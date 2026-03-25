import React from "react";
import { OperationDef } from "@/contexts/raster_operations/registry";

interface Props {
  op: OperationDef;
  isActive: boolean;
  disabled: boolean;
  onClick: () => void;
}

const OperationCard: React.FC<Props> = ({ op, isActive, disabled, onClick }) => {
  const color = `var(${op.accentColor})`;
  const bgColor = `var(${op.accentColor}-bg)`;
  const borderColor = `var(${op.accentColor}-border)`;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="op-card w-full text-left p-3 flex items-start gap-2.5 group"
      style={{
        borderRadius: "var(--radius-lg)",
        border: `1px solid ${isActive ? color : "var(--border-subtle)"}`,
        background: isActive ? bgColor : "var(--surface-card)",
        opacity: disabled ? 0.45 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "all 0.15s",
        boxShadow: isActive ? `0 0 0 3px ${borderColor}` : "var(--shadow-sm)",
      }}
    >
      {/* Icon */}
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-105"
        style={{
          background: isActive ? `${color}18` : "var(--surface-sunken)",
          border: `1px solid ${isActive ? borderColor : "var(--border-muted)"}`,
        }}
      >
        <svg
          className="w-4 h-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke={isActive ? color : "var(--text-muted)"}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d={op.icon} />
        </svg>
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p
          className="text-[12px] font-semibold leading-tight truncate"
          style={{ color: isActive ? color : "var(--text-primary)" }}
        >
          {op.label}
        </p>
        <p
          className="text-[10px] mt-0.5 leading-snug"
          style={{
            color: "var(--text-muted)",
            fontFamily: "var(--font-mono)",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical" as const,
            overflow: "hidden",
          }}
        >
          {op.description}
        </p>
      </div>

      {/* Chevron / active dot */}
      {isActive ? (
        <div
          className="w-2 h-2 rounded-full flex-shrink-0 mt-1 terra-pulse-dot"
          style={{ background: color }}
        />
      ) : (
        <svg
          className="w-3 h-3 flex-shrink-0 mt-1 opacity-30 group-hover:opacity-60 transition-opacity"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      )}
    </button>
  );
};

export default OperationCard;