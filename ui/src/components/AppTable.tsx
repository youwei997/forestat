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

const MONOGRAM_COLORS = [
  "var(--chart-1)", "var(--chart-2)", "var(--chart-3)",
  "var(--chart-4)", "var(--chart-5)",
];

/** 用名字做稳定 hash 选一个颜色 */
function colorFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return MONOGRAM_COLORS[Math.abs(h) % MONOGRAM_COLORS.length];
}

function monogram(name: string): string {
  const s = name.trim();
  if (!s) return "?";
  // 去掉常见前缀
  const stripped = s.replace(/^(microsoft|ms)\s*/i, "");
  if (stripped !== s) return stripped[0].toUpperCase();
  return s[0].toUpperCase();
}

export function AppTable({ rows }: AppTableProps) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("total_secs");
  const [sortAsc, setSortAsc] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);

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
      border: "1px solid var(--border)",
      borderRadius: 4,
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      height: "100%",
    }}>
      <div style={{
        padding: "6px 8px",
        borderBottom: "1px solid var(--border)",
        flexShrink: 0,
      }}>
        <input
          type="text"
          placeholder="搜索应用…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: "100%" }}
        />
      </div>
      <div style={{ overflow: "auto", flex: 1 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "var(--bg-alt)" }}>
              <th style={{
                padding: "6px 10px",
                textAlign: "left",
                fontWeight: 600,
                color: "var(--text-muted)",
                fontSize: 11,
                position: "sticky",
                top: 0,
                background: "var(--bg-alt)",
                width: "40%",
              }}>
                应用
              </th>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  style={{
                    padding: "6px 10px",
                    textAlign: "right",
                    fontWeight: 600,
                    color: col.key === "today_secs" ? "var(--accent)" : "var(--text-muted)",
                    fontSize: 11,
                    cursor: "pointer",
                    userSelect: "none",
                    whiteSpace: "nowrap",
                    position: "sticky",
                    top: 0,
                    background: col.key === "today_secs" ? "var(--accent-light)" : "var(--bg-alt)",
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
                <td colSpan={5} style={{
                  padding: 16,
                  textAlign: "center",
                  color: "var(--text-muted)",
                  fontSize: 11,
                }}>
                  暂无数据
                </td>
              </tr>
            )}
            {filtered.map((r) => {
              const isHover = hovered === r.app;
              return (
                <tr
                  key={r.app}
                  onMouseEnter={() => setHovered(r.app)}
                  onMouseLeave={() => setHovered(null)}
                  style={{
                    borderBottom: "1px solid var(--border)",
                    background: isHover ? "var(--bg-alt)" : "transparent",
                    transition: "background 0.08s",
                  }}
                >
                  <td style={{ padding: "5px 10px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                      <span style={{
                        width: 22,
                        height: 22,
                        borderRadius: 5,
                        background: colorFor(r.app),
                        color: "#fff",
                        fontSize: 11,
                        fontWeight: 700,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        lineHeight: 1,
                      }}>{monogram(r.app)}</span>
                      <span style={{
                        fontWeight: 500,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}>{r.app}</span>
                    </div>
                  </td>
                  <td style={{
                    padding: "5px 10px",
                    textAlign: "right",
                    color: "var(--text)",
                    fontWeight: 600,
                    fontVariantNumeric: "tabular-nums",
                    background: "var(--accent-light)",
                  }}>{fmtHours(r.today_secs)}</td>
                  <td style={{
                    padding: "5px 10px",
                    textAlign: "right",
                    color: "var(--text-muted)",
                    fontVariantNumeric: "tabular-nums",
                  }}>{fmtHours(r.week_secs)}</td>
                  <td style={{
                    padding: "5px 10px",
                    textAlign: "right",
                    color: "var(--text-muted)",
                    fontVariantNumeric: "tabular-nums",
                  }}>{fmtHours(r.month_secs)}</td>
                  <td style={{
                    padding: "5px 10px",
                    textAlign: "right",
                    fontWeight: 600,
                    fontVariantNumeric: "tabular-nums",
                  }}>{fmtHours(r.total_secs)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
