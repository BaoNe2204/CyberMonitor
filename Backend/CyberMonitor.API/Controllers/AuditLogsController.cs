using System.Security.Claims;
using CyberMonitor.API.Data;
using CyberMonitor.API.Models;
using CyberMonitor.API.Models.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CyberMonitor.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AuditLogsController : ControllerBase
{
    private readonly CyberMonitorDbContext _db;
    private readonly ILogger<AuditLogsController> _logger;

    public AuditLogsController(CyberMonitorDbContext db, ILogger<AuditLogsController> logger)
    {
        _db = db;
        _logger = logger;
    }

    /// <summary>Lấy danh sách audit logs với filter</summary>
    [HttpGet]
    public async Task<ActionResult<ApiResponse<PagedResult<AuditLogDto>>>> GetAuditLogs(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? action = null,
        [FromQuery] string? entityType = null,
        [FromQuery] Guid? userId = null,
        [FromQuery] DateTime? fromDate = null,
        [FromQuery] DateTime? toDate = null)
    {
        var tenantId = GetTenantId();
        var role = GetUserRole();

        if (role == "User")
            return Forbid();

        IQueryable<AuditLog> query = _db.AuditLogs.Include(a => a.User).AsQueryable();

        if (role == "Admin")
        {
            if (!tenantId.HasValue) return Forbid();
            query = query.Where(a => a.TenantId == tenantId);
        }

        if (!string.IsNullOrEmpty(action))
            query = query.Where(a => a.Action.Contains(action));
        if (!string.IsNullOrEmpty(entityType))
            query = query.Where(a => a.EntityType == entityType);
        if (userId.HasValue)
            query = query.Where(a => a.UserId == userId.Value);
        if (fromDate.HasValue)
            query = query.Where(a => a.Timestamp >= fromDate.Value);
        if (toDate.HasValue)
            query = query.Where(a => a.Timestamp <= toDate.Value);

        var totalCount = await query.CountAsync();
        var items = await query
            .OrderByDescending(a => a.Timestamp)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(a => new AuditLogDto(
                a.Id, a.TenantId, a.UserId, a.User != null ? a.User.FullName : null,
                a.Action, a.EntityType, a.EntityId, a.IpAddress, a.Timestamp, a.Details))
            .ToListAsync();

        return Ok(new ApiResponse<PagedResult<AuditLogDto>>(true, "OK", new PagedResult<AuditLogDto>(
            items, totalCount, page, pageSize, (int)Math.Ceiling(totalCount / (double)pageSize))));
    }

    /// <summary>Lấy chi tiết audit log</summary>
    [HttpGet("{id:long}")]
    public async Task<ActionResult<ApiResponse<AuditLogDto>>> GetAuditLog(long id)
    {
        var tenantId = GetTenantId();
        var role = GetUserRole();

        var auditLog = await _db.AuditLogs
            .Include(a => a.User)
            .FirstOrDefaultAsync(a => a.Id == id);

        if (auditLog == null)
            return NotFound(new ApiResponse<AuditLogDto>(false, "Audit log không tìm thấy.", null));

        if (role == "Admin" && auditLog.TenantId != tenantId)
            return Forbid();

        return Ok(new ApiResponse<AuditLogDto>(true, "OK", new AuditLogDto(
            auditLog.Id, auditLog.TenantId, auditLog.UserId, auditLog.User?.FullName,
            auditLog.Action, auditLog.EntityType, auditLog.EntityId, auditLog.IpAddress,
            auditLog.Timestamp, auditLog.Details)));
    }

    /// <summary>Thống kê audit logs theo action type</summary>
    [HttpGet("stats")]
    public async Task<ActionResult<ApiResponse<object>>> GetAuditStats(
        [FromQuery] int days = 30)
    {
        var tenantId = GetTenantId();
        var role = GetUserRole();

        if (role == "User")
            return Forbid();

        var startDate = DateTime.UtcNow.AddDays(-days);

        IQueryable<AuditLog> query = _db.AuditLogs.Where(a => a.Timestamp >= startDate);

        if (role == "Admin")
        {
            if (!tenantId.HasValue) return Forbid();
            query = query.Where(a => a.TenantId == tenantId);
        }

        var stats = await query
            .GroupBy(a => a.Action)
            .Select(g => new { Action = g.Key, Count = g.Count() })
            .OrderByDescending(x => x.Count)
            .ToListAsync();

        return Ok(new ApiResponse<object>(true, "OK", stats));
    }

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