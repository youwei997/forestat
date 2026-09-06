import { useMemo } from "react";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { Doughnut } from "react-chartjs-2";
import { fmtShort } from "../utils/format";

ChartJS.register(ArcElement, Tooltip, Legend);

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

    return {
      data: {
        labels: items.map((r) => r.app),
        datasets: [{
          data: items.map((r) => r.today_secs),
          backgroundColor: COLORS.slice(0, items.length),
          borderWidth: 0,
          hoverOffset: 6,
        }],
      },
      totalToday: total,
    };
  }, [rows]);

  const options = {
    responsive: true,
    maintainAspectRatio: true,
    cutout: "65%",
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: { label: string; parsed: number; dataset: { data: number[] } }) => {
            const total = ctx.dataset.data.reduce((s: number, v: number) => s + v, 0);
            const pct = Math.round((ctx.parsed / total) * 100);
            return `${ctx.label}: ${fmtShort(ctx.parsed)} (${pct}%)`;
          },
        },
      },
    },
  };

  return (
    <div style={{
      background: "var(--bg-card)",
      borderRadius: "var(--radius)",
      padding: 20,
      boxShadow: "var(--shadow)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
    }}>
      <div style={{
        fontSize: "0.8rem",
        fontWeight: 600,
        color: "var(--text-secondary)",
        marginBottom: 12,
        alignSelf: "flex-start",
      }}>
        今日使用占比
      </div>
      <div style={{ position: "relative", width: "100%", maxWidth: 200 }}>
        <Doughnut data={data} options={options} />
        <div style={{
          position: "absolute",
          top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          textAlign: "center",
        }}>
          <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)" }}>
            {fmtShort(totalToday)}
          </div>
          <div style={{ fontSize: "0.65rem", color: "var(--text-secondary)" }}>总计</div>
        </div>
      </div>
      {/* 图例 */}
      <div style={{
        display: "flex", flexWrap: "wrap", gap: "4px 12px",
        marginTop: 12, justifyContent: "center", fontSize: "0.7rem",
      }}>
        {data.labels.map((label, i) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{
              width: 8, height: 8, borderRadius: "50%",
              background: COLORS[i], display: "inline-block",
            }} />
            <span style={{ color: "var(--text-secondary)" }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
