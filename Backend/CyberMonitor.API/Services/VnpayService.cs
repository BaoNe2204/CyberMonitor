using System.Security.Cryptography;
using System.Text;
using CyberMonitor.API.Data;
using CyberMonitor.API.Models;
using Microsoft.EntityFrameworkCore;

namespace CyberMonitor.API.Services;

public interface IVnpayService
{
    string CreatePaymentUrl(decimal amount, string orderId, string description, string? returnUrl);
    VnpayReturnResult ProcessReturn(Dictionary<string, string> vnpData);
}

public record VnpayReturnResult(
    bool Success,
    string OrderId,
    string? TransactionNo,
    string? ResponseCode,
    string Message
);

public class VnpayService : IVnpayService
{
    private readonly IConfiguration _configuration;

    public VnpayService(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    public string CreatePaymentUrl(decimal amount, string orderId, string description, string? returnUrl)
    {
        var vnpayUrl = _configuration["VNPayConfig:Url"]
            ?? "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
        var tmnCode = _configuration["VNPayConfig:TmnCode"] ?? "YOUR_TMN_CODE";
        var hashSecret = _configuration["VNPayConfig:HashSecret"] ?? "YOUR_HASH_SECRET";
        var baseReturnUrl = _configuration["VNPayConfig:ReturnUrl"]
            ?? "http://localhost:5173/payment/return";

        var returnUrlFinal = returnUrl ?? baseReturnUrl;

        var vnpParams = new SortedDictionary<string, string>
        {
            ["vnp_Version"] = "2.1.0",
            ["vnp_Command"] = "pay",
            ["vnp_TmnCode"] = tmnCode,
            ["vnp_Amount"] = ((long)(amount * 100)).ToString(),
            ["vnp_CreateDate"] = DateTime.UtcNow.ToString("yyyyMMddHHmmss"),
            ["vnp_CurrCode"] = "VND",
            ["vnp_IpAddr"] = "127.0.0.1",
            ["vnp_Locale"] = "vn",
            ["vnp_OrderInfo"] = description,
            ["vnp_OrderType"] = "billpayment",
            ["vnp_ReturnUrl"] = returnUrlFinal,
            ["vnp_TxnRef"] = orderId
        };

        var queryString = new StringBuilder();
        foreach (var param in vnpParams)
        {
            if (!string.IsNullOrEmpty(param.Value))
            {
                queryString.Append($"{param.Key}={Uri.EscapeDataString(param.Value)}&");
            }
        }

        var signData = string.Join("&", vnpParams
            .Where(p => !string.IsNullOrEmpty(p.Value))
            .Select(p => $"{p.Key}={Uri.EscapeDataString(p.Value)}"));

        var secureHash = ComputeHmacSha512(hashSecret, signData);
        queryString.Append($"vnp_SecureHash={secureHash}");

        return $"{vnpayUrl}?{queryString}";
    }

    public VnpayReturnResult ProcessReturn(Dictionary<string, string> vnpData)
    {
        var hashSecret = _configuration["VNPayConfig:HashSecret"] ?? "YOUR_HASH_SECRET";

        var secureHash = vnpData.GetValueOrDefault("vnp_SecureHash", "");
        vnpData.Remove("vnp_SecureHash");

        var signData = string.Join("&", vnpData
            .OrderBy(p => p.Key)
            .Where(p => !string.IsNullOrEmpty(p.Value))
            .Select(p => $"{p.Key}={Uri.EscapeDataString(p.Value)}"));

        var computedHash = ComputeHmacSha512(hashSecret, signData);

        if (computedHash != secureHash)
        {
            return new VnpayReturnResult(false, vnpData.GetValueOrDefault("vnp_TxnRef", ""),
                null, vnpData.GetValueOrDefault("vnp_ResponseCode", ""), "Chữ ký không hợp lệ!");
        }

        var responseCode = vnpData.GetValueOrDefault("vnp_ResponseCode", "");
        var success = responseCode == "00";

        var message = responseCode switch
        {
            "00" => "Giao dịch thành công",
            "07" => "Giao dịch bị nghi ngờ (trùng lặp)",
            "09" => "Thẻ/Tài khoản chưa đăng ký Internet Banking",
            "10" => "Xác thực khách hàng thất bại",
            "11" => "Giao dịch đang xử lý",
            "24" => "Khách hàng hủy giao dịch",
            "99" => "Lỗi không xác định",
            _ => "Giao dịch thất bại"
        };

        return new VnpayReturnResult(
            success,
            vnpData.GetValueOrDefault("vnp_TxnRef", ""),
            vnpData.GetValueOrDefault("vnp_TransactionNo", ""),
            responseCode,
            message
        );
    }

    private static string ComputeHmacSha512(string key, string data)
    {
        using var hmac = new HMACSHA512(Encoding.UTF8.GetBytes(key));
        var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(data));
        return BitConverter.ToString(hash).Replace("-", "").ToLower();
    }
}
