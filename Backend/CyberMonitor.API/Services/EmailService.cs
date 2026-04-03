using System.Net;
using System.Net.Mail;
using CyberMonitor.API.Data;
using CyberMonitor.API.Models;
using Microsoft.EntityFrameworkCore;

namespace CyberMonitor.API.Services;

public interface IEmailService
{
    Task SendAlertEmailAsync(Guid tenantId, string toEmail, Alert alert, Server? server);
    Task SendTicketNotificationAsync(Guid tenantId, string toEmail, Ticket ticket, string action);
    Task SendWelcomeEmailAsync(string toEmail, string companyName, string planName);
    Task SendPaymentConfirmationAsync(string toEmail, PaymentOrder order);
}

public class EmailService : IEmailService
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<EmailService> _logger;

    public EmailService(IConfiguration configuration, ILogger<EmailService> logger)
    {
        _configuration = configuration;
        _logger = logger;
    }

    private SmtpClient BuildSmtpClient()
    {
        var host = _configuration["EmailConfig:SmtpHost"] ?? "smtp.gmail.com";
        var port = int.Parse(_configuration["EmailConfig:SmtpPort"] ?? "587");
        var user = _configuration["EmailConfig:SmtpUser"] ?? "";
        var pass = _configuration["EmailConfig:SmtpPass"] ?? "";

        var client = new SmtpClient(host, port)
        {
            EnableSsl = true,
            Credentials = new NetworkCredential(user, pass)
        };
        return client;
    }

    private string GetFromEmail() => _configuration["EmailConfig:FromEmail"] ?? "noreply@cybermonitor.vn";
    private string GetFromName() => _configuration["EmailConfig:FromName"] ?? "CyberMonitor SOC";

    public async Task SendAlertEmailAsync(Guid tenantId, string toEmail, Alert alert, Server? server)
    {
        try
        {
            var severityColor = alert.Severity switch
            {
                "Critical" => "#DC2626",
                "High" => "#EA580C",
                "Medium" => "#D97706",
                _ => "#16A34A"
            };

            var body = $@"
<!DOCTYPE html>
<html>
<head>
    <meta charset='utf-8'>
    <style>
        body {{ font-family: 'Segoe UI', Arial, sans-serif; background: #0f172a; color: #f1f5f9; margin: 0; padding: 20px; }}
        .container {{ max-width: 600px; margin: 0 auto; background: #1e293b; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.3); }}
        .header {{ background: linear-gradient(135deg, #dc2626, #991b1b); padding: 24px; text-align: center; }}
        .header h1 {{ color: white; margin: 0; font-size: 24px; }}
        .content {{ padding: 24px; }}
        .severity-badge {{ display: inline-block; padding: 4px 12px; border-radius: 20px; font-weight: bold; font-size: 12px; color: white; background: {severityColor}; }}
        .detail-row {{ padding: 12px 0; border-bottom: 1px solid #334155; }}
        .detail-label {{ color: #94a3b8; font-size: 12px; text-transform: uppercase; }}
        .detail-value {{ color: #f1f5f9; font-size: 16px; margin-top: 4px; }}
        .action-btn {{ display: inline-block; background: #dc2626; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 16px; }}
        .footer {{ background: #0f172a; padding: 16px; text-align: center; color: #64748b; font-size: 12px; }}
    </style>
</head>
<body>
    <div class='container'>
        <div class='header'>
            <h1>🚨 CẢNH BÁO BẢO MẬT - {alert.Severity.ToUpper()}</h1>
        </div>
        <div class='content'>
            <span class='severity-badge'>{alert.AlertType}</span>
            <h2 style='color: #f1f5f9; margin-top: 16px;'>{alert.Title}</h2>
            <p style='color: #94a3b8;'>{alert.Description}</p>
            <div class='detail-row'>
                <div class='detail-label'>Server bị ảnh hưởng</div>
                <div class='detail-value'>{(server != null ? $"{server.Name} ({server.IpAddress})" : "N/A")}</div>
            </div>
            <div class='detail-row'>
                <div class='detail-label'>IP nguồn tấn công</div>
                <div class='detail-value' style='color: #ef4444;'>{alert.SourceIp ?? "Không xác định"}</div>
            </div>
            <div class='detail-row'>
                <div class='detail-label'>MITRE ATT&CK</div>
                <div class='detail-value'>{alert.MitreTactic} → {alert.MitreTechnique}</div>
            </div>
            <div class='detail-row'>
                <div class='detail-label'>Thời gian</div>
                <div class='detail-value'>{alert.CreatedAt:dd/MM/yyyy HH:mm:ss} UTC</div>
            </div>
            <div class='detail-row'>
                <div class='detail-label'>Hành động khuyến nghị</div>
                <div class='detail-value'>{alert.RecommendedAction}</div>
            </div>
            <a href='#' class='action-btn'>XEM CHI TIẾT →</a>
        </div>
        <div class='footer'>
            CyberMonitor SOC Platform | Email tự động - Vui lòng không reply
        </div>
    </div>
</body>
</html>";

            var msg = new MailMessage
            {
                From = new MailAddress(GetFromEmail(), GetFromName()),
                Subject = $"🚨 [{alert.Severity}] {alert.Title}",
                Body = body,
                IsBodyHtml = true
            };
            msg.To.Add(toEmail);

            using var client = BuildSmtpClient();
            await client.SendMailAsync(msg);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send alert email to {Email}", toEmail);
        }
    }

    public async Task SendTicketNotificationAsync(Guid tenantId, string toEmail, Ticket ticket, string action)
    {
        try
        {
            var body = $@"
<!DOCTYPE html>
<html>
<head>
    <meta charset='utf-8'>
    <style>
        body {{ font-family: 'Segoe UI', Arial, sans-serif; background: #0f172a; color: #f1f5f9; margin: 0; padding: 20px; }}
        .container {{ max-width: 600px; margin: 0 auto; background: #1e293b; border-radius: 12px; overflow: hidden; }}
        .header {{ background: linear-gradient(135deg, #3b82f6, #1d4ed8); padding: 24px; text-align: center; }}
        .content {{ padding: 24px; }}
        .ticket-number {{ background: #334155; padding: 8px 16px; border-radius: 6px; font-family: monospace; font-size: 18px; color: #60a5fa; }}
        .status-badge {{ display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; }}
        .footer {{ background: #0f172a; padding: 16px; text-align: center; color: #64748b; font-size: 12px; }}
    </style>
</head>
<body>
    <div class='container'>
        <div class='header'>
            <h1 style='color: white; margin: 0;'>🎫 PHIẾU SỰ CỐ MỚI</h1>
        </div>
        <div class='content'>
            <div class='ticket-number'>{ticket.TicketNumber}</div>
            <h2 style='color: #f1f5f9;'>{ticket.Title}</h2>
            <p style='color: #94a3b8;'>{ticket.Description}</p>
            <p><strong>Trạng thái:</strong> <span class='status-badge'>{ticket.Status}</span></p>
            <p><strong>Độ ưu tiên:</strong> {ticket.Priority}</p>
            <p><strong>Thao tác:</strong> {action}</p>
        </div>
        <div class='footer'>CyberMonitor SOC Platform</div>
    </div>
</body>
</html>";

            var msg = new MailMessage
            {
                From = new MailAddress(GetFromEmail(), GetFromName()),
                Subject = $"🎫 [{ticket.TicketNumber}] {action}",
                Body = body,
                IsBodyHtml = true
            };
            msg.To.Add(toEmail);

            using var client = BuildSmtpClient();
            await client.SendMailAsync(msg);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send ticket email to {Email}", toEmail);
        }
    }

    public async Task SendWelcomeEmailAsync(string toEmail, string companyName, string planName)
    {
        try
        {
            var body = $@"
<!DOCTYPE html>
<html>
<head><meta charset='utf-8'></head>
<body style='font-family: Arial, sans-serif; background: #0f172a; color: #f1f5f9; padding: 40px;'>
    <div style='max-width: 600px; margin: 0 auto; background: #1e293b; border-radius: 12px; padding: 32px;'>
        <h1 style='color: #10b981;'>🎉 Chào mừng {companyName}!</h1>
        <p>Bạn đã đăng ký thành công gói <strong>{planName}</strong> trên CyberMonitor SOC Platform.</p>
        <p>Hệ thống của bạn đã sẵn sàng bảo vệ 24/7.</p>
        <a href='#' style='display: inline-block; background: #10b981; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none;'>ĐĂNG NHẬP NGAY</a>
    </div>
</body>
</html>";

            var msg = new MailMessage
            {
                From = new MailAddress(GetFromEmail(), GetFromName()),
                Subject = $"🎉 Chào mừng {companyName} đến với CyberMonitor SOC!",
                Body = body,
                IsBodyHtml = true
            };
            msg.To.Add(toEmail);

            using var client = BuildSmtpClient();
            await client.SendMailAsync(msg);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send welcome email to {Email}", toEmail);
        }
    }

    public async Task SendPaymentConfirmationAsync(string toEmail, PaymentOrder order)
    {
        try
        {
            var body = $@"
<!DOCTYPE html>
<html>
<head><meta charset='utf-8'></head>
<body style='font-family: Arial, sans-serif; background: #0f172a; color: #f1f5f9; padding: 40px;'>
    <div style='max-width: 600px; margin: 0 auto; background: #1e293b; border-radius: 12px; padding: 32px;'>
        <h1 style='color: #10b981;'>✅ Thanh toán thành công!</h1>
        <p><strong>Mã đơn hàng:</strong> {order.OrderId}</p>
        <p><strong>Gói dịch vụ:</strong> {order.PlanName}</p>
        <p><strong>Số tiền:</strong> {order.Amount:N0} VND</p>
        <p><strong>Trạng thái:</strong> Đã thanh toán</p>
    </div>
</body>
</html>";

            var msg = new MailMessage
            {
                From = new MailAddress(GetFromEmail(), GetFromName()),
                Subject = $"✅ Xác nhận thanh toán - {order.OrderId}",
                Body = body,
                IsBodyHtml = true
            };
            msg.To.Add(toEmail);

            using var client = BuildSmtpClient();
            await client.SendMailAsync(msg);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send payment confirmation to {Email}", toEmail);
        }
    }
}
