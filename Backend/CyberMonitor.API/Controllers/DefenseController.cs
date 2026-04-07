using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using CyberMonitor.API.Data;
using CyberMonitor.API.Extensions;
using CyberMonitor.API.Hubs;
using CyberMonitor.API.Models;
using CyberMonitor.API.Models.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace CyberMonitor.API.Controllers;

[ApiController]
[Route("api/defense")]
[Authorize]
public class DefenseController : ControllerBase
{
    private readonly CyberMonitorDbContext _db;
    private readonly IHubContext<AlertHub, IAlertHub> _alertHub;
    private readonly IHubContext<AgentHub, IAgentHub> _agentHub;
    private readonly ILogger<DefenseController> _logger;

    public DefenseController(
        CyberMonitorDbContext db,
        IHubContext<AlertHub, IAlertHub> alertHub,
        IHubContext<AgentHub, IAgentHub> agentHub,
        ILogger<DefenseController> logger)
    {
        _db = db;
        _alertHub = alertHub;
        _agentHub = agentHub;
        _logger = logger;
    }

    // ============================================================================
    // POST /api/defense/block-ip
    // AI Engine / Agent gọi khi phát hiện tấn công nghiêm trọng
    // ============================================================================
    [HttpPost("block-ip")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<object>>> BlockIP([FromBody] BlockIPRequest request)
    {
        // Ưu tiên: dùng TenantId từ request.ServerId (Agent/AI Engine)
        // Nếu không có, dùng TenantId từ API Key auth (middleware đã set context.Items)
        Guid effectiveTenantId;
        if (request.ServerId.HasValue)
        {
            // AI Engine / Agent chỉ truyền ServerId → tra TenantId từ Server
            var server = await _db.Servers.FindAsync(request.ServerId.Value);
            if (server == null)
                return NotFound(new ApiResponse<object>(false, $"Server {request.ServerId} not found.", null));
            effectiveTenantId = server.TenantId;
        }
        else
        {
            // Dùng TenantId từ API Key auth (middleware đặt vào context.Items)
            var tenantFromAuth = GetTenantId();
            if (!tenantFromAuth.HasValue)
                return BadRequest(new ApiResponse<object>(false, "TenantId không xác định được. Cần truyền ServerId hoặc dùng API Key có TenantId.", null));
            effectiveTenantId = tenantFromAuth.Value;
        }

        // Rate limit: max 10 blocks/minute per tenant
        var oneMinuteAgo = DateTime.UtcNow.AddMinutes(-1);
        var recentBlocks = await _db.BlockedIPs
            .Where(b => b.TenantId == effectiveTenantId && b.BlockedAt > oneMinuteAgo)
            .CountAsync();

        if (recentBlocks >= 10)
        {
            return BadRequest(new ApiResponse<object>(false, "Rate limit exceeded. Max 10 blocks per minute.", null));
        }

        // Check if already blocked — FILTER BY TENANT to prevent cross-tenant IDOR
        var existing = await _db.BlockedIPs
            .FirstOrDefaultAsync(b =>
                b.IpAddress == request.Ip &&
                b.IsActive &&
                b.TenantId == effectiveTenantId &&
                (request.ServerId.HasValue ? b.ServerId == request.ServerId : b.ServerId == null));

        if (existing != null)
        {
            existing.AttackType = request.AttackType ?? existing.AttackType;
            existing.Severity = request.Severity ?? existing.Severity;
            existing.Reason = request.Reason ?? existing.Reason;
            existing.BlockedAt = DateTime.UtcNow;
            existing.BlockedBy = request.BlockedBy ?? existing.BlockedBy;
            existing.IsActive = true;
            existing.ExpiresAt = request.BlockDurationMinutes.HasValue
                ? DateTime.UtcNow.AddMinutes(request.BlockDurationMinutes.Value)
                : existing.ExpiresAt;
            if (request.Score.HasValue)
                existing.AnomalyScore = request.Score;
            _db.BlockedIPs.Update(existing);
            await _db.SaveChangesAsync();

            // Push SignalR để Agent + Dashboard cập nhật
            var blockCmd = new BlockCommandDto
            {
                Ip = request.Ip,
                Reason = request.Reason ?? "AI Detection",
                AttackType = request.AttackType ?? "Unknown",
                Severity = request.Severity ?? "Medium",
                DurationMinutes = request.BlockDurationMinutes,
                BlockId = existing.Id,
                IssuedAt = DateTime.UtcNow,
                IsTenantWide = !request.ServerId.HasValue
            };

            if (request.ServerId.HasValue)
            {
                await _agentHub.Clients.Group(request.ServerId.Value.ToString()).ReceiveBlockCommand(blockCmd);
            }
            else
            {
                var tenantServers = await _db.Servers
                    .Where(s => s.TenantId == effectiveTenantId)
                    .Select(s => s.Id)
                    .ToListAsync();
                foreach (var sid in tenantServers)
                    await _agentHub.Clients.Group(sid.ToString()).ReceiveBlockCommand(blockCmd);
            }

            await _alertHub.Clients.Group(effectiveTenantId.ToString()).ReceiveBlockCommand(blockCmd);

            _logger.LogWarning("[BLOCK] Updated: {Ip} by {By} | {Attack}",
                request.Ip, request.BlockedBy, request.AttackType);

            return Ok(new ApiResponse<object>(true, $"IP {request.Ip} block updated.", new
            {
                ip = request.Ip,
                action = "updated",
                blockedAt = existing.BlockedAt,
                expiresAt = existing.ExpiresAt,
                blockId = existing.Id,
                anomalyScore = existing.AnomalyScore
            }));
        }

        // Create new block record
        var blockedIP = new BlockedIP
        {
            Id = Guid.NewGuid(),
            IpAddress = request.Ip,
            TenantId = effectiveTenantId,
            ServerId = request.ServerId,   // null = tenant-wide; set = server-specific
            AttackType = request.AttackType ?? "Unknown",
            Severity = request.Severity ?? "Medium",
            Reason = request.Reason ?? "AI Detection",
            BlockedBy = request.BlockedBy ?? "AI-Engine",
            BlockedAt = DateTime.UtcNow,
            ExpiresAt = request.BlockDurationMinutes.HasValue
                ? DateTime.UtcNow.AddMinutes(request.BlockDurationMinutes.Value)
                : null,
            IsActive = true,
            AnomalyScore = request.Score
        };

        _db.BlockedIPs.Add(blockedIP);

        // Auto-create Alert + Ticket + AuditLog — wrap to avoid blocking SignalR on FK errors
        if (!string.IsNullOrEmpty(request.AttackType))
        {
            var existingAlert = await _db.Alerts
                .FirstOrDefaultAsync(a =>
                    a.SourceIp == request.Ip &&
                    a.CreatedAt > DateTime.UtcNow.AddHours(-1) &&
                    a.AlertType == request.AttackType);

            if (existingAlert == null)
            {
                var alert = new Alert
                {
                    Id = Guid.NewGuid(),
                    TenantId = effectiveTenantId,
                    ServerId = null,
                    Title = $"[Auto-Blocked] {request.AttackType} from {request.Ip}",
                    Description = request.Reason ?? $"IP {request.Ip} automatically blocked.",
                    Severity = request.Severity ?? "Medium",
                    AlertType = request.AttackType,
                    SourceIp = request.Ip,
                    TargetAsset = request.TargetAsset,
                    Status = "Acknowledged",
                    AnomalyScore = request.Score,
                    CreatedAt = DateTime.UtcNow
                };
                _db.Alerts.Add(alert);

                // Ticket + AuditLog — nếu lỗi FK thì kệ, SignalR vẫn phải chạy
                try
                {
                    var ticketNumber = $"TK-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString("N")[..8].ToUpper()}";
                    var ticket = new Ticket
                    {
                        Id = Guid.NewGuid(),
                        TenantId = effectiveTenantId,
                        AlertId = alert.Id,
                        TicketNumber = ticketNumber,
                        Title = $"Incident: {request.AttackType} - {request.Ip}",
                        Description = $"Auto-generated by AI Engine.\n\nReason: {request.Reason}",
                        Priority = request.Severity ?? "Medium",
                        Status = "OPEN",
                        Category = "Security Incident",
                        CreatedBy = null  // System ticket — no real user
                    };
                    _db.Tickets.Add(ticket);

                    _db.AuditLogs.Add(new AuditLog
                    {
                        TenantId = effectiveTenantId,
                        Action = "AUTO_BLOCKED",
                        EntityType = "BlockedIP",
                        EntityId = blockedIP.Id.ToString(),
                        Details = $"Auto-blocked {request.Ip} - {request.AttackType}"
                    });
                }
                catch (Exception ticketEx)
                {
                    _logger.LogError(ticketEx, "[BLOCK] Ticket/AuditLog failed — continuing to SignalR push");
                }
            }
        }

        await _db.SaveChangesAsync();

        // ========================================================================
        // BƯỚC 3: PUSH lệnh qua SignalR → Agent nhận + thực thi block
        // ========================================================================
        // Nếu có ServerId: push đến Agent cụ thể
        // Nếu không có (AI Engine): push đến TẤT CẢ server trong tenant để block trên mọi máy
        if (request.ServerId.HasValue)
        {
            var blockCmd = new BlockCommandDto
            {
                Ip = request.Ip,
                Reason = request.Reason ?? "AI Detection",
                AttackType = request.AttackType ?? "Unknown",
                Severity = request.Severity ?? "Medium",
                DurationMinutes = request.BlockDurationMinutes,
                BlockId = blockedIP.Id,
                IssuedAt = DateTime.UtcNow,
                IsTenantWide = false
            };

            await _agentHub.Clients.Group(request.ServerId.Value.ToString())
                .ReceiveBlockCommand(blockCmd);

            _logger.LogWarning(
                "[AGENT-PUSH] Block command sent to Server {ServerId}: IP={Ip} by {By}",
                request.ServerId, request.Ip, request.BlockedBy);
        }
        else
        {
            // AI Engine không gửi ServerId → push đến TẤT CẢ server trong tenant
            var tenantServers = await _db.Servers
                .Where(s => s.TenantId == effectiveTenantId)
                .Select(s => s.Id)
                .ToListAsync();

            if (tenantServers.Count == 0)
            {
                _logger.LogWarning("[AGENT-PUSH] No servers found for tenant {TenantId} — block is local-only",
                    effectiveTenantId);
            }
            else
            {
                var blockCmd = new BlockCommandDto
                {
                    Ip = request.Ip,
                    Reason = request.Reason ?? "AI Detection",
                    AttackType = request.AttackType ?? "Unknown",
                    Severity = request.Severity ?? "Medium",
                    DurationMinutes = request.BlockDurationMinutes,
                    BlockId = blockedIP.Id,
                    IssuedAt = DateTime.UtcNow,
                    IsTenantWide = true   // ← Agent dùng cờ này để apply locally
                };

                foreach (var serverId in tenantServers)
                {
                    await _agentHub.Clients.Group(serverId.ToString())
                        .ReceiveBlockCommand(blockCmd);
                }

                _logger.LogWarning(
                    "[AGENT-PUSH] Block command broadcast to {Count} servers for tenant {TenantId}: IP={Ip}",
                    tenantServers.Count, effectiveTenantId, request.Ip);
            }
        }

        // Push đến Frontend Dashboard qua AlertHub
        var dashboardCmd = new BlockCommandDto
        {
            Ip = request.Ip,
            Reason = request.Reason ?? "AI Detection",
            AttackType = request.AttackType ?? "Unknown",
            Severity = request.Severity ?? "Medium",
            DurationMinutes = request.BlockDurationMinutes,
            BlockId = blockedIP.Id,
            IssuedAt = DateTime.UtcNow,
            IsTenantWide = !request.ServerId.HasValue
        };
        await _alertHub.Clients.Group(effectiveTenantId.ToString()).ReceiveBlockCommand(dashboardCmd);

        _logger.LogWarning("[BLOCK] New block: {Ip} by {By} | {Attack} | {Severity} | {BlockId}",
            request.Ip, request.BlockedBy, request.AttackType, request.Severity, blockedIP.Id);

        return Ok(new ApiResponse<object>(true, $"IP {request.Ip} has been blocked.", new
        {
            ip = request.Ip,
            action = "blocked",
            blockedAt = blockedIP.BlockedAt,
            expiresAt = blockedIP.ExpiresAt,
            blockId = blockedIP.Id,
            attackType = blockedIP.AttackType,
            severity = blockedIP.Severity,
            anomalyScore = blockedIP.AnomalyScore
        }));
    }

    // ============================================================================
    // POST /api/defense/unblock-ip
    // ============================================================================
    [HttpPost("unblock-ip")]
    public async Task<ActionResult<ApiResponse<object>>> UnblockIP([FromBody] UnblockIPRequest request)
    {
        var tenantId = GetTenantId();
        var userId = GetUserId();

        // Tìm IP bị block — filter theo ServerId nếu được chỉ định
        var blocked = await _db.BlockedIPs
            .FirstOrDefaultAsync(b =>
                b.IpAddress == request.Ip &&
                b.IsActive &&
                b.TenantId == (tenantId.HasValue ? tenantId.Value : b.TenantId) &&
                (request.ServerId.HasValue ? b.ServerId == request.ServerId : true));

        if (blocked == null)
        {
            // Thử tìm block tenant-wide nếu không có server cụ thể
            if (!request.ServerId.HasValue)
            {
                blocked = await _db.BlockedIPs
                    .FirstOrDefaultAsync(b =>
                        b.IpAddress == request.Ip &&
                        b.IsActive &&
                        (tenantId.HasValue ? b.TenantId == tenantId.Value : true));
            }
            if (blocked == null)
                return NotFound(new ApiResponse<object>(false, $"IP {request.Ip} is not currently blocked.", null));
        }

        blocked.IsActive = false;
        blocked.UnblockedAt = DateTime.UtcNow;
        blocked.UnblockedBy = request.UnblockedBy ?? GetUserRole();

        _db.BlockedIPs.Update(blocked);

        if (tenantId.HasValue)
        {
            _db.AuditLogs.Add(new AuditLog
            {
                TenantId = tenantId.Value,
                UserId = userId,
                Action = "IP_UNBLOCKED",
                EntityType = "BlockedIP",
                EntityId = blocked.Id.ToString(),
                Details = $"IP {request.Ip} unblocked (ServerId={request.ServerId})"
            });
        }

        await _db.SaveChangesAsync();

        // Push lệnh unblock qua SignalR → Agent nhận + thực thi
        if (request.ServerId.HasValue)
        {
            await _agentHub.Clients.Group(request.ServerId.Value.ToString())
                .ReceiveUnblockCommand(request.Ip);

            _logger.LogInformation(
                "[AGENT-PUSH] Unblock command sent to Server {ServerId}: IP={Ip}",
                request.ServerId, request.Ip);
        }

        _logger.LogInformation("[UNBLOCK] IP {Ip} unblocked by {By} (ServerId={ServerId})",
            request.Ip, blocked.UnblockedBy, request.ServerId);

        return Ok(new ApiResponse<object>(true, $"IP {request.Ip} has been unblocked.", new
        {
            ip = request.Ip,
            action = "unblocked",
            unblockedAt = blocked.UnblockedAt,
            unblockedBy = blocked.UnblockedBy,
            serverId = request.ServerId
        }));
    }

    // ============================================================================
    // GET /api/defense/blocked-ips
    // ============================================================================
    [HttpGet("blocked-ips")]
    public async Task<ActionResult<ApiResponse<PagedResult<BlockedIPDto>>>> GetBlockedIPs(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] bool activeOnly = true)
    {
        var tenantId = GetTenantId();
        var role = GetUserRole();

        IQueryable<BlockedIP> query = _db.BlockedIPs.AsQueryable();

        if (role != "SuperAdmin")
        {
            if (tenantId.HasValue)
                query = query.Where(b => b.TenantId == tenantId.Value);
            else
                return Forbid();
        }

        if (activeOnly)
            query = query.Where(b => b.IsActive);

        var total = await query.CountAsync();
        var items = await query
            .Include(b => b.Server)
            .OrderByDescending(b => b.BlockedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(b => new BlockedIPDto(
                b.Id,
                b.IpAddress,
                b.AttackType,
                b.Severity,
                b.Reason ?? "",
                b.BlockedBy,
                b.BlockedAt,
                b.ExpiresAt,
                b.IsActive,
                b.UnblockedAt,
                b.UnblockedBy,
                b.AnomalyScore,
                b.ServerId,
                b.Server != null ? b.Server.Name : null
            ))
            .ToListAsync();

        return Ok(new ApiResponse<PagedResult<BlockedIPDto>>(true, "OK", new PagedResult<BlockedIPDto>(
            items,
            total,
            page,
            pageSize,
            (int)Math.Ceiling(total / (double)pageSize)
        )));
    }

    // ============================================================================
    // GET /api/defense/check/{ip}
    // ============================================================================
    [HttpGet("check/{ip}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<IPCheckResult>>> CheckIP(string ip)
    {
        var blocked = await _db.BlockedIPs
            .Where(b => b.IpAddress == ip && b.IsActive)
            .Where(b => b.ExpiresAt == null || b.ExpiresAt > DateTime.UtcNow)
            .FirstOrDefaultAsync();

        return Ok(new ApiResponse<IPCheckResult>(true, "OK", new IPCheckResult(
            ip,
            blocked != null,
            blocked?.BlockedAt,
            blocked?.ExpiresAt,
            blocked?.Reason,
            blocked?.AttackType
        )));
    }

    // ============================================================================
    // GET /api/defense/rate-limit-status
    // ============================================================================
    [HttpGet("rate-limit-status")]
    public async Task<ActionResult<ApiResponse<RateLimitStatus>>> GetRateLimitStatus()
    {
        var tenantId = GetTenantId();
        if (!tenantId.HasValue)
            return Ok(new ApiResponse<RateLimitStatus>(true, "OK", new RateLimitStatus(0, 0, 0, 10, 100)));

        var oneMinuteAgo = DateTime.UtcNow.AddMinutes(-1);
        var oneHourAgo = DateTime.UtcNow.AddHours(-1);

        var blocksLastMinute = await _db.BlockedIPs
            .Where(b => b.TenantId == tenantId.Value && b.BlockedAt > oneMinuteAgo)
            .CountAsync();

        var blocksLastHour = await _db.BlockedIPs
            .Where(b => b.TenantId == tenantId.Value && b.BlockedAt > oneHourAgo)
            .CountAsync();

        var activeBlocks = await _db.BlockedIPs
            .Where(b => b.TenantId == tenantId.Value && b.IsActive)
            .CountAsync();

        return Ok(new ApiResponse<RateLimitStatus>(true, "OK", new RateLimitStatus(
            blocksLastMinute, blocksLastHour, activeBlocks, 10, 100
        )));
    }

    // ============================================================================
    // POST /api/defense/manual-block (Admin only)
    // ============================================================================
    [HttpPost("manual-block")]
    [Authorize(Roles = "SuperAdmin,Admin")]
    public async Task<ActionResult<ApiResponse<object>>> ManualBlock([FromBody] ManualBlockRequest request)
    {
        var tenantId = GetTenantId();
        var role = GetUserRole();
        var userId = GetUserId();

        // SuperAdmin có thể block mà không cần tenantId (global block)
        // Admin phải có tenantId
        if (role == "Admin" && !tenantId.HasValue)
        {
            return BadRequest(new ApiResponse<object>(false, "Admin requires TenantId.", null));
        }

        // Nếu là SuperAdmin và không có tenantId, tạo một global block (tenantId = null hoặc dùng tenant đầu tiên)
        Guid effectiveTenantId;
        if (!tenantId.HasValue && role == "SuperAdmin")
        {
            // SuperAdmin: lấy tenant đầu tiên hoặc tạo global block
            var firstTenant = await _db.Tenants.FirstOrDefaultAsync();
            if (firstTenant == null)
            {
                return BadRequest(new ApiResponse<object>(false, "No tenant found in system. Please create a tenant first.", null));
            }
            effectiveTenantId = firstTenant.Id;
        }
        else
        {
            effectiveTenantId = tenantId!.Value;
        }

        var existing = await _db.BlockedIPs
            .FirstOrDefaultAsync(b => b.IpAddress == request.Ip && b.IsActive && 
                (request.ServerId.HasValue ? b.ServerId == request.ServerId : b.ServerId == null));

        if (existing != null)
        {
            var scope = request.ServerId.HasValue ? "on this server" : "tenant-wide";
            return BadRequest(new ApiResponse<object>(false, $"IP {request.Ip} is already blocked {scope}.", null));
        }

        var blockedIP = new BlockedIP
        {
            Id = Guid.NewGuid(),
            IpAddress = request.Ip,
            TenantId = effectiveTenantId,
            ServerId = request.ServerId,  // Set ServerId if specified
            AttackType = "Manual Block",
            Severity = request.Severity ?? "Medium",
            Reason = request.Reason ?? "Manual block by admin",
            BlockedBy = userId.ToString(),
            BlockedAt = DateTime.UtcNow,
            ExpiresAt = request.DurationMinutes.HasValue
                ? DateTime.UtcNow.AddMinutes(request.DurationMinutes.Value)
                : null,
            IsActive = true
        };

        _db.BlockedIPs.Add(blockedIP);

        var blockScope = request.ServerId.HasValue ? $"on server {request.ServerId}" : "on all servers (tenant-wide)";
        _db.AuditLogs.Add(new AuditLog
        {
            TenantId = effectiveTenantId,
            UserId = userId,
            Action = "MANUAL_BLOCK",
            EntityType = "BlockedIP",
            EntityId = blockedIP.Id.ToString(),
            Details = $"Manual block: {request.Ip} {blockScope} - {request.Reason}"
        });

        await _db.SaveChangesAsync();

        // Push block command to agents
        // If ServerId specified: push only to that server
        // If ServerId is null: push to all servers in tenant (tenant-wide block)
        List<Guid> targetServers;
        if (request.ServerId.HasValue)
        {
            targetServers = new List<Guid> { request.ServerId.Value };
        }
        else
        {
            targetServers = await _db.Servers
                .Where(s => s.TenantId == effectiveTenantId)
                .Select(s => s.Id)
                .ToListAsync();
        }

        if (targetServers.Count > 0)
        {
            var blockCmd = new BlockCommandDto
            {
                Ip = request.Ip,
                Reason = request.Reason ?? "Manual block by admin",
                AttackType = "Manual Block",
                Severity = request.Severity ?? "Medium",
                DurationMinutes = request.DurationMinutes,
                BlockId = blockedIP.Id,
                IssuedAt = DateTime.UtcNow
            };

            foreach (var serverId in targetServers)
            {
                await _agentHub.Clients.Group(serverId.ToString())
                    .ReceiveBlockCommand(blockCmd);
            }

            var serverScope = request.ServerId.HasValue ? $"server {request.ServerId}" : $"{targetServers.Count} servers (tenant-wide)";
            _logger.LogWarning(
                "[MANUAL-BLOCK] Block command sent to {Scope}: IP={Ip} by User={UserId}",
                serverScope, request.Ip, userId);
        }

        // Push to dashboard
        await _alertHub.Clients.Group(effectiveTenantId.ToString()).ReceiveBlockCommand(new BlockCommandDto
        {
            Ip = request.Ip,
            Reason = request.Reason ?? "Manual block by admin",
            AttackType = "Manual Block",
            Severity = request.Severity ?? "Medium",
            DurationMinutes = request.DurationMinutes,
            BlockId = blockedIP.Id,
            IssuedAt = DateTime.UtcNow
        });

        _logger.LogWarning("[MANUAL-BLOCK] User {User} blocked {Ip}: {Reason}",
            userId, request.Ip, request.Reason);

        return Ok(new ApiResponse<object>(true, $"IP {request.Ip} has been manually blocked.", new
        {
            ip = request.Ip,
            blockedAt = blockedIP.BlockedAt,
            expiresAt = blockedIP.ExpiresAt,
            blockedBy = blockedIP.BlockedBy,
            tenantId = effectiveTenantId
        }));
    }

    // ============================================================================
    // GET /api/defense/firewall-rules
    // ============================================================================
    [HttpGet("firewall-rules")]
    public async Task<ActionResult<ApiResponse<FirewallRulesDto>>> GetFirewallRules()
    {
        var tenantId = GetTenantId();
        var role = GetUserRole();

        IQueryable<BlockedIP> query = _db.BlockedIPs.Where(b => b.IsActive);

        if (role != "SuperAdmin")
        {
            if (tenantId.HasValue)
                query = query.Where(b => b.TenantId == tenantId.Value);
            else
                return Forbid();
        }

        var rules = await query
            .Where(b => b.ExpiresAt == null || b.ExpiresAt > DateTime.UtcNow)
            .OrderByDescending(b => b.BlockedAt)
            .Select(b => new FirewallRuleDto(
                b.IpAddress,
                b.AttackType,
                b.Severity,
                b.ExpiresAt,
                b.BlockedAt
            ))
            .ToListAsync();

        return Ok(new ApiResponse<FirewallRulesDto>(true, "OK", new FirewallRulesDto(
            rules,
            rules.Count,
            DateTime.UtcNow
        )));
    }

    // ============================================================================
    // Helpers
    // ============================================================================
    private Guid GetUserId() =>
        Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? Guid.Empty.ToString());

    private Guid? GetTenantId()
    {
        // Ưu tiên context.Items (đặt bởi ApiKeyAuthMiddleware từ API Key)
        if (HttpContext.Items.TryGetValue("TenantId", out var tenantObj) && tenantObj is Guid tenantFromKey)
            return tenantFromKey;
        // Fallback: JWT claim
        var val = User.FindFirstValue("tenantId");
        return val != null ? Guid.Parse(val) : null;
    }

    private Guid? GetServerId()
    {
        if (HttpContext.Items.TryGetValue("ServerId", out var serverObj) && serverObj is Guid serverId)
            return serverId;
        return null;
    }

    private string GetUserRole() =>
        User.FindFirstValue(ClaimTypes.Role) ?? "User";
}

// =============================================================================
// Request / Response DTOs
// =============================================================================

public record BlockIPRequest(
    [Required] string Ip,
    string? AttackType,
    string? Severity,
    string? Reason,
    string? BlockedBy,
    string? TargetAsset,
    int? BlockDurationMinutes,
    Guid? ServerId,  // Server cần block — nếu có, Backend push lệnh qua SignalR đến Agent
    decimal? Score   // AI anomaly score khi block tự động
);

public record UnblockIPRequest(
    [Required] string Ip,
    string? UnblockedBy,
    Guid? ServerId   // Server cần unblock — push lệnh qua SignalR đến Agent
);

public record ManualBlockRequest(
    [Required] string Ip,
    string? Reason,
    string? Severity,
    int? DurationMinutes,
    Guid? ServerId  // If specified, block only on this server. If null, block on all servers (tenant-wide)
);

public record BlockedIPDto(
    Guid Id,
    string IpAddress,
    string AttackType,
    string Severity,
    string Reason,
    string BlockedBy,
    DateTime BlockedAt,
    DateTime? ExpiresAt,
    bool IsActive,
    DateTime? UnblockedAt,
    string? UnblockedBy,
    decimal? AnomalyScore,
    Guid? ServerId,
    string? ServerName
);

public record IPCheckResult(
    string IpAddress,
    bool IsBlocked,
    DateTime? BlockedAt,
    DateTime? ExpiresAt,
    string? Reason,
    string? AttackType
);

public record RateLimitStatus(
    int BlocksLastMinute,
    int BlocksLastHour,
    int ActiveBlocks,
    int MinuteLimit,
    int HourlyLimit
);

public record FirewallRuleDto(
    string IpAddress,
    string AttackType,
    string Severity,
    DateTime? ExpiresAt,
    DateTime BlockedAt
);

public record FirewallRulesDto(
    List<FirewallRuleDto> ActiveRules,
    int TotalActive,
    DateTime GeneratedAt
);
