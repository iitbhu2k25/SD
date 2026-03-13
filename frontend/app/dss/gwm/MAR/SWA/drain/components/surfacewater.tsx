'use client';

import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import type Plotly from 'plotly.js-dist-min';
import { useSurfaceWater } from '@/contexts/surfacewater_assessment/drain/SurfaceWater';

const Plot = dynamic(() => import('react-plotly.js'), {
  ssr: false,
});

const BLUE = '#2563eb';
const RED = '#dc2626';

type SubbasinResult = {
  subbasin: number;
  years: number[];
  timeseries: { day: number; flow: number }[];
  Q25_cms?: number;
  image_base64?: string;
};

function getFullscreenElement(): Element | null {
  // @ts-ignore
  return (
    document.fullscreenElement ||
    (document as any).webkitFullscreenElement ||
    (document as any).mozFullScreenElement ||
    (document as any).msFullscreenElement
  );
}

async function requestElFullscreen(el: HTMLElement) {
  const req =
    el.requestFullscreen ||
    (el as any).webkitRequestFullscreen ||
    (el as any).mozRequestFullScreen ||
    (el as any).msRequestFullscreen;
  if (req) await req.call(el);
  else throw new Error('Fullscreen API not supported');
}

async function exitDocFullscreen() {
  const exit =
    document.exitFullscreen ||
    (document as any).webkitExitFullscreen ||
    (document as any).mozCancelFullScreen ||
    (document as any).msExitFullscreen;
  if (exit) await exit.call(document);
}

export function buildMergedSeries(results: Record<number, any> | null) {
  if (!results) return { merged: [], q25: null, yearsUnion: [], issues: [] as string[] };

  const perDay: Record<number, number[]> = {};
  const yearsSet = new Set<number>();
  const issues: string[] = [];

  Object.entries(results).forEach(([subId, val]) => {
    if (!val || typeof val !== 'object') return;
    if ('error' in val) {
      issues.push(`Subbasin ${subId}: ${val.error}`);
      return;
    }
    const r = val as {
      years: number[]; timeseries: { day: number; flow: number }[];
    };
    (r.years || []).forEach(y => yearsSet.add(Number(y)));
    (r.timeseries || []).forEach(p => {
      const d = Number(p.day);
      const f = Number(p.flow);
      if (!Number.isFinite(d)) return;
      if (!perDay[d]) perDay[d] = [];
      if (Number.isFinite(f) && f >= 0) perDay[d].push(f);
    });
  });

  const merged = Object.keys(perDay)
    .map(k => Number(k))
    .sort((a, b) => a - b)
    .map(day => {
      const arr = perDay[day];
      const avg = arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
      return { day, flow: avg, surplus: 0 };
    });

  const flows = merged.map(m => m.flow).filter(v => Number.isFinite(v) && v >= 0);
  let q25: number | null = null;
  if (flows.length) {
    const sorted = [...flows].sort((a, b) => b - a);
    const N = sorted.length;
    const ranks = Array.from({ length: N }, (_, i) => i + 1);
    const exceedPct = ranks.map(r => (r / (N + 1)) * 100);
    const target = 25;
    const xp = exceedPct;
    const fp = sorted;
    const t = Math.min(Math.max(target, xp[0]), xp[xp.length - 1]);
    let y = fp[fp.length - 1];
    for (let i = 0; i < xp.length - 1; i++) {
      if (t >= xp[i] && t <= xp[i + 1]) {
        const x0 = xp[i], x1 = xp[i + 1];
        const y0 = fp[i], y1 = fp[i + 1];
        const w = x1 === x0 ? 0 : (t - x0) / (x1 - x0);
        y = y0 + w * (y1 - y0);
        break;
      }
    }
    q25 = y;
  }

  if (q25 !== null) {
    for (const m of merged) m.surplus = Math.max(0, m.flow - q25);
  }

  return { merged, q25, yearsUnion: Array.from(yearsSet).sort((a, b) => a - b), issues };
}

function isOk(r: any): r is SubbasinResult {
  return r && typeof r === 'object' && !('error' in r) && Array.isArray(r.timeseries);
}

export default function SurfaceWaterCard() {
  const {
    posting,
    error,
    results,
    hasSelection,
    selectionConfirmed,
    selectedSubs,
    run,
  } = useSurfaceWater();

  const canRun = hasSelection && selectionConfirmed && !posting;

  const { merged, q25, yearsUnion, issues } = React.useMemo(
    () => buildMergedSeries(results),
    [results]
  );

  const subOptions = React.useMemo(() => {
    if (!results) return [];
    return Object.entries(results)
      .filter(([_, v]) => isOk(v))
      .map(([k, v]) => ({
        value: Number(k),
        label: `Subbasin ${k} (${(v as any).years?.join(', ') || '—'})`,
      }));
  }, [results]);

  const [selectedSub, setSelectedSub] = useState<number | null>(null);
  const [subbasinSearchTerm, setSubbasinSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const chartWrapRef = useRef<HTMLDivElement | null>(null);
  const plotRef = useRef<any>(null);
  
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [xRange, setXRange] = useState<[number, number] | null>(null);
  const [yRange, setYRange] = useState<[number, number] | null>(null);

  React.useEffect(() => {
    if (!results) {
      setSelectedSub(null);
      return;
    }
    const okFirst = Object.keys(results)
      .map(n => Number(n))
      .find((n) => isOk((results as any)[n]));
    setSelectedSub((prev) => (prev !== null && (results as any)[prev] && isOk((results as any)[prev]) ? prev : okFirst ?? null));
  }, [results]);

  const selectedResult = React.useMemo(() => {
    if (!results || selectedSub === null) return null;
    const r = (results as any)[selectedSub];
    return isOk(r) ? r : null;
  }, [results, selectedSub]);

  const filteredSubOptions = useMemo(
    () =>
      subOptions.filter((opt) =>
        opt.label.toLowerCase().includes(subbasinSearchTerm.toLowerCase())
      ),
    [subOptions, subbasinSearchTerm]
  );

  const selectedQ25 = React.useMemo(() => {
    if (!selectedResult || !Array.isArray(selectedResult.timeseries)) return null;
    const flows = selectedResult.timeseries
      .map(p => Number(p.flow))
      .filter(v => Number.isFinite(v) && v >= 0);

    if (!flows.length) return null;

    const sorted = [...flows].sort((a, b) => b - a);
    const N = sorted.length;
    const ranks = Array.from({ length: N }, (_, i) => i + 1);
    const exceedPct = ranks.map(r => (r / (N + 1)) * 100);
    const target = 25;

    const xp = exceedPct;
    const fp = sorted;

    const t = Math.min(Math.max(target, xp[0]), xp[xp.length - 1]);
    let y = fp[fp.length - 1];
    for (let i = 0; i < xp.length - 1; i++) {
      if (t >= xp[i] && t <= xp[i + 1]) {
        const x0 = xp[i], x1 = xp[i + 1];
        const y0 = fp[i], y1 = fp[i + 1];
        const w = x1 === x0 ? 0 : (t - x0) / (x1 - x0);
        y = y0 + w * (y1 - y0);
        break;
      }
    }
    return y;
  }, [selectedResult]);

  const selectedChartData = React.useMemo(() => {
    if (!selectedResult) return { x: [], y: [] };
    const sorted = [...selectedResult.timeseries]
      .filter(p => Number.isFinite(p.day))
      .sort((a, b) => a.day - b.day);
    
    return {
      x: sorted.map(p => Number(p.day)),
      y: sorted.map(p => Number(p.flow))
    };
  }, [selectedResult]);

  React.useEffect(() => {
    const handler = () => setIsFullscreen(!!getFullscreenElement());
    document.addEventListener('fullscreenchange', handler);
    document.addEventListener('webkitfullscreenchange', handler as any);
    document.addEventListener('mozfullscreenchange', handler as any);
    document.addEventListener('MSFullscreenChange', handler as any);
    return () => {
      document.removeEventListener('fullscreenchange', handler);
      document.removeEventListener('webkitfullscreenchange', handler as any);
      document.removeEventListener('mozfullscreenchange', handler as any);
      document.removeEventListener('MSFullscreenChange', handler as any);
    };
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (isFullscreen) await exitDocFullscreen();
      else if (chartWrapRef.current) await requestElFullscreen(chartWrapRef.current);
    } catch (e) {
      console.error('Fullscreen error:', e);
    }
  }, [isFullscreen]);

  const downloadServerPng = useCallback(() => {
    if (!selectedSub || !results) return;
    const r = (results as any)[selectedSub];
    if (!r || 'error' in r || !r.image_base64) {
      console.warn('No server PNG available for this subbasin');
      return;
    }
    const a = document.createElement('a');
    a.href = `data:image/png;base64,${r.image_base64}`;
    a.download = `Subbasin-${selectedSub}_SurfaceWater.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, [selectedSub, results]);



  

  const defaultLayout: Partial<Plotly.Layout> = useMemo(
    () => ({
      autosize: true,
      margin: { l: 70, r: 30, t: 40, b: 80 },
      hovermode: 'x unified',
      xaxis: {
        title: { text: 'Day of Year', standoff: 10 },
        range: xRange ?? undefined,
        autorange: xRange === null,
        zeroline: false,
      },
      yaxis: {
        title: { text: 'Flow (cms)' },
        autorange: yRange === null,
        range: yRange ?? undefined,
        zeroline: false,
        tickformat: '.2f',
      },
      shapes:
        selectedQ25 !== null
          ? [
              {
                type: 'line',
                x0: 0,
                x1: 1,
                xref: 'paper',
                y0: selectedQ25,
                y1: selectedQ25,
                line: { color: RED, dash: 'dash', width: 2 },
              },
            ]
          : [],
      annotations:
        selectedQ25 !== null
          ? [
              {
                x: 0.5,
                y: selectedQ25,
                xref: 'paper',
                yref: 'y',
                text: 'Q25 Threshold',
                showarrow: false,
                yshift: 10,
                font: { color: RED, size: 12, family: 'Inter, Arial' },
              },
            ]
          : [],
    }),
    [xRange, yRange, selectedQ25]
  );

  const traces: Plotly.Data[] = useMemo(() => {
    if (selectedChartData.x.length === 0) return [];
    return [
      {
        x: selectedChartData.x,
        y: selectedChartData.y,
        type: 'scatter',
        mode: 'lines',
        name: 'Avg Flow',
        line: { color: BLUE, width: 2 },
        hovertemplate: 'Day %{x}<br>%{y:.2f} cms<extra></extra>',
      },
    ];
  }, [selectedChartData]);

  const tableRows = React.useMemo(() => {
    if (!selectedResult) return [];
    return [...selectedResult.timeseries].sort((a, b) => a.day - b.day);
  }, [selectedResult]);

  const FullscreenIcon = (
    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
        d="M8 3H5a2 2 0 00-2 2v3m0 8v3a2 2 0 002 2h3m8-18h3a2 2 0 012 2v3m0 8v3a2 2 0 01-2 2h-3" />
    </svg>
  );

  const ExitFullscreenIcon = (
    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
        d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2V4a2 2 0 012-2h6l2 2" />
    </svg>
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
      {!isFullscreen && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-1">Surface Water Surplus Analysis</h3>
              {yearsUnion.length > 0 && (
                <p className="text-xs text-gray-600 mt-1">Years aggregated: {yearsUnion.join(', ')}</p>
              )}
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => void run()}
                disabled={!canRun}
                className={`px-6 py-2 rounded-lg font-medium text-sm transition-all duration-200 transform ${
                  canRun
                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg hover:scale-105'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {posting ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Running...
                  </div>
                ) : (
                  'Run Analysis'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={`space-y-6 ${isFullscreen ? 'p-0' : 'p-6'}`}>
        {!isFullscreen && (
          <>
            {!hasSelection && (
              <div className="p-4 bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="text-2xl">📍</div>
                  <div>
                    <p className="text-gray-700 font-medium">No Subbasin Selected</p>
                    <p className="text-gray-600 text-sm">Confirm one or more subbasins in the location panel to enable Run Analysis.</p>
                  </div>
                </div>
              </div>
            )}

            {issues?.length > 0 && (
              <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg">
                <p className="text-amber-800 text-sm">
                  {issues.join(' · ')}
                </p>
              </div>
            )}

            {error && (
              <div className="p-4 bg-gradient-to-r from-red-50 to-red-100 border border-red-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="text-2xl">❌</div>
                  <div>
                    <p className="text-red-800 font-medium">Analysis Error</p>
                    <p className="text-red-700 text-sm">{error}</p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        <div
          ref={chartWrapRef}
          className={`bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg border border-gray-200 p-4 ${
            isFullscreen ? 'w-screen h-screen fixed inset-0 z-50 m-0 rounded-none bg-white' : ''
          }`}
        >
          <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
            <div className="flex items-center gap-4 flex-wrap">
              <h4 className="text-lg font-semibold text-gray-900">Selected Subbasin Flow</h4>

              {isFullscreen && (
                <div className="relative">
                  <button
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="border rounded-md px-3 py-1.5 text-sm bg-white hover:bg-gray-50 min-w-[200px] text-left flex items-center justify-between"
                    disabled={subOptions.length === 0}
                    title="Select subbasin"
                  >
                    <span className="truncate">
                      {selectedSub !== null
                        ? subOptions.find((opt) => opt.value === selectedSub)?.label
                        : 'Select...'}
                    </span>
                    <svg
                      className="w-4 h-4 ml-2 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {isDropdownOpen && (
                    <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-300 rounded-md shadow-lg z-50 max-h-80 overflow-hidden flex flex-col">
                      <div className="p-2 border-b border-gray-200">
                        <input
                          type="text"
                          placeholder="Search subbasins..."
                          value={subbasinSearchTerm}
                          onChange={(e) => setSubbasinSearchTerm(e.target.value)}
                          className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          autoFocus
                        />
                      </div>
                      <div className="overflow-y-auto max-h-60">
                        {filteredSubOptions.length > 0 ? (
                          filteredSubOptions.map((opt) => (
                            <button
                              key={opt.value}
                              onClick={() => {
                                setSelectedSub(opt.value);
                                setIsDropdownOpen(false);
                                setSubbasinSearchTerm('');
                              }}
                              className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 ${
                                selectedSub === opt.value
                                  ? 'bg-blue-50 text-blue-700 font-medium'
                                  : 'text-gray-700'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))
                        ) : (
                          <div className="px-3 py-2 text-sm text-gray-500 text-center">No subbasins found</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="text-sm text-gray-600">
                {selectedChartData.x.length} data points
              </div>

              <button
                onClick={toggleFullscreen}
                className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                  isFullscreen
                    ? 'bg-purple-600 text-white border-purple-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
                title={isFullscreen ? 'Exit fullscreen (Esc)' : 'Enter fullscreen'}
              >
                {isFullscreen ? ExitFullscreenIcon : FullscreenIcon}
                <span>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
              </button>

              

              {selectedSub !== null && (
                <button
                  onClick={downloadServerPng}
                  className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium border bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                  title="Download PNG (server-rendered)"
                >
                  Server PNG
                </button>
              )}
            </div>
          </div>

          {selectedChartData.x.length > 0 ? (
            <div className={isFullscreen ? 'h-[calc(100vh-120px)]' : 'h-120'}>
              <Plot
                data={traces}
                layout={defaultLayout}
                config={{
                  responsive: true,
                  displayModeBar: true,
                  modeBarButtonsToRemove: ['toggleSpikelines', 'sendDataToCloud'],
                  toImageButtonOptions: {
                    format: 'png',
                    filename: `Subbasin_${selectedSub}_surface_water`,
                    height: 800,
                    width: 1200,
                  },
                }}
                useResizeHandler
                style={{ width: '100%', height: '100%' }}
                onInitialized={(figure, gd) => {
                  plotRef.current = gd;
                }}
                onUpdate={(figure, gd) => {
                  plotRef.current = gd;
                }}
                onRelayout={(event) => {
                  if (
                    event['xaxis.range[0]'] ||
                    event['xaxis.range[1]'] ||
                    (event['xaxis.range'] && Array.isArray(event['xaxis.range']))
                  ) {
                    try {
                      const x0 = event['xaxis.range[0]'] ?? (event['xaxis.range'] ? event['xaxis.range'][0] : undefined);
                      const x1 = event['xaxis.range[1]'] ?? (event['xaxis.range'] ? event['xaxis.range'][1] : undefined);
                      if (typeof x0 === 'number' && typeof x1 === 'number') setXRange([x0, x1]);
                    } catch {}
                  }
                  if (
                    event['yaxis.range[0]'] ||
                    event['yaxis.range[1]'] ||
                    (event['yaxis.range'] && Array.isArray(event['yaxis.range']))
                  ) {
                    try {
                      const y0 = event['yaxis.range[0]'] ?? (event['yaxis.range'] ? event['yaxis.range'][0] : undefined);
                      const y1 = event['yaxis.range[1]'] ?? (event['yaxis.range'] ? event['yaxis.range'][1] : undefined);
                      if (typeof y0 === 'number' && typeof y1 === 'number') setYRange([y0, y1]);
                    } catch {}
                  }
                  if (event['xaxis.autorange'] === true) setXRange(null);
                  if (event['yaxis.autorange'] === true) setYRange(null);
                }}
              />
            </div>
          ) : (
            <div className={`flex items-center justify-center text-gray-500 ${isFullscreen ? 'h-[calc(100vh-120px)]' : 'h-96'}`}>
              <p>No data available for the selected subbasin</p>
            </div>
          )}

          <div className="mt-3 flex items-center justify-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-0.5 bg-blue-600" />
              <span className="text-gray-600">Avg Flow</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-0.5 bg-red-600 border-t border-dashed border-red-600" />
              <span className="text-gray-600">Q25 Threshold</span>
            </div>
          </div>
        </div>

        {!isFullscreen && (
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg border border-gray-200">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between flex-wrap gap-3">
              <div>
                <h4 className="text-lg font-semibold text-gray-900">Subbasin Daily Data</h4>
                <p className="text-sm text-gray-600 mt-1">Select a subbasin to view its averaged day-wise flow series</p>
              </div>
              <div className="relative">
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="border rounded-md px-3 py-1.5 text-sm bg-white hover:bg-gray-50 min-w-[200px] text-left flex items-center justify-between"
                  disabled={subOptions.length === 0}
                  title="Select subbasin"
                >
                  <span className="truncate">
                    {selectedSub !== null
                      ? subOptions.find((opt) => opt.value === selectedSub)?.label
                      : 'Select...'}
                  </span>
                  <svg
                    className="w-4 h-4 ml-2 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isDropdownOpen && (
                  <div className="absolute top-full right-0 mt-1 w-64 bg-white border border-gray-300 rounded-md shadow-lg z-50 max-h-80 overflow-hidden flex flex-col">
                    <div className="p-2 border-b border-gray-200">
                      <input
                        type="text"
                        placeholder="Search subbasins..."
                        value={subbasinSearchTerm}
                        onChange={(e) => setSubbasinSearchTerm(e.target.value)}
                        className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
                      />
                    </div>
                    <div className="overflow-y-auto max-h-60">
                      {filteredSubOptions.length > 0 ? (
                        filteredSubOptions.map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => {
                              setSelectedSub(opt.value);
                              setIsDropdownOpen(false);
                              setSubbasinSearchTerm('');
                            }}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 ${
                              selectedSub === opt.value
                                ? 'bg-blue-50 text-blue-700 font-medium'
                                : 'text-gray-700'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))
                      ) : (
                        <div className="px-3 py-2 text-sm text-gray-500 text-center">No subbasins found</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4">
              {!selectedResult ? (
                <div className="text-sm text-gray-600">No subbasin selected or data unavailable.</div>
              ) : (
                <>
                  <div className="text-sm text-gray-700 mb-2">
                    <span className="font-medium">Subbasin:</span> {selectedResult.subbasin} •
                    <span className="ml-2 font-medium">Years:</span> {selectedResult.years.join(', ')} •
                    <span className="ml-2 font-medium">Q25:</span> {(selectedResult.Q25_cms ?? selectedQ25 ?? 0).toFixed(3)} cms
                  </div>
                  <div className="h-80 overflow-auto bg-white border border-gray-200 rounded-md">
                    <table className="min-w-full">
                      <thead className="bg-gray-100 sticky top-0">
                        <tr>
                          <th className="text-left px-4 py-3 text-xs font-medium text-gray-700 uppercase tracking-wider">Day</th>
                          <th className="text-left px-4 py-3 text-xs font-medium text-gray-700 uppercase tracking-wider">Avg Flow (cms)</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {tableRows.map((row, idx) => (
                          <tr key={idx} className="hover:bg-gray-50 transition-colors duration-150">
                            <td className="px-4 py-2 text-sm text-gray-900 font-medium">{row.day}</td>
                            <td className="px-4 py-2 text-sm text-gray-900">{row.flow.toFixed(3)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}