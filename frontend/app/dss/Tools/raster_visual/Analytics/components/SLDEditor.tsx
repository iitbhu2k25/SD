'use client'
import React, { useState, useEffect } from 'react';
import { ColorStop } from '@/interface/raster_operations';
import { useRaster } from '@/contexts/raster_operations/RasterContext';
import { SLDGenerator, CLASSIFICATION_METHODS } from '@/interface/sldGenerator';
import { toast } from 'react-toastify';

// ─────────────────────────────────────────────────────────────────────────────
// SLDEditor — TerraOps Light Theme
// ─────────────────────────────────────────────────────────────────────────────

interface ColorSchemeOption {
  id: string;
  name: string;
  preview: string[];
  scheme: string;
}

const COLOR_SCHEMES: ColorSchemeOption[] = [
  { id: 'sequential-blue',        name: 'Blues',    scheme: 'sequential',              preview: ['#f7fbff', '#6baed6', '#08306b'] },
  { id: 'sequential-red',         name: 'Reds',     scheme: 'sequential_red',           preview: ['#fff5f0', '#fb6a4a', '#67000d'] },
  { id: 'sequential-green',       name: 'Greens',   scheme: 'sequential_green',          preview: ['#f7fcf5', '#74c476', '#00441b'] },
  { id: 'diverging-red-blue',     name: 'RdBu',     scheme: 'diverging',                 preview: ['#d73027', '#ffffbf', '#4575b4'] },
  { id: 'diverging-purple-green', name: 'PuGn',     scheme: 'diverging_purple_green',    preview: ['#8e0152', '#fde0ef', '#4d9221'] },
  { id: 'rainbow',                name: 'Spectral', scheme: 'rainbow',                   preview: ['#9e0142', '#fee08b', '#5e4fa2'] },
  { id: 'terrain',                name: 'Terrain',  scheme: 'terrain',                   preview: ['#333399', '#FFFF99', '#993333'] },
  { id: 'viridis',                name: 'Viridis',  scheme: 'viridis',                   preview: ['#440154', '#31688e', '#fde724'] },
  { id: 'plasma',                 name: 'Plasma',   scheme: 'plasma',                    preview: ['#0d0887', '#d8576b', '#f0f921'] },
];

type RenderMode = 'singleband_pseudocolor' | 'singleband_gray';

interface SLDEditorProps {
  onApply: (sldXml: string | null) => void;
  onClose: () => void;
}

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span
    className="text-[9px] font-bold uppercase block mb-2"
    style={{ color: 'var(--text-muted)', letterSpacing: '1.5px', fontFamily: 'var(--font-mono)' }}
  >
    {children}
  </span>
);

export const SLDEditor: React.FC<SLDEditorProps> = ({ onApply, onClose }) => {
  // Pull both layer (identity) and details (band stats) from context
  const { layer, details, setSldConfig } = useRaster();

  // Derive raster stats from details.bands[0] (band stats live there after normalisation)
  const band0       = details?.bands?.[0];
  const rasterMin   = band0?.min   ?? 0;
  const rasterMax   = band0?.max   ?? 100;
  // GeoServer layer name comes from details.layer_name (the UUID workspace name)
  const geoName     = details?.layer_name ?? layer?.layer_name ?? '';

  // Core state
  const [renderMode, setRenderMode]               = useState<RenderMode>('singleband_pseudocolor');
  const [colorStops, setColorStops]               = useState<ColorStop[]>([]);
  const [numClasses, setNumClasses]               = useState<number>(5);
  const [selectedScheme, setSelectedScheme]       = useState<ColorSchemeOption>(COLOR_SCHEMES[0]);
  const [interpolation, setInterpolation]         = useState<'linear' | 'discrete'>('linear');
  const [classificationMethod, setClassificationMethod] = useState<string>('equal_interval');

  // Value range
  const [minValue, setMinValue]   = useState<number>(rasterMin);
  const [maxValue, setMaxValue]   = useState<number>(rasterMax);
  const [autoMinMax, setAutoMinMax] = useState<boolean>(true);

  // Advanced
  const [invertColors, setInvertColors]   = useState<boolean>(false);
  const [opacity, setOpacity]             = useState<number>(1);
  const [showAdvanced, setShowAdvanced]   = useState<boolean>(false);

  // ── Sync min/max when details arrive or change ─────────────────────────
  useEffect(() => {
    if (band0) {
      setMinValue(band0.min);
      setMaxValue(band0.max);
    }
  }, [band0?.min, band0?.max]);

  // ── Generate colour stops ──────────────────────────────────────────────
  const regenerateStops = () => {
    const min = autoMinMax ? rasterMin : minValue;
    const max = autoMinMax ? rasterMax : maxValue;
    let stops = SLDGenerator.generateColorStops(min, max, numClasses, selectedScheme.scheme, undefined);
    if (invertColors) stops = SLDGenerator.invertColors(stops);
    setColorStops(stops);
  };

  // Re-generate whenever any relevant input changes
  useEffect(() => {
    regenerateStops();
  }, [
    numClasses,
    selectedScheme,
    autoMinMax,
    minValue,
    maxValue,
    interpolation,
    classificationMethod,
    invertColors,
    rasterMin,
    rasterMax,
  ]);

  // ── Stop mutations ─────────────────────────────────────────────────────
  const updateColorStop = (id: string, updates: Partial<ColorStop>) =>
    setColorStops(prev => prev.map(s => (s.id === id ? { ...s, ...updates } : s)));

  const addColorStop = () => {
    if (colorStops.length >= 20) { toast.warning('Maximum 20 color stops'); return; }
    const sorted = [...colorStops].sort((a, b) => a.value - b.value);
    const last = sorted[sorted.length - 1];
    const prev = sorted[sorted.length - 2];
    const val  = last.value + (last.value - prev.value);
    setColorStops(p => [...p, {
      id: `stop-${Date.now()}`,
      value: parseFloat(val.toFixed(6)),
      color: last.color,
      label: val.toFixed(2),
    }]);
  };

  const removeColorStop = (id: string) => {
    if (colorStops.length <= 2) { toast.warning('Minimum 2 stops required'); return; }
    setColorStops(p => p.filter(s => s.id !== id));
  };

  // ── Apply ──────────────────────────────────────────────────────────────
  const handleApply = () => {
    if (!layer) { toast.error('No active layer'); return; }
    const validation = SLDGenerator.validateColorStops(colorStops);
    if (!validation.valid) { toast.error(validation.errors[0]); return; }

    let sldXml: string | null = null;
    if (renderMode === 'singleband_pseudocolor') {
      sldXml = SLDGenerator.generateSLD({ layerName: geoName, colorStops, interpolation, opacity });
      setSldConfig({ layerName: geoName, colorStops, interpolation, opacity });
    }
    onApply(sldXml);
  };

  // ── Export SLD ─────────────────────────────────────────────────────────
  const handleExportSLD = () => {
    if (!layer) return;
    const validation = SLDGenerator.validateColorStops(colorStops);
    if (!validation.valid) { toast.error(validation.errors[0]); return; }

    const sldXml = SLDGenerator.generateSLD({ layerName: geoName, colorStops, interpolation, opacity });
    const blob = new Blob([sldXml], { type: 'application/xml' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${geoName}_style.sld`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('SLD exported');
  };

  // ── Empty state ────────────────────────────────────────────────────────
  if (!layer) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <div
          className="w-14 h-14 rounded-xl flex items-center justify-center mb-3"
          style={{ background: 'var(--surface-sunken)', border: '1px solid var(--border-muted)' }}
        >
          <svg className="w-6 h-6" style={{ color: 'var(--text-faint)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
          </svg>
        </div>
        <p className="text-[12px] font-semibold" style={{ color: 'var(--text-tertiary)' }}>No Layer Selected</p>
        <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          Upload a raster to configure symbology
        </p>
      </div>
    );
  }

  // Show a gentle loading state while details are still fetching
  if (!details) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 animate-pulse">
        <div className="w-14 h-14 rounded-xl mb-3" style={{ background: 'var(--surface-sunken)' }} />
        <div className="h-3 w-28 rounded" style={{ background: 'var(--border-subtle)' }} />
        <div className="h-2.5 w-20 rounded mt-2" style={{ background: 'var(--border-muted)' }} />
      </div>
    );
  }

  const sortedStops = [...colorStops].sort((a, b) => a.value - b.value);

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">

      {/* ── Scrollable body ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0 space-y-4 pb-2">

        {/* ── Raster stats banner ─────────────────────────────────────── */}
        <div
          className="grid grid-cols-3 gap-1"
          style={{
            background: 'var(--surface-card)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-subtle)',
            padding: '10px 12px',
          }}
        >
          {[
            { label: 'Min',  value: band0?.min.toFixed(4)  ?? '—' },
            { label: 'Mean', value: band0?.mean.toFixed(4) ?? '—' },
            { label: 'Max',  value: band0?.max.toFixed(4)  ?? '—' },
          ].map(({ label, value }) => (
            <div key={label} className="text-center">
              <p className="text-[8px] uppercase font-semibold" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}>
                {label}
              </p>
              <p className="text-[11px] font-bold mt-0.5" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                {value}
              </p>
            </div>
          ))}
        </div>

        {/* ── Render Type ─────────────────────────────────────────────── */}
        <div>
          <SectionLabel>Render Type</SectionLabel>
          <div className="grid grid-cols-2 gap-2">
            {([
              { key: 'singleband_pseudocolor' as RenderMode, label: 'Pseudocolor', desc: 'Color ramp' },
              { key: 'singleband_gray'         as RenderMode, label: 'Grayscale',   desc: 'Single band' },
            ]).map(({ key, label, desc }) => (
              <button
                key={key}
                onClick={() => setRenderMode(key)}
                className="p-2.5 text-left transition-all"
                style={{
                  borderRadius: 'var(--radius-md)',
                  border: `1.5px solid ${renderMode === key ? 'var(--accent)' : 'var(--border-subtle)'}`,
                  background: renderMode === key ? 'var(--accent-bg)' : 'var(--surface-card)',
                  boxShadow: renderMode === key ? '0 0 0 3px var(--accent-border)' : 'var(--shadow-sm)',
                }}
              >
                <p className="text-[11px] font-semibold" style={{ color: renderMode === key ? 'var(--accent)' : 'var(--text-primary)' }}>
                  {label}
                </p>
                <p className="text-[9px] mt-0.5" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{desc}</p>
              </button>
            ))}
          </div>
        </div>

        {renderMode === 'singleband_pseudocolor' && (
          <>
            {/* ── Mode ──────────────────────────────────────────────── */}
            <div>
              <SectionLabel>Mode</SectionLabel>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { key: 'linear'   as const, label: 'Continuous', desc: 'Smooth ramp' },
                  { key: 'discrete' as const, label: 'Classified',  desc: 'Intervals' },
                ]).map(({ key, label, desc }) => (
                  <button
                    key={key}
                    onClick={() => setInterpolation(key)}
                    className="p-2.5 text-left transition-all"
                    style={{
                      borderRadius: 'var(--radius-md)',
                      border: `1.5px solid ${interpolation === key ? 'var(--blue)' : 'var(--border-subtle)'}`,
                      background: interpolation === key ? 'var(--blue-bg)' : 'var(--surface-card)',
                      boxShadow: interpolation === key ? '0 0 0 3px var(--blue-border)' : 'var(--shadow-sm)',
                    }}
                  >
                    <p className="text-[11px] font-semibold" style={{ color: interpolation === key ? 'var(--blue)' : 'var(--text-primary)' }}>
                      {label}
                    </p>
                    <p className="text-[9px] mt-0.5" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* ── Classification method ──────────────────────────────── */}
            {interpolation === 'discrete' && (
              <div>
                <SectionLabel>Classification</SectionLabel>
                <select
                  value={classificationMethod}
                  onChange={(e) => setClassificationMethod(e.target.value)}
                  className="w-full"
                  style={{
                    padding: '8px 12px',
                    background: 'var(--surface-input)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)',
                    fontSize: 11,
                    fontFamily: 'var(--font-mono)',
                    outline: 'none',
                  }}
                >
                  {CLASSIFICATION_METHODS.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* ── Classes slider ─────────────────────────────────────── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <SectionLabel>Classes</SectionLabel>
                <span
                  className="text-[11px] font-bold px-2 py-0.5"
                  style={{ background: 'var(--accent-bg)', color: 'var(--accent)', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-mono)' }}
                >
                  {numClasses}
                </span>
              </div>
              <input
                type="range" min="2" max="20" value={numClasses}
                onChange={(e) => setNumClasses(parseInt(e.target.value))}
                className="w-full terra-slider"
                style={{
                  background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${((numClasses - 2) / 18) * 100}%, var(--border-subtle) ${((numClasses - 2) / 18) * 100}%, var(--border-subtle) 100%)`,
                }}
              />
            </div>

            {/* ── Value range ────────────────────────────────────────── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <SectionLabel>Value Range</SectionLabel>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <div
                    className="terra-toggle"
                    data-active={autoMinMax.toString()}
                    onClick={() => setAutoMinMax(!autoMinMax)}
                    style={{ width: 32, height: 18 }}
                  />
                  <span className="text-[9px] font-medium" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    Auto
                  </span>
                </label>
              </div>

              {/* Always show the effective range as read-only hint when auto is on */}
              {autoMinMax ? (
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Min', value: rasterMin },
                    { label: 'Max', value: rasterMax },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <span className="text-[8px] font-medium uppercase block mb-1"
                        style={{ color: 'var(--text-faint)', fontFamily: 'var(--font-mono)', letterSpacing: '1px' }}>
                        {label}
                      </span>
                      <div
                        className="text-[11px] font-bold px-2.5 py-1.5"
                        style={{
                          background: 'var(--surface-sunken)',
                          border: '1px solid var(--border-muted)',
                          borderRadius: 'var(--radius-sm)',
                          color: 'var(--accent)',
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        {value.toFixed(4)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Min', value: minValue, set: setMinValue },
                    { label: 'Max', value: maxValue, set: setMaxValue },
                  ].map(({ label, value, set }) => (
                    <div key={label}>
                      <span className="text-[8px] font-medium uppercase block mb-1"
                        style={{ color: 'var(--text-faint)', fontFamily: 'var(--font-mono)', letterSpacing: '1px' }}>
                        {label}
                      </span>
                      <input
                        type="number" value={value} step="0.0001"
                        onChange={(e) => set(parseFloat(e.target.value))}
                        style={{
                          width: '100%', padding: '7px 10px',
                          background: 'var(--surface-input)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-sm)',
                          color: 'var(--text-primary)',
                          fontSize: 11, fontFamily: 'var(--font-mono)', outline: 'none',
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Color ramp picker ──────────────────────────────────── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <SectionLabel>Color Ramp</SectionLabel>
                <button
                  onClick={() => setInvertColors(!invertColors)}
                  className="flex items-center gap-1 px-2 py-1 transition-all"
                  style={{
                    borderRadius: 'var(--radius-sm)',
                    border: `1px solid ${invertColors ? 'var(--amber)' : 'var(--border-subtle)'}`,
                    background: invertColors ? 'var(--amber-bg)' : 'var(--surface-card)',
                    color: invertColors ? 'var(--amber)' : 'var(--text-muted)',
                    fontSize: 9, fontWeight: 600, fontFamily: 'var(--font-mono)',
                  }}
                >
                  <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                  Invert
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {COLOR_SCHEMES.map((scheme) => (
                  <button
                    key={scheme.id}
                    onClick={() => setSelectedScheme(scheme)}
                    className="p-2 transition-all"
                    style={{
                      borderRadius: 'var(--radius-sm)',
                      border: `1.5px solid ${selectedScheme.id === scheme.id ? 'var(--accent)' : 'var(--border-subtle)'}`,
                      background: selectedScheme.id === scheme.id ? 'var(--accent-bg)' : 'var(--surface-card)',
                      boxShadow: selectedScheme.id === scheme.id ? '0 0 0 2px var(--accent-border)' : 'none',
                    }}
                  >
                    <p className="text-[9px] font-semibold mb-1.5"
                      style={{ color: selectedScheme.id === scheme.id ? 'var(--accent)' : 'var(--text-secondary)' }}>
                      {scheme.name}
                    </p>
                    <div className="flex h-3 overflow-hidden" style={{ borderRadius: 3 }}>
                      {scheme.preview.map((c, i) => (
                        <div key={i} className="flex-1" style={{ background: c }} />
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* ── Ramp preview ───────────────────────────────────────── */}
            <div>
              <SectionLabel>Preview</SectionLabel>
              <div
                className="p-3"
                style={{
                  background: 'var(--surface-card)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border-subtle)',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <div className="flex h-10 overflow-hidden" style={{ borderRadius: 'var(--radius-md)' }}>
                  {sortedStops.map((stop) => (
                    <div
                      key={stop.id}
                      className="flex-1 transition-all hover:opacity-80"
                      style={{ background: stop.color }}
                      title={`${stop.value.toFixed(4)} — ${stop.color}`}
                    />
                  ))}
                </div>
                <div className="flex justify-between mt-2">
                  <span className="text-[9px] font-bold" style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
                    {sortedStops[0]?.value.toFixed(4)}
                  </span>
                  <span className="text-[9px]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {interpolation === 'linear' ? 'Continuous' : 'Classified'} · {numClasses} classes
                  </span>
                  <span className="text-[9px] font-bold" style={{ color: 'var(--purple)', fontFamily: 'var(--font-mono)' }}>
                    {sortedStops[sortedStops.length - 1]?.value.toFixed(4)}
                  </span>
                </div>
              </div>
            </div>

            {/* ── Advanced toggle ────────────────────────────────────── */}
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between px-3 py-2.5 transition-all"
              style={{
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                background: showAdvanced ? 'var(--purple-bg)' : 'var(--surface-card)',
                color: showAdvanced ? 'var(--purple)' : 'var(--text-muted)',
              }}
            >
              <span className="flex items-center gap-1.5 text-[10px] font-semibold" style={{ fontFamily: 'var(--font-mono)' }}>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                Advanced Options
              </span>
              <svg
                className="w-3 h-3 transition-transform"
                style={{ transform: showAdvanced ? 'rotate(180deg)' : '' }}
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* ── Advanced section ───────────────────────────────────── */}
            {showAdvanced && (
              <div
                className="space-y-3 p-3 terra-fade-in"
                style={{
                  background: 'var(--surface-sunken)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-muted)',
                }}
              >
                {/* Opacity */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[9px] font-bold uppercase"
                      style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '1px' }}>
                      Opacity
                    </span>
                    <span className="text-[10px] font-bold" style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
                      {Math.round(opacity * 100)}%
                    </span>
                  </div>
                  <input
                    type="range" min="0" max="1" step="0.05" value={opacity}
                    onChange={(e) => setOpacity(parseFloat(e.target.value))}
                    className="w-full terra-slider"
                    style={{
                      background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${opacity * 100}%, var(--border-subtle) ${opacity * 100}%, var(--border-subtle) 100%)`,
                    }}
                  />
                </div>

                {/* Color stops editor */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[9px] font-bold uppercase"
                      style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '1px' }}>
                      Color Stops ({colorStops.length})
                    </span>
                    <button
                      onClick={addColorStop}
                      disabled={colorStops.length >= 20}
                      className="px-2 py-1 text-[9px] font-bold transition-all"
                      style={{
                        borderRadius: 'var(--radius-sm)',
                        background: colorStops.length >= 20 ? 'var(--border-subtle)' : 'var(--accent)',
                        color: colorStops.length >= 20 ? 'var(--text-faint)' : '#fff',
                        fontFamily: 'var(--font-mono)',
                        cursor: colorStops.length >= 20 ? 'not-allowed' : 'pointer',
                      }}
                    >
                      + Add
                    </button>
                  </div>

                  <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                    {sortedStops.map((stop) => (
                      <div
                        key={stop.id}
                        className="flex items-center gap-2 p-2"
                        style={{
                          background: 'var(--surface-card)',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border-muted)',
                        }}
                      >
                        {/* Color swatch */}
                        <label
                          className="w-7 h-7 rounded-md flex-shrink-0 cursor-pointer"
                          style={{
                            background: stop.color,
                            border: '2px solid var(--surface-card)',
                            boxShadow: '0 0 0 1px var(--border-subtle)',
                          }}
                        >
                          <input
                            type="color" value={stop.color}
                            onChange={(e) => updateColorStop(stop.id, { color: e.target.value })}
                            className="sr-only"
                          />
                        </label>

                        {/* Value */}
                        <input
                          type="number" value={stop.value} step="0.0001"
                          onChange={(e) => updateColorStop(stop.id, { value: parseFloat(e.target.value) })}
                          className="flex-1 min-w-0"
                          style={{
                            padding: '4px 6px',
                            background: 'var(--surface-sunken)',
                            border: '1px solid var(--border-muted)',
                            borderRadius: 'var(--radius-sm)',
                            color: 'var(--text-primary)',
                            fontSize: 10, fontFamily: 'var(--font-mono)', outline: 'none', width: '100%',
                          }}
                        />

                        {/* Label */}
                        <input
                          type="text" value={stop.label || ''} placeholder="Label"
                          onChange={(e) => updateColorStop(stop.id, { label: e.target.value })}
                          className="flex-1 min-w-0"
                          style={{
                            padding: '4px 6px',
                            background: 'var(--surface-sunken)',
                            border: '1px solid var(--border-muted)',
                            borderRadius: 'var(--radius-sm)',
                            color: 'var(--text-secondary)',
                            fontSize: 10, fontFamily: 'var(--font-mono)', outline: 'none', width: '100%',
                          }}
                        />

                        {/* Delete */}
                        {colorStops.length > 2 && (
                          <button
                            onClick={() => removeColorStop(stop.id)}
                            className="p-1 rounded-md flex-shrink-0 transition-colors"
                            style={{ color: 'var(--red)' }}
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Footer actions ──────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 flex items-center gap-2 px-0 pt-3"
        style={{ borderTop: '1px solid var(--border-subtle)' }}
      >
        {/* Export */}
        <button
          onClick={handleExportSLD}
          className="p-2.5 transition-all"
          style={{
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
            background: 'var(--surface-card)',
            color: 'var(--text-muted)',
          }}
          title="Export SLD file"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </button>

        {/* Reset */}
        <button
          onClick={regenerateStops}
          className="p-2.5 transition-all"
          style={{
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
            background: 'var(--surface-card)',
            color: 'var(--text-muted)',
          }}
          title="Reset to defaults"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>

        {/* Apply */}
        <button
          onClick={handleApply}
          className="flex-1 py-2.5 flex items-center justify-center gap-2 transition-all"
          style={{
            borderRadius: 'var(--radius-md)',
            border: 'none',
            background: 'linear-gradient(135deg, var(--accent) 0%, #0a7a6a 100%)',
            color: '#fff',
            fontSize: 12,
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.5px',
            textTransform: 'uppercase' as const,
            boxShadow: '0 2px 8px rgba(13,155,122,0.3)',
            cursor: 'pointer',
          }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Apply Style
        </button>
      </div>
    </div>
  );
};

export default SLDEditor;