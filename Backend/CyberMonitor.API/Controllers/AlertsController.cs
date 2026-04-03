using System.Security.Claims;
using CyberMonitor.API.Data;
using CyberMonitor.API.Extensions;
using CyberMonitor.API.Hubs;
using CyberMonitor.API.Models;
using CyberMonitor.API.Models.DTOs;
using CyberMonitor.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace CyberMonitor.API.Controllers;

[ApiController]
[Route("api/alerts")]
public class AlertsController : ControllerBase
{
    private readonly CyberMonitorDbContext _db;
    private readonly IHubContext<AlertHub, IAlertHub> _alertHub;
    private readonly IEmailService _emailService;
    private readonly ILogger<AlertsController> _logger;

    public AlertsController(
        CyberMonitorDbContext db,
        IHubContext<AlertHub, IAlertHub> alertHub,
        IEmailService emailService,
        ILogger<AlertsController> logger)
    {
        _db = db;
        _alertHub = alertHub;
        _emailService = emailService;
        _logger = logger;
    }

    /// <summary>AI Engine gọi webhook này để tạo alert</summary>
    [HttpPost("trigger")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<AlertDto>>> TriggerAlert([FromBody] TriggerAlertRequest request)
    {
        // Ưu tiên TenantId từ request, fallback từ API Key middleware (AI Engine)
        var tenantId = request.TenantId ?? HttpContext.Items["TenantId"] as Guid?;

        if (!tenantId.HasValue)
        {
            _logger.LogError("TriggerAlert: TenantId is null. request.TenantId={ReqTid}, Items[TenantId]={CtxTid}",
                request.TenantId, HttpContext.Items["TenantId"]);
            return BadRequest(new ApiResponse<object>(false, "TenantId is required.", null));
        }

        try
        {
            var alert = new Alert
            {
                TenantId = tenantId.Value,
                ServerId = request.ServerId,
                Severity = request.Severity,
                AlertType = request.AlertType,
                Title = request.Title,
                Description = request.Description,
                SourceIp = request.SourceIp,
                TargetAsset = request.TargetAsset,
                MitreTactic = request.MitreTactic,
                MitreTechnique = request.MitreTechnique,
                AnomalyScore = request.AnomalyScore,
                RecommendedAction = request.RecommendedAction,
                Status = "Open"
            };

            _db.Alerts.Add(alert);
            await _db.SaveChangesAsync();

            if (request.ServerId.HasValue)
            {
                var server = await _db.Servers.FindAsync(request.ServerId.Value);
                if (server != null && request.Severity is "High" or "Critical")
                    server.Status = "Warning";
                await _db.SaveChangesAsync();
            }

            var ticket = await CreateAutoTicket(alert);
            await SendAlertNotifications(alert, ticket);
            await _alertHub.Clients.Group(tenantId.Value.ToString()).ReceiveAlert(MapAlertDto(alert));

            _logger.LogWarning("ALERT TRIGGERED: {Type} - {Title} | Severity: {Severity} | Source: {SourceIp}",
                request.AlertType, request.Title, request.Severity, request.SourceIp);

            return Ok(new ApiResponse<AlertDto>(true, "Alert đã được tạo!", MapAlertDto(alert)));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TriggerAlert failed: {Message} | Inner: {Inner}",
                ex.Message, ex.InnerException?.Message);
            return StatusCode(500, new ApiResponse<object>(false, $"Lỗi: {ex.InnerException?.Message ?? ex.Message}", null));
        }
    }

    /// <summary>Lấy danh sách alerts</summary>
    [HttpGet]
    [Authorize]
    public async Task<ActionResult<ApiResponse<PagedResult<AlertDto>>>> GetAlerts(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? severity = null,
        [FromQuery] string? status = null,
        [FromQuery] string? alertType = null,
        [FromQuery] DateTime? fromDate = null,
        [FromQuery] DateTime? toDate = null)
    {
        var tenantId = GetTenantId();
        var role = GetUserRole();

        IQueryable<Alert> query = _db.Alerts
            .Include(a => a.Server)
            .Include(a => a.AcknowledgedByUser)
            .Include(a => a.ResolvedByUser);

        if (role != "SuperAdmin")
        {
            if (tenantId.HasValue)
                query = query.Where(a => a.TenantId == tenantId.Value);
            else
                return Forbid();
        }

        if (!string.IsNullOrEmpty(severity))
            query = query.Where(a => a.Severity == severity);
        if (!string.IsNullOrEmpty(status))
            query = query.Where(a => a.Status == status);
        if (!string.IsNullOrEmpty(alertType))
            query = query.Where(a => a.AlertType == alertType);
        if (fromDate.HasValue)
            query = query.Where(a => a.CreatedAt >= fromDate.Value);
        if (toDate.HasValue)
            query = query.Where(a => a.CreatedAt <= toDate.Value);

        var totalCount = await query.CountAsync();
        var items = await query
            .OrderByDescending(a => a.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return Ok(new ApiResponse<PagedResult<AlertDto>>(true, "OK", new PagedResult<AlertDto>(
            items.Select(MapAlertDto).ToList(),
            totalCount,
            page,
            pageSize,
            (int)Math.Ceiling(totalCount / (double)pageSize)
        )));
    }

    /// <summary>Lấy chi tiết alert</summary>
    [HttpGet("{id:guid}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<AlertDto>>> GetAlert(Guid id)
    {
        var tenantId = GetTenantId();
        var role = GetUserRole();

        var alert = await _db.Alerts
            .Include(a => a.Server)
            .Include(a => a.AcknowledgedByUser)
            .Include(a => a.ResolvedByUser)
            .FirstOrDefaultAsync(a => a.Id == id);

        if (alert == null)
            return NotFound(new ApiResponse<AlertDto>(false, "Alert không tìm thấy.", null));

        if (role != "SuperAdmin" && alert.TenantId != tenantId)
            return Forbid();

        return Ok(new ApiResponse<AlertDto>(true, "OK", MapAlertDto(alert)));
    }

    /// <summary>Cập nhật trạng thái alert</summary>
    [HttpPut("{id:guid}/status")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<AlertDto>>> UpdateAlertStatus(Guid id, [FromBody] UpdateAlertStatusRequest request)
    {
        var tenantId = GetTenantId();
        var role = GetUserRole();

        var alert = await _db.Alerts
            .Include(a => a.Server)
            .Include(a => a.AcknowledgedByUser)
            .Include(a => a.ResolvedByUser)
            .FirstOrDefaultAsync(a => a.Id == id);

        if (alert == null)
            return NotFound(new ApiResponse<AlertDto>(false, "Alert không tìm thấy.", null));

        if (role != "SuperAdmin" && alert.TenantId != tenantId)
            return Forbid();

        var userId = GetUserId();

        alert.Status = request.Status;
        if (request.Status == "Acknowledged")
            alert.AcknowledgedBy = request.UpdatedBy ?? userId;
        if (request.Status == "Resolved")
            alert.ResolvedBy = request.UpdatedBy ?? userId;

        await _db.SaveChangesAsync();

        var dto = MapAlertDto(alert);
        await _alertHub.Clients.Group(alert.TenantId.ToString()).ReceiveAlert(dto);

        return Ok(new ApiResponse<AlertDto>(true, $"Alert status updated to {request.Status}", dto));
    }

    /// <summary>Xóa alert</summary>
    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "SuperAdmin,Admin")]
    public async Task<ActionResult<ApiResponse<object>>> DeleteAlert(Guid id)
    {
        var tenantId = GetTenantId();
        var role = GetUserRole();

        var alert = await _db.Alerts.FindAsync(id);
        if (alert == null)
            return NotFound(new ApiResponse<object>(false, "Alert không tìm thấy.", null));

        if (role != "SuperAdmin" && alert.TenantId != tenantId)
            return Forbid();

        _db.Alerts.Remove(alert);
        await _db.SaveChangesAsync();

        return Ok(new ApiResponse<object>(true, "Alert deleted successfully", null));
    }

    // --- Helpers ---

    private async Task<Ticket> CreateAutoTicket(Alert alert)
    {
        var ticketNumber = $"TK-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString("N")[..4].ToUpper()}";

        // Lấy user admin đầu tiên của tenant để gán CreatedBy (tránh FK violation)
        var adminUserId = await _db.Users
            .Where(u => u.TenantId == alert.TenantId && (u.Role == "Admin" || u.Role == "SuperAdmin"))
            .Select(u => (Guid?)u.Id)
            .FirstOrDefaultAsync();

        var ticket = new Ticket
        {
            TenantId = alert.TenantId,
            AlertId = alert.Id,
            TicketNumber = ticketNumber,
            Title = $"[Auto] {alert.Title}",
            Description = alert.Description,
            Priority = alert.Severity,
            Status = "OPEN",
            Category = "Security",
            CreatedBy = adminUserId ?? alert.TenantId  // fallback = tenantId (không có FK ở đây)
        };

        _db.Tickets.Add(ticket);

        // Audit
        _db.AuditLogs.Add(new AuditLog
        {
            TenantId = alert.TenantId,
            Action = "AUTO_TICKET_CREATED",
            EntityType = "Ticket",
            EntityId = ticket.Id.ToString(),
            Details = $"Auto ticket {ticketNumber} created from alert {alert.AlertType}"
        });

        await _db.SaveChangesAsync();
        return ticket;
    }

    private async Task SendAlertNotifications(Alert alert, Ticket ticket)
    {
        var users = await _db.Users
            .Where(u => u.TenantId == alert.TenantId && (u.Role == "Admin" || u.Role == "SuperAdmin"))
            .ToListAsync();

        var server = await _db.Servers.FindAsync(alert.ServerId);

        foreach (var user in users)
        {
            // DB notification
            _db.Notifications.Add(new Notification
            {
                TenantId = alert.TenantId,
                UserId = user.Id,
                Title = $"[{alert.Severity}] {alert.AlertType}",
                Message = alert.Title,
                Type = alert.Severity == "Critical" ? "Alert" : "Warning",
                Link = $"/dashboard/tickets/{ticket.Id}"
            });

            // Email
            await _emailService.SendAlertEmailAsync(alert.TenantId, user.Email, alert, server);
        }

        await _db.SaveChangesAsync();
    }

    private static AlertDto MapAlertDto(Alert a) => new(
        a.Id,
        a.TenantId,
        a.ServerId,
        a.Server?.Name,
        a.Severity,
        a.AlertType,
        a.Title,
        a.Description,
        a.SourceIp,
        a.TargetAsset,
        a.MitreTactic,
        a.MitreTechnique,
        a.Status,
        a.AnomalyScore,
        a.RecommendedAction,
        a.CreatedAt,
        a.AcknowledgedAt,
        a.ResolvedAt,
        a.AcknowledgedByUser?.FullName,
        a.ResolvedByUser?.FullName
    );

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
}
