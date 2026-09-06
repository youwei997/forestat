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
      height: "100%",
    }}>
      {/* 搜索栏 */}
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
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
              <th style={{
                padding: "10px 16px", textAlign: "left", fontWeight: 600,
                color: "var(--text-secondary)", fontSize: "0.75rem",
                position: "sticky", top: 0, background: "var(--bg-secondary)",
              }}>
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
                    position: "sticky", top: 0, background: "var(--bg-secondary)",
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
