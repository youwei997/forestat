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
    const today = new Date().getDay(); // 0=Sun, 1=Mon...
    const todayIdx = today === 0 ? 6 : today - 1;

    const values = dayNames.map((_, i) =>
      i === todayIdx ? totalToday / 3600 : otherDaysAvg / 3600
    );

    const bgColors = dayNames.map((_, i) =>
      i === todayIdx ? "var(--accent)" : "var(--accent-light)"
    );

    return {
      labels: dayNames,
      datasets: [{
        data: values,
        backgroundColor: bgColors,
        borderRadius: 6,
        borderSkipped: false,
        maxBarThickness: 40,
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
        ticks: { color: "var(--text-secondary)", font: { size: 11 } },
      },
      y: {
        grid: { color: "var(--border)" },
        ticks: {
          color: "var(--text-secondary)",
          font: { size: 11 },
          callback: (v: unknown) => `${v}h`,
        },
        beginAtZero: true,
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
    }}>
      <div style={{
        fontSize: "0.8rem",
        fontWeight: 600,
        color: "var(--text-secondary)",
        marginBottom: 12,
      }}>
        本周使用趋势
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <Bar data={chartData} options={options} />
      </div>
    </div>
  );
}
