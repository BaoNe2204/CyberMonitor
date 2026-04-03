using System.Security.Cryptography;
using System.Text;
using CyberMonitor.API.Data;
using CyberMonitor.API.Extensions;
using CyberMonitor.API.Models;
using CyberMonitor.API.Models.DTOs;
using CyberMonitor.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
namespace CyberMonitor.API.Controllers;

[ApiController]
[Route("api/payment")]
public class PaymentController : ControllerBase
{
    private readonly CyberMonitorDbContext _db;
    private readonly IVnpayService _vnpayService;
    private readonly IEmailService _emailService;
    private readonly ILogger<PaymentController> _logger;

    public PaymentController(
        CyberMonitorDbContext db,
        IVnpayService vnpayService,
        IEmailService emailService,
        ILogger<PaymentController> logger)
    {
        _db = db;
        _vnpayService = vnpayService;
        _emailService = emailService;
        _logger = logger;
    }

    /// <summary>Tạo URL thanh toán VNPay</summary>
    [HttpPost("create-url")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<PaymentResponse>>> CreatePaymentUrl([FromBody] CreatePaymentRequest request)
    {
        var tenantId = GetTenantId();
        var userId = GetUserId();

        if (tenantId.HasValue && request.TenantId != tenantId.Value)
            return Forbid();

        // Check subscription limit
        var subscription = await _db.Subscriptions
            .Where(s => s.TenantId == request.TenantId)
            .OrderByDescending(s => s.EndDate)
            .FirstOrDefaultAsync();

        if (subscription != null && subscription.Status == "Active")
        {
            var daysLeft = (subscription.EndDate - DateTime.UtcNow).TotalDays;
            if (daysLeft > 0)
                return BadRequest(new ApiResponse<PaymentResponse>(false, $"Subscription còn active {daysLeft:N0} ngày.", null));
        }

        // Generate order
        var orderId = $"ORD-{DateTime.UtcNow:yyyyMMddHHmmss}-{Guid.NewGuid().ToString("N")[..6].ToUpper()}";
        var description = $"Thanh toán gói {request.PlanName} - CyberMonitor SOC Platform";

        var paymentUrl = _vnpayService.CreatePaymentUrl(request.Amount, orderId, description, null);

        // Create order record
        var order = new PaymentOrder
        {
            OrderId = orderId,
            TenantId = request.TenantId,
            Amount = request.Amount,
            PlanName = request.PlanName,
            Status = "Pending",
            VnpTxnRef = orderId
        };

        _db.PaymentOrders.Add(order);

        _db.AuditLogs.Add(new AuditLog
        {
            TenantId = request.TenantId,
            UserId = userId,
            Action = "PAYMENT_INITIATED",
            EntityType = "PaymentOrder",
            EntityId = orderId,
            Details = $"Payment initiated for plan {request.PlanName} - {request.Amount:N0}VND"
        });

        await _db.SaveChangesAsync();

        return Ok(new ApiResponse<PaymentResponse>(true, "URL thanh toán đã được tạo!", new PaymentResponse(orderId, paymentUrl)));
    }

    /// <summary>VNPay webhook return</summary>
    [HttpGet("vnpay-return")]
    [AllowAnonymous]
    public async Task<ActionResult> VnpayReturn()
    {
        var vnpData = new Dictionary<string, string>();
        foreach (var key in Request.Query.Keys)
        {
            vnpData[key] = Request.Query[key].ToString();
        }

        var result = _vnpayService.ProcessReturn(vnpData);

        var order = await _db.PaymentOrders
            .Include(o => o.Tenant)
            .FirstOrDefaultAsync(o => o.OrderId == result.OrderId);

        if (order == null)
            return BadRequest("Order not found");

        order.VnpayTransactionNo = result.TransactionNo;
        order.VnpayResponseCode = result.ResponseCode;
        order.PaymentMethod = "VNPay QR";

        if (result.Success)
        {
            order.Status = "Paid";
            order.PaidAt = DateTime.UtcNow;

            // Activate or upgrade subscription
            var subscription = await _db.Subscriptions
                .Where(s => s.TenantId == order.TenantId)
                .OrderByDescending(s => s.EndDate)
                .FirstOrDefaultAsync();

            var planConfig = GetPlanConfig(order.PlanName);

            if (subscription == null)
            {
                subscription = new Subscription
                {
                    TenantId = order.TenantId!.Value,
                    PlanName = order.PlanName,
                    PlanPrice = order.Amount,
                    MaxServers = planConfig.maxServers,
                    Status = "Active",
                    StartDate = DateTime.UtcNow,
                    EndDate = DateTime.UtcNow.AddDays(planConfig.durationDays)
                };
                _db.Subscriptions.Add(subscription);
            }
            else
            {
                subscription.PlanName = order.PlanName;
                subscription.PlanPrice = order.Amount;
                subscription.MaxServers = planConfig.maxServers;
                subscription.Status = "Active";
                subscription.StartDate = DateTime.UtcNow;
                subscription.EndDate = DateTime.UtcNow.AddDays(planConfig.durationDays);
            }

            // Send confirmation email
            if (order.Tenant != null)
            {
                var adminUsers = await _db.Users
                    .Where(u => u.TenantId == order.TenantId && u.Role == "Admin")
                    .ToListAsync();

                foreach (var admin in adminUsers)
                {
                    await _emailService.SendPaymentConfirmationAsync(admin.Email, order);
                }
            }

            _db.AuditLogs.Add(new AuditLog
            {
                TenantId = order.TenantId,
                Action = "PAYMENT_COMPLETED",
                EntityType = "PaymentOrder",
                EntityId = order.OrderId,
                Details = $"Payment completed for plan {order.PlanName}"
            });

            await _db.SaveChangesAsync();

            _logger.LogInformation("Payment completed: {OrderId}", order.OrderId);

            // Redirect to frontend success
            return Redirect($"/payment/success?orderId={order.OrderId}&amount={order.Amount}&plan={order.PlanName}");
        }
        else
        {
            order.Status = "Failed";

            _db.AuditLogs.Add(new AuditLog
            {
                TenantId = order.TenantId,
                Action = "PAYMENT_FAILED",
                EntityType = "PaymentOrder",
                EntityId = order.OrderId,
                Details = $"Payment failed: {result.Message}"
            });

            await _db.SaveChangesAsync();

            _logger.LogWarning("Payment failed: {OrderId} - {Message}", order.OrderId, result.Message);

            return Redirect($"/payment/failed?orderId={order.OrderId}&message={Uri.EscapeDataString(result.Message)}");
        }
    }

    /// <summary>Webhook cho IPN (Instant Payment Notification)</summary>
    [HttpPost("vnpay-ipn")]
    [AllowAnonymous]
    public async Task<ActionResult> VnpayIpn()
    {
        var vnpData = new Dictionary<string, string>();
        foreach (var key in Request.Query.Keys)
        {
            vnpData[key] = Request.Query[key].ToString();
        }

        var result = _vnpayService.ProcessReturn(vnpData);

        if (result.Success)
        {
            // Process in background
        }

        return Ok();
    }

    /// <summary>Lấy lịch sử thanh toán</summary>
    [HttpGet("history")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<List<PaymentOrder>>>> GetPaymentHistory()
    {
        var tenantId = GetTenantId();
        var role = GetUserRole();

        var orders = _db.PaymentOrders.AsQueryable();

        if (role != "SuperAdmin")
        {
            if (!tenantId.HasValue) return Forbid();
            orders = orders.Where(o => o.TenantId == tenantId);
        }

        var result = await orders.OrderByDescending(o => o.CreatedAt).ToListAsync();

        return Ok(new ApiResponse<List<PaymentOrder>>(true, "OK", result));
    }

    private static (int maxServers, int durationDays) GetPlanConfig(string planName) => planName switch
    {
        "Starter" => (1, 30),
        "Pro" => (10, 30),
        "Enterprise" => (999, 365),
        _ => (1, 30)
    };

    private Guid? GetTenantId()
    {
        if (HttpContext.Items.TryGetValue("TenantId", out var tenantObj) && tenantObj is Guid tenantFromKey)
            return tenantFromKey;
        var val = User.FindFirstValue("tenantId");
        return val != null ? Guid.Parse(val) : null;
    }

    private Guid GetUserId() =>
        Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? Guid.Empty.ToString());

    private string GetUserRole() =>
        User.FindFirstValue(ClaimTypes.Role) ?? "User";
}
