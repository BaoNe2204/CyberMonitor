using System.Security.Cryptography;
using System.Text;
using CyberMonitor.API.Data;
using CyberMonitor.API.Extensions;
using CyberMonitor.API.Models;
using CyberMonitor.API.Models.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
namespace CyberMonitor.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ServersController : ControllerBase
{
    private readonly CyberMonitorDbContext _db;
    private readonly ILogger<ServersController> _logger;

    public ServersController(CyberMonitorDbContext db, ILogger<ServersController> logger)
    {
        _db = db;
        _logger = logger;
    }

    /// <summary>Lấy danh sách server của tenant</summary>
    [HttpGet]
    [Authorize]
    public async Task<ActionResult<ApiResponse<PagedResult<ServerDto>>>> GetServers(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null,
        [FromQuery] string? status = null)
    {
        var tenantId = GetTenantId();
        var role = GetUserRole();

        IQueryable<Server> query = _db.Servers.Include(s => s.ApiKeys);

        if (role != "SuperAdmin")
        {
            query = query.Where(s => s.TenantId == tenantId);
        }

        if (!string.IsNullOrEmpty(search))
        {
            query = query.Where(s => s.Name.Contains(search) || s.IpAddress.Contains(search));
        }

        if (!string.IsNullOrEmpty(status))
        {
            query = query.Where(s => s.Status == status);
        }

        var totalCount = await query.CountAsync();
        var items = await query
            .OrderByDescending(s => s.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(s => new ServerDto(
                s.Id,
                s.Name,
                s.IpAddress,
                s.Status,
                s.OS,
                s.CpuUsage,
                s.RamUsage,
                s.DiskUsage,
                s.LastSeenAt,
                s.CreatedAt,
                s.ApiKeys.Select(k => new ApiKeyDto(
                    k.Id, k.ServerId ?? Guid.Empty, k.Name, k.KeyPrefix,
                    k.Permissions, k.LastUsedAt, k.ExpiresAt, k.IsActive, k.CreatedAt
                )).ToList()
            ))
            .ToListAsync();

        return Ok(new ApiResponse<PagedResult<ServerDto>>(true, "OK", new PagedResult<ServerDto>(
            items, totalCount, page, pageSize, (int)Math.Ceiling(totalCount / (double)pageSize)
        )));
    }

    /// <summary>Thêm server mới + sinh API Key</summary>
    [HttpPost("add")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<ApiKeyGeneratedResponse>>> AddServer([FromBody] CreateServerRequest request)
    {
        var tenantId = GetTenantId();
        var role = GetUserRole();

        if (role != "SuperAdmin" && role != "Admin")
            return Forbid();

        Guid targetTenantId;
        if (role == "SuperAdmin")
        {
            if (request.TenantId is { } tid && tid != Guid.Empty)
                targetTenantId = tid;
            else
            {
                var latestSub = await _db.Subscriptions
                    .AsNoTracking()
                    .OrderByDescending(s => s.EndDate)
                    .FirstOrDefaultAsync();
                if (latestSub == null)
                    return BadRequest(new ApiResponse<ApiKeyGeneratedResponse>(false,
                        "Chưa có subscription nào. Hãy đăng ký tenant/gói cước trước khi thêm server.", null));
                targetTenantId = latestSub.TenantId;
            }
        }
        else
        {
            if (request.TenantId is not { } adminTid || adminTid == Guid.Empty || tenantId != adminTid)
                return Forbid();
            targetTenantId = adminTid;
        }

        var createdBy = request.CreatedBy != Guid.Empty
            ? request.CreatedBy
            : (Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var uid) ? uid : Guid.Empty);
        if (createdBy == Guid.Empty)
            return BadRequest(new ApiResponse<ApiKeyGeneratedResponse>(false, "Không xác định người tạo (CreatedBy).", null));

        // Check giới hạn server
        var subscription = await _db.Subscriptions
            .Where(s => s.TenantId == targetTenantId)
            .OrderByDescending(s => s.EndDate)
            .FirstOrDefaultAsync();

        if (subscription == null)
            return BadRequest(new ApiResponse<ApiKeyGeneratedResponse>(false, "Không tìm thấy subscription.", null));

        var currentServerCount = await _db.Servers.CountAsync(s => s.TenantId == targetTenantId);
        if (currentServerCount >= subscription.MaxServers)
            return BadRequest(new ApiResponse<ApiKeyGeneratedResponse>(false,
                $"Bạn đã đạt giới hạn {subscription.MaxServers} server cho gói {subscription.PlanName}. Vui lòng nâng cấp gói cước.", null));

        // Tạo server
        var plainApiKey = $"sk_live_{GenerateSecureKey(32)}";
        var server = new Server
        {
            TenantId = targetTenantId,
            Name = request.Name,
            IpAddress = request.IpAddress,
            ApiKeyHash = ComputeSha256(plainApiKey),
            Status = "Offline",
            CreatedAt = DateTime.UtcNow
        };
        _db.Servers.Add(server);
        await _db.SaveChangesAsync();

        // Tạo API Key record
        var apiKeyRecord = new ApiKey
        {
            TenantId = targetTenantId,
            ServerId = server.Id,
            KeyHash = ComputeSha256(plainApiKey),
            KeyPrefix = $"sk_live_{plainApiKey[8..12]}",
            Name = $"Agent Key - {server.Name}",
            Permissions = "{\"ingest\":true,\"read\":true,\"write\":false}",
            IsActive = true
        };
        _db.ApiKeys.Add(apiKeyRecord);

        // Audit
        _db.AuditLogs.Add(new AuditLog
        {
            TenantId = targetTenantId,
            UserId = createdBy,
            Action = "SERVER_ADDED",
            EntityType = "Server",
            EntityId = server.Id.ToString(),
            Details = $"Server '{server.Name}' ({server.IpAddress}) added"
        });
        await _db.SaveChangesAsync();

        _logger.LogInformation("Server {Name} added for tenant {TenantId}", server.Name, server.TenantId);

        return Ok(new ApiResponse<ApiKeyGeneratedResponse>(true,
            $"Server '{server.Name}' đã được tạo. Hãy lưu giữ API Key bên dưới!", new ApiKeyGeneratedResponse(
                server.Id,
                plainApiKey,
                server.Name,
                server.CreatedAt
            )));
    }

    /// <summary>Lấy thông tin server + API Key</summary>
    [HttpGet("{id:guid}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<ServerDto>>> GetServer(Guid id)
    {
        var tenantId = GetTenantId();
        var role = GetUserRole();

        var server = await _db.Servers
            .Include(s => s.ApiKeys)
            .FirstOrDefaultAsync(s => s.Id == id);

        if (server == null)
            return NotFound(new ApiResponse<ServerDto>(false, "Server không tìm thấy.", null));

        if (role != "SuperAdmin" && server.TenantId != tenantId)
            return Forbid();

        return Ok(new ApiResponse<ServerDto>(true, "OK", new ServerDto(
            server.Id, server.Name, server.IpAddress, server.Status,
            server.OS, server.CpuUsage, server.RamUsage, server.DiskUsage,
            server.LastSeenAt, server.CreatedAt,
            server.ApiKeys.Select(k => new ApiKeyDto(
                k.Id, k.ServerId ?? Guid.Empty, k.Name, k.KeyPrefix,
                k.Permissions, k.LastUsedAt, k.ExpiresAt, k.IsActive, k.CreatedAt
            )).ToList()
        )));
    }

    /// <summary>Cập nhật server</summary>
    [HttpPut("{id:guid}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<ServerDto>>> UpdateServer(Guid id, [FromBody] UpdateServerRequest request)
    {
        var tenantId = GetTenantId();
        var role = GetUserRole();

        var server = await _db.Servers.FindAsync(id);
        if (server == null)
            return NotFound(new ApiResponse<ServerDto>(false, "Server không tìm thấy.", null));

        if (role != "SuperAdmin" && server.TenantId != tenantId)
            return Forbid();

        if (!string.IsNullOrEmpty(request.Name))
            server.Name = request.Name;
        if (!string.IsNullOrEmpty(request.Status))
            server.Status = request.Status;

        await _db.SaveChangesAsync();

        return Ok(new ApiResponse<ServerDto>(true, "Cập nhật thành công!", null));
    }

    /// <summary>Xóa server</summary>
    [HttpDelete("{id:guid}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<object>>> DeleteServer(Guid id)
    {
        var tenantId = GetTenantId();
        var role = GetUserRole();

        if (role != "SuperAdmin" && role != "Admin")
            return Forbid();

        var server = await _db.Servers.FindAsync(id);
        if (server == null)
            return NotFound(new ApiResponse<object>(false, "Server không tìm thấy.", null));

        if (role != "SuperAdmin" && server.TenantId != tenantId)
            return Forbid();

        var alerts = await _db.Alerts.Where(a => a.ServerId == id).ToListAsync();
        var alertIds = alerts.Select(a => a.Id).ToList();
        var tickets = await _db.Tickets.Where(t => t.AlertId.HasValue && alertIds.Contains(t.AlertId.Value)).ToListAsync();
        var apiKeys = await _db.ApiKeys.Where(k => k.ServerId == id).ToListAsync();
        _db.Tickets.RemoveRange(tickets);
        _db.Alerts.RemoveRange(alerts);
        _db.ApiKeys.RemoveRange(apiKeys);
        _db.Servers.Remove(server);
        await _db.SaveChangesAsync();

        return Ok(new ApiResponse<object>(true, "Xóa server thành công!", null));
    }

    /// <summary>Tái tạo API Key mới cho server</summary>
    [HttpPost("{id:guid}/regenerate-key")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<ApiKeyGeneratedResponse>>> RegenerateKey(Guid id)
    {
        var tenantId = GetTenantId();
        var role = GetUserRole();

        var server = await _db.Servers.FindAsync(id);
        if (server == null)
            return NotFound(new ApiResponse<ApiKeyGeneratedResponse>(false, "Server không tìm thấy.", null));

        if (role != "SuperAdmin" && server.TenantId != tenantId)
            return Forbid();

        var newPlainKey = $"sk_live_{GenerateSecureKey(32)}";
        server.ApiKeyHash = ComputeSha256(newPlainKey);

        // Deactivate old keys
        var oldKeys = await _db.ApiKeys.Where(k => k.ServerId == id).ToListAsync();
        foreach (var k in oldKeys) k.IsActive = false;

        var newKey = new ApiKey
        {
            TenantId = server.TenantId,
            ServerId = server.Id,
            KeyHash = ComputeSha256(newPlainKey),
            KeyPrefix = $"sk_live_{newPlainKey[8..12]}",
            Name = $"Agent Key - {server.Name} (Regenerated {DateTime.UtcNow:yyyyMMdd})",
            Permissions = "{\"ingest\":true,\"read\":true,\"write\":false}",
            IsActive = true
        };
        _db.ApiKeys.Add(newKey);
        await _db.SaveChangesAsync();

        return Ok(new ApiResponse<ApiKeyGeneratedResponse>(true,
            "API Key đã được tái tạo!", new ApiKeyGeneratedResponse(server.Id, newPlainKey, server.Name, DateTime.UtcNow)));
    }

    /// <summary>Lấy API Key của server (chỉ Admin)</summary>
    [HttpGet("{id:guid}/key")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<object>>> GetServerApiKey(Guid id)
    {
        var tenantId = GetTenantId();
        var role = GetUserRole();

        if (role == "User")
            return Forbid();

        var server = await _db.Servers.FindAsync(id);
        if (server == null)
            return NotFound(new ApiResponse<object>(false, "Server không tìm thấy.", null));

        if (role != "SuperAdmin" && server.TenantId != tenantId)
            return Forbid();

        var activeKey = await _db.ApiKeys
            .Where(k => k.ServerId == id && k.IsActive)
            .OrderByDescending(k => k.CreatedAt)
            .FirstOrDefaultAsync();

        if (activeKey == null)
            return NotFound(new ApiResponse<object>(false, "Không có API Key active.", null));

        // Chỉ lưu hash trong DB — không thể trả về plain key. Prefix để nhận biết; key đầy đủ chỉ có lúc tạo mới / tái tạo.
        return Ok(new ApiResponse<object>(true, "Chỉ có prefix; key đầy đủ cần tái tạo nếu đã mất.", new
        {
            plainApiKey = (string?)null,
            keyPrefix = activeKey.KeyPrefix,
            serverId = server.Id,
            serverName = server.Name,
            activeKey.Name,
            activeKey.CreatedAt,
            activeKey.LastUsedAt
        }));
    }

    private Guid? GetTenantId()
    {
        if (HttpContext.Items.TryGetValue("TenantId", out var tenantObj) && tenantObj is Guid tenantFromKey)
            return tenantFromKey;
        var val = User.FindFirstValue("tenantId");
        return val != null ? Guid.Parse(val) : null;
    }

    private string GetUserRole() => User.FindFirstValue(System.Security.Claims.ClaimTypes.Role) ?? "User";

    private static string GenerateSecureKey(int length)
    {
        var bytes = RandomNumberGenerator.GetBytes(length);
        return Convert.ToBase64String(bytes).Replace("+", "").Replace("/", "").Replace("=", "")[..length];
    }

    private static string ComputeSha256(string input)
    {
        var bytes = System.Security.Cryptography.SHA256.HashData(Encoding.UTF8.GetBytes(input));
        return Convert.ToHexString(bytes).ToLower();
    }
}
