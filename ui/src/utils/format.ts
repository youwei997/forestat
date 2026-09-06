/** 秒 → "X小时Y分"，不足1小时显示"Y分"，不足1分显示"<1分" */
export function fmtHours(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h}小时${m}分`;
  if (m > 0) return `${m}分`;
  return "<1分";
}

/** 秒 → "Xh Ym"（图表 tooltip 用） */
export function fmtShort(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return "<1m";
}

/** 秒 → 小时数（保留1位小数） */
export function toHours(secs: number): number {
  return Math.round((secs / 3600) * 10) / 10;
}
