using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using CyberMonitor.API.Data;
using CyberMonitor.API.Extensions;
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

        // Update LastLogin
        user.LastLoginAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        var token = _jwtService.GenerateToken(user.Id, user.TenantId, user.Email, user.Role);

        // Audit log
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

        var response = new AuthResponse(
            token,
            new UserDto(
                user.Id,
                user.TenantId,
                user.Tenant?.CompanyName,
                user.Email,
                user.FullName,
                user.Role,
                user.LastLoginAt,
                user.TwoFactorEnabled
            )
        );

        return Ok(new ApiResponse<AuthResponse>(true, "Đăng nhập thành công!", response));
    }

    /// <summary>Đăng ký + Mua gói (Tạo Tenant mới)</summary>
    [HttpPost("register")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<AuthResponse>>> Register([FromBody] RegisterRequest request)
    {
        // Check email tồn tại
        if (await _db.Users.AnyAsync(u => u.Email == request.Email))
            return BadRequest(new ApiResponse<AuthResponse>(false, "Email đã được sử dụng.", null));

        // Tạo Tenant
        var tenant = new Tenant
        {
            CompanyName = request.CompanyName,
            Subdomain = GenerateSubdomain(request.CompanyName)
        };
        _db.Tenants.Add(tenant);
        await _db.SaveChangesAsync();

        // Tạo SuperAdmin cho tenant (người đăng ký = SuperAdmin của workspace)
        var passwordHash = BCrypt.Net.BCrypt.HashPassword(request.Password);
        var user = new User
        {
            TenantId = tenant.Id,
            Email = request.Email,
            PasswordHash = passwordHash,
            FullName = request.CompanyName + " Admin",
            Role = "Admin" // Mặc định là Admin, có thể upgrade lên SuperAdmin sau
        };
        _db.Users.Add(user);
        await _db.SaveChangesAsync();

        // Tạo subscription trial 14 ngày
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

        // Audit log
        _db.AuditLogs.Add(new AuditLog
        {
            TenantId = tenant.Id,
            UserId = user.Id,
            Action = "TENANT_REGISTERED",
            Details = $"New tenant {tenant.CompanyName} registered"
        });
        await _db.SaveChangesAsync();

        // Gửi welcome email
        await _emailService.SendWelcomeEmailAsync(request.Email, request.CompanyName, "Starter");

        var token = _jwtService.GenerateToken(user.Id, user.TenantId, user.Email, user.Role);

        var response = new AuthResponse(
            token,
            new UserDto(
                user.Id,
                user.TenantId,
                user.Tenant?.CompanyName,
                user.Email,
                user.FullName,
                user.Role,
                null,
                false
            )
        );

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

        return Ok(new ApiResponse<UserDto>(true, "OK", new UserDto(
            user.Id,
            user.TenantId,
            user.Tenant?.CompanyName,
            user.Email,
            user.FullName,
            user.Role,
            user.LastLoginAt,
            user.TwoFactorEnabled
        )));
    }

    /// <summary>Đổi mật khẩu</summary>
    [HttpPost("change-password")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<object>>> ChangePassword(
        [FromBody] ChangePasswordRequest request)
    {
        var userId = GetUserId();
        var user = await _db.Users.FindAsync(userId);

        if (user == null)
            return NotFound(new ApiResponse<object>(false, "User không tìm thấy.", null));

        if (!BCrypt.Net.BCrypt.Verify(request.CurrentPassword, user.PasswordHash))
            return BadRequest(new ApiResponse<object>(false, "Mật khẩu hiện tại không đúng.", null));

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
        await _db.SaveChangesAsync();

        return Ok(new ApiResponse<object>(true, "Đổi mật khẩu thành công!", null));
    }

    /// <summary>Lấy danh sách user (SuperAdmin hoặc Admin của tenant)</summary>
    [HttpGet("users")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<PagedResult<UserDto>>>> GetUsers(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null)
    {
        var role = GetUserRole();
        var userId = GetUserId();
        var tenantId = GetTenantId();

        IQueryable<User> query = _db.Users.Include(u => u.Tenant);

        if (role == "SuperAdmin")
        {
            // SuperAdmin thấy all users
        }
        else if (role == "Admin")
        {
            // Admin thấy users trong tenant
            query = query.Where(u => u.TenantId == tenantId);
        }
        else
        {
            return Forbid();
        }

        if (!string.IsNullOrEmpty(search))
        {
            query = query.Where(u => u.FullName.Contains(search) || u.Email.Contains(search));
        }

        var totalCount = await query.CountAsync();
        var items = await query
            .OrderByDescending(u => u.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(u => new UserDto(
                u.Id,
                u.TenantId,
                u.Tenant!.CompanyName,
                u.Email,
                u.FullName,
                u.Role,
                u.LastLoginAt,
                u.TwoFactorEnabled
            ))
            .ToListAsync();

        return Ok(new ApiResponse<PagedResult<UserDto>>(true, "OK", new PagedResult<UserDto>(
            items, totalCount, page, pageSize, (int)Math.Ceiling(totalCount / (double)pageSize)
        )));
    }

    /// <summary>Tạo user mới (Admin hoặc SuperAdmin)</summary>
    [HttpPost("users")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<UserDto>>> CreateUser([FromBody] CreateUserRequest request)
    {
        var role = GetUserRole();
        var currentTenantId = GetTenantId();

        if (role != "SuperAdmin" && role != "Admin")
            return Forbid();

        // Admin chỉ được tạo user trong tenant của mình
        if (role == "Admin" && request.TenantId != currentTenantId)
            return Forbid();

        if (await _db.Users.AnyAsync(u => u.Email == request.Email))
            return BadRequest(new ApiResponse<UserDto>(false, "Email đã tồn tại.", null));

        // Admin không được tạo SuperAdmin
        if (role == "Admin" && request.Role == "SuperAdmin")
            return Forbid();

        var user = new User
        {
            TenantId = request.TenantId ?? currentTenantId,
            Email = request.Email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            FullName = request.FullName,
            Role = request.Role,
        };

        _db.Users.Add(user);
        await _db.SaveChangesAsync();

        return Ok(new ApiResponse<UserDto>(true, "Tạo user thành công!", new UserDto(
            user.Id,
            user.TenantId,
            null,
            user.Email,
            user.FullName,
            user.Role,
            null,
            false
        )));
    }

    /// <summary>Cập nhật user</summary>
    [HttpPut("users/{id:guid}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<UserDto>>> UpdateUser(Guid id, [FromBody] UpdateUserRequest request)
    {
        var role = GetUserRole();
        var currentTenantId = GetTenantId();

        var user = await _db.Users.Include(u => u.Tenant).FirstOrDefaultAsync(u => u.Id == id);
        if (user == null)
            return NotFound(new ApiResponse<UserDto>(false, "User không tìm thấy.", null));

        // Permission check
        if (role == "Admin" && user.TenantId != currentTenantId)
            return Forbid();
        if (role == "User")
            return Forbid();

        if (!string.IsNullOrEmpty(request.FullName))
            user.FullName = request.FullName;
        if (!string.IsNullOrEmpty(request.Role))
        {
            if (role == "Admin" && request.Role == "SuperAdmin")
                return Forbid();
            user.Role = request.Role;
        }
        if (request.IsActive.HasValue)
            user.IsActive = request.IsActive.Value;

        await _db.SaveChangesAsync();

        return Ok(new ApiResponse<UserDto>(true, "Cập nhật thành công!", new UserDto(
            user.Id,
            user.TenantId,
            user.Tenant?.CompanyName,
            user.Email,
            user.FullName,
            user.Role,
            user.LastLoginAt,
            user.TwoFactorEnabled
        )));
    }

    /// <summary>Xóa user</summary>
    [HttpDelete("users/{id:guid}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<object>>> DeleteUser(Guid id)
    {
        var role = GetUserRole();
        var currentTenantId = GetTenantId();
        var currentUserId = GetUserId();

        var user = await _db.Users.FindAsync(id);
        if (user == null)
            return NotFound(new ApiResponse<object>(false, "User không tìm thại.", null));

        if (role == "Admin" && user.TenantId != currentTenantId)
            return Forbid();
        if (role == "User")
            return Forbid();

        if (user.Id == currentUserId)
            return BadRequest(new ApiResponse<object>(false, "Không thể tự xóa chính mình.", null));

        _db.Users.Remove(user);
        await _db.SaveChangesAsync();

        return Ok(new ApiResponse<object>(true, "Xóa user thành công!", null));
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

    private static string GenerateSubdomain(string companyName)
    {
        var slug = companyName.ToLower()
            .Replace(" ", "-")
            .Replace(".", "-")
            .Replace(",", "")
            .Replace("(", "")
            .Replace(")", "");
        // Remove diacritics
        slug = slug.Normalize(System.Text.NormalizationForm.FormD);
        slug = new string(slug.Where(c => !char.GetUnicodeCategory(c).Equals(System.Globalization.UnicodeCategory.NonSpacingMark)).ToArray());
        return slug + "-" + Guid.NewGuid().ToString("N")[..6];
    }
}

public record ChangePasswordRequest(string CurrentPassword, string NewPassword);
