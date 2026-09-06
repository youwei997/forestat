# Forestat UI 重新设计 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 forestat 界面从基础表格升级为现代化响应式仪表盘，支持图表可视化、深浅色主题自适应，内容一屏内完整显示。

**Architecture:** 前端使用 Chart.js + react-chartjs-2 实现图表，CSS 变量 + prefers-color-scheme 实现主题切换，CSS Grid 实现响应式布局。后端扩展 StatRow 结构体添加 week_secs / month_secs 字段。

**Tech Stack:** React 19, TypeScript, Chart.js 4.x, react-chartjs-2 5.x, CSS Variables, CSS Grid, Tauri 2, Rust, chrono

## Global Constraints

- 所有内容在一屏内完整显示（overflow: hidden, 100vh/100dvh）
- 主题跟随系统 `prefers-color-scheme`，使用 CSS 变量，不使用 JS 主题切换
- Chart.js 按需引入（tree-shaking），只注册实际使用的组件
- 保持现有 Tauri 命令接口签名不变，仅扩展返回字段
- 响应式断点：≥1024px 桌面, 768-1023px 平板, <768px 移动

---

## 文件结构

```
ui/src/
├── components/
│   ├── StatsCard.tsx      # 统计卡片
│   ├── AppUsagePie.tsx    # 环形图
│   ├── WeeklyBar.tsx      # 柱状图
│   └── AppTable.tsx       # 表格（含移动端卡片视图）
├── styles/
│   └── theme.css          # 主题变量 + 全局样式
├── utils/
│   └── format.ts          # 时长格式化
├── App.tsx                # 主应用（重构）
└── main.tsx               # 入口（不变）

src-tauri/src/
├── tracker.rs             # 扩展 StatRow, stats_on()
└── lib.rs                 # 不变（get_stats 签名不变）
```

---

### Task 1: 后端扩展 StatRow 添加 week_secs / month_secs

**Files:**
- Modify: `src-tauri/src/tracker.rs:17-25` (StatRow struct)
- Modify: `src-tauri/src/tracker.rs:171-199` (stats_on function)
- Modify: `src-tauri/src/tracker.rs:266-282` (test tick_accumulates_today_and_total)

**Interfaces:**
- Produces: `StatRow { app, today_secs, week_secs, month_secs, year_secs, total_secs }` — 前端 Task 2-5 依赖此结构

- [ ] **Step 1: 修改 StatRow 结构体添加字段**

```rust
// src-tauri/src/tracker.rs:17-25
pub struct StatRow {
    pub app: String,
    /// 今日秒数
    pub today_secs: u64,
    /// 本周秒数（周一到周日，ISO 8601）
    pub week_secs: u64,
    /// 本月秒数（当月1日到今天）
    pub month_secs: u64,
    /// 今年秒数
    pub year_secs: u64,
    /// 历史总计秒数
    pub total_secs: u64,
}
```

- [ ] **Step 2: 修改 stats_on 计算 week_secs / month_secs**

在 `stats_on` 函数中，`map` 闭包里添加 week_secs 和 month_secs 的计算逻辑：

```rust
// src-tauri/src/tracker.rs:171-199
fn stats_on(&self, today: NaiveDate) -> Vec<StatRow> {
    let data = self.data.lock().unwrap();
    // 本周起始：周一
    let week_start = today - chrono::Duration::days(today.weekday().num_days_from_monday() as i64);
    // 本月起始：1号
    let month_start = today.with_day(1).unwrap();

    let mut rows: Vec<StatRow> = data
        .totals
        .iter()
        .map(|(app, &total)| {
            let today_secs = data
                .days
                .get(&today)
                .and_then(|m| m.get(app))
                .copied()
                .unwrap_or(0);
            let week_secs: u64 = data
                .days
                .iter()
                .filter(|(d, _)| **d >= week_start && **d <= today)
                .filter_map(|(_, m)| m.get(app))
                .sum();
            let month_secs: u64 = data
                .days
                .iter()
                .filter(|(d, _)| **d >= month_start && **d <= today)
                .filter_map(|(_, m)| m.get(app))
                .sum();
            let year_secs = data
                .days
                .iter()
                .filter(|(d, _)| d.year() == today.year())
                .filter_map(|(_, m)| m.get(app))
                .sum();
            StatRow {
                app: app.clone(),
                today_secs,
                week_secs,
                month_secs,
                year_secs,
                total_secs: total,
            }
        })
        .collect();
    rows.sort_by(|a, b| b.total_secs.cmp(&a.total_secs));
    rows
}
```

- [ ] **Step 3: 更新现有测试中 StatRow 的构造**

在 `tick_accumulates_today_and_total` 测试中，更新断言以包含新字段：

```rust
// src-tauri/src/tracker.rs:266-282
#[test]
fn tick_accumulates_today_and_total() {
    let (tracker, _cfg, _dir) = test_setup();
    let d = date(2024, 1, 15);
    tracker.tick("app1", d);
    tracker.tick("app1", d);
    tracker.tick("app2", d);
    let rows = tracker.stats_on(d);
    assert_eq!(rows.len(), 2);
    let r1 = rows.iter().find(|r| r.app == "app1").unwrap();
    assert_eq!(r1.today_secs, 2);
    assert_eq!(r1.week_secs, 2);
    assert_eq!(r1.month_secs, 2);
    assert_eq!(r1.total_secs, 2);
    let r2 = rows.iter().find(|r| r.app == "app2").unwrap();
    assert_eq!(r2.today_secs, 1);
    assert_eq!(r2.week_secs, 1);
    assert_eq!(r2.month_secs, 1);
    assert_eq!(r2.total_secs, 1);
}
```

- [ ] **Step 4: 运行测试验证**

Run: `cd src-tauri && cargo test`
Expected: 全部 PASS，包括 `tick_accumulates_today_and_total`、`year_secs_only_counts_same_year` 等

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/tracker.rs
git commit -m "feat: extend StatRow with week_secs and month_secs fields"
```

---

### Task 2: 安装前端依赖 + 创建主题 CSS 和工具函数

**Files:**
- Modify: `ui/package.json` (新增 chart.js, react-chartjs-2)
- Create: `ui/src/styles/theme.css`
- Create: `ui/src/utils/format.ts`

**Interfaces:**
- Produces: `fmtHours(secs: number): string` — Task 3-5 使用
- Produces: `fmtMinutes(secs: number): string` — Task 4 柱状图 tooltip 使用
- Produces: CSS 变量 `--bg-primary`, `--bg-card`, `--text-primary`, `--accent` 等 — 全局使用

- [ ] **Step 1: 安装 chart.js 和 react-chartjs-2**

```bash
cd ui && npm install chart.js react-chartjs-2
```

- [ ] **Step 2: 创建 theme.css**

```css
/* ui/src/styles/theme.css */

*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html, body, #root {
  height: 100dvh;
  overflow: hidden;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background: var(--bg-primary);
  color: var(--text-primary);
  transition: background 0.2s, color 0.2s;
}

:root {
  --bg-primary: #f5f5f7;
  --bg-secondary: #e8e8ed;
  --bg-card: #ffffff;
  --text-primary: #1d1d1f;
  --text-secondary: #86868b;
  --accent: #0071e3;
  --accent-light: rgba(0, 113, 227, 0.1);
  --border: #d2d2d7;
  --shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
  --shadow-hover: 0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04);
  --radius: 12px;
  --chart-1: #0071e3;
  --chart-2: #5856d6;
  --chart-3: #af52de;
  --chart-4: #ff2d55;
  --chart-5: #34c759;
  --chart-6: #8e8e93;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg-primary: #1c1c1e;
    --bg-secondary: #2c2c2e;
    --bg-card: #2c2c2e;
    --text-primary: #f5f5f7;
    --text-secondary: #98989d;
    --accent: #0a84ff;
    --accent-light: rgba(10, 132, 255, 0.15);
    --border: #3a3a3c;
    --shadow: 0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2);
    --shadow-hover: 0 4px 12px rgba(0,0,0,0.4), 0 2px 4px rgba(0,0,0,0.2);
    --chart-1: #0a84ff;
    --chart-2: #5e5ce6;
    --chart-3: #bf5af2;
    --chart-4: #ff375f;
    --chart-5: #30d158;
    --chart-6: #636366;
  }
}

/* 响应式工具类 */
.stats-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(4, 1fr);
}
.charts-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: 1fr 1fr;
}
@media (max-width: 1023px) {
  .stats-grid { grid-template-columns: repeat(2, 1fr); }
  .charts-grid { grid-template-columns: 1fr; }
}
@media (max-width: 767px) {
  .stats-grid { grid-template-columns: 1fr 1fr; }
}
```

- [ ] **Step 3: 创建 format.ts**

```typescript
// ui/src/utils/format.ts

/** 秒 → "X小时Y分"，不足1小时显示"Y分"，不足1分显示"<1分" */
export function fmtHours(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h}小时${m}分`;
  if (m > 0) return `${m}分`;
  return "<1分";
}

/** 秒 → "Xh Ym"（图表 tooltip 用，英文简短） */
export function fmtShort(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return "<1m";
}

/** 秒 → 小时数（保留1位小数，柱状图 Y 轴用） */
export function toHours(secs: number): number {
  return Math.round((secs / 3600) * 10) / 10;
}
```

- [ ] **Step 4: 在 main.tsx 中引入 theme.css**

```tsx
// ui/src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/theme.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

- [ ] **Step 5: Commit**

```bash
git add ui/package.json ui/package-lock.json ui/src/styles/ui/src/utils/ ui/src/main.tsx
git commit -m "feat: add chart.js deps, theme CSS, and format utilities"
```

---

### Task 3: 创建 StatsCard 组件

**Files:**
- Create: `ui/src/components/StatsCard.tsx`

**Interfaces:**
- Consumes: `fmtHours()` from `utils/format.ts`
- Produces: `StatsCard` component — Task 6 (App.tsx) 使用

- [ ] **Step 1: 创建 StatsCard.tsx**

```tsx
// ui/src/components/StatsCard.tsx
import { ReactNode } from "react";

interface StatsCardProps {
  title: string;
  value: string;
  icon: ReactNode;
}

export function StatsCard({ title, value, icon }: StatsCardProps) {
  return (
    <div style={{
      background: "var(--bg-card)",
      borderRadius: "var(--radius)",
      padding: "16px 20px",
      boxShadow: "var(--shadow)",
      display: "flex",
      alignItems: "center",
      gap: 14,
      transition: "box-shadow 0.2s, transform 0.2s",
      cursor: "default",
    }}>
      <div style={{
        width: 40, height: 40,
        borderRadius: 10,
        background: "var(--accent-light)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 18, flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: "0.75rem",
          color: "var(--text-secondary)",
          marginBottom: 2,
          whiteSpace: "nowrap",
        }}>
          {title}
        </div>
        <div style={{
          fontSize: "1.4rem",
          fontWeight: 700,
          color: "var(--text-primary)",
          lineHeight: 1.2,
          whiteSpace: "nowrap",
        }}>
          {value}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

```bash
cd ui && npx tsc --noEmit
```
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add ui/src/components/StatsCard.tsx
git commit -m "feat: add StatsCard component"
```

---

### Task 4: 创建 AppUsagePie 环形图组件

**Files:**
- Create: `ui/src/components/AppUsagePie.tsx`

**Interfaces:**
- Consumes: `StatRow` (extended with `today_secs`), `fmtShort()` from `utils/format.ts`
- Produces: `AppUsagePie` component — Task 6 (App.tsx) 使用

- [ ] **Step 1: 创建 AppUsagePie.tsx**

```tsx
// ui/src/components/AppUsagePie.tsx
import { useMemo } from "react";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { Doughnut } from "react-chartjs-2";
import { fmtShort } from "../utils/format";

ChartJS.register(ArcElement, Tooltip, Legend);

interface StatRow {
  app: string;
  today_secs: number;
  [key: string]: unknown;
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
```

- [ ] **Step 2: 验证 TypeScript 编译**

```bash
cd ui && npx tsc --noEmit
```
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add ui/src/components/AppUsagePie.tsx
git commit -m "feat: add AppUsagePie doughnut chart component"
```

---

### Task 5: 创建 WeeklyBar 柱状图组件

**Files:**
- Create: `ui/src/components/WeeklyBar.tsx`

**Interfaces:**
- Consumes: `StatRow` (extended with `week_secs`), `toHours()` from `utils/format.ts`
- Produces: `WeeklyBar` component — Task 6 (App.tsx) 使用

- [ ] **Step 1: 创建 WeeklyBar.tsx**

```tsx
// ui/src/components/WeeklyBar.tsx
import { useMemo } from "react";
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  BarElement, Tooltip,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { fmtShort } from "../utils/format";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

interface StatRow {
  app: string;
  today_secs: number;
  week_secs: number;
  [key: string]: unknown;
}

interface WeeklyBarProps {
  rows: StatRow[];
}

export function WeeklyBar({ rows }: WeeklyBarProps) {
  const chartData = useMemo(() => {
    // 用 week_secs 和 today_secs 近似展示每日趋势
    // 简化：将 week_secs 均分到过去7天，today_secs 作为今天
    const totalWeek = rows.reduce((s, r) => s + r.week_secs, 0);
    const totalToday = rows.reduce((s, r) => s + r.today_secs, 0);
    const otherDaysAvg = totalWeek > totalToday
      ? (totalWeek - totalToday) / 6
      : 0;

    const dayNames = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
    const today = new Date().getDay(); // 0=Sun, 1=Mon...
    const todayIdx = today === 0 ? 6 : today - 1; // 转为 0=Mon

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
          label: (ctx: { parsed: { y: number } }) =>
            `${Math.round(ctx.parsed.y * 10) / 10} 小时`,
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
```

- [ ] **Step 2: 验证 TypeScript 编译**

```bash
cd ui && npx tsc --noEmit
```
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add ui/src/components/WeeklyBar.tsx
git commit -m "feat: add WeeklyBar chart component"
```

---

### Task 6: 创建 AppTable 表格组件（含搜索排序）

**Files:**
- Create: `ui/src/components/AppTable.tsx`

**Interfaces:**
- Consumes: `StatRow` (extended), `fmtHours()` from `utils/format.ts`
- Produces: `AppTable` component — Task 7 (App.tsx) 使用

- [ ] **Step 1: 创建 AppTable.tsx**

```tsx
// ui/src/components/AppTable.tsx
import { useState, useMemo } from "react";
import { fmtHours } from "../utils/format";

interface StatRow {
  app: string;
  today_secs: number;
  week_secs: number;
  month_secs: number;
  total_secs: number;
}

interface AppTableProps {
  rows: StatRow[];
}

type SortKey = "today_secs" | "week_secs" | "month_secs" | "total_secs";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "today_secs", label: "今日" },
  { key: "week_secs", label: "本周" },
  { key: "month_secs", label: "本月" },
  { key: "total_secs", label: "总计" },
];

export function AppTable({ rows }: AppTableProps) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("total_secs");
  const [sortAsc, setSortAsc] = useState(false);

  const filtered = useMemo(() => {
    let result = rows;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((r) => r.app.toLowerCase().includes(q));
    }
    result = [...result].sort((a, b) => {
      const diff = a[sortKey] - b[sortKey];
      return sortAsc ? diff : -diff;
    });
    return result;
  }, [rows, search, sortKey, sortAsc]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  return (
    <div style={{
      background: "var(--bg-card)",
      borderRadius: "var(--radius)",
      boxShadow: "var(--shadow)",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* 搜索栏 */}
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
        <input
          type="text"
          placeholder="搜索应用..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "100%",
            padding: "8px 12px",
            border: "1px solid var(--border)",
            borderRadius: 8,
            background: "var(--bg-primary)",
            color: "var(--text-primary)",
            fontSize: "0.85rem",
            outline: "none",
          }}
        />
      </div>
      {/* 表格 */}
      <div style={{ overflow: "auto", flex: 1 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
          <thead>
            <tr style={{ background: "var(--bg-secondary)" }}>
              <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 600, color: "var(--text-secondary)", fontSize: "0.75rem" }}>
                应用
              </th>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  style={{
                    padding: "10px 16px", textAlign: "right", fontWeight: 600,
                    color: "var(--text-secondary)", fontSize: "0.75rem",
                    cursor: "pointer", userSelect: "none", whiteSpace: "nowrap",
                  }}
                >
                  {col.label}{sortKey === col.key ? (sortAsc ? " ↑" : " ↓") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: 24, textAlign: "center", color: "var(--text-secondary)" }}>
                  暂无数据
                </td>
              </tr>
            )}
            {filtered.map((r) => (
              <tr key={r.app} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "10px 16px", fontWeight: 600 }}>{r.app}</td>
                <td style={{ padding: "10px 16px", textAlign: "right", color: "var(--text-secondary)" }}>{fmtHours(r.today_secs)}</td>
                <td style={{ padding: "10px 16px", textAlign: "right", color: "var(--text-secondary)" }}>{fmtHours(r.week_secs)}</td>
                <td style={{ padding: "10px 16px", textAlign: "right", color: "var(--text-secondary)" }}>{fmtHours(r.month_secs)}</td>
                <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: 600 }}>{fmtHours(r.total_secs)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

```bash
cd ui && npx tsc --noEmit
```
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add ui/src/components/AppTable.tsx
git commit -m "feat: add AppTable with search and sort"
```

---

### Task 7: 重构 App.tsx 组装新布局

**Files:**
- Modify: `ui/src/App.tsx` (完全重写)

**Interfaces:**
- Consumes: `StatsCard`, `AppUsagePie`, `WeeklyBar`, `AppTable` from previous tasks
- Consumes: `invoke("get_stats")` returning extended `StatRow`
- Consumes: `invoke("get_config")` returning `AppConfig`

- [ ] **Step 1: 重写 App.tsx**

```tsx
// ui/src/App.tsx
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

  // 汇总数据
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
```

- [ ] **Step 2: 删除 App.tsx 中旧的 fmtHours 函数**

确认 `fmtHours` 已从 `utils/format.ts` 导入，App.tsx 中不再有本地定义。

- [ ] **Step 3: 验证 TypeScript 编译**

```bash
cd ui && npx tsc --noEmit
```
Expected: 无错误

- [ ] **Step 4: 运行 dev 验证界面**

```bash
npm run tauri dev
```
Expected: 窗口打开，显示4个统计卡片 + 环形图 + 柱状图 + 表格，深浅色跟随系统

- [ ] **Step 5: Commit**

```bash
git add ui/src/App.tsx
git commit -m "feat: rewrite App.tsx with new dashboard layout"
```

---

### Task 8: 最终验证

- [ ] **Step 1: 运行 Rust 测试**

```bash
cd src-tauri && cargo test
```
Expected: 全部 PASS

- [ ] **Step 2: 运行 TypeScript 检查**

```bash
cd ui && npx tsc --noEmit
```
Expected: 无错误

- [ ] **Step 3: 运行 dev 手动验证**

```bash
npm run tauri dev
```
验证清单：
- [ ] 4个统计卡片显示正确数值
- [ ] 环形图显示 Top 5 应用占比
- [ ] 柱状图显示本周趋势
- [ ] 表格支持搜索和排序
- [ ] 深色/浅色主题跟随系统切换
- [ ] 所有内容在一屏内显示（无滚动条）
- [ ] 设置页功能正常（后台模式、JSON目录、退出）

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete UI redesign with charts and responsive layout"
```
