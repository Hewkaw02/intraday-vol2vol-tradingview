using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Windows.Forms;

namespace VolStrikeCalLauncher
{
    public class MainForm : Form
    {
        private readonly string appRoot;

        public MainForm()
        {
            appRoot = AppDomain.CurrentDomain.BaseDirectory.TrimEnd('\\', '/');

            Text = "CME Vol2Vol Options Intelligence — Quick Launcher";
            Size = new Size(560, 460);
            MinimumSize = new Size(560, 460);
            MaximizeBox = false;
            StartPosition = FormStartPosition.CenterScreen;
            BackColor = Color.FromArgb(19, 23, 34);
            ForeColor = Color.FromArgb(209, 212, 220);
            Font = new Font("Segoe UI", 9.5f, FontStyle.Regular);

            BuildUI();
        }

        private void BuildUI()
        {
            var headerPanel = new Panel
            {
                Dock = DockStyle.Top,
                Height = 76,
                BackColor = Color.FromArgb(26, 30, 43),
                Padding = new Padding(20, 14, 20, 14)
            };

            var lblTitle = new Label
            {
                Text = "CME Vol2Vol™ Options Intelligence",
                Font = new Font("Segoe UI Semibold", 14f, FontStyle.Bold),
                ForeColor = Color.White,
                AutoSize = true,
                Location = new Point(20, 14)
            };

            var lblSub = new Label
            {
                Text = "One-Click Launcher & Browser Extension Helper (0DTE / GOLD.F / XAUUSD)",
                Font = new Font("Segoe UI", 9f, FontStyle.Regular),
                ForeColor = Color.FromArgb(134, 142, 158),
                AutoSize = true,
                Location = new Point(22, 44)
            };

            headerPanel.Controls.Add(lblTitle);
            headerPanel.Controls.Add(lblSub);
            Controls.Add(headerPanel);

            int y = 94;

            // Button 1: Launch Chrome/Edge with Extension pre-loaded directly onto TradingView
            var btnLaunchTV = CreateActionButton(
                "1. Launch Browser with Extension Loaded (Auto-Setup)",
                "Opens Chrome or Edge with this extension automatically loaded on TradingView Options",
                Color.FromArgb(41, 98, 255),
                y
            );
            btnLaunchTV.Click += (s, e) => LaunchBrowserWithExtension();
            Controls.Add(btnLaunchTV);
            y += 72;

            // Button 2: Open Standalone Widescreen Pro Dashboard
            var btnLaunchDash = CreateActionButton(
                "2. Open Standalone Widescreen Pro Dashboard",
                "Opens the full-screen Vol2Vol Dashboard directly in your browser (no install needed)",
                Color.FromArgb(30, 34, 45),
                y
            );
            btnLaunchDash.Click += (s, e) => OpenLocalFile(Path.Combine(appRoot, "src", "dashboard", "dashboard.html"));
            Controls.Add(btnLaunchDash);
            y += 72;

            // Button 3: Open Standalone Interactive Preview
            var btnLaunchSim = CreateActionButton(
                "3. Open Standalone Interactive Simulator",
                "Opens standalone-test.html with simulated real-time 0DTE price ticks",
                Color.FromArgb(30, 34, 45),
                y
            );
            btnLaunchSim.Click += (s, e) => OpenLocalFile(Path.Combine(appRoot, "standalone-test.html"));
            Controls.Add(btnLaunchSim);
            y += 72;

            // Button 4: Manual Load Unpacked Assistant (Copies path + opens chrome://extensions)
            var btnManualHelper = CreateActionButton(
                "4. Copy Folder Path && Open Extension Manager",
                "Copies \"" + appRoot + "\" to clipboard for Load Unpacked",
                Color.FromArgb(30, 34, 45),
                y
            );
            btnManualHelper.Click += (s, e) => CopyPathAndOpenExtensions();
            Controls.Add(btnManualHelper);

            var lblFooter = new Label
            {
                Text = "Extension Path: " + appRoot,
                Font = new Font("Consolas", 8f, FontStyle.Regular),
                ForeColor = Color.FromArgb(120, 123, 134),
                AutoSize = false,
                Width = 505,
                Height = 20,
                Location = new Point(22, 392)
            };
            Controls.Add(lblFooter);
        }

        private Button CreateActionButton(string title, string subtitle, Color bgColor, int top)
        {
            var btn = new Button
            {
                Location = new Point(22, top),
                Size = new Size(500, 60),
                FlatStyle = FlatStyle.Flat,
                BackColor = bgColor,
                ForeColor = Color.White,
                TextAlign = ContentAlignment.MiddleLeft,
                Padding = new Padding(14, 0, 14, 0),
                Cursor = Cursors.Hand,
                Font = new Font("Segoe UI Semibold", 10f, FontStyle.Bold),
                Text = title + "\r\n" + subtitle
            };
            btn.FlatAppearance.BorderColor = Color.FromArgb(54, 58, 69);
            btn.FlatAppearance.BorderSize = 1;
            return btn;
        }

        private string FindBrowserExecutable()
        {
            string[] candidates = new string[]
            {
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Google\\Chrome\\Application\\chrome.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Google\\Chrome\\Application\\chrome.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Google\\Chrome\\Application\\chrome.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Microsoft\\Edge\\Application\\msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Microsoft\\Edge\\Application\\msedge.exe")
            };
            foreach (var p in candidates)
            {
                if (File.Exists(p)) return p;
            }
            return null;
        }

        private void LaunchBrowserWithExtension()
        {
            string manifestPath = Path.Combine(appRoot, "manifest.json");
            if (!File.Exists(manifestPath))
            {
                MessageBox.Show(
                    "manifest.json was not found in:\n" + appRoot + "\n\nPlease keep Vol2Vol-Launcher.exe in the project root folder.",
                    "Manifest Not Found",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Warning
                );
                return;
            }

            string browser = FindBrowserExecutable();
            string targetUrl = "https://www.tradingview.com/options/volume/?symbol=COMEX%3AGC1%21&tab=by-strike";

            if (browser != null)
            {
                try
                {
                    Clipboard.SetText(appRoot);
                    string args = string.Format("--load-extension=\"{0}\" \"{1}\"", appRoot, targetUrl);
                    Process.Start(new ProcessStartInfo
                    {
                        FileName = browser,
                        Arguments = args,
                        UseShellExecute = true
                    });
                    return;
                }
                catch (Exception ex)
                {
                    MessageBox.Show("Failed to launch browser: " + ex.Message, "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
                }
            }
            else
            {
                Process.Start(new ProcessStartInfo { FileName = targetUrl, UseShellExecute = true });
            }
        }

        private void OpenLocalFile(string filePath)
        {
            if (!File.Exists(filePath))
            {
                MessageBox.Show("File not found:\n" + filePath, "File Missing", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }
            Process.Start(new ProcessStartInfo
            {
                FileName = filePath,
                UseShellExecute = true
            });
        }

        private void CopyPathAndOpenExtensions()
        {
            try
            {
                Clipboard.SetText(appRoot);
                Process.Start(new ProcessStartInfo
                {
                    FileName = "https://www.tradingview.com/options/volume/?symbol=COMEX%3AGC1%21&tab=by-strike",
                    UseShellExecute = true
                });
                MessageBox.Show(
                    "Folder path copied to your clipboard:\n\n" + appRoot + "\n\n" +
                    "Quick Steps:\n" +
                    "1. Open chrome://extensions (or edge://extensions)\n" +
                    "2. Turn ON 'Developer mode' (top-right)\n" +
                    "3. Click 'Load unpacked' and press Ctrl+V to paste the folder path.",
                    "Extension Path Copied!",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Information
                );
            }
            catch (Exception ex)
            {
                MessageBox.Show("Error: " + ex.Message, "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        [STAThread]
        public static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new MainForm());
        }
    }
}
