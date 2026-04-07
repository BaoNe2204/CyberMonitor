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

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/payment/create-url   (legacy — giữ tương thích)
    // POST /api/payments/create      (endpoint mới frontend gọi)
    // ─────────────────────────────────────────────────────────────────────────

    /// <summary>Tạo URL thanh toán VNPay — legacy route</summary>
    [HttpPost("create-url")]
    [Authorize]
    public Task<ActionResult<ApiResponse<PaymentResponse>>> CreatePaymentUrlLegacy(
        [FromBody] CreatePaymentRequest request) => CreatePaymentUrlInternal(request);

    /// <summary>Tạo URL thanh toán VNPay từ planId</summary>
    [HttpPost("/api/payments/create")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<PaymentResponse>>> CreatePaymentByPlanId(
        [FromBody] CreatePaymentByPlanRequest request)
    {
        var tenantId = GetTenantId();
        if (!tenantId.HasValue)
            return Unauthorized(new ApiResponse<PaymentResponse>(false, "Không xác định được tenant.", null));

        // Lấy thông tin plan từ DB
        PricingPlan? plan = null;
        if (request.PlanId.HasValue)
            plan = await _db.PricingPlans.FindAsync(request.PlanId.Value);

        if (plan == null && !string.IsNullOrEmpty(request.PlanName))
            plan = await _db.PricingPlans.FirstOrDefaultAsync(p => p.Name == request.PlanName && p.IsActive);

        if (plan == null)
            return BadRequest(new ApiResponse<PaymentResponse>(false, "Không tìm thấy gói dịch vụ.", null));

        var amount = request.Amount > 0 ? request.Amount : plan.Price;

        var internalReq = new CreatePaymentRequest(tenantId.Value, plan.Name, amount);
        return await CreatePaymentUrlInternal(internalReq);
    }

    private async Task<ActionResult<ApiResponse<PaymentResponse>>> CreatePaymentUrlInternal(
        CreatePaymentRequest request)
    {
        var tenantId = GetTenantId();
        var userId = GetUserId();

        // Kiểm tra subscription còn active không
        var activeSub = await _db.Subscriptions
            .Where(s => s.TenantId == request.TenantId && s.Status == "Active")
            .OrderByDescending(s => s.EndDate)
            .FirstOrDefaultAsync();

        if (activeSub != null)
        {
            var daysLeft = (activeSub.EndDate - DateTime.UtcNow).TotalDays;
            if (daysLeft > 7)
                return BadRequest(new ApiResponse<PaymentResponse>(false,
                    $"Subscription còn active {daysLeft:N0} ngày. Vui lòng gia hạn khi gần hết hạn.", null));
        }

        var orderId = $"ORD-{DateTime.UtcNow:yyyyMMddHHmmss}-{Guid.NewGuid().ToString("N")[..6].ToUpper()}";
        var description = $"Thanh toan goi {request.PlanName} - CyberMonitor SOC";

        var paymentUrl = _vnpayService.CreatePaymentUrl(request.Amount, orderId, description, null);

        var order = new PaymentOrder
        {
            OrderId    = orderId,
            TenantId   = request.TenantId,
            Amount     = request.Amount,
            PlanName   = request.PlanName,
            Status     = "Pending",
            VnpTxnRef  = orderId,
        };
        _db.PaymentOrders.Add(order);

        _db.AuditLogs.Add(new AuditLog
        {
            TenantId   = request.TenantId,
            UserId     = userId == Guid.Empty ? null : userId,
            Action     = "PAYMENT_INITIATED",
            EntityType = "PaymentOrder",
            EntityId   = orderId,
            Details    = $"Payment initiated: {request.PlanName} - {request.Amount:N0} VND",
        });

        await _db.SaveChangesAsync();

        _logger.LogInformation("Payment URL created: {OrderId} | Plan: {Plan} | Amount: {Amount}",
            orderId, request.PlanName, request.Amount);

        return Ok(new ApiResponse<PaymentResponse>(true, "URL thanh toán đã được tạo!", new PaymentResponse(orderId, paymentUrl)));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/payment/vnpay-return   — VNPay redirect sau thanh toán
    // GET /api/payments/vnpay-return  — Frontend gọi để xác minh
    // ─────────────────────────────────────────────────────────────────────────

    /// <summary>VNPay redirect về sau khi thanh toán (browser redirect)</summary>
    [HttpGet("vnpay-return")]
    [AllowAnonymous]
    public Task<ActionResult> VnpayReturnRedirect() => ProcessVnpayReturn(redirect: true);

    /// <summary>Frontend gọi để xác minh kết quả (AJAX / fetch)</summary>
    [HttpGet("/api/payments/vnpay-return")]
    [AllowAnonymous]
    public Task<ActionResult> VnpayReturnApi() => ProcessVnpayReturn(redirect: false);

    private async Task<ActionResult> ProcessVnpayReturn(bool redirect)
    {
        var vnpData = Request.Query.Keys
            .ToDictionary(k => k, k => Request.Query[k].ToString());

        var result = _vnpayService.ProcessReturn(vnpData);

        var order = await _db.PaymentOrders
            .Include(o => o.Tenant)
            .FirstOrDefaultAsync(o => o.OrderId == result.OrderId);

        if (order == null)
        {
            if (redirect) return Redirect("/payment-result?error=order_not_found");
            return NotFound(new ApiResponse<object>(false, "Không tìm thấy đơn hàng.", null));
        }

        // Tránh xử lý lại đơn đã hoàn thành
        if (order.Status == "Paid")
        {
            if (redirect) return Redirect($"/payment-result?orderId={order.OrderId}&status=success");
            return Ok(new ApiResponse<PaymentResultData>(true, "Giao dịch đã được xử lý trước đó.",
                new PaymentResultData(order.OrderId, order.VnpayTransactionNo, order.Amount, order.PlanName)));
        }

        order.VnpayTransactionNo  = result.TransactionNo;
        order.VnpayResponseCode   = result.ResponseCode;
        order.PaymentMethod       = "VNPay";

        if (result.Success)
        {
            order.Status  = "Paid";
            order.PaidAt  = DateTime.UtcNow;

            await ActivateSubscriptionAsync(order);
            await SendConfirmationEmailAsync(order);

            _db.AuditLogs.Add(new AuditLog
            {
                TenantId   = order.TenantId,
                Action     = "PAYMENT_COMPLETED",
                EntityType = "PaymentOrder",
                EntityId   = order.OrderId,
                Details    = $"Payment completed: {order.PlanName} - {order.Amount:N0} VND | TxnNo: {result.TransactionNo}",
            });

            await _db.SaveChangesAsync();
            _logger.LogInformation("Payment completed: {OrderId}", order.OrderId);

            if (redirect)
                return Redirect($"/payment-result?orderId={order.OrderId}&status=success");

            return Ok(new ApiResponse<PaymentResultData>(true, "Thanh toán thành công!",
                new PaymentResultData(order.OrderId, order.VnpayTransactionNo, order.Amount, order.PlanName)));
        }
        else
        {
            order.Status = "Failed";

            _db.AuditLogs.Add(new AuditLog
            {
                TenantId   = order.TenantId,
                Action     = "PAYMENT_FAILED",
                EntityType = "PaymentOrder",
                EntityId   = order.OrderId,
                Details    = $"Payment failed: {result.Message} | Code: {result.ResponseCode}",
            });

            await _db.SaveChangesAsync();
            _logger.LogWarning("Payment failed: {OrderId} — {Message}", order.OrderId, result.Message);

            if (redirect)
                return Redirect($"/payment-result?orderId={order.OrderId}&status=failed&message={Uri.EscapeDataString(result.Message)}");

            return Ok(new ApiResponse<object>(false, result.Message, null));
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/payment/demo-confirm  — Xác nhận thanh toán demo (không qua VNPay)
    // ─────────────────────────────────────────────────────────────────────────

    [HttpPost("demo-confirm")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<PaymentResultData>>> DemoConfirm(
        [FromBody] DemoConfirmRequest request)
    {
        var tenantId = GetTenantId();
        if (!tenantId.HasValue)
            return Unauthorized(new ApiResponse<PaymentResultData>(false, "Không xác định được tenant.", null));

        // Tạo order mới với status Paid ngay
        var orderId = request.OrderId ?? $"DEMO-{DateTime.UtcNow:yyyyMMddHHmmss}-{Guid.NewGuid().ToString("N")[..6].ToUpper()}";

        // Kiểm tra order đã tồn tại chưa (tránh duplicate)
        var existing = await _db.PaymentOrders.FirstOrDefaultAsync(o => o.OrderId == orderId);
        if (existing != null && existing.Status == "Paid")
        {
            return Ok(new ApiResponse<PaymentResultData>(true, "Giao dịch đã được xử lý.",
                new PaymentResultData(existing.OrderId, existing.VnpayTransactionNo, existing.Amount, existing.PlanName)));
        }

        var order = existing ?? new PaymentOrder
        {
            OrderId   = orderId,
            TenantId  = tenantId.Value,
            Amount    = request.Amount,
            PlanName  = request.PlanName,
            Currency  = "VND",
        };

        order.Status        = "Paid";
        order.PaidAt        = DateTime.UtcNow;
        order.PaymentMethod = request.PaymentMethod ?? "Demo";
        order.VnpayTransactionNo = $"DEMO{DateTime.UtcNow:yyyyMMddHHmmss}";

        if (existing == null) _db.PaymentOrders.Add(order);

        // Kích hoạt subscription
        await ActivateSubscriptionAsync(order);

        _db.AuditLogs.Add(new AuditLog
        {
            TenantId   = tenantId,
            UserId     = GetUserId() == Guid.Empty ? null : GetUserId(),
            Action     = "PAYMENT_DEMO_CONFIRMED",
            EntityType = "PaymentOrder",
            EntityId   = orderId,
            Details    = $"Demo payment confirmed: {request.PlanName} - {request.Amount:N0} VND",
        });

        await _db.SaveChangesAsync();
        _logger.LogInformation("Demo payment confirmed: {OrderId} | Plan: {Plan}", orderId, request.PlanName);

        return Ok(new ApiResponse<PaymentResultData>(true, "Thanh toán thành công!",
            new PaymentResultData(orderId, order.VnpayTransactionNo, order.Amount, order.PlanName)));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/payment/vnpay-ipn  — Instant Payment Notification từ VNPay
    // ─────────────────────────────────────────────────────────────────────────

    [HttpPost("vnpay-ipn")]
    [AllowAnonymous]
    public async Task<ActionResult> VnpayIpn()
    {
        var vnpData = Request.Query.Keys
            .ToDictionary(k => k, k => Request.Query[k].ToString());

        var result = _vnpayService.ProcessReturn(vnpData);
        if (!result.Success) return Ok(new { RspCode = "97", Message = "Invalid signature" });

        var order = await _db.PaymentOrders.FindAsync(result.OrderId);
        if (order == null) return Ok(new { RspCode = "01", Message = "Order not found" });
        if (order.Status == "Paid") return Ok(new { RspCode = "02", Message = "Already confirmed" });

        order.Status              = "Paid";
        order.PaidAt              = DateTime.UtcNow;
        order.VnpayTransactionNo  = result.TransactionNo;
        order.VnpayResponseCode   = result.ResponseCode;

        await ActivateSubscriptionAsync(order);
        await _db.SaveChangesAsync();

        return Ok(new { RspCode = "00", Message = "Confirm success" });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/payment/history
    // ─────────────────────────────────────────────────────────────────────────

    [HttpGet("history")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<List<PaymentHistoryDto>>>> GetPaymentHistory()
    {
        var tenantId = GetTenantId();
        var role     = GetUserRole();

        var query = _db.PaymentOrders.AsQueryable();

        if (role != "SuperAdmin")
        {
            if (!tenantId.HasValue) return Forbid();
            query = query.Where(o => o.TenantId == tenantId.Value);
        }

        var orders = await query
            .OrderByDescending(o => o.CreatedAt)
            .Select(o => new PaymentHistoryDto(
                o.Id.ToString(),
                o.OrderId,
                o.PlanName,
                o.Amount,
                o.Currency,
                o.Status,
                o.PaymentMethod,
                o.VnpayTransactionNo,
                o.VnpayResponseCode,
                o.CreatedAt,
                o.PaidAt
            ))
            .ToListAsync();

        return Ok(new ApiResponse<List<PaymentHistoryDto>>(true, "OK", orders));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/payment/order/{orderId}
    // ─────────────────────────────────────────────────────────────────────────

    [HttpGet("order/{orderId}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<PaymentHistoryDto>>> GetOrder(string orderId)
    {
        var tenantId = GetTenantId();
        var role     = GetUserRole();

        var order = await _db.PaymentOrders
            .FirstOrDefaultAsync(o => o.OrderId == orderId);

        if (order == null)
            return NotFound(new ApiResponse<PaymentHistoryDto>(false, "Không tìm thấy đơn hàng.", null));

        if (role != "SuperAdmin" && order.TenantId != tenantId)
            return Forbid();

        return Ok(new ApiResponse<PaymentHistoryDto>(true, "OK", new PaymentHistoryDto(
            order.Id.ToString(), order.OrderId, order.PlanName, order.Amount,
            order.Currency, order.Status, order.PaymentMethod,
            order.VnpayTransactionNo, order.VnpayResponseCode,
            order.CreatedAt, order.PaidAt)));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Private helpers
    // ─────────────────────────────────────────────────────────────────────────

    private async Task ActivateSubscriptionAsync(PaymentOrder order)
    {
        if (!order.TenantId.HasValue) return;

        // Lấy config từ DB PricingPlans trước, fallback về hardcode
        var plan = await _db.PricingPlans
            .FirstOrDefaultAsync(p => p.Name == order.PlanName && p.IsActive);

        var maxServers   = plan?.Servers ?? GetFallbackPlanConfig(order.PlanName).maxServers;
        var durationDays = GetBillingDays(plan?.BillingPeriod ?? "monthly");

        var subscription = await _db.Subscriptions
            .Where(s => s.TenantId == order.TenantId.Value)
            .OrderByDescending(s => s.EndDate)
            .FirstOrDefaultAsync();

        if (subscription == null)
        {
            subscription = new Subscription
            {
                TenantId   = order.TenantId.Value,
                PlanName   = order.PlanName,
                PlanPrice  = order.Amount,
                MaxServers = maxServers,
                Status     = "Active",
                StartDate  = DateTime.UtcNow,
                EndDate    = DateTime.UtcNow.AddDays(durationDays),
            };
            _db.Subscriptions.Add(subscription);
        }
        else
        {
            // Gia hạn: nếu còn hạn thì cộng thêm, nếu hết hạn thì tính từ hôm nay
            var baseDate = subscription.EndDate > DateTime.UtcNow
                ? subscription.EndDate
                : DateTime.UtcNow;

            subscription.PlanName   = order.PlanName;
            subscription.PlanPrice  = order.Amount;
            subscription.MaxServers = maxServers;
            subscription.Status     = "Active";
            subscription.StartDate  = DateTime.UtcNow;
            subscription.EndDate    = baseDate.AddDays(durationDays);
        }
    }

    private async Task SendConfirmationEmailAsync(PaymentOrder order)
    {
        if (order.Tenant == null || !order.TenantId.HasValue) return;
        try
        {
            var admins = await _db.Users
                .Where(u => u.TenantId == order.TenantId && (u.Role == "Admin" || u.Role == "SuperAdmin"))
                .ToListAsync();

            foreach (var admin in admins)
                await _emailService.SendPaymentConfirmationAsync(admin.Email, order);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to send payment confirmation email for order {OrderId}", order.OrderId);
        }
    }

    private static (int maxServers, int durationDays) GetFallbackPlanConfig(string planName) => planName switch
    {
        "Starter"    => (1,   30),
        "Pro"        => (10,  30),
        "Enterprise" => (999, 365),
        "Unlimited"  => (999, 365),
        _            => (1,   30),
    };

    private static int GetBillingDays(string billingPeriod) => billingPeriod switch
    {
        "yearly"  => 365,
        "monthly" => 30,
        _         => 30,
    };

    private Guid? GetTenantId()
    {
        if (HttpContext.Items.TryGetValue("TenantId", out var v) && v is Guid g) return g;
        var val = User.FindFirstValue("tenantId");
        return val != null ? Guid.Parse(val) : null;
    }

    private Guid GetUserId()
    {
        var val = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return val != null ? Guid.Parse(val) : Guid.Empty;
    }

    private string GetUserRole() =>
        User.FindFirstValue(ClaimTypes.Role) ?? "User";
}

// ─────────────────────────────────────────────────────────────────────────────
// Extra DTOs (local to this controller)
// ─────────────────────────────────────────────────────────────────────────────

public record CreatePaymentByPlanRequest(
    Guid? PlanId,
    string? PlanName,
    decimal Amount
);

public record DemoConfirmRequest(
    string? OrderId,
    string PlanName,
    decimal Amount,
    string? PaymentMethod
);

public record PaymentResultData(
    string OrderId,
    string? TransactionId,
    decimal Amount,
    string PlanName
);

public record PaymentHistoryDto(
    string Id,
    string OrderId,
    string PlanName,
    decimal Amount,
    string Currency,
    string Status,
    string? PaymentMethod,
    string? TransactionNo,
    string? ResponseCode,
    DateTime CreatedAt,
    DateTime? PaidAt
);
