import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";

interface StatRow {
  app: string;
  today_secs: number;
  year_secs: number;
  total_secs: number;
}

interface AppConfig {
  json_dir: string | null;
  write_interval_secs: number;
  background_mode: boolean;
}

function fmtHours(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return `${h} 小时 ${m} 分`;
}

function App() {
  const [rows, setRows] = useState<StatRow[]>([]);
  const [cfg, setCfg] = useState<AppConfig | null>(null);
  const [tab, setTab] = useState<"stats" | "settings">("stats");
  const [msg, setMsg] = useState("");

  const refresh = useCallback(async () => {
    setRows(await invoke<StatRow[]>("get_stats"));
    setCfg(await invoke<AppConfig>("get_config"));
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 5000);
    const un = listen<string>("first-run-msg", (e) => flash(e.payload));
    return () => {
      clearInterval(t);
      un.then((f) => f());
    };
  }, [refresh]);

  const flash = (text: string) => {
    setMsg(text);
    setTimeout(() => setMsg(""), 2500);
  };

  const toggleBackground = async () => {
    if (!cfg) return;
    try {
      await invoke("set_background_mode", { enable: !cfg.background_mode });
      await refresh();
      flash(!cfg.background_mode ? "已开启后台轻量模式(开机自启)" : "已关闭后台模式");
    } catch (e) {
      flash(`失败: ${e}`);
    }
  };

  const pickJsonDir = async () => {
    const dir = await open({ directory: true });
    if (typeof dir === "string") {
      await invoke("set_json_dir", { dir });
      await refresh();
      flash("JSON 路径已更新并写入");
    }
  };

  const resetJsonDir = async () => {
    await invoke("set_json_dir", { dir: null });
    await refresh();
    flash("已恢复默认(exe 旁)");
  };

  const writeNow = async () => {
    await invoke("write_now");
    flash("已立即写入 JSON");
  };

  const quit = async () => {
    await invoke("quit_app");
  };

  return (
    <div style={{ fontFamily: "sans-serif", padding: "1.5rem", maxWidth: 860, margin: "0 auto" }}>
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        <button onClick={() => setTab("stats")} disabled={tab === "stats"}>统计</button>
        <button onClick={() => setTab("settings")} disabled={tab === "settings"}>设置</button>
        <span style={{ marginLeft: "auto", color: "#888", fontSize: 13, alignSelf: "center" }}>{msg}</span>
      </div>

      {tab === "stats" && (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "2px solid #ccc" }}>
              <th style={{ padding: "6px 8px" }}>软件</th>
              <th style={{ padding: "6px 8px" }}>今日</th>
              <th style={{ padding: "6px 8px" }}>今年</th>
              <th style={{ padding: "6px 8px" }}>总计</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={4} style={{ padding: 12, color: "#888" }}>暂无数据,前台使用中每秒自动累计…</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.app} style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: "6px 8px", fontWeight: 600 }}>{r.app}</td>
                <td style={{ padding: "6px 8px" }}>{fmtHours(r.today_secs)}</td>
                <td style={{ padding: "6px 8px" }}>{fmtHours(r.year_secs)}</td>
                <td style={{ padding: "6px 8px" }}>{fmtHours(r.total_secs)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {tab === "settings" && cfg && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem", fontSize: 14 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={cfg.background_mode} onChange={toggleBackground} />
            <span>
              后台轻量模式(开机自启、静默运行、无界面无托盘;任务管理器中可见 forestat.exe)
            </span>
          </label>

          <div>
            <div style={{ marginBottom: 6 }}>JSON 备份目录(默认:exe 所在目录,可直接指向 OneDrive)</div>
            <code style={{ display: "block", background: "#f4f4f4", padding: 8, borderRadius: 6, wordBreak: "break-all" }}>
              {cfg.json_dir ?? "未设置(使用 exe 所在目录)"}
            </code>
            <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
              <button onClick={pickJsonDir}>选择目录…</button>
              <button onClick={resetJsonDir} disabled={!cfg.json_dir}>恢复默认</button>
              <button onClick={writeNow}>立即写入</button>
            </div>
            <div style={{ color: "#888", marginTop: 6 }}>
              默认存放在 exe 旁边;每 {cfg.write_interval_secs} 秒自动覆盖 app-usage.json,每天首次写入前轮转出 app-usage.backup.json
            </div>
          </div>

          <div>
            <button onClick={quit} style={{ color: "#c00" }}>完全退出(停止计时并结束进程)</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
