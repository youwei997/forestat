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
