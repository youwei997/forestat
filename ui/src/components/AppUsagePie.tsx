import { useMemo } from "react";
import { Chart as ChartJS, ArcElement, Tooltip } from "chart.js";
import { Doughnut } from "react-chartjs-2";
import { fmtShort } from "../utils/format";

ChartJS.register(ArcElement, Tooltip);

interface StatRow {
  app: string;
  today_secs: number;
  week_secs: number;
  month_secs: number;
  year_secs: number;
  total_secs: number;
}

interface AppUsagePieProps {
  rows: StatRow[];
}

const COLORS = [
  "var(--chart-1)", "var(--chart-2)", "var(--chart-3)",
  "var(--chart-4)", "var(--chart-5)", "var(--chart-6)",
];

export function AppUsagePie({ rows }: AppUsagePieProps) {
  const { data, totalToday } = useMemo(() => {
    const sorted = [...rows].sort((a, b) => b.today_secs - a.today_secs);
    const top5 = sorted.slice(0, 5);
    const others = sorted.slice(5);
    const othersTotal = others.reduce((s, r) => s + r.today_secs, 0);
    const total = rows.reduce((s, r) => s + r.today_secs, 0);

    const items = othersTotal > 0
      ? [...top5, { app: "其他", today_secs: othersTotal }]
      : top5;

    // chart.js 不吃 CSS 变量，解析成实际色值；也确保最大那片能"拉出"
    const resolvedColors = items.map((_, i) => {
      const cssVar = COLORS[i] || COLORS[COLORS.length - 1];
      const probe = document.createElement("div");
      probe.style.color = cssVar;
      document.body.appendChild(probe);
      const c = getComputedStyle(probe).color;
      document.body.removeChild(probe);
      return c;
    });

    return {
      data: {
        labels: items.map((r) => r.app),
        datasets: [{
          data: items.map((r) => r.today_secs),
          backgroundColor: resolvedColors,
          borderColor: resolvedColors.map((_, i) => i === 0 ? "transparent" : "var(--bg)"),
          borderWidth: 2,
          hoverOffset: 6,
          spacing: 1,
          offset: items.map((_, i) => (i === 0 ? 8 : 0)),
        }],
      },
      totalToday: total,
    };
  }, [rows]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "62%",
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: { label: string; parsed: number; dataset: { data: number[] } }) => {
            const total = ctx.dataset.data.reduce((s: number, v: number) => s + v, 0);
            const pct = total > 0 ? Math.round((ctx.parsed / total) * 100) : 0;
            return `${ctx.label}: ${fmtShort(ctx.parsed)} (${pct}%)`;
          },
        },
      },
    },
  };

  const hasData = data.labels.length > 0;
  const total = data.datasets[0].data.reduce((s, v) => s + v, 0);

  return (
    <div style={{
      border: "1px solid var(--border)",
      borderRadius: 4,
      padding: 10,
      display: "flex",
      alignItems: "center",
      gap: 12,
      height: "100%",
      overflow: "hidden",
    }}>
      <div style={{ flexShrink: 0, width: 140, height: 140, position: "relative" }}>
        {hasData ? (
          <>
            <Doughnut data={data} options={options} />
            <div style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              textAlign: "center",
            }}>
              <div style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                {fmtShort(totalToday)}
              </div>
              <div style={{ fontSize: 10, color: "var(--text-muted)" }}>今日</div>
            </div>
          </>
        ) : (
          <div style={{
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-muted)",
            fontSize: 11,
            border: "1px dashed var(--border)",
            borderRadius: 4,
          }}>
            暂无数据
          </div>
        )}
      </div>
      <div style={{
        flex: 1,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        gap: 3,
        height: "100%",
        overflow: "auto",
      }}>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>今日使用占比</div>
        {!hasData && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>—</div>}
        {data.labels.map((label, i) => {
          const val = data.datasets[0].data[i];
          const pct = total > 0 ? Math.round((val / total) * 100) : 0;
          return (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
              <span style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                background: COLORS[i],
                display: "inline-block",
                flexShrink: 0,
              }} />
              <span style={{
                flex: 1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}>{label}</span>
              <span style={{
                color: "var(--text-muted)",
                fontVariantNumeric: "tabular-nums",
                flexShrink: 0,
              }}>{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
