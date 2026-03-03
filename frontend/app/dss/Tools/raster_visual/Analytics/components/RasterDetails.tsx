import React, { useState } from "react";
import { useRaster, type BandInfo } from "@/contexts/raster_operations/RasterContext"

// ─────────────────────────────────────────────────────────────────────────────
// RasterDetails.tsx
// src/components/analytics/RasterDetails.tsx
//
// Shows full metadata of the currently active raster layer.
// Reads from RasterContext — no props needed.
// ─────────────────────────────────────────────────────────────────────────────

// ── Small reusable sub-components ────────────────────────────────────────────

function SectionHeading({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 pt-4 pb-2">
      <div className="w-3.5 h-3.5 text-blue-400/60 flex-shrink-0">{icon}</div>
      <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500">
        {title}
      </span>
      <div className="flex-1 h-px bg-slate-700/35" />
    </div>
  );
}

function Cell({
  label,
  value,
  sub,
  accent = false,
  mono = true,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  mono?: boolean;
}) {
  return (
    <div className={[
      "rounded-xl p-2.5 border",
      accent
        ? "bg-emerald-500/5 border-emerald-500/18"
        : "bg-slate-800/45 border-slate-700/30",
    ].join(" ")}>
      <p className="text-[8px] font-semibold uppercase tracking-[0.1em] text-slate-500 mb-0.5">
        {label}
      </p>
      <p className={[
        "text-[11px] font-bold truncate",
        mono ? "font-mono" : "",
        accent ? "text-emerald-300" : "text-slate-100",
      ].join(" ")}>
        {value}
      </p>
      {sub && <p className="text-[9px] text-slate-600 mt-0.5">{sub}</p>}
    </div>
  );
}

function BoundsGrid({ bounds }: {
  bounds: { west: number; south: number; east: number; north: number; unit?: string };
}) {
  const fmt = (n: number) => n.toFixed(5);
  const items = [
    ["West",  fmt(bounds.west)],
    ["East",  fmt(bounds.east)],
    ["South", fmt(bounds.south)],
    ["North", fmt(bounds.north)],
  ];
  return (
    <div className="bg-slate-800/35 rounded-xl border border-slate-700/30 overflow-hidden">
      <div className="grid grid-cols-2 divide-x divide-y divide-slate-700/30">
        {items.map(([l, v]) => (
          <div key={l} className="px-3 py-2">
            <p className="text-[8px] uppercase tracking-wider text-slate-500">{l}</p>
            <p className="text-[11px] font-mono font-bold text-slate-200 mt-0.5">{v}</p>
          </div>
        ))}
      </div>
      {bounds.unit && (
        <div className="border-t border-slate-700/30 px-3 py-1 bg-slate-800/15">
          <p className="text-[9px] text-slate-600">Unit: {bounds.unit}</p>
        </div>
      )}
    </div>
  );
}

function BandCard({ band }: { band: BandInfo }) {
  const range = (band.max - band.min) || 1;
  const meanPct = Math.min(Math.max(((band.mean - band.min) / range) * 100, 1), 99);

  return (
    <div className="bg-slate-800/45 border border-slate-700/30 rounded-xl p-3 space-y-2">
      {/* Band header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-blue-500/12 border border-blue-500/20 flex items-center justify-center">
            <span className="text-[9px] font-bold text-blue-300">{band.band_number}</span>
          </div>
          <span className="text-xs font-semibold text-slate-200">Band {band.band_number}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="px-1.5 py-0.5 rounded-full bg-violet-500/8 border border-violet-500/18 text-[9px] font-mono text-violet-300">
            {band.dtype}
          </span>
          <span className="px-1.5 py-0.5 rounded-full bg-slate-700/45 text-[9px] text-slate-400">
            {band.color_interpretation}
          </span>
        </div>
      </div>

      {/* Min / Max / Std */}
      <div className="grid grid-cols-3 gap-1">
        {([["Min", band.min], ["Max", band.max], ["Std", band.std]] as [string, number][]).map(([l, v]) => (
          <div key={l} className="text-center bg-slate-900/35 rounded-lg py-1.5">
            <p className="text-[8px] uppercase tracking-wider text-slate-500">{l}</p>
            <p className="text-[11px] font-mono font-bold text-slate-200 mt-0.5">{v.toFixed(4)}</p>
          </div>
        ))}
      </div>

      {/* Mean bar */}
      <div>
        <div className="flex justify-between text-[9px] mb-1">
          <span className="text-slate-500">Mean</span>
          <span className="font-mono text-slate-300">{band.mean.toFixed(4)}</span>
        </div>
        <div className="relative h-1.5 bg-slate-900 rounded-full overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-900/20 to-slate-900" />
          <div
            className="absolute top-0 h-full w-0.5 bg-emerald-400 shadow-[0_0_4px_#34d399] transition-all duration-500"
            style={{ left: `${meanPct}%` }}
          />
        </div>
        <div className="flex justify-between text-[8px] font-mono text-slate-600 mt-0.5">
          <span>{band.min.toFixed(2)}</span>
          <span>{band.max.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}

// ── Skeleton loader ───────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-3 animate-pulse pt-1">
      {/* File badge skeleton */}
      <div className="h-[72px] bg-slate-700/25 rounded-xl" />
      {/* Section header */}
      <div className="h-3 w-32 bg-slate-700/40 rounded mt-4" />
      {/* Grid cells */}
      <div className="grid grid-cols-2 gap-1.5">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-10 bg-slate-700/30 rounded-xl" />
        ))}
      </div>
      {/* Another section */}
      <div className="h-3 w-24 bg-slate-700/40 rounded mt-4" />
      <div className="h-20 bg-slate-700/25 rounded-xl" />
    </div>
  );
}

// ── Expand/collapse band list ─────────────────────────────────────────────────

function BandSection({ bands }: { bands: BandInfo[] }) {
  const [expanded, setExpanded] = useState(bands.length <= 3);

  const visible = expanded ? bands : bands.slice(0, 2);

  return (
    <div className="space-y-2.5">
      {visible.map((b) => <BandCard key={b.band_number} band={b} />)}

      {bands.length > 2 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full py-2 rounded-xl border border-slate-700/35 bg-slate-800/25 hover:bg-slate-800/45 text-[10px] font-semibold text-slate-400 hover:text-slate-200 transition-all flex items-center justify-center gap-1.5"
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

// ── Main component ────────────────────────────────────────────────────────────

const RasterDetails: React.FC = () => {
  const { state } = useRaster();
  const { activeLayer, details: d, detailsLoading } = state;

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (!activeLayer) {
    return (
      <div className="flex flex-col items-center justify-center py-14 text-center px-4">
        <div className="w-12 h-12 rounded-2xl bg-slate-700/20 border border-slate-600/20 flex items-center justify-center mb-3">
          <svg className="w-6 h-6 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <p className="text-xs font-semibold text-slate-400">No layer selected</p>
        <p className="text-[10px] text-slate-600 mt-1 leading-relaxed">
          Upload a raster file or select one from the layers list to view its metadata.
        </p>
      </div>
    );
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (detailsLoading) return <Skeleton />;

  // ── No details yet (shouldn't happen after loading, but safe) ───────────────
  if (!d) return null;

  const fmt = (n: number, dec = 2) =>
    n.toLocaleString("en-IN", { maximumFractionDigits: dec });

  const badges = [
    { t: d.driver,                        c: "text-blue-300 bg-blue-500/10 border-blue-500/18" },
    { t: `${d.file_size.value} ${d.file_size.unit}`, c: "text-slate-300 bg-slate-700/45 border-slate-600/30" },
    { t: `${d.band_count} band${d.band_count > 1 ? "s" : ""}`, c: "text-slate-300 bg-slate-700/45 border-slate-600/30" },
    ...(d.is_tiled    ? [{ t: "tiled", c: "text-emerald-300 bg-emerald-500/8 border-emerald-500/18" }] : []),
    ...(d.is_cog_like ? [{ t: "COG",   c: "text-amber-300 bg-amber-500/8 border-amber-500/18"    }] : []),
  ];

  return (
    <div className="pb-8 space-y-0.5">

      {/* ── File header card ───────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-blue-900/15 to-slate-800/10 border border-blue-700/18 rounded-xl p-3 mt-1">
        <div className="flex items-start gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/18 flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white truncate leading-tight">
              {activeLayer.file_name}
            </p>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">
              {activeLayer.layer_name}
            </p>
            <div className="flex flex-wrap gap-1 mt-1.5">
              {badges.map((b, i) => (
                <span key={i}
                  className={`px-1.5 py-0.5 rounded-full border text-[9px] font-mono font-semibold ${b.c}`}>
                  {b.t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Dimensions & Projection ───────────────────────────────────────── */}
      <SectionHeading
        title="Dimensions & Projection"
        icon={
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        }
      />
      <div className="grid grid-cols-2 gap-1.5">
        <Cell label="Width"       value={`${fmt(d.width, 0)} px`} />
        <Cell label="Height"      value={`${fmt(d.height, 0)} px`} />
        <Cell label="CRS"         value={d.crs}              sub={d.crs_unit} accent />
        <Cell label="Compression" value={d.compression ?? "None"} />
        <Cell label="Res X"       value={`${d.resolution.x.value} ${d.resolution.x.unit}`} />
        <Cell label="Res Y"       value={`${d.resolution.y.value} ${d.resolution.y.unit}`} />
      </div>

      {/* ── WGS84 Bounds ──────────────────────────────────────────────────── */}
      <SectionHeading
        title="WGS84 Bounds"
        icon={
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064" />
          </svg>
        }
      />
      <BoundsGrid bounds={d.bounds_wgs84} />

      {/* ── Native Bounds ─────────────────────────────────────────────────── */}
      <SectionHeading
        title="Native Bounds"
        icon={
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
        }
      />
      <BoundsGrid bounds={d.bounds} />

      {/* ── Data Info ─────────────────────────────────────────────────────── */}
      <SectionHeading
        title="Data Info"
        icon={
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18" />
          </svg>
        }
      />
      <div className="grid grid-cols-2 gap-1.5">
        <Cell label="Dtype"  value={d.dtypes.join(", ")} />
        <Cell label="NoData" value={d.nodata !== null ? d.nodata.toExponential(2) : "None"} />
        <Cell label="Block"  value={d.block_shapes[0]?.join("×") ?? "N/A"} sub="pixels" />
      </div>

      {/* ── Tags ──────────────────────────────────────────────────────────── */}
      {Object.keys(d.tags).length > 0 && (
        <>
          <SectionHeading
            title="Tags"
            icon={
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
              </svg>
            }
          />
          <div className="space-y-1">
            {Object.entries(d.tags).map(([k, v]) => (
              <div key={k}
                className="flex items-center justify-between px-2.5 py-1.5 bg-slate-800/30 rounded-lg border border-slate-700/25">
                <span className="text-[10px] font-mono text-slate-400 truncate max-w-[45%]">{k}</span>
                <span className="text-[10px] font-mono text-slate-200 truncate max-w-[50%] text-right">{v}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Band Statistics ───────────────────────────────────────────────── */}
      <SectionHeading
        title={`Band Statistics (${d.bands.length})`}
        icon={
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
          </svg>
        }
      />
      <BandSection bands={d.bands} />

    </div>
  );
};

export default RasterDetails;

