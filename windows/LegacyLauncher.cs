using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.WinForms;

internal static class Program
{
    [STAThread]
    public static void Main()
    {
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        string root = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "interactive-3d-prototype");
        string[] required = { "index.html", "app.js", "model-data.js", "validation-report.json", Path.Combine("vendor", "three.module.js") };
        string[] missing = required.Where(x => !File.Exists(Path.Combine(root, x))).ToArray();
        if (missing.Length > 0) { MessageBox.Show("The LS400 Toolbox files are incomplete. Missing: " + string.Join(", ", missing), "LS400 Toolbox", MessageBoxButtons.OK, MessageBoxIcon.Error); return; }
        using (LocalServer server = new LocalServer(root))
        {
            try { server.Start(); }
            catch (Exception ex) { MessageBox.Show("The local toolbox server could not start.\n\n" + ex.Message, "LS400 Toolbox", MessageBoxButtons.OK, MessageBoxIcon.Error); return; }
            string url = server.Url + "?offline=" + DateTime.UtcNow.Ticks;
            using (NativeToolboxForm form = new NativeToolboxForm(url)) Application.Run(form);
        }
    }
}

internal sealed class NativeToolboxForm : Form
{
    private readonly WebView2 view;
    private readonly string url;
    public NativeToolboxForm(string url)
    {
        this.url = url;
        Text = "LS400 Toolbox — 1990 Lexus LS400 A/C Service Model";
        Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath) ?? SystemIcons.Application;
        WindowState = FormWindowState.Maximized;
        MinimumSize = new Size(1024, 700);
        view = new WebView2 { Dock = DockStyle.Fill, CreationProperties = new CoreWebView2CreationProperties { UserDataFolder = Path.Combine(Path.GetTempPath(), "LS400Toolbox-WebView") } };
        Controls.Add(view);
        Shown += async delegate { try { await view.EnsureCoreWebView2Async(); view.CoreWebView2.Navigate(this.url); } catch (Exception ex) { MessageBox.Show("The embedded offline view could not start.\n\n" + ex.Message, "LS400 Toolbox", MessageBoxButtons.OK, MessageBoxIcon.Error); Close(); } };
    }
}

internal sealed class LocalServer : IDisposable
{
    private readonly string root;
    private HttpListener listener;
    private CancellationTokenSource stop;
    public int Port { get; private set; }
    public string Url { get { return "http://127.0.0.1:" + Port + "/"; } }
    public LocalServer(string path) { root = Path.GetFullPath(path).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar; }
    public static bool IsToolboxAlreadyRunning(string url)
    {
        try
        {
            HttpWebRequest request = (HttpWebRequest)WebRequest.Create(url);
            request.Method = "GET"; request.Timeout = 250; request.ReadWriteTimeout = 250;
            using (HttpWebResponse response = (HttpWebResponse)request.GetResponse())
            using (StreamReader reader = new StreamReader(response.GetResponseStream()))
            {
                string body = reader.ReadToEnd();
                return response.StatusCode == HttpStatusCode.OK && body.IndexOf("LS400", StringComparison.OrdinalIgnoreCase) >= 0;
            }
        }
        catch { return false; }
    }
    public void Start()
    {
        for (int port = 8123; port <= 8135; port++)
        {
            try { TcpListener probe = new TcpListener(IPAddress.Loopback, port); probe.Start(); probe.Stop(); Port = port; break; } catch (SocketException) { }
        }
        if (Port == 0) throw new InvalidOperationException("No free local port was found (tried 8123-8135).");
        listener = new HttpListener(); listener.Prefixes.Add(Url); listener.Start(); stop = new CancellationTokenSource(); Task.Run(() => Serve(stop.Token));
    }
    private async Task Serve(CancellationToken token)
    {
        while (!token.IsCancellationRequested && listener.IsListening)
        {
            HttpListenerContext context;
            try { context = await listener.GetContextAsync(); } catch { if (token.IsCancellationRequested) break; else continue; }
            Task.Run(() => Handle(context));
        }
    }
    private async Task Handle(HttpListenerContext context)
    {
        try
        {
            string rel = Uri.UnescapeDataString(context.Request.Url.AbsolutePath).TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
            if (string.IsNullOrWhiteSpace(rel)) rel = "index.html";
            string file = Path.GetFullPath(Path.Combine(root, rel));
            if (!file.StartsWith(root, StringComparison.OrdinalIgnoreCase) || !File.Exists(file)) { context.Response.StatusCode = 404; Write(context.Response, "Not found", "text/plain"); return; }
            byte[] bytes = File.ReadAllBytes(file); context.Response.ContentType = Mime(Path.GetExtension(file)); context.Response.ContentLength64 = bytes.Length; await context.Response.OutputStream.WriteAsync(bytes, 0, bytes.Length);
        }
        catch { try { context.Response.StatusCode = 500; } catch { } }
        finally { context.Response.Close(); }
    }
    private static void Write(HttpListenerResponse response, string text, string type) { byte[] bytes = Encoding.UTF8.GetBytes(text); response.ContentType = type; response.ContentLength64 = bytes.Length; response.OutputStream.Write(bytes, 0, bytes.Length); }
    private static string Mime(string ext) { switch (ext.ToLowerInvariant()) { case ".html": case ".htm": return "text/html; charset=utf-8"; case ".js": return "text/javascript; charset=utf-8"; case ".css": return "text/css; charset=utf-8"; case ".json": return "application/json; charset=utf-8"; case ".png": return "image/png"; case ".jpg": case ".jpeg": return "image/jpeg"; case ".webp": return "image/webp"; case ".svg": return "image/svg+xml"; case ".ico": return "image/x-icon"; default: return "application/octet-stream"; } }
    public void Dispose() { if (stop != null) stop.Cancel(); if (listener != null) { listener.Stop(); listener.Close(); } if (stop != null) stop.Dispose(); }
}
