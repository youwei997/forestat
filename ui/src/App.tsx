import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { StatsCard } from "./components/StatsCard";
import { AppUsagePie } from "./components/AppUsagePie";
import { WeeklyBar } from "./components/WeeklyBar";
import { AppTable } from "./components/AppTable";
import { fmtHours } from "./utils/format";

interface StatRow {
  app: string;
  today_secs: number;
  week_secs: number;
  month_secs: number;
  year_secs: number;
  total_secs: number;
}

interface AppConfig {
  json_dir: string | null;
  write_interval_secs: number;
  background_mode: boolean;
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
      flash(!cfg.background_mode ? "已开启后台轻量模式" : "已关闭后台模式");
    } catch (e) {
      flash(`失败: ${e}`);
    }
  };

  const pickJsonDir = async () => {
    const dir = await open({ directory: true });
    if (typeof dir === "string") {
      await invoke("set_json_dir", { dir });
      await refresh();
      flash("JSON 路径已更新");
    }
  };

  const resetJsonDir = async () => {
    await invoke("set_json_dir", { dir: null });
    await refresh();
    flash("已恢复默认");
  };

  const writeNow = async () => {
    await invoke("write_now");
    flash("已立即写入");
  };

  const quit = async () => {
    await invoke("quit_app");
  };

  const totalToday = rows.reduce((s, r) => s + r.today_secs, 0);
  const totalWeek = rows.reduce((s, r) => s + r.week_secs, 0);
  const totalMonth = rows.reduce((s, r) => s + r.month_secs, 0);
  const appCount = rows.length;

  return (
    <div style={{
      height: "100dvh",
      display: "flex",
      flexDirection: "column",
      padding: 20,
      gap: 16,
      overflow: "hidden",
      maxWidth: 960,
      margin: "0 auto",
      width: "100%",
    }}>
      {/* 顶部导航 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <button onClick={() => setTab("stats")} disabled={tab === "stats"} style={tabBtn(tab === "stats")}>统计</button>
        <button onClick={() => setTab("settings")} disabled={tab === "settings"} style={tabBtn(tab === "settings")}>设置</button>
        <span style={{ marginLeft: "auto", color: "var(--text-secondary)", fontSize: 13 }}>{msg}</span>
      </div>

      {tab === "stats" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, overflow: "hidden", minHeight: 0 }}>
          {/* 统计卡片 */}
          <div className="stats-grid" style={{ flexShrink: 0 }}>
            <StatsCard title="今日使用" value={fmtHours(totalToday)} icon="⏱" />
            <StatsCard title="本周使用" value={fmtHours(totalWeek)} icon="📅" />
            <StatsCard title="本月使用" value={fmtHours(totalMonth)} icon="📊" />
            <StatsCard title="应用数量" value={`${appCount}`} icon="💻" />
          </div>
          {/* 图表区 */}
          <div className="charts-grid" style={{ flex: "1 1 0", minHeight: 0 }}>
            <AppUsagePie rows={rows} />
            <WeeklyBar rows={rows} />
          </div>
          {/* 表格区 */}
          <div style={{ flex: "1 1 0", minHeight: 0, overflow: "hidden" }}>
            <AppTable rows={rows} />
          </div>
        </div>
      )}

      {tab === "settings" && cfg && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem", fontSize: 14 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={cfg.background_mode} onChange={toggleBackground} />
            <span>后台轻量模式(开机自启、静默运行)</span>
          </label>
          <div>
            <div style={{ marginBottom: 6, color: "var(--text-secondary)" }}>JSON 备份目录</div>
            <code style={{
              display: "block", background: "var(--bg-secondary)", padding: 8,
              borderRadius: 8, wordBreak: "break-all", fontSize: 13,
            }}>
              {cfg.json_dir ?? "未设置(exe 所在目录)"}
            </code>
            <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
              <button onClick={pickJsonDir}>选择目录…</button>
              <button onClick={resetJsonDir} disabled={!cfg.json_dir}>恢复默认</button>
              <button onClick={writeNow}>立即写入</button>
            </div>
          </div>
          <div>
            <button onClick={quit} style={{ color: "#c00" }}>完全退出</button>
          </div>
        </div>
      )}
    </div>
  );
}

function tabBtn(active: boolean): React.CSSProperties {
  return {
    padding: "6px 16px",
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: active ? "var(--accent)" : "var(--bg-card)",
    color: active ? "#fff" : "var(--text-primary)",
    cursor: active ? "default" : "pointer",
    fontSize: "0.85rem",
    fontWeight: 500,
  };
}

export default App;
