import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
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
  const [showSettings, setShowSettings] = useState(false);
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
      padding: 10,
      gap: 8,
      overflow: "hidden",
      maxWidth: 1200,
      margin: "0 auto",
      width: "100%",
    }}>
      {/* 单行 header：logo + 内联统计 + 设置按钮 */}
      <header style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        paddingBottom: 8,
        borderBottom: "1px solid var(--border)",
        flexShrink: 0,
      }}>
        <div style={{ fontWeight: 700, fontSize: 14, letterSpacing: 0.3 }}>
          <span className="live-dot" />
          forestat
        </div>
        <div style={{ display: "flex", gap: 14, fontSize: 12, color: "var(--text-muted)" }}>
          <span>
            今日 <strong style={{ color: "var(--text)", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{fmtHours(totalToday)}</strong>
          </span>
          <span>
            本周 <strong style={{ color: "var(--text)", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{fmtHours(totalWeek)}</strong>
          </span>
          <span>
            本月 <strong style={{ color: "var(--text)", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{fmtHours(totalMonth)}</strong>
          </span>
          <span>
            应用 <strong style={{ color: "var(--text)", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{appCount}</strong>
          </span>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{msg}</span>
          <button onClick={() => setShowSettings(!showSettings)}>
            {showSettings ? "关闭" : "设置"}
          </button>
        </div>
      </header>

      {/* 设置面板：内联下拉 */}
      {showSettings && cfg && (
        <div style={{
          padding: 10,
          border: "1px solid var(--border)",
          borderRadius: 4,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          fontSize: 12,
          flexShrink: 0,
          background: "var(--bg-alt)",
        }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" checked={cfg.background_mode} onChange={toggleBackground} />
            <span>后台轻量模式（开机自启、静默运行）</span>
          </label>
          <div>
            <div style={{ color: "var(--text-muted)", marginBottom: 4 }}>JSON 备份目录</div>
            <code style={{
              display: "block",
              background: "var(--bg)",
              padding: 6,
              borderRadius: 4,
              wordBreak: "break-all",
              fontSize: 11,
              border: "1px solid var(--border)",
            }}>
              {cfg.json_dir ?? "未设置（exe 所在目录）"}
            </code>
            <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button onClick={pickJsonDir}>选择目录…</button>
              <button onClick={resetJsonDir} disabled={!cfg.json_dir}>恢复默认</button>
              <button onClick={writeNow}>立即写入</button>
              <button onClick={quit} className="danger">完全退出</button>
            </div>
          </div>
        </div>
      )}

      {/* 图表区：并排，固定高度 */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 8,
        flexShrink: 0,
        height: 200,
      }}>
        <AppUsagePie rows={rows} />
        <WeeklyBar rows={rows} />
      </div>

      {/* 表格区：填满剩余 */}
      <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
        <AppTable rows={rows} />
      </div>
    </div>
  );
}

export default App;
