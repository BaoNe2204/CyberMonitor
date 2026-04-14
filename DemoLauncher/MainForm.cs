using System.Diagnostics;
using System.Text;

namespace DemoLauncher;

public partial class MainForm : Form
{
    private Process backendProcess;
    private Process aiEngineProcess;
    private Process frontendProcess;

    private readonly string projectRoot;
    private readonly string backendPath;
    private readonly string aiEnginePath;
    private readonly string frontendPath;

    public MainForm()
    {
        InitializeComponent();

        // Get project root path
        projectRoot = Path.GetFullPath(Path.Combine(Application.StartupPath, "..", "..", "..", ".."));
        backendPath = Path.Combine(projectRoot, "Backend", "CyberMonitor.API");
        aiEnginePath = Path.Combine(projectRoot, "Al-Engine");
        frontendPath = Path.Combine(projectRoot, "Frontend");

        // Set form properties
        this.Text = "CyberMonitor Demo Launcher";
        this.Size = new Size(920, 650);
        this.StartPosition = FormStartPosition.CenterScreen;
        this.FormBorderStyle = FormBorderStyle.FixedDialog;
        this.MaximizeBox = false;
        this.BackColor = Color.FromArgb(15, 23, 42);

        // Handle form closing
        this.FormClosing += MainForm_FormClosing;
    }

    private void MainForm_FormClosing(object sender, FormClosingEventArgs e)
    {
        var result = MessageBox.Show(
            "Bạn có muốn dừng tất cả services trước khi thoát?",
            "Xác nhận thoát",
            MessageBoxButtons.YesNoCancel,
            MessageBoxIcon.Question
        );

        if (result == DialogResult.Cancel)
        {
            e.Cancel = true;
            return;
        }

        if (result == DialogResult.Yes)
        {
            StopAllServices();
        }
    }

    private void StopAllServices()
    {
        StopProcess(backendProcess, "Backend");
        StopProcess(aiEngineProcess, "AI Engine");
        StopProcess(frontendProcess, "Frontend");
    }

    private void StopProcess(Process process, string name)
    {
        if (process != null && !process.HasExited)
        {
            try
            {
                process.Kill(true);
                process.WaitForExit(3000);
                
                if (name == "Backend")
                    AppendBackendLog($"✓ {name} stopped");
                else if (name == "AI Engine")
                    AppendAIEngineLog($"✓ {name} stopped");
                else if (name == "Frontend")
                    AppendFrontendLog($"✓ {name} stopped");
            }
            catch (Exception ex)
            {
                if (name == "Backend")
                    AppendBackendLog($"✗ Error: {ex.Message}");
                else if (name == "AI Engine")
                    AppendAIEngineLog($"✗ Error: {ex.Message}");
                else if (name == "Frontend")
                    AppendFrontendLog($"✗ Error: {ex.Message}");
            }
        }
    }

    private void BtnBackend_Click(object sender, EventArgs e)
    {
        if (backendProcess != null && !backendProcess.HasExited)
        {
            MessageBox.Show("Backend đang chạy!", "Thông báo", MessageBoxButtons.OK, MessageBoxIcon.Information);
            return;
        }

        try
        {
            AppendBackendLog("🚀 Starting Backend API...");

            var startInfo = new ProcessStartInfo
            {
                FileName = "dotnet",
                Arguments = "run",
                WorkingDirectory = backendPath,
                UseShellExecute = false,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                CreateNoWindow = true,
                StandardOutputEncoding = Encoding.UTF8,
                StandardErrorEncoding = Encoding.UTF8
            };

            backendProcess = new Process { StartInfo = startInfo };
            backendProcess.OutputDataReceived += (s, ev) => {
                if (!string.IsNullOrEmpty(ev.Data))
                {
                    BeginInvoke(() => AppendBackendLog(ev.Data));
                    
                    if (ev.Data.Contains("Now listening on"))
                    {
                        BeginInvoke(() => {
                            btnBackend.BackColor = Color.FromArgb(34, 197, 94);
                            btnBackend.Text = "✓ Backend";
                        });
                    }
                }
            };
            backendProcess.ErrorDataReceived += (s, ev) => {
                if (!string.IsNullOrEmpty(ev.Data))
                    BeginInvoke(() => AppendBackendLog($"ERROR: {ev.Data}"));
            };

            backendProcess.Start();
            backendProcess.BeginOutputReadLine();
            backendProcess.BeginErrorReadLine();

            btnBackend.BackColor = Color.FromArgb(234, 179, 8);
            btnBackend.Text = "⏳ Backend...";
        }
        catch (Exception ex)
        {
            AppendBackendLog($"✗ Error: {ex.Message}");
            MessageBox.Show($"Lỗi: {ex.Message}", "Lỗi", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }

    private void BtnAIEngine_Click(object sender, EventArgs e)
    {
        if (aiEngineProcess != null && !aiEngineProcess.HasExited)
        {
            MessageBox.Show("AI Engine đang chạy!", "Thông báo", MessageBoxButtons.OK, MessageBoxIcon.Information);
            return;
        }

        try
        {
            AppendAIEngineLog("🚀 Starting AI Engine...");

            var startInfo = new ProcessStartInfo
            {
                FileName = "python",
                Arguments = "ai_engine.py",
                WorkingDirectory = aiEnginePath,
                UseShellExecute = false,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                CreateNoWindow = true,
                StandardOutputEncoding = Encoding.UTF8,
                StandardErrorEncoding = Encoding.UTF8
            };

            aiEngineProcess = new Process { StartInfo = startInfo };
            aiEngineProcess.OutputDataReceived += (s, ev) => {
                if (!string.IsNullOrEmpty(ev.Data))
                {
                    BeginInvoke(() => AppendAIEngineLog(ev.Data));
                    
                    if (ev.Data.Contains("AI Engine started") || ev.Data.Contains("Running"))
                    {
                        BeginInvoke(() => {
                            btnAIEngine.BackColor = Color.FromArgb(34, 197, 94);
                            btnAIEngine.Text = "✓ AI Engine";
                        });
                    }
                }
            };
            aiEngineProcess.ErrorDataReceived += (s, ev) => {
                if (!string.IsNullOrEmpty(ev.Data))
                    BeginInvoke(() => AppendAIEngineLog($"ERROR: {ev.Data}"));
            };

            aiEngineProcess.Start();
            aiEngineProcess.BeginOutputReadLine();
            aiEngineProcess.BeginErrorReadLine();

            btnAIEngine.BackColor = Color.FromArgb(234, 179, 8);
            btnAIEngine.Text = "⏳ AI Engine...";
        }
        catch (Exception ex)
        {
            AppendAIEngineLog($"✗ Error: {ex.Message}");
            MessageBox.Show($"Lỗi: {ex.Message}", "Lỗi", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }

    private void BtnFrontend_Click(object sender, EventArgs e)
    {
        if (frontendProcess != null && !frontendProcess.HasExited)
        {
            MessageBox.Show("Frontend đang chạy!", "Thông báo", MessageBoxButtons.OK, MessageBoxIcon.Information);
            return;
        }

        try
        {
            AppendFrontendLog("🚀 Starting Frontend...");

            var startInfo = new ProcessStartInfo
            {
                FileName = "cmd.exe",
                Arguments = "/c npm run dev",
                WorkingDirectory = frontendPath,
                UseShellExecute = false,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                CreateNoWindow = true,
                StandardOutputEncoding = Encoding.UTF8,
                StandardErrorEncoding = Encoding.UTF8
            };

            frontendProcess = new Process { StartInfo = startInfo };
            frontendProcess.OutputDataReceived += (s, ev) => {
                if (!string.IsNullOrEmpty(ev.Data))
                {
                    BeginInvoke(() => AppendFrontendLog(ev.Data));
                    
                    if (ev.Data.Contains("Local:") && ev.Data.Contains("5173"))
                    {
                        BeginInvoke(() => {
                            btnFrontend.BackColor = Color.FromArgb(34, 197, 94);
                            btnFrontend.Text = "✓ Frontend";
                        });
                    }
                }
            };
            frontendProcess.ErrorDataReceived += (s, ev) => {
                if (!string.IsNullOrEmpty(ev.Data) && !ev.Data.Contains("VITE"))
                    BeginInvoke(() => AppendFrontendLog($"ERROR: {ev.Data}"));
            };

            frontendProcess.Start();
            frontendProcess.BeginOutputReadLine();
            frontendProcess.BeginErrorReadLine();

            btnFrontend.BackColor = Color.FromArgb(234, 179, 8);
            btnFrontend.Text = "⏳ Frontend...";
        }
        catch (Exception ex)
        {
            AppendFrontendLog($"✗ Error: {ex.Message}");
            MessageBox.Show($"Lỗi: {ex.Message}", "Lỗi", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }

    private void BtnStartAll_Click(object sender, EventArgs e)
    {
        AppendBackendLog("═══ STARTING ALL ═══");
        AppendAIEngineLog("═══ STARTING ALL ═══");
        AppendFrontendLog("═══ STARTING ALL ═══");
        
        BtnBackend_Click(sender, e);
        Task.Delay(3000).ContinueWith(_ => BeginInvoke(() => BtnAIEngine_Click(sender, e)));
        Task.Delay(5000).ContinueWith(_ => BeginInvoke(() => BtnFrontend_Click(sender, e)));
    }

    private void BtnStopAll_Click(object sender, EventArgs e)
    {
        AppendBackendLog("═══ STOPPING ALL ═══");
        AppendAIEngineLog("═══ STOPPING ALL ═══");
        AppendFrontendLog("═══ STOPPING ALL ═══");
        
        StopAllServices();
        
        btnBackend.BackColor = Color.FromArgb(59, 130, 246);
        btnBackend.Text = "▶ Backend";
        
        btnAIEngine.BackColor = Color.FromArgb(139, 92, 246);
        btnAIEngine.Text = "▶ AI Engine";
        
        btnFrontend.BackColor = Color.FromArgb(236, 72, 153);
        btnFrontend.Text = "▶ Frontend";
    }

    private void BtnOpenFrontend_Click(object sender, EventArgs e)
    {
        OpenBrowser("http://localhost:5173");
    }

    private void BtnOpenBackend_Click(object sender, EventArgs e)
    {
        OpenBrowser("http://localhost:5000/swagger");
    }

    private void BtnClearAll_Click(object sender, EventArgs e)
    {
        ClearAllLogs();
    }

    private void OpenBrowser(string url)
    {
        try
        {
            Process.Start(new ProcessStartInfo
            {
                FileName = url,
                UseShellExecute = true
            });
            AppendBackendLog($"🌐 Opened: {url}");
        }
        catch (Exception ex)
        {
            AppendBackendLog($"✗ Error: {ex.Message}");
        }
    }

    private void AppendBackendLog(string message)
    {
        if (txtBackendLog.InvokeRequired)
        {
            txtBackendLog.Invoke(() => AppendBackendLog(message));
            return;
        }

        txtBackendLog.SelectionStart = txtBackendLog.TextLength;
        txtBackendLog.SelectionLength = 0;
        txtBackendLog.SelectionColor = Color.FromArgb(134, 239, 172);
        txtBackendLog.AppendText($"[{DateTime.Now:HH:mm:ss}] {message}\n");
        txtBackendLog.ScrollToCaret();
    }

    private void AppendAIEngineLog(string message)
    {
        if (txtAIEngineLog.InvokeRequired)
        {
            txtAIEngineLog.Invoke(() => AppendAIEngineLog(message));
            return;
        }

        txtAIEngineLog.SelectionStart = txtAIEngineLog.TextLength;
        txtAIEngineLog.SelectionLength = 0;
        txtAIEngineLog.SelectionColor = Color.FromArgb(196, 181, 253);
        txtAIEngineLog.AppendText($"[{DateTime.Now:HH:mm:ss}] {message}\n");
        txtAIEngineLog.ScrollToCaret();
    }

    private void AppendFrontendLog(string message)
    {
        if (txtFrontendLog.InvokeRequired)
        {
            txtFrontendLog.Invoke(() => AppendFrontendLog(message));
            return;
        }

        txtFrontendLog.SelectionStart = txtFrontendLog.TextLength;
        txtFrontendLog.SelectionLength = 0;
        txtFrontendLog.SelectionColor = Color.FromArgb(251, 207, 232);
        txtFrontendLog.AppendText($"[{DateTime.Now:HH:mm:ss}] {message}\n");
        txtFrontendLog.ScrollToCaret();
    }

    private void ClearAllLogs()
    {
        txtBackendLog.Clear();
        txtAIEngineLog.Clear();
        txtFrontendLog.Clear();
        AppendBackendLog("Log cleared");
        AppendAIEngineLog("Log cleared");
        AppendFrontendLog("Log cleared");
    }
}
