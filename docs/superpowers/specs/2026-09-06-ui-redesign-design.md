# Forestat UI 重新设计方案

## 概述

将 forestat 的界面从基础表格升级为现代化、响应式的仪表盘，采用极简风格，支持图表可视化，自动适应深浅色主题，并确保内容在一屏内完整显示。

## 设计目标

1. **现代化视觉**：采用极简设计风格，大量留白，清晰的视觉层次
2. **数据可视化**：混合图表展示（环形图 + 柱状图 + 表格）
3. **响应式布局**：适配桌面端、平板端、移动端
4. **主题自适应**：自动跟随系统深浅色设置
5. **单屏显示**：所有内容在一屏内完整展示，无需滚动

## 技术方案

### 技术栈选择

**方案：Chart.js + CSS变量（推荐）**

- **图表库**：Chart.js（~60KB）- 轻量级、支持饼图/柱状图/折线图
- **样式方案**：CSS变量 + CSS Grid/Flexbox
- **主题切换**：`prefers-color-scheme` 媒体查询自动切换
- **优点**：
  - 轻量级，符合"不超过一屏"的性能要求
  - 简单可靠，易于维护
  - 性能好，加载快

### 依赖变更

```json
// ui/package.json 新增依赖
{
  "dependencies": {
    "chart.js": "^4.4.0",
    "react-chartjs-2": "^5.2.0"
  }
}
```

## 布局设计

### 整体结构

```
┌─────────────────────────────────────────────────────────────┐
│                      顶部摘要区                              │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐          │
│  │ 今日使用 │ │ 本周使用 │ │ 本月使用 │ │ 总应用数 │          │
│  │  5.2h   │ │  32.1h  │ │  128h   │ │   12    │          │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘          │
├─────────────────────────────────────────────────────────────┤
│                      图表区                                  │
│  ┌─────────────────────┐ ┌─────────────────────┐          │
│  │                     │ │                     │          │
│  │    环形图            │ │    柱状图            │          │
│  │  Top 5 应用占比      │ │  最近7天使用趋势     │          │
│  │                     │ │                     │          │
│  └─────────────────────┘ └─────────────────────┘          │
├─────────────────────────────────────────────────────────────┤
│                      表格区                                  │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ 🔍 搜索应用...                                       │  │
│  ├─────────────────────────────────────────────────────┤  │
│  │ 应用名称     │ 今日    │ 本周    │ 本月    │ 总计    │  │
│  ├─────────────┼─────────┼─────────┼─────────┼─────────┤  │
│  │ Chrome      │ 2.1h    │ 12.5h   │ 48.2h   │ 156h    │  │
│  │ VS Code     │ 1.8h    │ 10.2h   │ 42.1h   │ 128h    │  │
│  │ ...         │ ...     │ ...     │ ...     │ ...     │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 响应式断点

```css
/* 桌面端 (≥1024px) */
.stats-grid { grid-template-columns: repeat(4, 1fr); }
.charts-grid { grid-template-columns: 1fr 1fr; }

/* 平板端 (768px - 1023px) */
.stats-grid { grid-template-columns: repeat(2, 1fr); }
.charts-grid { grid-template-columns: 1fr; }

/* 移动端 (<768px) */
.stats-grid { grid-template-columns: 1fr; }
.charts-grid { grid-template-columns: 1fr; }
/* 表格转为卡片列表 */
.table-view { display: none; }
.card-view { display: block; }
```

## 组件设计

### 1. 统计卡片组件（StatsCard）

```tsx
interface StatsCardProps {
  title: string;           // "今日使用" | "本周使用" | "本月使用" | "总应用数"
  value: string;           // 格式化后的时长或数量
  icon: React.ReactNode;   // 图标
  trend?: 'up' | 'down' | 'stable';  // 趋势指示器（可选）
}
```

**样式规范**：
- 背景：`var(--bg-card)` 带微妙阴影（`box-shadow: 0 2px 8px rgba(0,0,0,0.06)`）
- 数字：字号 2rem，颜色 `var(--accent)`
- 标签：字号 0.875rem，颜色 `var(--text-secondary)`
- 悬停效果：`transform: translateY(-2px)` + 阴影加深
- 圆角：`border-radius: 12px`

### 2. 环形图组件（AppUsagePie）

```tsx
interface PieData {
  app: string;
  today_secs: number;
}
```

**功能规范**：
- 显示 Top 5 应用 + "其他" 分类（合并剩余应用）
- 中心显示今日总时长
- 悬停显示：应用名 + 时长 + 百分比
- 颜色：使用预设调色板，自动适应主题
- 图表尺寸：自适应容器，保持正方形比例

**颜色调色板**：
```css
--chart-color-1: #4361ee;
--chart-color-2: #3a0ca3;
--chart-color-3: #7209b7;
--chart-color-4: #f72585;
--chart-color-5: #4cc9f0;
--chart-color-6: #adb5bd;  // "其他"
```

### 3. 柱状图组件（WeeklyBar）

```tsx
interface BarData {
  date: string;    // "周一" ~ "周日"
  hours: number;   // 使用时长（小时）
}
```

**功能规范**：
- 显示最近 7 天使用时长趋势
- X 轴：星期几（周一 ~ 周日）
- Y 轴：小时数（自动刻度）
- 悬停显示具体时长（精确到分钟）
- 柱状图颜色：`var(--accent)` 带透明度变化
- 当前日期柱状图高亮

### 4. 表格组件（AppTable）

```tsx
interface TableRow {
  app: string;
  today_secs: number;
  week_secs: number;
  month_secs: number;
  total_secs: number;
}
```

**功能规范**：
- 列：应用名称、今日、本周、本月、总计
- 支持点击列头排序（升序/降序切换）
- 顶部搜索框：实时过滤应用名（防抖 300ms）
- 默认按总计时长降序排列
- 响应式：移动端转换为卡片列表布局

**桌面端表格样式**：
- 表头：背景 `var(--bg-secondary)`，字号 0.75rem，文字颜色 `var(--text-secondary)`
- 行：悬停高亮 `var(--bg-secondary)`
- 边框：`1px solid var(--border)`
- 单元格内边距：`12px 16px`

**移动端卡片样式**：
```tsx
<div className="app-card">
  <div className="app-name">Chrome</div>
  <div className="app-stats">
    <span>今日: 2.1h</span>
    <span>本周: 12.5h</span>
    <span>总计: 156h</span>
  </div>
</div>
```

### 5. 主题系统

```css
:root {
  /* 浅色主题 */
  --bg-primary: #ffffff;
  --bg-secondary: #f8f9fa;
  --bg-card: #ffffff;
  --text-primary: #1a1a2e;
  --text-secondary: #6c757d;
  --accent: #4361ee;
  --border: #e9ecef;
  --shadow: 0 2px 8px rgba(0,0,0,0.06);
}

@media (prefers-color-scheme: dark) {
  :root {
    /* 深色主题 */
    --bg-primary: #0f0f23;
    --bg-secondary: #1a1a2e;
    --bg-card: #16213e;
    --text-primary: #e6e6e6;
    --text-secondary: #a0a0b0;
    --accent: #7b8cde;
    --border: #2a2a4a;
    --shadow: 0 2px 8px rgba(0,0,0,0.2);
  }
}
```

## 数据流

### 数据获取

```tsx
// 现有接口（保持不变）
interface StatRow {
  app: string;
  today_secs: number;
  year_secs: number;
  total_secs: number;
}

// 新增：周数据和月数据需要在后端计算
// 方案：在现有 get_stats 命令中扩展返回字段
interface ExtendedStatRow extends StatRow {
  week_secs: number;   // 本周使用时长
  month_secs: number;  // 本月使用时长
}
```

### 数据处理

```tsx
// 环形图数据处理
const getPieData = (rows: ExtendedStatRow[]): PieData[] => {
  const sorted = [...rows].sort((a, b) => b.today_secs - a.today_secs);
  const top5 = sorted.slice(0, 5);
  const others = sorted.slice(5);
  const othersTotal = others.reduce((sum, r) => sum + r.today_secs, 0);
  
  return [
    ...top5.map(r => ({ app: r.app, today_secs: r.today_secs })),
    { app: '其他', today_secs: othersTotal }
  ];
};

// 柱状图数据处理（需要后端提供历史数据）
const getBarData = (history: DailyUsage[]): BarData[] => {
  return history.map(d => ({
    date: formatDay(d.date),
    hours: d.total_secs / 3600
  }));
};
```

## 后端变更（可选）

### 方案选择：扩展现有接口（推荐）

在 `tracker.rs` 中扩展 `StatRow` 结构体：

```rust
pub struct StatRow {
    pub app: String,
    pub today_secs: u64,
    pub week_secs: u64,    // 新增：本周使用时长
    pub month_secs: u64,   // 新增：本月使用时长
    pub year_secs: u64,
    pub total_secs: u64,
}
```

**选择理由**：
- 保持单一接口，减少前端调用复杂度
- 数据一致性更好，避免多次请求的数据不一致问题
- 实现简单，只需在现有 `stats_on` 函数中增加计算逻辑

**实现方式**：
- 在 `tracker.rs` 中的 `stats_on` 函数中，根据 `NaiveDate` 计算本周和本月的起始日期
- 遍历 `UsageData` 中的历史数据，累计本周和本月的使用时长
- 本周定义：周一到周日（ISO 8601标准）
- 本月定义：当月1日到当天

## 文件结构

```
ui/src/
├── components/
│   ├── StatsCard.tsx      # 统计卡片组件
│   ├── AppUsagePie.tsx    # 环形图组件
│   ├── WeeklyBar.tsx      # 柱状图组件
│   ├── AppTable.tsx       # 表格组件
│   └── AppCard.tsx        # 移动端卡片组件（表格的响应式替代）
├── styles/
│   └── theme.css          # 主题变量和全局样式
├── utils/
│   └── format.ts          # 时长格式化工具函数
├── App.tsx                # 主应用组件（重构）
└── main.tsx               # 入口文件
```

## 实现优先级

### 第一阶段：基础布局和主题
1. 创建 CSS 变量主题系统
2. 实现响应式网格布局
3. 重构 App.tsx 为新布局结构

### 第二阶段：统计卡片
1. 创建 StatsCard 组件
2. 实现4个统计卡片（今日、本周、本月、总应用数）
3. 添加格式化工具函数

### 第三阶段：图表组件
1. 安装 Chart.js 和 react-chartjs-2
2. 实现 AppUsagePie 环形图组件
3. 实现 WeeklyBar 柱状图组件

### 第四阶段：表格增强
1. 重构 AppTable 组件
2. 添加排序和搜索功能
3. 实现移动端卡片视图

### 第五阶段：后端扩展（可选）
1. 扩展 StatRow 结构体添加周/月数据
2. 实现历史数据查询接口
3. 前端集成新数据

## 测试策略

1. **单元测试**：组件渲染、数据处理函数
2. **集成测试**：组件交互、主题切换
3. **响应式测试**：不同屏幕尺寸下的布局
4. **性能测试**：图表渲染性能、内存占用

## 验收标准

1. ✅ 所有内容在一屏内完整显示（无滚动条）
2. ✅ 自动跟随系统深浅色主题切换
3. ✅ 桌面端、平板端、移动端布局正确
4. ✅ 图表正确显示数据，悬停交互正常
5. ✅ 表格支持排序和搜索
6. ✅ 加载性能：首屏渲染 < 1 秒
7. ✅ 保持现有功能完整（后台模式、数据同步等）

## 风险和缓解措施

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| Chart.js 包体积影响加载速度 | 中 | 使用 Tree Shaking，按需引入组件 |
| 移动端表格可读性差 | 高 | 实现卡片式布局作为替代 |
| 后端数据扩展复杂 | 中 | 优先实现前端，后端扩展作为可选阶段 |
| 主题切换闪烁 | 低 | 使用 CSS 变量，避免 JS 主题切换 |

## 参考资源

- [Chart.js 文档](https://www.chartjs.org/docs/latest/)
- [react-chartjs-2 文档](https://react-chartjs-2.js.org/)
- [CSS 变量主题切换](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties)
- [响应式设计最佳实践](https://web.dev/responsive-design/)
