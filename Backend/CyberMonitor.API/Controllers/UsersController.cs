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
public class UsersController : ControllerBase
{
    private readonly CyberMonitorDbContext _db;
    private readonly ILogger<UsersController> _logger;

    public UsersController(CyberMonitorDbContext db, ILogger<UsersController> logger)
    {
        _db = db;
        _logger = logger;
    }

    /// <summary>Đổi mật khẩu cho user khác (Admin/SuperAdmin)</summary>
    [HttpPut("{id:guid}/password")]
    public async Task<ActionResult<ApiResponse<object>>> ChangeUserPassword(
        Guid id,
        [FromBody] ChangeUserPasswordRequest request)
    {
        var role = GetUserRole();
        var currentTenantId = GetTenantId();

        if (role != "SuperAdmin" && role != "Admin")
            return Forbid();

        var user = await _db.Users.FindAsync(id);
        if (user == null)
            return NotFound(new ApiResponse<object>(false, "User không tìm thấy.", null));

        // Admin chỉ được đổi password user trong tenant của mình
        if (role == "Admin" && user.TenantId != currentTenantId)
            return Forbid();

        // Validate password
        if (string.IsNullOrEmpty(request.NewPassword) || request.NewPassword.Length < 6)
            return BadRequest(new ApiResponse<object>(false, "Mật khẩu phải có ít nhất 6 ký tự.", null));

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
        await _db.SaveChangesAsync();

        // Audit log
        _db.AuditLogs.Add(new AuditLog
        {
            UserId = GetUserId(),
            TenantId = currentTenantId,
            Action = "USER_PASSWORD_CHANGED",
            EntityType = "User",
            EntityId = user.Id.ToString(),
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
            Details = $"Admin changed password for user {user.Email}"
        });
        await _db.SaveChangesAsync();

        return Ok(new ApiResponse<object>(true, "Đổi mật khẩu thành công!", null));
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
}

public record ChangeUserPasswordRequest(string NewPassword);
