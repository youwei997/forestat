import { useMemo } from "react";
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  BarElement, Tooltip,
} from "chart.js";
import { Bar } from "react-chartjs-2";
ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

interface StatRow {
  app: string;
  today_secs: number;
  week_secs: number;
  month_secs: number;
  year_secs: number;
  total_secs: number;
}

interface WeeklyBarProps {
  rows: StatRow[];
}

export function WeeklyBar({ rows }: WeeklyBarProps) {
  const chartData = useMemo(() => {
    const totalWeek = rows.reduce((s, r) => s + r.week_secs, 0);
    const totalToday = rows.reduce((s, r) => s + r.today_secs, 0);
    const otherDaysAvg = totalWeek > totalToday
      ? (totalWeek - totalToday) / 6
      : 0;

    const dayNames = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
    const today = new Date().getDay();
    const todayIdx = today === 0 ? 6 : today - 1;

    const values = dayNames.map((_, i) =>
      i === todayIdx ? totalToday / 3600 : otherDaysAvg / 3600
    );

    // 今天用实色 + 高亮顶部；其他用边框色（扁平）
    const bgColors = dayNames.map((_, i) =>
      i === todayIdx ? "var(--accent)" : "var(--border)"
    );

    return {
      labels: dayNames,
      datasets: [{
        data: values,
        backgroundColor: bgColors,
        borderColor: dayNames.map((_, i) =>
          i === todayIdx ? "var(--accent)" : "var(--border)"
        ),
        borderWidth: dayNames.map((_, i) => (i === todayIdx ? 0 : 1)),
        borderRadius: 3,
        borderSkipped: false,
        maxBarThickness: 28,
      }],
    };
  }, [rows]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: { parsed: { y: number | null } }) =>
            `${Math.round(((ctx.parsed.y ?? 0)) * 10) / 10} 小时`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          color: (ctx: { index: number }) => {
            const today = new Date().getDay();
            const todayIdx = today === 0 ? 6 : today - 1;
            return ctx.index === todayIdx ? "var(--accent)" : "var(--text-muted)";
          },
          font: (ctx: { index: number }) => {
            const today = new Date().getDay();
            const todayIdx = today === 0 ? 6 : today - 1;
            const weight: "bold" | "normal" = ctx.index === todayIdx ? "bold" : "normal";
            return { size: 10, weight };
          },
        },
        border: { color: "var(--border)" },
      },
      y: {
        grid: { color: "var(--border)", drawTicks: false },
        ticks: {
          color: "var(--text-muted)",
          font: { size: 10 },
          callback: (v: unknown) => `${v}h`,
          padding: 4,
        },
        border: { display: false },
        beginAtZero: true,
      },
    },
  };

  return (
    <div style={{
      border: "1px solid var(--border)",
      borderRadius: 4,
      padding: 10,
      display: "flex",
      flexDirection: "column",
      height: "100%",
      overflow: "hidden",
    }}>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6, flexShrink: 0 }}>
        本周使用趋势
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <Bar data={chartData} options={options} />
      </div>
    </div>
  );
}
