using System.Text;
using CyberMonitor.API.Data;
using CyberMonitor.API.Hubs;
using CyberMonitor.API.Middlewares;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException("DefaultConnection not found");

try
{
    var csb = new Microsoft.Data.SqlClient.SqlConnectionStringBuilder(connectionString);
    Console.WriteLine($"[DB] DataSource={csb.DataSource}; InitialCatalog={csb.InitialCatalog}");
}
catch { /* ignore parse errors */ }

builder.Services.AddDbContext<CyberMonitorDbContext>(options =>
    options.UseSqlServer(connectionString, sqlOptions =>
    {
        sqlOptions.EnableRetryOnFailure(5, TimeSpan.FromSeconds(30), null);
        sqlOptions.CommandTimeout(60);
    }));

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
    });

builder.Services.AddSignalR();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "CyberMonitor SOC API",
        Version = "v1",
        Description = "Security Operations Center API - SOC Platform"
    });

    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT Authorization header using the Bearer scheme",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
    });

    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

var jwtSecretKey = builder.Configuration["JwtSettings:SecretKey"]
    ?? throw new InvalidOperationException("JwtSettings:SecretKey is not configured");
var key = Encoding.UTF8.GetBytes(jwtSecretKey);

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(key),
        ValidateIssuer = true,
        ValidIssuer = builder.Configuration["JwtSettings:Issuer"],
        ValidateAudience = true,
        ValidAudience = builder.Configuration["JwtSettings:Audience"],
        ValidateLifetime = true,
        ClockSkew = TimeSpan.Zero
    };

    // SignalR token from query string
    options.Events = new JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            var accessToken = context.Request.Query["access_token"];
            var path = context.HttpContext.Request.Path;
            if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
            {
                context.Token = accessToken;
            }
            return Task.CompletedTask;
        }
    };
});

builder.Services.AddAuthorization();

builder.Services.AddScoped<CyberMonitor.API.Services.IJwtService, CyberMonitor.API.Services.JwtService>();
builder.Services.AddScoped<CyberMonitor.API.Services.IVnpayService, CyberMonitor.API.Services.VnpayService>();
builder.Services.AddScoped<CyberMonitor.API.Services.IEmailService, CyberMonitor.API.Services.EmailService>();
builder.Services.AddScoped<CyberMonitor.API.Services.ITelegramService, CyberMonitor.API.Services.TelegramService>();
builder.Services.AddHostedService<CyberMonitor.API.Services.AlertDigestBackgroundService>();
builder.Services.AddHttpClient();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        // Cho phép localhost + mạng LAN (192.168.x) để VM / máy khác mở Frontend bằng IP vẫn gọi được API
        policy
            .SetIsOriginAllowed(static origin =>
            {
                if (string.IsNullOrEmpty(origin)) return false;
                try
                {
                    var uri = new Uri(origin);
                    var h = uri.Host;
                    if (h is "localhost" or "127.0.0.1") return true;
                    if (h.StartsWith("192.168.", StringComparison.Ordinal)) return true;
                    if (h.StartsWith("10.", StringComparison.Ordinal)) return true;
                    return false;
                }
                catch
                {
                    return false;
                }
            })
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

builder.Services.AddHealthChecks()
    .AddSqlServer(connectionString, name: "sqlserver");

var app = builder.Build();

// Auto-migrate database on startup
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<CyberMonitorDbContext>();
    try
    {
        await db.Database.EnsureCreatedAsync();
        await db.Database.ExecuteSqlRawAsync(@"
IF COL_LENGTH('Users', 'EmailAlertsEnabled') IS NULL
BEGIN
    ALTER TABLE Users ADD EmailAlertsEnabled BIT NOT NULL CONSTRAINT DF_Users_EmailAlertsEnabled DEFAULT 1;
END;

IF COL_LENGTH('Users', 'TelegramAlertsEnabled') IS NULL
BEGIN
    ALTER TABLE Users ADD TelegramAlertsEnabled BIT NOT NULL CONSTRAINT DF_Users_TelegramAlertsEnabled DEFAULT 0;
END;

IF COL_LENGTH('Users', 'PushNotificationsEnabled') IS NULL
BEGIN
    ALTER TABLE Users ADD PushNotificationsEnabled BIT NOT NULL CONSTRAINT DF_Users_PushNotificationsEnabled DEFAULT 1;
END;

IF COL_LENGTH('Users', 'TelegramChatId') IS NULL
BEGIN
    ALTER TABLE Users ADD TelegramChatId NVARCHAR(100) NULL;
END;

IF COL_LENGTH('Users', 'SessionTimeoutEnabled') IS NULL
BEGIN
    ALTER TABLE Users ADD SessionTimeoutEnabled BIT NOT NULL CONSTRAINT DF_Users_SessionTimeoutEnabled DEFAULT 0;
END;

IF COL_LENGTH('Users', 'SessionTimeoutMinutes') IS NULL
BEGIN
    ALTER TABLE Users ADD SessionTimeoutMinutes INT NOT NULL CONSTRAINT DF_Users_SessionTimeoutMinutes DEFAULT 30;
END;

IF COL_LENGTH('Users', 'AlertSeverityThreshold') IS NULL
BEGIN
    ALTER TABLE Users ADD AlertSeverityThreshold NVARCHAR(20) NOT NULL CONSTRAINT DF_Users_AlertSeverityThreshold DEFAULT 'Medium';
END;

IF COL_LENGTH('Users', 'AlertDigestMode') IS NULL
BEGIN
    ALTER TABLE Users ADD AlertDigestMode NVARCHAR(20) NOT NULL CONSTRAINT DF_Users_AlertDigestMode DEFAULT 'realtime';
END;");
        Console.WriteLine("Database connected successfully!");
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Database connection failed: {ex.Message}");
    }
}

app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "CyberMonitor API v1");
    c.RoutePrefix = "swagger";
});

app.UseCors("AllowFrontend");

app.UseAuthentication();
app.UseAuthorization();
app.UseApiKeyAuth(); // Middleware kiểm tra API Key cho Agent

app.MapControllers();
app.MapHub<AlertHub>("/hubs/alerts");
app.MapHub<AgentHub>("/hubs/agents");
app.MapHealthChecks("/health");
app.MapHealthChecks("/api/health");

app.MapGet("/", () => new
{
    name = "CyberMonitor SOC API",
    version = "1.0.0",
    status = "running",
    docs = "/swagger",
    health = "/health"
});

Console.WriteLine("CyberMonitor API listening on http://0.0.0.0:5000 (LAN + localhost)");

app.Run();
