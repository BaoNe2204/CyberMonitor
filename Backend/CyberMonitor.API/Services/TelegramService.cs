using System.Net;
using CyberMonitor.API.Data;
using CyberMonitor.API.Models;
using Microsoft.EntityFrameworkCore;

namespace CyberMonitor.API.Services;

public interface ITelegramService
{
    Task<int> SendAlertAsync(Guid tenantId, Alert alert, Server? server, Ticket? ticket);
}

public class TelegramService : ITelegramService
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<TelegramService> _logger;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly CyberMonitorDbContext _db;

    public TelegramService(
        IConfiguration configuration,
        ILogger<TelegramService> logger,
        IHttpClientFactory httpClientFactory,
        CyberMonitorDbContext db)
    {
        _configuration = configuration;
        _logger = logger;
        _httpClientFactory = httpClientFactory;
        _db = db;
    }

    public async Task<int> SendAlertAsync(Guid tenantId, Alert alert, Server? server, Ticket? ticket)
    {
        if (!IsEnabled())
            return 0;

        var botToken = _configuration["TelegramBot:BotToken"];
        if (string.IsNullOrWhiteSpace(botToken))
        {
            _logger.LogWarning("TelegramBot is enabled but BotToken is missing.");
            return 0;
        }

        var chatIds = await GetChatIdsAsync(alert.ServerId);
        if (chatIds.Count == 0)
        {
            _logger.LogInformation("No Telegram recipients configured for alert {AlertId}", alert.Id);
            return 0;
        }

        var client = _httpClientFactory.CreateClient(nameof(TelegramService));
        var endpoint = $"https://api.telegram.org/bot{botToken}/sendMessage";
        var message = BuildAlertMessage(tenantId, alert, server, ticket);

        var sentCount = 0;

        foreach (var chatId in chatIds)
        {
            try
            {
                using var content = new FormUrlEncodedContent(new Dictionary<string, string>
                {
                    ["chat_id"] = chatId,
                    ["text"] = message,
                    ["parse_mode"] = "HTML",
                    ["disable_web_page_preview"] = "true",
                });

                using var response = await client.PostAsync(endpoint, content);
                if (response.IsSuccessStatusCode)
                {
                    sentCount++;
                    continue;
                }

                var responseBody = await response.Content.ReadAsStringAsync();
                _logger.LogWarning(
                    "Failed to send Telegram alert to chat {ChatId}. Status={StatusCode}, Response={Response}",
                    chatId,
                    (int)response.StatusCode,
                    responseBody);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to send Telegram alert to chat {ChatId}", chatId);
            }
        }

        return sentCount;
    }

    private bool IsEnabled()
    {
        var enabled = _configuration["TelegramBot:Enabled"];
        return bool.TryParse(enabled, out var value) && value;
    }

    private async Task<List<string>> GetChatIdsAsync(Guid? serverId)
    {
        var results = new HashSet<string>(StringComparer.Ordinal);

        if (serverId.HasValue)
        {
            var serverChatIds = await _db.ServerTelegramRecipients
                .Where(r => r.ServerId == serverId.Value && r.IsActive)
                .Select(r => r.ChatId)
                .ToListAsync();

            foreach (var chatId in serverChatIds)
            {
                if (!string.IsNullOrWhiteSpace(chatId))
                    results.Add(chatId.Trim());
            }
        }

        foreach (var chatId in GetConfiguredFallbackChatIds())
            results.Add(chatId);

        return results.ToList();
    }

    private List<string> GetConfiguredFallbackChatIds()
    {
        var configured = _configuration.GetSection("TelegramBot:ChatIds").Get<string[]>() ?? [];
        if (configured.Length > 0)
        {
            return configured
                .Where(static id => !string.IsNullOrWhiteSpace(id))
                .Select(static id => id.Trim())
                .ToList();
        }

        var single = _configuration["TelegramBot:ChatId"];
        if (!string.IsNullOrWhiteSpace(single))
            return [single.Trim()];

        var csv = _configuration["TelegramBot:ChatIdsCsv"];
        if (string.IsNullOrWhiteSpace(csv))
            return [];

        return csv
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(static id => !string.IsNullOrWhiteSpace(id))
            .ToList();
    }

    private static string BuildAlertMessage(Guid tenantId, Alert alert, Server? server, Ticket? ticket)
    {
        var severityIcon = alert.Severity switch
        {
            "Critical" => "[CRITICAL]",
            "High" => "[HIGH]",
            "Medium" => "[MEDIUM]",
            _ => "[LOW]"
        };

        var lines = new List<string>
        {
            $"<b>{severityIcon} CyberMonitor Alert</b>",
            $"<b>Type:</b> {Encode(alert.AlertType)}",
            $"<b>Title:</b> {Encode(alert.Title)}",
            $"<b>Severity:</b> {Encode(alert.Severity)}",
            $"<b>Source IP:</b> {Encode(alert.SourceIp ?? "Unknown")}",
            $"<b>Server:</b> {Encode(server != null ? $"{server.Name} ({server.IpAddress})" : "N/A")}",
            $"<b>Tenant:</b> {Encode(tenantId.ToString())}",
            $"<b>MITRE:</b> {Encode($"{alert.MitreTactic} -> {alert.MitreTechnique}")}",
            $"<b>Time (UTC):</b> {Encode(alert.CreatedAt.ToString("yyyy-MM-dd HH:mm:ss"))}"
        };

        if (alert.AnomalyScore.HasValue)
            lines.Add($"<b>Anomaly Score:</b> {Encode(alert.AnomalyScore.Value.ToString("0.0000"))}");
        if (!string.IsNullOrWhiteSpace(alert.RecommendedAction))
            lines.Add($"<b>Action:</b> {Encode(alert.RecommendedAction)}");
        if (ticket != null)
            lines.Add($"<b>Ticket:</b> {Encode(ticket.TicketNumber)}");

        return string.Join("\n", lines);
    }

    private static string Encode(string value) => WebUtility.HtmlEncode(value);
}
