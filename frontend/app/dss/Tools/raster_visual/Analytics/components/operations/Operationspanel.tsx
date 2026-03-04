import React, { useState, useMemo } from "react";
import { useRaster } from "@/contexts/raster_operations/RasterContext";
import {
  CATEGORIES,
  OPERATIONS,
  OperationCategory,
  OperationDef,
  getOperationsByCategory,
} from "./registry";
import OperationCard from "./Operationcard";
import OperationForm from "./Operationform";

// ─────────────────────────────────────────────────────────────────────────────
// OperationsPanel — Full operations sidebar section
// Shows category tabs + operation grid + dynamic form
// ─────────────────────────────────────────────────────────────────────────────

const OperationsPanel: React.FC = () => {
  const { layer, executeOperation } = useRaster();

  const [activeCategory, setActiveCategory] = useState<OperationCategory | "all">("all");
  const [selectedOp, setSelectedOp] = useState<OperationDef | null>(null);
  const [search, setSearch] = useState("");
  const [running, setRunning] = useState(false);

  const hasLayer = !!layer;

  // ── Filtered operations ────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let ops = activeCategory === "all" ? OPERATIONS : getOperationsByCategory(activeCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      ops = ops.filter(
        (o) =>
          o.label.toLowerCase().includes(q) ||
          o.description.toLowerCase().includes(q) ||
          o.id.includes(q)
      );
    }
    return ops;
  }, [activeCategory, search]);

  // ── Grouped by category (when showing "all") ───────────────────────────
  const grouped = useMemo(() => {
    if (activeCategory !== "all") return null;
    const map = new Map<OperationCategory, OperationDef[]>();
    filtered.forEach((o) => {
      const arr = map.get(o.category) || [];
      arr.push(o);
      map.set(o.category, arr);
    });
    return map;
  }, [activeCategory, filtered]);

  // ── Execute handler ────────────────────────────────────────────────────
  const handleExecute = async (params: Record<string, unknown>) => {
    if (!selectedOp || !layer) return;
    setRunning(true);
    try {
      await executeOperation(selectedOp.id as any, params);
    } finally {
      setRunning(false);
      setSelectedOp(null);
    }
  };

  // ── If an operation is selected, show its form ─────────────────────────
  if (selectedOp) {
    return (
      <OperationForm
        op={selectedOp}
        running={running}
        onExecute={handleExecute}
        onClose={() => setSelectedOp(null)}
      />
    );
  }

  return (
    <div className="space-y-3 terra-fade-in">

      {/* ── Section header ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <div
          className="w-5 h-5 rounded-md flex items-center justify-center"
          style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-border)' }}
        >
          <svg className="w-3 h-3" style={{ color: 'var(--accent)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
        </div>
        <span
          className="text-[11px] font-bold uppercase"
          style={{ color: 'var(--text-secondary)', letterSpacing: '0.08em' }}
        >
          Operations
        </span>
        <span
          className="terra-badge terra-badge--ready ml-auto"
          style={{ fontSize: 9 }}
        >
          {OPERATIONS.length} tools
        </span>
      </div>

      {/* ── Search ────────────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{
          background: 'var(--surface-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
        }}
      >
        <svg className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--text-muted)' }}
          fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <circle cx="11" cy="11" r="8" strokeWidth={2} />
          <path strokeLinecap="round" d="M21 21l-4.35-4.35" strokeWidth={2} />
        </svg>
        <input
          type="text"
          placeholder="Search operations…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-transparent outline-none text-[12px]"
          style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}
        />
        {search && (
          <button onClick={() => setSearch("")} style={{ color: 'var(--text-muted)' }}>
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* ── Category tabs ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-1.5">
        <CategoryTab
          label="All"
          active={activeCategory === "all"}
          dotColor="var(--text-muted)"
          onClick={() => setActiveCategory("all")}
        />
        {CATEGORIES.map((c) => (
          <CategoryTab
            key={c.id}
            label={c.label.split(" ")[0]}
            active={activeCategory === c.id}
            dotColor={c.dotColor}
            onClick={() => setActiveCategory(c.id)}
          />
        ))}
      </div>

      {/* ── No-layer warning ──────────────────────────────────────────────── */}
      {!hasLayer && (
        <div
          className="flex items-center gap-2 px-3 py-2.5"
          style={{
            background: 'var(--amber-bg)',
            border: '1px solid var(--amber-border)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <svg className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--amber)' }}
            fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <p className="text-[10px] font-medium" style={{ color: '#92400e' }}>
            Upload a raster first to enable operations
          </p>
        </div>
      )}

      {/* ── Operation grid ────────────────────────────────────────────────── */}
      {activeCategory === "all" && grouped ? (
        // Grouped view
        Array.from(grouped.entries()).map(([catId, ops]) => {
          const cat = CATEGORIES.find((c) => c.id === catId);
          if (!cat) return null;
          return (
            <div key={catId}>
              {/* Category header */}
              <div className="flex items-center gap-2 mb-2 mt-1">
                <div className="category-dot" style={{ background: cat.dotColor }} />
                <span
                  className="text-[9px] font-bold uppercase"
                  style={{
                    color: 'var(--text-muted)',
                    letterSpacing: '0.1em',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {cat.label}
                </span>
                <div className="flex-1 h-px" style={{ background: 'var(--border-muted)' }} />
                <span className="text-[9px]" style={{ color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>
                  {ops.length}
                </span>
              </div>
              <div className="space-y-1.5">
                {ops.map((op) => (
                  <OperationCard
                    key={op.id}
                    op={op}
                    isActive={false}
                    disabled={!hasLayer}
                    onClick={() => hasLayer && setSelectedOp(op)}
                  />
                ))}
              </div>
            </div>
          );
        })
      ) : (
        // Flat filtered view
        <div className="space-y-1.5">
          {filtered.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>No operations found</p>
            </div>
          ) : (
            filtered.map((op) => (
              <OperationCard
                key={op.id}
                op={op}
                isActive={false}
                disabled={!hasLayer}
                onClick={() => hasLayer && setSelectedOp(op)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
};

// ── Category tab pill ────────────────────────────────────────────────────────

function CategoryTab({
  label,
  active,
  dotColor,
  onClick,
}: {
  label: string;
  active: boolean;
  dotColor: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-2.5 py-1.5 transition-all duration-150"
      style={{
        borderRadius: 'var(--radius-sm)',
        border: `1px solid ${active ? 'var(--accent)' : 'var(--border-subtle)'}`,
        background: active ? 'var(--accent-bg)' : 'var(--surface-card)',
        color: active ? 'var(--accent)' : 'var(--text-muted)',
        fontSize: 10,
        fontWeight: 600,
        fontFamily: 'var(--font-mono)',
        cursor: 'pointer',
      }}
    >
      <span className="w-[5px] h-[5px] rounded-full" style={{ background: active ? dotColor : 'var(--border-strong)' }} />
      {label}
    </button>
  );
}

export default OperationsPanel;