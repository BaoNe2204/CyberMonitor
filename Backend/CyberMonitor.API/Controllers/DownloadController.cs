using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CyberMonitor.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class DownloadController : ControllerBase
{
    private readonly ILogger<DownloadController> _logger;
    private readonly IWebHostEnvironment _env;

    public DownloadController(ILogger<DownloadController> logger, IWebHostEnvironment env)
    {
        _logger = logger;
        _env = env;
    }

    /// <summary>
    /// Kiểm tra trạng thái Agent - có tồn tại không, size bao nhiêu
    /// </summary>
    [HttpGet("agent-status")]
    [AllowAnonymous]
    public IActionResult GetAgentStatus()
    {
        var agentPath = GetAgentPath();
        if (System.IO.File.Exists(agentPath))
        {
            var fileInfo = new System.IO.FileInfo(agentPath);
            return Ok(new
            {
                exists = true,
                sizeBytes = fileInfo.Length,
                sizeMB = Math.Round(fileInfo.Length / (double)(1024 * 1024), 2),
                lastModified = fileInfo.LastWriteTimeUtc,
                version = "v1.0.0",
                path = agentPath
            });
        }

        return Ok(new
        {
            exists = false,
            message = "Agent chưa được build. Chạy script build để tạo file EXE.",
            buildScript = "Agent/Agent_build_exe/build.ps1",
            instructions = new[]
            {
                "Mở PowerShell (Admin)",
                "cd Agent/Agent_build_exe",
                "powershell -ExecutionPolicy Bypass -File build.ps1",
                "File EXE sẽ được tạo tại dist/CyberMonitorAgent.exe"
            }
        });
    }

    /// <summary>
    /// Download CyberMonitor Agent executable
    /// </summary>
    [HttpGet("agent")]
    [AllowAnonymous]
    public IActionResult DownloadAgent()
    {
        var agentPath = GetAgentPath();
        try
        {
            if (!System.IO.File.Exists(agentPath))
            {
                return NotFound(new
                {
                    success = false,
                    message = "Agent chưa được build. Chạy Agent/Agent_build_exe/build.ps1 để tạo file EXE.",
                    hint = "powershell -ExecutionPolicy Bypass -File Agent\\Agent_build_exe\\build.ps1"
                });
            }

            var fileBytes = System.IO.File.ReadAllBytes(agentPath);
            _logger.LogInformation("[DOWNLOAD] Agent downloaded: {Size} bytes", fileBytes.Length);
            return File(fileBytes, "application/vnd.microsoft.portable-executable", "CyberMonitorAgent.exe");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi tải Agent");
            return StatusCode(500, new { success = false, message = "Lỗi hệ thống", error = ex.Message });
        }
    }

    private string GetAgentPath()
    {
        var apiPath = _env.ContentRootPath;
        var rootProjectDir = Directory.GetParent(apiPath)?.FullName
                           ?? throw new Exception("Không tìm thấy thư mục gốc dự án");
        return Path.Combine(rootProjectDir, "Agent", "Agent_build_exe", "dist", "CyberMonitorAgent.exe");
    }
}
