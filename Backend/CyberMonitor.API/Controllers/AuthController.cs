using System.Security.Claims;
using CyberMonitor.API.Data;
using CyberMonitor.API.Models;
using CyberMonitor.API.Models.DTOs;
using CyberMonitor.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CyberMonitor.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly CyberMonitorDbContext _db;
    private readonly IJwtService _jwtService;
    private readonly IEmailService _emailService;
    private readonly ILogger<AuthController> _logger;

    public AuthController(
        CyberMonitorDbContext db,
        IJwtService jwtService,
        IEmailService emailService,
        ILogger<AuthController> logger)
    {
        _db = db;
        _jwtService = jwtService;
        _emailService = emailService;
        _logger = logger;
    }

    /// <summary>Đăng nhập</summary>
    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<AuthResponse>>> Login([FromBody] LoginRequest request)
    {
        var email = request.Email.Trim();
        var user = await _db.Users
            .Include(u => u.Tenant)
            .FirstOrDefaultAsync(u => u.Email == email && u.IsActive);

        if (user == null)
            return Unauthorized(new ApiResponse<AuthResponse>(false, "Email hoặc mật khẩu không đúng.", null));

        if (!BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash.Trim()))
            return Unauthorized(new ApiResponse<AuthResponse>(false, "Email hoặc mật khẩu không đúng.", null));

        user.LastLoginAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        var token = _jwtService.GenerateToken(user.Id, user.TenantId, user.Email, user.Role);

        _db.AuditLogs.Add(new AuditLog
        {
            UserId = user.Id,
            TenantId = user.TenantId,
            Action = "USER_LOGIN",
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
            UserAgent = Request.Headers.UserAgent.ToString(),
            Details = $"User {user.Email} logged in"
        });
        await _db.SaveChangesAsync();

        var response = new AuthResponse(token, MapUserDto(user));
        return Ok(new ApiResponse<AuthResponse>(true, "Đăng nhập thành công!", response));
    }

    /// <summary>Đăng ký + Tạo Tenant mới</summary>
    [HttpPost("register")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<AuthResponse>>> Register([FromBody] RegisterRequest request)
    {
        if (await _db.Users.AnyAsync(u => u.Email == request.Email))
            return BadRequest(new ApiResponse<AuthResponse>(false, "Email đã được sử dụng.", null));

        var tenant = new Tenant
        {
            CompanyName = request.CompanyName,
            Subdomain = GenerateSubdomain(request.CompanyName)
        };
        _db.Tenants.Add(tenant);
        await _db.SaveChangesAsync();

        var passwordHash = BCrypt.Net.BCrypt.HashPassword(request.Password);
        var user = new User
        {
            TenantId = tenant.Id,
            Email = request.Email,
            PasswordHash = passwordHash,
            FullName = request.CompanyName + " Admin",
            Role = "Admin"
        };
        _db.Users.Add(user);
        await _db.SaveChangesAsync();

        var subscription = new Subscription
        {
            TenantId = tenant.Id,
            PlanName = "Starter",
            PlanPrice = 0,
            MaxServers = 1,
            Status = "Trial",
            StartDate = DateTime.UtcNow,
            EndDate = DateTime.UtcNow.AddDays(14)
        };
        _db.Subscriptions.Add(subscription);
        await _db.SaveChangesAsync();

        _db.AuditLogs.Add(new AuditLog
        {
            TenantId = tenant.Id,
            UserId = user.Id,
            Action = "TENANT_REGISTERED",
            Details = $"New tenant {tenant.CompanyName} registered"
        });
        await _db.SaveChangesAsync();

        await _emailService.SendWelcomeEmailAsync(request.Email, request.CompanyName, "Starter");

        var token = _jwtService.GenerateToken(user.Id, user.TenantId, user.Email, user.Role);
        var response = new AuthResponse(token, MapUserDto(user));

        return Ok(new ApiResponse<AuthResponse>(true, "Đăng ký thành công! Workspace đã được tạo.", response));
    }

    /// <summary>Lấy thông tin user hiện tại</summary>
    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<UserDto>>> GetMe()
    {
        var userId = GetUserId();
        var user = await _db.Users
            .Include(u => u.Tenant)
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null)
            return NotFound(new ApiResponse<UserDto>(false, "User không tìm thấy.", null));

        return Ok(new ApiResponse<UserDto>(true, "OK", MapUserDto(user)));
    }

    /// <summary>Đổi mật khẩu user hiện tại</summary>
    [HttpPost("change-password")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<object>>> ChangePassword([FromBody] ChangePasswordRequest request)
    {
        var userId = GetUserId();
        var user = await _db.Users.FindAsync(userId);

        if (user == null)
            return NotFound(new ApiResponse<object>(false, "User không tìm thấy.", null));

        if (!BCrypt.Net.BCrypt.Verify(request.CurrentPassword, user.PasswordHash))
            return BadRequest(new ApiResponse<object>(false, "Mật khẩu hiện tại không đúng.", null));

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
        await _db.SaveChangesAsync();

        await _emailService.SendPasswordChangedEmailAsync(user.Email, user.FullName);

        return Ok(new ApiResponse<object>(true, "Đổi mật khẩu thành công!", null));
    }

    private Guid GetUserId() =>
        Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? Guid.Empty.ToString());

    private static UserDto MapUserDto(User user) => new(
        user.Id, user.TenantId, user.Tenant?.CompanyName, user.Email, user.FullName, user.Role,
        user.LastLoginAt, user.TwoFactorEnabled, user.SessionTimeoutEnabled, user.SessionTimeoutMinutes,
        user.EmailAlertsEnabled, user.TelegramAlertsEnabled, user.PushNotificationsEnabled,
        user.TelegramChatId, user.AlertSeverityThreshold, user.AlertDigestMode);

    private static string GenerateSubdomain(string companyName)
    {
        var slug = companyName.ToLower()
            .Replace(" ", "-").Replace(".", "-").Replace(",", "").Replace("(", "").Replace(")", "");
        slug = slug.Normalize(System.Text.NormalizationForm.FormD);
        slug = new string(slug.Where(c => !char.GetUnicodeCategory(c).Equals(System.Globalization.UnicodeCategory.NonSpacingMark)).ToArray());
        return slug + "-" + Guid.NewGuid().ToString("N")[..6];
    }
}

public record ChangePasswordRequest(string CurrentPassword, string NewPassword);
