using System.Security.Claims;
using CyberMonitor.API.Data;
using CyberMonitor.API.Extensions;
using CyberMonitor.API.Models;
using CyberMonitor.API.Models.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CyberMonitor.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ReportsController : ControllerBase
{
    private readonly CyberMonitorDbContext _db;
    private readonly ILogger<ReportsController> _logger;

    public ReportsController(CyberMonitorDbContext db, ILogger<ReportsController> logger)
    {
        _db = db;
        _logger = logger;
    }

    /// <summary>Xuất báo cáo Excel</summary>
    [HttpGet("export-excel")]
    [Authorize]
    public async Task<IActionResult> ExportExcel(
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate,
        [FromQuery] Guid? tenantId)
    {
        var now = DateTime.UtcNow;
        var start = startDate ?? now.AddDays(-30);
        var end = endDate ?? now;

        var currentTenantId = GetTenantId();
        var role = GetUserRole();

        IQueryable<Alert> alertQuery = _db.Alerts
            .Include(a => a.Server)
            .Include(a => a.AcknowledgedByUser)
            .Include(a => a.ResolvedByUser)
            .AsQueryable();

        IQueryable<Ticket> ticketQuery = _db.Tickets
            .Include(t => t.AssignedToUser)
            .Include(t => t.CreatedByUser)
            .Include(t => t.Comments)
                .ThenInclude(c => c.User)
            .AsQueryable();

        // Filter by tenant
        if (role == "SuperAdmin")
        {
            if (tenantId.HasValue)
            {
                alertQuery = alertQuery.Where(a => a.TenantId == tenantId);
                ticketQuery = ticketQuery.Where(t => t.TenantId == tenantId);
            }
        }
        else if (role == "Admin")
        {
            if (currentTenantId.HasValue)
            {
                alertQuery = alertQuery.Where(a => a.TenantId == currentTenantId);
                ticketQuery = ticketQuery.Where(t => t.TenantId == currentTenantId);
            }
        }
        else
        {
            return Forbid();
        }

        // Date filter
        alertQuery = alertQuery.Where(a => a.CreatedAt >= start && a.CreatedAt <= end);
        ticketQuery = ticketQuery.Where(t => t.CreatedAt >= start && t.CreatedAt <= end);

        // Load data
        var alerts = await alertQuery.OrderByDescending(a => a.CreatedAt).ToListAsync();
        var tickets = await ticketQuery.OrderByDescending(t => t.CreatedAt).ToListAsync();

        // Statistics
        var topAttackers = alerts
            .Where(a => !string.IsNullOrEmpty(a.SourceIp) && a.Status == "Resolved")
            .GroupBy(a => a.SourceIp!)
            .Select(g => new ThreatSourceDto(g.Key, g.Count(), g.GroupBy(a => a.AlertType).OrderByDescending(x => x.Count()).First().Key))
            .OrderByDescending(x => x.AttackCount)
            .Take(10)
            .ToList();

        var alertsByType = alerts
            .GroupBy(a => a.AlertType)
            .Select(g => new AlertTypeStatDto(g.Key, g.Count(), g.First().Severity))
            .OrderByDescending(x => x.Count)
            .ToList();

        var totalAlerts = alerts.Count;
        var openAlerts = alerts.Count(a => a.Status == "Open");
        var resolvedAlerts = alerts.Count(a => a.Status == "Resolved");
        var criticalAlerts = alerts.Count(a => a.Severity == "Critical");
        var totalTickets = tickets.Count;
        var openTickets = tickets.Count(t => t.Status == "OPEN");
        var closedTickets = tickets.Count(t => t.Status == "CLOSED");
        var inProgressTickets = tickets.Count(t => t.Status == "IN_PROGRESS");

        var tenantName = "CyberMonitor SOC";
        if (currentTenantId.HasValue)
        {
            var tenant = await _db.Tenants.FindAsync(currentTenantId.Value);
            tenantName = tenant?.CompanyName ?? tenantName;
        }

        // Build Excel using ClosedXML
        var workbook = new ClosedXML.Excel.XLWorkbook();
        var wsSummary = workbook.Worksheets.Add("Tổng Quan");

        // --- Summary Sheet ---
        wsSummary.Cell("A1").Value = "CYBERMONITOR SOC - BÁO CÁO BẢO MẬT";
        wsSummary.Cell("A1").Style.Font.FontSize = 18;
        wsSummary.Cell("A1").Style.Font.Bold = true;
        wsSummary.Range("A1:D1").Merge();

        wsSummary.Cell("A2").Value = $"Công ty: {tenantName}";
        wsSummary.Cell("A3").Value = $"Thời gian: {start:dd/MM/yyyy} - {end:dd/MM/yyyy}";
        wsSummary.Cell("A4").Value = $"Ngày xuất: {DateTime.UtcNow:dd/MM/yyyy HH:mm} UTC";
        wsSummary.Range("A2:D4").Style.Font.FontSize = 11;

        wsSummary.Cell("A6").Value = "CHỈ SỐ TỔNG QUAN";
        wsSummary.Cell("A6").Style.Font.Bold = true;
        wsSummary.Cell("A6").Style.Font.FontSize = 13;
        wsSummary.Range("A6:B6").Merge();

        var summaryRows = new[]
        {
            ("Tổng cảnh báo", totalAlerts, "Cảnh báo đã được ghi nhận"),
            ("Cảnh báo mở", openAlerts, "Đang chờ xử lý"),
            ("Cảnh báo đã xử lý", resolvedAlerts, "Đã được giải quyết"),
            ("Cảnh báo nguy hiểm", criticalAlerts, "Cấp độ Critical"),
            ("", 0, ""),
            ("Tổng phiếu sự cố", totalTickets, "Tổng số ticket"),
            ("Ticket đang mở", openTickets, "Chờ xử lý"),
            ("Ticket đang xử lý", inProgressTickets, "Đang được assign"),
            ("Ticket đã đóng", closedTickets, "Đã hoàn thành"),
        };

        var summaryColor = new Dictionary<string, string>
        {
            ["Cảnh báo nguy hiểm"] = "E53E3E",
            ["Cảnh báo mở"] = "DD6B20",
            ["Ticket đang mở"] = "DD6B20",
            ["Cảnh báo đã xử lý"] = "38A169",
            ["Ticket đã đóng"] = "38A169"
        };

        int row = 7;
        foreach (var (label, value, note) in summaryRows)
        {
            if (string.IsNullOrEmpty(label)) { row++; continue; }
            wsSummary.Cell($"A{row}").Value = label;
            wsSummary.Cell($"A{row}").Style.Font.Bold = true;
            wsSummary.Cell($"B{row}").Value = value;

            if (summaryColor.TryGetValue(label, out var hexColor))
            {
                var color = System.Drawing.ColorTranslator.FromHtml($"#{hexColor}");
                wsSummary.Cell($"B{row}").Style.Font.FontColor = ClosedXML.Excel.XLColor.FromArgb(color.A, color.R, color.G, color.B);
                wsSummary.Cell($"B{row}").Style.Font.Bold = true;
            }

            wsSummary.Cell($"C{row}").Value = note;
            wsSummary.Cell($"C{row}").Style.Font.FontColor = ClosedXML.Excel.XLColor.FromHtml("#718096");
            row++;
        }

        // Top Attackers
        row += 2;
        wsSummary.Cell($"A{row}").Value = "TOP NGUỒN TẤN CÔNG";
        wsSummary.Cell($"A{row}").Style.Font.Bold = true;
        wsSummary.Range($"A{row}:C{row}").Merge();

        row++;
        wsSummary.Cell($"A{row}").Value = "IP Address";
        wsSummary.Cell($"B{row}").Value = "Số lần tấn công";
        wsSummary.Cell($"C{row}").Value = "Loại tấn công phổ biến";
        wsSummary.Range($"A{row}:C{row}").Style.Font.Bold = true;
        wsSummary.Range($"A{row}:C{row}").Style.Fill.BackgroundColor = ClosedXML.Excel.XLColor.FromHtml("#2D3748");
        wsSummary.Range($"A{row}:C{row}").Style.Font.FontColor = ClosedXML.Excel.XLColor.FromHtml("#FFFFFF");

        row++;
        foreach (var attacker in topAttackers)
        {
            wsSummary.Cell($"A{row}").Value = attacker.IpAddress;
            wsSummary.Cell($"B{row}").Value = attacker.AttackCount;
            wsSummary.Cell($"C{row}").Value = attacker.MostCommonType;
            if (attacker.AttackCount > 5)
            {
                wsSummary.Range($"A{row}:C{row}").Style.Fill.BackgroundColor = ClosedXML.Excel.XLColor.FromHtml("#FED7D7");
            }
            row++;
        }

        // Alerts by Type
        row += 2;
        wsSummary.Cell($"A{row}").Value = "PHÂN BỔ CẢNH BÁO THEO LOẠI";
        wsSummary.Cell($"A{row}").Style.Font.Bold = true;
        row++;
        wsSummary.Cell($"A{row}").Value = "Loại cảnh báo";
        wsSummary.Cell($"B{row}").Value = "Số lượng";
        wsSummary.Cell($"C{row}").Value = "Mức độ nghiêm trọng";
        wsSummary.Range($"A{row}:C{row}").Style.Font.Bold = true;
        row++;
        foreach (var at in alertsByType)
        {
            wsSummary.Cell($"A{row}").Value = at.AlertType;
            wsSummary.Cell($"B{row}").Value = at.Count;
            wsSummary.Cell($"C{row}").Value = at.Severity;

            var sevColor = at.Severity switch
            {
                "Critical" => "#E53E3E",
                "High" => "DD6B20",
                "Medium" => "D69E2E",
                _ => "38A169"
            };
            wsSummary.Cell($"C{row}").Style.Font.FontColor = ClosedXML.Excel.XLColor.FromHtml(sevColor);
            wsSummary.Cell($"C{row}").Style.Font.Bold = true;
            row++;
        }

        wsSummary.Columns().AdjustToContents();

        // --- Alerts Sheet ---
        var wsAlerts = workbook.Worksheets.Add("Chi Tiết Cảnh Báo");
        wsAlerts.Cell("A1").Value = "CHI TIẾT CẢNH BÁO BẢO MẬT";
        wsAlerts.Cell("A1").Style.Font.FontSize = 14;
        wsAlerts.Cell("A1").Style.Font.Bold = true;
        wsAlerts.Range("A1:L1").Merge();

        var alertHeaders = new[] { "ID", "Thời gian", "Loại", "Mức độ", "Tiêu đề", "Server", "IP Nguồn",
            "MITRE Tactic", "MITRE Technique", "Trạng thái", "Người tiếp nhận", "Người xử lý" };

        for (int i = 0; i < alertHeaders.Length; i++)
        {
            wsAlerts.Cell(3, i + 1).Value = alertHeaders[i];
            wsAlerts.Cell(3, i + 1).Style.Font.Bold = true;
            wsAlerts.Cell(3, i + 1).Style.Fill.BackgroundColor = ClosedXML.Excel.XLColor.FromHtml("#1A202C");
            wsAlerts.Cell(3, i + 1).Style.Font.FontColor = ClosedXML.Excel.XLColor.FromHtml("#FFFFFF");
        }

        int alertRow = 4;
        foreach (var alert in alerts)
        {
            wsAlerts.Cell(alertRow, 1).Value = alert.Id.ToString()[..8];
            wsAlerts.Cell(alertRow, 2).Value = alert.CreatedAt.ToString("dd/MM/yyyy HH:mm");
            wsAlerts.Cell(alertRow, 3).Value = alert.AlertType;
            wsAlerts.Cell(alertRow, 4).Value = alert.Severity;
            wsAlerts.Cell(alertRow, 5).Value = alert.Title;
            wsAlerts.Cell(alertRow, 6).Value = alert.Server?.Name ?? "N/A";
            wsAlerts.Cell(alertRow, 7).Value = alert.SourceIp ?? "N/A";
            wsAlerts.Cell(alertRow, 8).Value = alert.MitreTactic ?? "";
            wsAlerts.Cell(alertRow, 9).Value = alert.MitreTechnique ?? "";
            wsAlerts.Cell(alertRow, 10).Value = alert.Status;
            wsAlerts.Cell(alertRow, 11).Value = alert.AcknowledgedByUser?.FullName ?? "";
            wsAlerts.Cell(alertRow, 12).Value = alert.ResolvedByUser?.FullName ?? "";

            // Color severity
            var sevFill = alert.Severity switch
            {
                "Critical" => ClosedXML.Excel.XLColor.FromHtml("#FED7D7"),
                "High" => ClosedXML.Excel.XLColor.FromHtml("#FEEBC8"),
                "Medium" => ClosedXML.Excel.XLColor.FromHtml("#FAF089"),
                _ => ClosedXML.Excel.XLColor.FromHtml("#C6F6D5")
            };
            wsAlerts.Cell(alertRow, 4).Style.Fill.BackgroundColor = sevFill;

            // Color status
            var statusFill = alert.Status switch
            {
                "Resolved" => ClosedXML.Excel.XLColor.FromHtml("#C6F6D5"),
                "Open" => ClosedXML.Excel.XLColor.FromHtml("#FED7D7"),
                "Investigating" => ClosedXML.Excel.XLColor.FromHtml("#FEEBC8"),
                _ => ClosedXML.Excel.XLColor.FromHtml("#E2E8F0")
            };
            wsAlerts.Cell(alertRow, 10).Style.Fill.BackgroundColor = statusFill;

            alertRow++;
        }

        wsAlerts.Columns().AdjustToContents();

        // --- Tickets Sheet ---
        var wsTickets = workbook.Worksheets.Add("Phiếu Sự Cố");
        wsTickets.Cell("A1").Value = "DANH SÁCH PHIẾU SỰ CỐ";
        wsTickets.Cell("A1").Style.Font.FontSize = 14;
        wsTickets.Cell("A1").Style.Font.Bold = true;
        wsTickets.Range("A1:J1").Merge();

        var ticketHeaders = new[] { "Mã Ticket", "Tiêu đề", "Độ ưu tiên", "Trạng thái", "Người phụ trách",
            "Người tạo", "Ngày tạo", "Ngày đóng", "Danh mục", "Số bình luận" };

        for (int i = 0; i < ticketHeaders.Length; i++)
        {
            wsTickets.Cell(3, i + 1).Value = ticketHeaders[i];
            wsTickets.Cell(3, i + 1).Style.Font.Bold = true;
            wsTickets.Cell(3, i + 1).Style.Fill.BackgroundColor = ClosedXML.Excel.XLColor.FromHtml("#2B6CB0");
            wsTickets.Cell(3, i + 1).Style.Font.FontColor = ClosedXML.Excel.XLColor.FromHtml("#FFFFFF");
        }

        int ticketRow = 4;
        foreach (var ticket in tickets)
        {
            wsTickets.Cell(ticketRow, 1).Value = ticket.TicketNumber;
            wsTickets.Cell(ticketRow, 1).Style.Font.Bold = true;
            wsTickets.Cell(ticketRow, 1).Style.Font.FontColor = ClosedXML.Excel.XLColor.FromHtml("#3182CE");
            wsTickets.Cell(ticketRow, 2).Value = ticket.Title;
            wsTickets.Cell(ticketRow, 3).Value = ticket.Priority;
            wsTickets.Cell(ticketRow, 4).Value = ticket.Status;
            wsTickets.Cell(ticketRow, 5).Value = ticket.AssignedToUser?.FullName ?? "Chưa phân công";
            wsTickets.Cell(ticketRow, 6).Value = ticket.CreatedByUser?.FullName ?? "";
            wsTickets.Cell(ticketRow, 7).Value = ticket.CreatedAt.ToString("dd/MM/yyyy HH:mm");
            wsTickets.Cell(ticketRow, 8).Value = ticket.ClosedAt?.ToString("dd/MM/yyyy HH:mm") ?? "";
            wsTickets.Cell(ticketRow, 9).Value = ticket.Category ?? "";
            wsTickets.Cell(ticketRow, 10).Value = ticket.Comments?.Count ?? 0;

            // Priority color
            var prioFill = ticket.Priority switch
            {
                "Critical" => ClosedXML.Excel.XLColor.FromHtml("#FED7D7"),
                "High" => ClosedXML.Excel.XLColor.FromHtml("#FEEBC8"),
                "Medium" => ClosedXML.Excel.XLColor.FromHtml("#FAF089"),
                _ => ClosedXML.Excel.XLColor.FromHtml("#C6F6D5")
            };
            wsTickets.Cell(ticketRow, 3).Style.Fill.BackgroundColor = prioFill;

            // Status color
            var statusFill2 = ticket.Status switch
            {
                "CLOSED" => ClosedXML.Excel.XLColor.FromHtml("#C6F6D5"),
                "RESOLVED" => ClosedXML.Excel.XLColor.FromHtml("#9AE6B4"),
                "IN_PROGRESS" => ClosedXML.Excel.XLColor.FromHtml("#FBD38D"),
                "OPEN" => ClosedXML.Excel.XLColor.FromHtml("#FEB2B2"),
                _ => ClosedXML.Excel.XLColor.FromHtml("#E2E8F0")
            };
            wsTickets.Cell(ticketRow, 4).Style.Fill.BackgroundColor = statusFill2;

            ticketRow++;
        }

        wsTickets.Columns().AdjustToContents();

        // --- Attack Sources Sheet ---
        if (topAttackers.Count > 0)
        {
            var wsAttack = workbook.Worksheets.Add("Nguồn Tấn Công");
            wsAttack.Cell("A1").Value = "TOP NGUỒN TẤN CÔNG NGUY HIỂM";
            wsAttack.Cell("A1").Style.Font.FontSize = 14;
            wsAttack.Cell("A1").Style.Font.Bold = true;
            wsAttack.Range("A1:C1").Merge();

            wsAttack.Cell(3, 1).Value = "IP Address";
            wsAttack.Cell(3, 2).Value = "Số lần tấn công";
            wsAttack.Cell(3, 3).Value = "Loại tấn công";
            wsAttack.Range("A3:C3").Style.Font.Bold = true;
            wsAttack.Range("A3:C3").Style.Fill.BackgroundColor = ClosedXML.Excel.XLColor.FromHtml("#C53030");
            wsAttack.Range("A3:C3").Style.Font.FontColor = ClosedXML.Excel.XLColor.FromHtml("#FFFFFF");

            int atRow = 4;
            foreach (var attacker in topAttackers)
            {
                wsAttack.Cell(atRow, 1).Value = attacker.IpAddress;
                wsAttack.Cell(atRow, 1).Style.Font.Bold = true;
                wsAttack.Cell(atRow, 1).Style.Font.FontColor = ClosedXML.Excel.XLColor.FromHtml("#C53030");
                wsAttack.Cell(atRow, 2).Value = attacker.AttackCount;
                wsAttack.Cell(atRow, 3).Value = attacker.MostCommonType;

                var dangerColor = attacker.AttackCount > 10
                    ? ClosedXML.Excel.XLColor.FromHtml("#FED7D7")
                    : ClosedXML.Excel.XLColor.FromHtml("#FEEBC8");
                wsAttack.Range($"A{atRow}:C{atRow}").Style.Fill.BackgroundColor = dangerColor;

                atRow++;
            }

            wsAttack.Columns().AdjustToContents();
        }

        var fileName = $"CyberMonitor_Report_{tenantName.Replace(" ", "_")}_{DateTime.UtcNow:yyyyMMddHHmmss}.xlsx";
        using var ms = new MemoryStream();
        workbook.SaveAs(ms);
        ms.Position = 0;

        _logger.LogInformation("Report exported: {FileName}", fileName);

        return File(ms.ToArray(),
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            fileName);
    }

    /// <summary>Lấy dashboard summary - OPTIMIZED</summary>
    [HttpGet("dashboard")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<DashboardSummary>>> GetDashboard()
    {
        var tenantId = GetTenantId();
        var role = GetUserRole();

        // Build base queries with tenant filter
        IQueryable<Server> serverQuery = _db.Servers.AsNoTracking();
        IQueryable<Alert> alertQuery = _db.Alerts.AsNoTracking();
        IQueryable<Ticket> ticketQuery = _db.Tickets.AsNoTracking();
        IQueryable<TrafficLog> trafficQuery = _db.TrafficLogs.AsNoTracking();

        if (role == "Admin")
        {
            if (!tenantId.HasValue) return Forbid();
            serverQuery = serverQuery.Where(s => s.TenantId == tenantId);
            alertQuery = alertQuery.Where(a => a.TenantId == tenantId);
            ticketQuery = ticketQuery.Where(t => t.TenantId == tenantId);
            trafficQuery = trafficQuery.Where(t => t.TenantId == tenantId);
        }
        else if (role == "User")
        {
            return Forbid();
        }

        var today = DateTime.UtcNow.Date;
        var oneHourAgo = DateTime.UtcNow.AddHours(-1);
        var oneDayAgo = DateTime.UtcNow.AddHours(-24);

        // Execute queries SEQUENTIALLY to avoid DbContext concurrency issues
        // EF Core doesn't support parallel queries on same DbContext instance
        
        // Server list
        var servers = await serverQuery.ToListAsync();
        
        // Alert counts
        var openAlertsCount = await alertQuery.Where(a => a.Status == "Open").CountAsync();
        var totalAlertsCount = await alertQuery.CountAsync();
        var criticalAlertsCount = await alertQuery.Where(a => a.Severity == "Critical" && a.Status == "Open").CountAsync();
        
        // Ticket counts
        var openTicketsCount = await ticketQuery.Where(t => t.Status == "OPEN").CountAsync();
        var closedTicketsCount = await ticketQuery.Where(t => t.Status == "CLOSED").CountAsync();
        var todayClosedCount = await ticketQuery.Where(t => t.ClosedAt >= today).CountAsync();
        
        // Recent alerts
        var recentAlerts = await alertQuery
            .Include(a => a.Server)
            .OrderByDescending(a => a.CreatedAt)
            .Take(10)
            .ToListAsync();
        
        // Bandwidth
        var bandwidthIn = await trafficQuery.Where(t => t.Timestamp >= oneHourAgo).SumAsync(t => t.BytesIn);
        var bandwidthOut = await trafficQuery.Where(t => t.Timestamp >= oneHourAgo).SumAsync(t => t.BytesOut);
        
        // Traffic data (last 24h) - aggregated in DB
        var trafficGroups = await trafficQuery
            .Where(t => t.Timestamp >= oneDayAgo)
            .GroupBy(t => new { Hour = t.Timestamp.Hour })
            .Select(g => new {
                Hour = g.Key.Hour,
                Requests = g.Count(),
                Attacks = g.Count(l => l.IsAnomaly)
            })
            .ToListAsync();
        
        // Attack types
        var attackTypeGroups = await alertQuery
            .GroupBy(a => a.AlertType ?? "Unknown")
            .Select(g => new { Type = g.Key, Count = g.Count() })
            .OrderByDescending(g => g.Count)
            .Take(10)
            .ToListAsync();
        
        // MITRE techniques
        var mitreGroups = await alertQuery
            .Where(a => a.MitreTechnique != null)
            .GroupBy(a => a.MitreTechnique!)
            .Select(g => new {
                Tech = g.Key,
                Count = g.Count(),
                Severity = g.Max(a => a.Severity)
            })
            .OrderByDescending(g => g.Count)
            .Take(6)
            .ToListAsync();

        // Build traffic data from aggregated results
        var now = DateTime.UtcNow;
        var trafficData = new List<TrafficPointDto>();
        for (int i = 23; i >= 0; i--)
        {
            var hourStart = now.AddHours(-i);
            var hourValue = hourStart.Hour;
            var match = trafficGroups.FirstOrDefault(g => g.Hour == hourValue);
            trafficData.Add(new TrafficPointDto(
                hourStart.ToString("HH:mm"),
                match?.Requests ?? 0,
                match?.Attacks ?? 0
            ));
        }

        // Build attack types breakdown
        var colors = new[] { "#ef4444", "#f97316", "#3b82f6", "#8b5cf6", "#10b981", "#f59e0b" };
        var totalAttacks = attackTypeGroups.Sum(g => g.Count);
        var attackTypes = attackTypeGroups
            .Select((g, idx) => new AttackTypeDto(
                g.Type,
                totalAttacks > 0 ? Math.Round((decimal)g.Count / totalAttacks * 100, 1) : 0,
                colors[idx % colors.Length]
            ))
            .ToList();

        // Build MITRE data
        var mitreData = mitreGroups
            .Select(m => new MitrelDto(
                m.Tech,
                GetMitreName(m.Tech),
                m.Count,
                MapSeverity(m.Severity)
            ))
            .ToList();

        var summary = new DashboardSummary(
            servers.Count,
            servers.Count(s => s.Status == "Online"),
            servers.Count(s => s.Status == "Offline"),
            openAlertsCount,
            totalAlertsCount,
            criticalAlertsCount,
            openTicketsCount,
            closedTicketsCount,
            todayClosedCount,
            bandwidthIn + bandwidthOut,
            closedTicketsCount > 0 ? 120m : 85m,
            bandwidthIn,
            bandwidthOut,
            servers.Select(s => new ServerHealthDto(
                s.Id, s.Name, s.IpAddress, s.Status, s.CpuUsage,
                s.RamUsage, s.DiskUsage, s.LastSeenAt
            )).ToList(),
            recentAlerts.Select(a => new AlertDto(
                a.Id, a.TenantId, a.ServerId, a.Server?.Name, a.Severity,
                a.AlertType, a.Title, a.Description, a.SourceIp, a.TargetAsset,
                a.MitreTactic, a.MitreTechnique, a.Status, a.AnomalyScore,
                a.RecommendedAction, a.CreatedAt, a.AcknowledgedAt, a.ResolvedAt,
                a.AcknowledgedByUser?.FullName, a.ResolvedByUser?.FullName
            )).ToList(),
            trafficData,
            attackTypes,
            mitreData
        );

        return Ok(new ApiResponse<DashboardSummary>(true, "OK", summary));
    }

    /// <summary>Lấy subscription info</summary>
    [HttpGet("subscription")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<SubscriptionDto>>> GetSubscription()
    {
        var tenantId = GetTenantId();
        var role = GetUserRole();

        if (role == "SuperAdmin")
        {
            if (!tenantId.HasValue)
                return Ok(new ApiResponse<SubscriptionDto>(true, "OK", new SubscriptionDto(
                    Guid.Empty, Guid.Empty, "Unlimited", 0, 999, 0, "Active",
                    DateTime.UtcNow, DateTime.UtcNow.AddYears(100), 99999
                )));
        }

        if (!tenantId.HasValue) return Forbid();

        var subscription = await _db.Subscriptions
            .Where(s => s.TenantId == tenantId)
            .OrderByDescending(s => s.EndDate)
            .FirstOrDefaultAsync();

        if (subscription == null)
            return NotFound(new ApiResponse<SubscriptionDto>(false, "No subscription found.", null));

        var usedServers = await _db.Servers.CountAsync(s => s.TenantId == tenantId);

        return Ok(new ApiResponse<SubscriptionDto>(true, "OK", new SubscriptionDto(
            subscription.Id,
            subscription.TenantId,
            subscription.PlanName,
            subscription.PlanPrice,
            subscription.MaxServers,
            usedServers,
            subscription.Status,
            subscription.StartDate,
            subscription.EndDate,
            Math.Max(0, (subscription.EndDate - DateTime.UtcNow).Days)
        )));
    }

    /// <summary>Lấy notifications</summary>
    [HttpGet("notifications")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<PagedResult<NotificationDto>>>> GetNotifications(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var userId = GetUserId();

        var query = _db.Notifications.Where(n => n.UserId == userId);
        var totalCount = await query.CountAsync();

        var items = await query
            .OrderByDescending(n => n.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(n => new NotificationDto(n.Id, n.TenantId, n.UserId, n.Title, n.Message, n.Type, n.IsRead, n.Link, n.CreatedAt))
            .ToListAsync();

        return Ok(new ApiResponse<PagedResult<NotificationDto>>(true, "OK", new PagedResult<NotificationDto>(
            items, totalCount, page, pageSize, (int)Math.Ceiling(totalCount / (double)pageSize)
        )));
    }

    /// <summary>Đánh dấu notification đã đọc</summary>
    [HttpPut("notifications/{id:guid}/read")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<object>>> MarkNotificationRead(Guid id)
    {
        var userId = GetUserId();
        var notification = await _db.Notifications.FirstOrDefaultAsync(n => n.Id == id && n.UserId == userId);

        if (notification == null)
            return NotFound(new ApiResponse<object>(false, "Notification not found.", null));

        notification.IsRead = true;
        await _db.SaveChangesAsync();

        return Ok(new ApiResponse<object>(true, "OK", null));
    }

    /// <summary>Lấy audit logs</summary>
    [HttpGet("audit-logs")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<PagedResult<AuditLogDto>>>> GetAuditLogs(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? action = null)
    {
        var tenantId = GetTenantId();
        var role = GetUserRole();

        if (role == "User")
            return Forbid();

        IQueryable<AuditLog> query = _db.AuditLogs.Include(a => a.User);

        if (role == "Admin")
        {
            if (!tenantId.HasValue) return Forbid();
            query = query.Where(a => a.TenantId == tenantId);
        }

        if (!string.IsNullOrEmpty(action))
            query = query.Where(a => a.Action.Contains(action));

        var totalCount = await query.CountAsync();
        var items = await query
            .OrderByDescending(a => a.Timestamp)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(a => new AuditLogDto(a.Id, a.TenantId, a.UserId, a.User != null ? a.User.FullName : null, a.Action,a.EntityType, a.EntityId, a.IpAddress, a.Timestamp, a.Details))
            .ToListAsync();

        return Ok(new ApiResponse<PagedResult<AuditLogDto>>(true, "OK", new PagedResult<AuditLogDto>(
            items, totalCount, page, pageSize, (int)Math.Ceiling(totalCount / (double)pageSize)
        )));
    }

    private Guid GetUserId() =>
        Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? Guid.Empty.ToString());

    private Guid? GetTenantId()
    {
        if (HttpContext.Items.TryGetValue("TenantId", out var tenantObj) && tenantObj is Guid tenantFromKey)
            return tenantFromKey;
        var val = User.FindFirstValue("tenantId");
        return val != null ? Guid.Parse(val) : null;
    }

    private string GetUserRole() =>
        User.FindFirstValue(ClaimTypes.Role) ?? "User";

    private string GetMitreName(string technique)
    {
        var names = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            { "T1190", "Exploit Public-Facing App" },
            { "T1110", "Brute Force" },
            { "T1498", "Network Denial of Service" },
            { "T1059", "Command & Scripting Interpreter" },
            { "T1070", "Data Destruction" },
            { "T1047", "Windows Management Instrumentation" },
            { "T1055", "Process Injection" },
            { "T1566", "Phishing" },
            { "T1005", "Data from Local System" },
            { "T1041", "Exfiltration Over C2" },
        };
        return names.TryGetValue(technique, out var name) ? name : technique;
    }

    private string MapSeverity(string? severity)
    {
        return severity?.ToUpperInvariant() switch
        {
            "CRITICAL" => "Critical",
            "HIGH" => "High",
            "MEDIUM" => "Medium",
            _ => "Low"
        };
    }
}
