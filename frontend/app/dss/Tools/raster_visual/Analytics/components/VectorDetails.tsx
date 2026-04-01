import React, { useState } from "react";
import { useRaster } from "@/contexts/raster_operations/RasterContext";
import type { AttributeField } from "@/interface/raster_operations";

/* ── Section heading ──────────────────────────────────────────────────────── */

function SectionHeading({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 pt-5 pb-2">
      <div className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--accent)" }}>
        {icon}
      </div>
      <span
        className="text-[9px] font-bold uppercase"
        style={{
          letterSpacing: "0.12em",
          color: "var(--text-muted)",
          fontFamily: "var(--font-mono)",
        }}
      >
        {title}
      </span>
      <div
        className="flex-1 h-px"
        style={{ background: "linear-gradient(to right, var(--border-subtle), transparent)" }}
      />
    </div>
  );
}

/* ── Cell color map ───────────────────────────────────────────────────────── */

type CellColor = "blue" | "teal" | "purple" | "amber" | "coral" | "gray";

const CELL_STYLES: Record<CellColor, { border: string; bg: string; textColor: string }> = {
  blue:   { border: "rgba(24,95,165,0.30)",  bg: "rgba(24,95,165,0.06)",   textColor: "#0C447C" },
  teal:   { border: "rgba(13,155,122,0.30)", bg: "rgba(13,155,122,0.06)",  textColor: "#085041" },
  purple: { border: "rgba(83,74,183,0.30)",  bg: "rgba(83,74,183,0.06)",   textColor: "#3C3489" },
  amber:  { border: "rgba(186,117,23,0.30)", bg: "rgba(186,117,23,0.06)",  textColor: "#633806" },
  coral:  { border: "rgba(216,90,48,0.30)",  bg: "rgba(216,90,48,0.06)",   textColor: "#712B13" },
  gray:   { border: "var(--border-subtle)",  bg: "var(--surface-card)",    textColor: "var(--text-primary)" },
};

function Cell({
  label,
  value,
  sub,
  color = "gray",
  mono = true,
  span2 = false,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: CellColor;
  mono?: boolean;
  span2?: boolean;
}) {
  const s = CELL_STYLES[color];
  return (
    <div
      className="p-2.5"
      style={{
        borderRadius: "var(--radius-lg)",
        border: `1px solid ${s.border}`,
        background: s.bg,
        gridColumn: span2 ? "span 2" : undefined,
      }}
    >
      <p
        className="text-[8px] font-semibold uppercase mb-0.5"
        style={{ letterSpacing: "0.1em", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}
      >
        {label}
      </p>
      <p
        className="text-[11px] font-bold truncate"
        style={{ fontFamily: mono ? "var(--font-mono)" : "var(--font-body)", color: s.textColor }}
      >
        {value}
      </p>
      {sub && (
        <p className="text-[9px] mt-0.5" style={{ color: "var(--text-muted)" }}>{sub}</p>
      )}
    </div>
  );
}

/* ── Key-value row ────────────────────────────────────────────────────────── */

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex items-center justify-between px-2.5 py-2 mb-1"
      style={{
        background: "var(--surface-card)",
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--border-muted)",
      }}
    >
      <span className="text-[10px] truncate max-w-[45%]" style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
        {label}
      </span>
      <span className="text-[10px] truncate max-w-[50%] text-right" style={{ color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
        {value}
      </span>
    </div>
  );
}

/* ── Attribute schema table ───────────────────────────────────────────────── */

const FIELD_COLORS = [
  { border: "rgba(83,74,183,0.20)",  bg: "rgba(83,74,183,0.04)",  name: "#3C3489", type: "#534AB7" },
  { border: "rgba(13,155,122,0.20)", bg: "rgba(13,155,122,0.04)", name: "#085041", type: "#0D9B7A" },
  { border: "rgba(24,95,165,0.20)",  bg: "rgba(24,95,165,0.04)",  name: "#0C447C", type: "#185FA5" },
  { border: "rgba(186,117,23,0.20)", bg: "rgba(186,117,23,0.04)", name: "#633806", type: "#BA7517" },
];

function AttributeTable({ fields }: { fields: AttributeField[] }) {
  const [expanded, setExpanded] = useState(fields.length <= 5);
  const visible = expanded ? fields : fields.slice(0, 4);

  return (
    <div className="space-y-1.5">
      {visible.map((f, i) => {
        const c = FIELD_COLORS[i % FIELD_COLORS.length];
        return (
          <div
            key={f.name}
            className="flex items-center justify-between px-2.5 py-2"
            style={{
              borderRadius: "var(--radius-md)",
              border: `1px solid ${c.border}`,
              background: c.bg,
            }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <div
                className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                style={{ background: c.border }}
              >
                <span className="text-[7px] font-bold" style={{ color: c.name, fontFamily: "var(--font-mono)" }}>
                  {i + 1}
                </span>
              </div>
              <span
                className="text-[10px] font-semibold truncate"
                style={{ color: c.name, fontFamily: "var(--font-mono)" }}
              >
                {f.name}
              </span>
            </div>
            <span
              className="px-1.5 py-0.5 rounded-full text-[9px] font-semibold flex-shrink-0 ml-2"
              style={{
                background: c.bg,
                border: `1px solid ${c.border}`,
                color: c.type,
                fontFamily: "var(--font-mono)",
              }}
            >
              {f.type}
            </span>
          </div>
        );
      })}
      {fields.length > 4 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full py-2.5 text-[10px] font-semibold flex items-center justify-center gap-1.5 transition-all"
          style={{
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--border-subtle)",
            background: "var(--surface-card)",
            color: "var(--text-tertiary)",
          }}
        >
          {expanded ? (
            <>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
              Show less
            </>
          ) : (
            <>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              Show {fields.length - 4} more field{fields.length - 4 !== 1 ? "s" : ""}
            </>
          )}
        </button>
      )}
    </div>
  );
}

/* ── Skeleton loader ──────────────────────────────────────────────────────── */

function Skeleton() {
  return (
    <div className="space-y-3 animate-pulse pt-1">
      <div className="h-[72px] rounded-xl" style={{ background: "var(--surface-sunken)" }} />
      <div className="h-3 w-32 rounded mt-4" style={{ background: "var(--border-subtle)" }} />
      <div className="grid grid-cols-2 gap-1.5">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-12 rounded-xl" style={{ background: "var(--surface-sunken)" }} />
        ))}
      </div>
      <div className="h-3 w-24 rounded mt-4" style={{ background: "var(--border-subtle)" }} />
      <div className="space-y-1.5">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-8 rounded-md" style={{ background: "var(--surface-sunken)" }} />
        ))}
      </div>
    </div>
  );
}

/* ── Main component ───────────────────────────────────────────────────────── */

const VectorDetails: React.FC = () => {
  const { vectorLayer, vectorDetails: d, vectorDetailsLoading } = useRaster();

  if (!vectorLayer) {
    return (
      <div className="flex flex-col items-center justify-center py-14 text-center px-4">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
          style={{ background: "var(--surface-sunken)", border: "1px solid var(--border-subtle)" }}
        >
          <svg className="w-6 h-6" style={{ color: "var(--text-muted)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
        </div>
        <p className="text-xs font-semibold" style={{ color: "var(--text-tertiary)" }}>No vector layer</p>
        <p className="text-[10px] mt-1 leading-relaxed" style={{ color: "var(--text-muted)" }}>
          Upload a vector file to view its metadata.
        </p>
      </div>
    );
  }

  if (vectorDetailsLoading) return <Skeleton />;
  if (!d) return null;

  const fmtDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString("en-IN", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      });
    } catch { return iso; }
  };

  const badges = [
    { t: d.driver,        style: { color: "#0C447C",  background: "#E6F1FB",        borderColor: "#85B7EB" } },
    { t: `${d.file_size.value} ${d.file_size.unit}`, style: { color: "#633806", background: "#FAEEDA", borderColor: "#EF9F27" } },
    { t: d.geometry_type, style: { color: "#085041", background: "#E1F5EE", borderColor: "#5DCAA5" } },
    { t: d.storage_type,  style: { color: "var(--text-tertiary)", background: "var(--surface-sunken)", borderColor: "var(--border-subtle)" } },
  ];

  return (
    <div
      className="pb-8 space-y-0.5 rounded-xl px-0.5"
      style={{
        background: "linear-gradient(160deg, rgba(34,197,94,0.04) 0%, rgba(24,95,165,0.03) 50%, rgba(83,74,183,0.04) 100%)",
      }}
    >
      {/* ── File header card ─────────────────────────────────────────────── */}
      <div
        className="p-3 mt-1"
        style={{
          borderRadius: "var(--radius-lg)",
          background: "var(--surface-card)",
          border: "1px solid var(--green-border, rgba(34,197,94,0.2))",
          boxShadow: "0 1px 8px rgba(34,197,94,0.07), var(--shadow-sm)",
        }}
      >
        <div className="flex items-start gap-2.5">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
            style={{ background: "var(--green-bg, rgba(34,197,94,0.08))", border: "1px solid var(--green-border, rgba(34,197,94,0.2))" }}
          >
            <svg className="w-4 h-4" style={{ color: "var(--green)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate leading-tight" style={{ color: "var(--text-primary)" }}>
              {d.file_name}
            </p>
            <p className="text-[10px] mt-0.5 truncate" style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
              {d.layer_name}
            </p>
            <div className="flex flex-wrap gap-1 mt-2">
              {badges.map((b, i) => (
                <span
                  key={i}
                  className="px-1.5 py-0.5 rounded-full text-[9px] font-semibold"
                  style={{ fontFamily: "var(--font-mono)", border: `1px solid ${b.style.borderColor}`, ...b.style }}
                >
                  {b.t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── File Info ────────────────────────────────────────────────────── */}
      <SectionHeading
        title="File Info"
        icon={<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
      />
      <InfoRow label="file_name"   value={d.file_name} />
      {d.parent_id !== null && <InfoRow label="parent_id" value={String(d.parent_id)} />}
      <InfoRow label="modified_at" value={fmtDate(d.modified_at)} />

      {/* ── Vector Properties ────────────────────────────────────────────── */}
      <SectionHeading
        title="Vector Properties"
        icon={<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/></svg>}
      />
      <div className="grid grid-cols-2 gap-1.5">
        <Cell label="Driver"        value={d.driver}                                         color="blue" />
        <Cell label="Features"      value={d.feature_count.toLocaleString()}                 color="teal" />
        <Cell label="Geometry"      value={d.geometry_type}                                  color="purple" span2 />
        <Cell label="CRS"           value={d.crs}        sub={d.crs_unit}                   color="teal" span2 />
        <Cell label="File Size"     value={`${d.file_size.value} ${d.file_size.unit}`}       color="amber" span2 />
      </div>

      {/* ── Attribute Schema ─────────────────────────────────────────────── */}
      <SectionHeading
        title={`Attribute Schema (${d.attribute_schema.length})`}
        icon={<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9a2 2 0 00-2-2H9m0 12H5a2 2 0 01-2-2V9a2 2 0 012-2h4"/></svg>}
      />
      {d.attribute_schema.length > 0 ? (
        <AttributeTable fields={d.attribute_schema} />
      ) : (
        <p className="text-[10px] px-1" style={{ color: "var(--text-muted)" }}>No attribute fields.</p>
      )}
    </div>
  );
};

export default VectorDetails;
