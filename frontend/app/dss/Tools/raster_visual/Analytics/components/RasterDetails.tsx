import React, { useState } from "react";
import { useRaster } from "@/contexts/raster_operations/RasterContext";
import { BandInfo } from "@/interface/raster_operations";

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

/* ── Data cell ────────────────────────────────────────────────────────────── */

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
        transition: "box-shadow 0.15s",
      }}
    >
      <p
        className="text-[8px] font-semibold uppercase mb-0.5"
        style={{
          letterSpacing: "0.1em",
          color: "var(--text-muted)",
          fontFamily: "var(--font-mono)",
        }}
      >
        {label}
      </p>
      <p
        className="text-[11px] font-bold truncate"
        style={{
          fontFamily: mono ? "var(--font-mono)" : "var(--font-body)",
          color: s.textColor,
        }}
      >
        {value}
      </p>
      {sub && (
        <p className="text-[9px] mt-0.5" style={{ color: "var(--text-muted)" }}>
          {sub}
        </p>
      )}
    </div>
  );
}

/* ── Bounds grid ──────────────────────────────────────────────────────────── */

function BoundsGrid({
  bounds,
  color = "blue",
}: {
  bounds: { west: number; south: number; east: number; north: number; unit?: string };
  color?: "blue" | "amber";
}) {
  const fmt = (n: number) => n.toFixed(5);
  const items: [string, string][] = [
    ["West", fmt(bounds.west)],
    ["East", fmt(bounds.east)],
    ["South", fmt(bounds.south)],
    ["North", fmt(bounds.north)],
  ];

  const palette =
    color === "blue"
      ? { border: "rgba(24,95,165,0.25)", bg: "rgba(24,95,165,0.05)", divider: "rgba(24,95,165,0.15)", label: "#185FA5", value: "#0C447C", foot: "rgba(24,95,165,0.08)", unit: "#185FA5" }
      : { border: "rgba(186,117,23,0.28)", bg: "rgba(186,117,23,0.05)", divider: "rgba(186,117,23,0.18)", label: "#BA7517", value: "#633806", foot: "rgba(186,117,23,0.08)", unit: "#BA7517" };

  return (
    <div
      className="overflow-hidden"
      style={{
        borderRadius: "var(--radius-lg)",
        border: `1px solid ${palette.border}`,
        background: palette.bg,
      }}
    >
      <div className="grid grid-cols-2" style={{ gap: 0 }}>
        {items.map(([l, v], i) => (
          <div
            key={l}
            className="px-3 py-2.5"
            style={{
              borderRight: i % 2 === 0 ? `1px solid ${palette.divider}` : "none",
              borderBottom: i < 2 ? `1px solid ${palette.divider}` : "none",
            }}
          >
            <p
              className="text-[8px] uppercase"
              style={{ letterSpacing: "0.08em", color: palette.label, fontFamily: "var(--font-mono)" }}
            >
              {l}
            </p>
            <p
              className="text-[11px] font-bold mt-0.5"
              style={{ color: palette.value, fontFamily: "var(--font-mono)" }}
            >
              {v}
            </p>
          </div>
        ))}
      </div>
      {bounds.unit && (
        <div
          className="px-3 py-1.5"
          style={{
            borderTop: `1px solid ${palette.divider}`,
            background: palette.foot,
          }}
        >
          <p className="text-[9px]" style={{ color: palette.unit, fontFamily: "var(--font-mono)" }}>
            Unit: {bounds.unit}
          </p>
        </div>
      )}
    </div>
  );
}

/* ── Band card ────────────────────────────────────────────────────────────── */

const BAND_COLORS = [
  { border: "rgba(83,74,183,0.25)",  bg: "rgba(83,74,183,0.05)",  num: { bg: "rgba(83,74,183,0.12)",  text: "#3C3489" }, title: "#26215C", dtype: { bg: "rgba(83,74,183,0.10)", border: "rgba(83,74,183,0.22)", text: "#3C3489" }, bar: "#534AB7", barTrack: "rgba(83,74,183,0.12)", stat: "rgba(83,74,183,0.08)", statBorder: "rgba(83,74,183,0.14)", statLabel: "#534AB7", statVal: "#26215C", mean: "#534AB7" },
  { border: "rgba(13,155,122,0.25)", bg: "rgba(13,155,122,0.05)", num: { bg: "rgba(13,155,122,0.12)", text: "#085041" }, title: "#04342C", dtype: { bg: "rgba(13,155,122,0.10)", border: "rgba(13,155,122,0.22)", text: "#085041" }, bar: "#0D9B7A", barTrack: "rgba(13,155,122,0.12)", stat: "rgba(13,155,122,0.08)", statBorder: "rgba(13,155,122,0.14)", statLabel: "#0F6E56", statVal: "#04342C", mean: "#0F6E56" },
  { border: "rgba(24,95,165,0.25)",  bg: "rgba(24,95,165,0.05)",  num: { bg: "rgba(24,95,165,0.12)",  text: "#0C447C" }, title: "#042C53", dtype: { bg: "rgba(24,95,165,0.10)", border: "rgba(24,95,165,0.22)", text: "#0C447C" }, bar: "#185FA5", barTrack: "rgba(24,95,165,0.12)", stat: "rgba(24,95,165,0.08)", statBorder: "rgba(24,95,165,0.14)", statLabel: "#185FA5", statVal: "#042C53", mean: "#185FA5" },
];

function BandCard({ band, index }: { band: BandInfo; index: number }) {
  const c = BAND_COLORS[index % BAND_COLORS.length];
  const hasStats = band.min !== null && band.max !== null && band.mean !== null;
  const range = hasStats ? (band.max! - band.min! || 1) : 1;
  const meanPct = hasStats ? Math.min(Math.max(((band.mean! - band.min!) / range) * 100, 1), 99) : 50;
  const fmtStat = (v: number | null, dec: number) => v !== null ? v.toFixed(dec) : "N/A";

  return (
    <div
      className="p-3 space-y-2.5"
      style={{
        borderRadius: "var(--radius-lg)",
        border: `1px solid ${c.border}`,
        background: c.bg,
        boxShadow: "var(--shadow-sm)",
        transition: "box-shadow 0.15s",
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="w-5 h-5 rounded-md flex items-center justify-center"
            style={{ background: c.num.bg }}
          >
            <span className="text-[9px] font-bold" style={{ color: c.num.text, fontFamily: "var(--font-mono)" }}>
              {band.band_number}
            </span>
          </div>
          <span className="text-xs font-semibold" style={{ color: c.title }}>
            Band {band.band_number}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span
            className="px-1.5 py-0.5 rounded-full text-[9px] font-semibold"
            style={{ background: c.dtype.bg, border: `1px solid ${c.dtype.border}`, color: c.dtype.text, fontFamily: "var(--font-mono)" }}
          >
            {band.dtype}
          </span>
          <span
            className="px-1.5 py-0.5 rounded-full text-[9px]"
            style={{ background: "var(--surface-raised)", color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}
          >
            {band.color_interpretation}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1">
        {(
          [["Min", band.min], ["Max", band.max], ["Std", band.std]] as [string, number | null][]
        ).map(([l, v]) => (
          <div
            key={l}
            className="text-center py-2"
            style={{ background: c.stat, borderRadius: "var(--radius-md)", border: `1px solid ${c.statBorder}` }}
          >
            <p className="text-[8px] uppercase" style={{ letterSpacing: "0.08em", color: c.statLabel, fontFamily: "var(--font-mono)" }}>
              {l}
            </p>
            <p className="text-[11px] font-bold mt-0.5" style={{ color: c.statVal, fontFamily: "var(--font-mono)" }}>
              {fmtStat(v, 4)}
            </p>
          </div>
        ))}
      </div>

      <div>
        <div className="flex justify-between text-[9px] mb-1">
          <span style={{ color: c.mean }}>Mean</span>
          <span style={{ color: c.mean, fontFamily: "var(--font-mono)" }}>{fmtStat(band.mean, 4)}</span>
        </div>
        <div className="relative h-[5px] rounded-full overflow-hidden" style={{ background: c.barTrack }}>
          {hasStats && (
            <div
              className="absolute top-0 h-full w-[3px] rounded-full transition-all duration-500"
              style={{ left: `${meanPct}%`, background: c.bar }}
            />
          )}
        </div>
        <div className="flex justify-between mt-0.5">
          <span className="text-[8px]" style={{ color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>
            {fmtStat(band.min, 2)}
          </span>
          <span className="text-[8px]" style={{ color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>
            {fmtStat(band.max, 2)}
          </span>
        </div>
      </div>
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
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-12 rounded-xl" style={{ background: "var(--surface-sunken)" }} />
        ))}
      </div>
      <div className="h-3 w-24 rounded mt-4" style={{ background: "var(--border-subtle)" }} />
      <div className="h-20 rounded-xl" style={{ background: "var(--surface-sunken)" }} />
    </div>
  );
}

/* ── Band expand / collapse ───────────────────────────────────────────────── */

function BandSection({ bands }: { bands: BandInfo[] }) {
  const [expanded, setExpanded] = useState(bands.length <= 3);
  const visible = expanded ? bands : bands.slice(0, 2);

  return (
    <div className="space-y-2.5">
      {visible.map((b, i) => <BandCard key={b.band_number} band={b} index={i} />)}
      {bands.length > 2 && (
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
              Show {bands.length - 2} more band{bands.length - 2 !== 1 ? "s" : ""}
            </>
          )}
        </button>
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

/* ── Main component ───────────────────────────────────────────────────────── */

const RasterDetails: React.FC = () => {
  const { layer, details: d, detailsLoading } = useRaster();

  if (!layer) {
    return (
      <div className="flex flex-col items-center justify-center py-14 text-center px-4">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
          style={{ background: "var(--surface-sunken)", border: "1px solid var(--border-subtle)" }}
        >
          <svg className="w-6 h-6" style={{ color: "var(--text-muted)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <p className="text-xs font-semibold" style={{ color: "var(--text-tertiary)" }}>No layer selected</p>
        <p className="text-[10px] mt-1 leading-relaxed" style={{ color: "var(--text-muted)" }}>
          Upload a raster file to view its metadata.
        </p>
      </div>
    );
  }

  if (detailsLoading) return <Skeleton />;
  if (!d) return null;

  const fmt = (n: number, dec = 2) => n.toLocaleString("en-IN", { maximumFractionDigits: dec });
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
    { t: `${d.band_count} band${d.band_count > 1 ? "s" : ""}`, style: { color: "var(--text-tertiary)", background: "var(--surface-sunken)", borderColor: "var(--border-subtle)" } },
    ...(d.is_tiled ? [{ t: "tiled", style: { color: "#085041", background: "#E1F5EE", borderColor: "#5DCAA5" } }] : []),
    ...(d.is_cog_like ? [{ t: "COG",  style: { color: "#085041", background: "#E1F5EE", borderColor: "#5DCAA5" } }] : []),
    { t: d.storage_type,   style: { color: "var(--text-tertiary)", background: "var(--surface-sunken)", borderColor: "var(--border-subtle)" } },
  ];

  return (
    /* Subtle multi-stop gradient panel background */
    <div
      className="pb-8 space-y-0.5 rounded-xl px-0.5"
      style={{
        background: "linear-gradient(160deg, rgba(13,155,122,0.04) 0%, rgba(24,95,165,0.03) 50%, rgba(83,74,183,0.04) 100%)",
      }}
    >
      {/* ── File header card ─────────────────────────────────────────────── */}
      <div
        className="p-3 mt-1"
        style={{
          borderRadius: "var(--radius-lg)",
          background: "var(--surface-card)",
          border: "1px solid var(--accent-border)",
          boxShadow: "0 1px 8px rgba(13,155,122,0.07), var(--shadow-sm)",
        }}
      >
        <div className="flex items-start gap-2.5">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
            style={{ background: "var(--accent-bg)", border: "1px solid var(--accent-border)" }}
          >
            <svg className="w-4 h-4" style={{ color: "var(--accent)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate leading-tight" style={{ color: "var(--text-primary)" }}>
              {layer.file_name}
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

      {/* ── Dimensions & Projection ──────────────────────────────────────── */}
      <SectionHeading
        title="Dimensions & Projection"
        icon={<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/></svg>}
      />
      <div className="grid grid-cols-2 gap-1.5">
        <Cell label="Width"       value={`${fmt(d.width, 0)} px`}               color="blue" />
        <Cell label="Height"      value={`${fmt(d.height, 0)} px`}              color="blue" />
        <Cell label="CRS"         value={d.crs} sub={d.crs_unit}                color="teal" span2 />
        <Cell label="Compression" value={d.compression ?? "None"}               color="gray" />
        <Cell label="Res X"       value={`${d.resolution.x.value} ${d.resolution.x.unit}`} color="amber" />
        <Cell label="Res Y"       value={`${d.resolution.y.value} ${d.resolution.y.unit}`} color="amber" />
      </div>

      {/* ── WGS84 Bounds ─────────────────────────────────────────────────── */}
      <SectionHeading
        title="WGS84 Bounds"
        icon={<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064"/></svg>}
      />
      <BoundsGrid bounds={d.bounds_wgs84} color="blue" />

      {/* ── Native Bounds ────────────────────────────────────────────────── */}
      <SectionHeading
        title="Native Bounds"
        icon={<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/></svg>}
      />
      <BoundsGrid bounds={d.bounds} color="amber" />

      {/* ── Data Info ────────────────────────────────────────────────────── */}
      <SectionHeading
        title="Data Info"
        icon={<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18"/></svg>}
      />
      <div className="grid grid-cols-2 gap-1.5">
        <Cell label="Dtype"  value={d.dtypes.join(", ")}                                          color="purple" />
        <Cell label="NoData" value={d.nodata !== null ? Number(d.nodata).toExponential(2) : "None"}       color="coral" />
        <Cell label="Block"  value={d.block_shapes[0]?.join("×") ?? "N/A"} sub="pixels"          color="gray" />
      </div>

      {/* ── Tags ─────────────────────────────────────────────────────────── */}
      {Object.keys(d.tags).length > 0 && (
        <>
          <SectionHeading
            title="Tags"
            icon={<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z"/></svg>}
          />
          {Object.entries(d.tags).map(([k, v]) => (
            <InfoRow key={k} label={k} value={v} />
          ))}
        </>
      )}

      {/* ── Band Statistics ──────────────────────────────────────────────── */}
      <SectionHeading
        title={`Band Statistics (${d.bands.length})`}
        icon={<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"/></svg>}
      />
      <BandSection bands={d.bands} />
    </div>
  );
};

export default RasterDetails;