// frontend/app/dss/gwm/MAR/SWA/drain/components/surfacewater.tsx
'use client';

import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { useSurfaceWater } from '@/contexts/surfacewater_assessment/drain/SurfaceWater';

type SubbasinResult = {
  subbasin: number;
  years: number[];
  timeseries: { day: number; flow: number }[];
  Q25_cms?: number;
  image_base64?: string; // NEW
};

function getFullscreenElement(): Element | null {
  // @ts-ignore
  return document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;
}

async function requestElFullscreen(el: HTMLElement) {
  // @ts-ignore
  const req = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
  if (req) {
    await req.call(el);
  } else {
    throw new Error('Fullscreen API not supported');
  }
}

async function exitDocFullscreen() {
  // @ts-ignore
  const exit = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;
  if (exit) {
    await exit.call(document);
  }
}

// Removed: client SVG-to-PNG exporter

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

  const [selectedSub, setSelectedSub] = React.useState<number | null>(null);

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

  const tableRows = React.useMemo(() => {
    if (!selectedResult) return [];
    return [...selectedResult.timeseries].sort((a, b) => a.day - b.day);
  }, [selectedResult]);

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

    const t = Math.min(Math.max(target, xp[0]), xp[xp.length - 1]); // clamp
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
    if (!selectedResult) return [];
    return [...selectedResult.timeseries]
      .filter(p => Number.isFinite(p.day))
      .sort((a, b) => a.day - b.day)
      .map(p => ({ day: Number(p.day), flow: Number(p.flow) }));
  }, [selectedResult]);

  const chartWrapRef = React.useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = React.useState(false);

  React.useEffect(() => {
    const handler = () => {
      const active = !!getFullscreenElement();
      setIsFullscreen(active);
    };
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

  const toggleFullscreen = React.useCallback(async () => {
    try {
      if (isFullscreen) {
        await exitDocFullscreen();
      } else if (chartWrapRef.current) {
        await requestElFullscreen(chartWrapRef.current);
      }
    } catch (e) {
      console.error('Fullscreen error:', e);
    }
  }, [isFullscreen]);

  // NEW: download the server-rendered PNG for selected subbasin
  const downloadServerPng = React.useCallback(() => {
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
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-700">Subbasin:</label>
                  <select
                    className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm"
                    value={selectedSub ?? ''}
                    onChange={(e) => setSelectedSub(e.target.value ? Number(e.target.value) : null)}
                    disabled={!subOptions.length}
                  >
                    <option value="">Select...</option>
                    {subOptions.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="text-sm text-gray-600">
                {selectedChartData.length} data points
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

              {/* NEW: Download server PNG for selected subbasin */}
              <button
                onClick={downloadServerPng}
                className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium border bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                title="Download PNG (server-rendered)"
              >
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                      d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" />
                </svg>
                <span>Download PNG</span>
              </button>
            </div>
          </div>

          {selectedChartData.length > 0 ? (
            <div className={isFullscreen ? 'h-[calc(100vh-120px)]' : 'h-120'}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={selectedChartData} margin={{ top: 7, right: 30, left: 20, bottom: 9 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="day"
                    stroke="#6b7280"
                    tick={{ fontSize: 12 }}
                    label={{ value: 'Day of Year', position: 'insideBottom', offset: -5 }}
                  />
                  <YAxis
                    stroke="#6b7280"
                    tick={{ fontSize: 12 }}
                    label={{ value: 'Flow (cms)', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    }}
                    formatter={(value: number, name: string) => [
                      `${Number(value).toFixed(2)} cms`,
                      name === 'flow' ? 'Avg Flow' : 'Value',
                    ]}
                    labelFormatter={(day: any) => `Day ${day}`}
                  />
                  {typeof selectedQ25 === 'number' && (
                    <ReferenceLine
                      y={selectedQ25}
                      stroke="#dc2626"
                      strokeDasharray="5 5"
                      label={{ value: 'Q25 Threshold', position: 'top' }}
                    />
                  )}
                  <Line
                    type="monotone"
                    dataKey="flow"
                    stroke="#2563eb"
                    strokeWidth={2}
                    dot={false}
                    name="flow"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className={`flex items-center justify-center text-gray-500 ${isFullscreen }`}>
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
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-700">Subbasin</label>
                <select
                  className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm"
                  value={selectedSub ?? ''}
                  onChange={(e) => setSelectedSub(e.target.value ? Number(e.target.value) : null)}
                  disabled={!subOptions.length}
                >
                  <option value="">Select...</option>
                  {subOptions.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
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
