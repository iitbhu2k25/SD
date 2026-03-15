import React, { useState, useMemo } from "react";
import { OperationDef, OperationParam, getCategoryDef } from "./registry";

// ─────────────────────────────────────────────────────────────────────────────
// OperationForm — Dynamic param form for the selected operation
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  op: OperationDef;
  running: boolean;
  onExecute: (params: Record<string, unknown>) => void;
  onClose: () => void;
}

const OperationForm: React.FC<Props> = ({ op, running, onExecute, onClose }) => {
  const color = `var(${op.accentColor})`;
  const bgColor = `var(${op.accentColor}-bg)`;
  const borderColor = `var(${op.accentColor}-border)`;
  const cat = getCategoryDef(op.category);

  // Build default values from params
  const defaults = useMemo(() => {
    const d: Record<string, unknown> = {};
    op.params.forEach((p) => { d[p.key] = p.default; });
    return d;
  }, [op]);

  const [values, setValues] = useState<Record<string, unknown>>(defaults);

  const set = (key: string, val: unknown) =>
    setValues((prev) => ({ ...prev, [key]: val }));

  const handleSubmit = () => {
    if (running) return;
    onExecute(values);
  };

  return (
    <div className="terra-fade-in">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div
        className="p-3 flex items-center gap-3"
        style={{
          background: bgColor,
          borderRadius: 'var(--radius-lg)',
          border: `1px solid ${borderColor}`,
          marginBottom: 12,
        }}
      >
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: `${color}18`, border: `1px solid ${borderColor}` }}
        >
          <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none"
            stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d={op.icon} />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold" style={{ color }}>{op.label}</p>
          <p className="text-[10px]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {cat?.label}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-md transition-colors"
          style={{ color: 'var(--text-muted)' }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* ── Params ────────────────────────────────────────────────────────── */}
      {op.params.length > 0 ? (
        <div className="space-y-3 mb-4">
          {op.params.map((p) => (
            <ParamField key={p.key} param={p} value={values[p.key]} onChange={(v) => set(p.key, v)} />
          ))}
        </div>
      ) : (
        <div
          className="text-center py-4 mb-4"
          style={{
            background: 'var(--surface-sunken)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-muted)',
          }}
        >
          <p className="text-[11px]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            No parameters needed — ready to run
          </p>
        </div>
      )}

      {/* ── Execute button ────────────────────────────────────────────────── */}
      <button
        onClick={handleSubmit}
        disabled={running}
        className="w-full py-3 flex items-center justify-center gap-2 transition-all duration-200"
        style={{
          borderRadius: 'var(--radius-lg)',
          border: 'none',
          background: running
            ? 'var(--border-strong)'
            : `linear-gradient(135deg, ${color} 0%, ${color}cc 100%)`,
          color: '#dc3a09e5',
          fontSize: 16,
          fontWeight: 700,
          fontFamily: 'var(--font-mono)',
          letterSpacing: '0.5px',
          textTransform: 'uppercase' as const,
          cursor: running ? 'not-allowed' : 'pointer',
          boxShadow: running ? 'none' : `0 2px 8px ${color}33`,
        }}
      >
        {running ? (
          <>
            <div
              className="w-4 h-4 rounded-full animate-spin"
              style={{ border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff' }}
            />
            Processing…
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Execute {op.label}
          </>
        )}
      </button>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// ParamField — renders one parameter input based on its type
// ─────────────────────────────────────────────────────────────────────────────

function ParamField({
  param,
  value,
  onChange,
}: {
  param: OperationParam;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const labelStyle: React.CSSProperties = {
    color: 'var(--text-muted)',
    fontSize: 9,
    fontFamily: 'var(--font-mono)',
    letterSpacing: '1.5px',
    textTransform: 'uppercase',
    marginBottom: 5,
    display: 'block',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'var(--surface-input)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
    padding: '9px 12px',
    color: 'var(--text-primary)',
    fontSize: 12,
    fontFamily: 'var(--font-mono)',
    outline: 'none',
  };

  switch (param.type) {
    case "select":
      return (
        <div>
          <label style={labelStyle}>{param.label}</label>
          <select
            value={String(value)}
            onChange={(e) => onChange(e.target.value)}
            style={inputStyle}
          >
            {param.options?.map((o) => (
              <option key={String(o.value)} value={String(o.value)}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      );

    case "number":
      return (
        <div>
          <div className="flex items-center justify-between" style={{ marginBottom: 5 }}>
            <label style={{ ...labelStyle, marginBottom: 0 }}>{param.label}</label>
            {param.unit && (
              <span className="text-[9px] px-1.5 py-0.5 rounded"
                style={{ background: 'var(--surface-sunken)', color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>
                {param.unit}
              </span>
            )}
          </div>
          <input
            type="number"
            value={Number(value)}
            onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
            min={param.min}
            max={param.max}
            step={param.step}
            style={inputStyle}
          />
          {param.hint && (
            <p className="text-[9px] mt-1" style={{ color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>
              {param.hint}
            </p>
          )}
        </div>
      );

    case "text":
      return (
        <div>
          <label style={labelStyle}>{param.label}</label>
          <input
            type="text"
            value={String(value)}
            onChange={(e) => onChange(e.target.value)}
            style={inputStyle}
          />
        </div>
      );

    case "boolean":
      return (
        <div className="flex items-center justify-between py-1">
          <label style={{ ...labelStyle, marginBottom: 0 }}>{param.label}</label>
          <div
            className="terra-toggle"
            data-active={String(!!value)}
            onClick={() => onChange(!value)}
          />
        </div>
      );

    default:
      return null;
  }
}

export default OperationForm;