'use client';

import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from 'recharts';
import { useEflow } from '@/contexts/surfacewater_assessment/drain/EFlowContext';

type MethodKey =
  | 'FDC-Q90'
  | 'FDC-Q95'
  | 'Tennant-10%'
  | 'Tennant-30%'
  | 'Tennant-60%'
  | 'Smakhtin'
  | 'Tessmann';

const MONTHS: string[] = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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

function isOk(v: any): v is {
  summary: Record<string, number>;
  curves: Record<string, { days: number[]; flows: number[]; threshold: number; image_base64?: string }>;
} {
  return v && typeof v === 'object' && !('error' in v) && v.summary && v.curves;
}

export default function EFlow() {
  const {
    posting,
    error,
    results,
    hasSelection,
    selectionConfirmed,
    selectedSubs,
    run,
  } = useEflow();

  const canRun = hasSelection && selectionConfirmed && !posting;

  const subOptions = React.useMemo(() => {
    if (!results) return [];
    return Object.entries(results)
      .filter(([_, v]) => isOk(v))
      .map(([k]) => ({ value: Number(k), label: `Subbasin ${k}` }));
  }, [results]);

  const [selectedSub, setSelectedSub] = React.useState<number | null>(null);
  const [method, setMethod] = React.useState<MethodKey>('FDC-Q90');

  React.useEffect(() => {
    if (!results) {
      setSelectedSub(null);
      return;
    }
    const okFirst = Object.keys(results)
      .map(Number)
      .find((n) => isOk((results as any)[n]));
    setSelectedSub((prev) =>
      prev !== null && (results as any)[prev] && isOk((results as any)[prev]) ? prev : okFirst ?? null
    );
  }, [results]);

  const current = React.useMemo(() => {
    if (!results || selectedSub === null) return null;
    const r = (results as any)[selectedSub];
    return isOk(r) ? r : null;
  }, [results, selectedSub]);

  const availableMethods = React.useMemo<MethodKey[]>(() => {
    if (!current) return [];
    const keys = Object.keys(current.curves) as MethodKey[];
    const order: MethodKey[] = ['FDC-Q90', 'FDC-Q95', 'Tennant-10%', 'Tennant-30%', 'Tennant-60%', 'Smakhtin', 'Tessmann'];
    return order.filter((k) => keys.includes(k));
  }, [current]);

  React.useEffect(() => {
    if (!current) return;
    if (!availableMethods.includes(method)) {
      const defaultMethod = availableMethods[0] || 'FDC-Q90';
      setMethod(defaultMethod);
    }
  }, [current, availableMethods, method]);

  const series = React.useMemo(() => {
    if (!current) return null;
    return current.curves[method] ?? null;
  }, [current, method]);

  const monthTicks = React.useMemo<number[]>(() => [1, 3, 5, 7, 9, 11], []);

  const yDomain = React.useMemo<[number, number] | undefined>(() => {
    const vals: number[] = [];
    if (series) {
      series.flows.forEach((q) => Number.isFinite(Number(q)) && vals.push(Number(q)));
      if (Number.isFinite(Number(series.threshold))) vals.push(Number(series.threshold));
    }
    if (!vals.length) return undefined;
    const min = Math.min(...vals, 0);
    const max = Math.max(...vals);
    const pad = (max - min) * 0.08 || Math.max(0.1, max * 0.08);
    return [Math.max(0, min - pad), max + pad] as [number, number];
  }, [series]);

  const methodTitle = React.useMemo(() => {
    switch (method) {
      case 'FDC-Q90': return 'Monthly flows with Q90 threshold';
      case 'FDC-Q95': return 'Monthly flows with Q95 threshold';
      case 'Tennant-10%': return 'Tennant 10% MAF';
      case 'Tennant-30%': return 'Tennant 30% MAF';
      case 'Tennant-60%': return 'Tennant 60% MAF';
      case 'Smakhtin': return 'Smakhtin (0.2 MAF)';
      case 'Tessmann': return 'Tessmann (monthly rule)';
    }
  }, [method]);

  const tableRows = React.useMemo(() => {
    if (!series) return [];
    return series.days.map((d, i) => ({
      monthIndex: Number(d),
      month: MONTHS[(Number(d) - 1 + 12) % 12] ?? String(d),
      flow: series.flows[i] ?? null,
    }));
  }, [series]);

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

  // NEW: download server-provided PNG for selected sub + method
  const downloadServerPng = React.useCallback(() => {
    if (!selectedSub || !results) return;
    const r = (results as any)[selectedSub];
    if (!r || 'error' in r || !r.curves || !r.curves[method]?.image_base64) {
      console.warn('No server PNG available for this selection');
      return;
    }
    const b64 = r.curves[method].image_base64 as string;
    const a = document.createElement('a');
    a.href = `data:image/png;base64,${b64}`;
    const safeMethod = method.replace(/[^A-Za-z0-9%-]+/g, '_');
    a.download = `Subbasin-${selectedSub}_${safeMethod}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, [selectedSub, results, method]);

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
              <h3 className="text-xl font-bold text-gray-900 mb-1">Environmental Flow Analysis</h3>
              <p className="text-xs text-gray-600 mt-1">FDC, Tennant, Smakhtin, Tessmann</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => void run()}
                disabled={!canRun}
                className={`px-6 py-2 rounded-lg font-medium text-sm transition-all duration-200 transform ${canRun
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
                  'Run Eflow'
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
                    <p className="text-gray-600 text-sm">Confirm one or more subbasins in the location panel to enable Run Eflow.</p>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="p-4 bg-gradient-to-r from-red-50 to-red-100 border border-red-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="text-2xl">❌</div>
                  <div>
                    <p className="text-red-800 font-medium">Eflow Error</p>
                    <p className="text-red-700 text-sm">{error}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-700">Subbasin:</label>
              <select
                className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm"
                value={selectedSub ?? ''}
                onChange={(e) => setSelectedSub(e.target.value ? Number(e.target.value) : null)}
                disabled={!subOptions.length}
              >
                <option value="">Select...</option>
                {subOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
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
              <h4 className="text-lg font-semibold text-gray-900">{methodTitle}</h4>

              {isFullscreen && (
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-700">Subbasin:</label>
                    <select
                      className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm"
                      value={selectedSub ?? ''}
                      onChange={(e) => setSelectedSub(e.target.value ? Number(e.target.value) : null)}
                      disabled={!subOptions.length}
                    >
                      <option value="">Select...</option>
                      {subOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-700">Method:</label>
                    <select
                      className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm"
                      value={method}
                      onChange={(e) => setMethod(e.target.value as MethodKey)}
                      disabled={!availableMethods.length}
                    >
                      {availableMethods.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {!isFullscreen && (
                <select
                  className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm"
                  value={method}
                  onChange={(e) => setMethod(e.target.value as MethodKey)}
                  disabled={!availableMethods.length}
                >
                  {availableMethods.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              )}

              <button
                onClick={toggleFullscreen}
                className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                  isFullscreen
                    ? 'bg-purple-600 text-white border-purple-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
                title={isFullscreen ? 'Exit fullscreen (Esc)' : 'Enter fullscreen'}
              >
                {isFullscreen ? (
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                      d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2V4a2 2 0 012-2h6l2 2" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                      d="M8 3H5a2 2 0 00-2 2v3m0 8v3a2 2 0 002 2h3m8-18h3a2 2 0 012 2v3m0 8v3a2 2 0 01-2 2h-3" />
                  </svg>
                )}
                <span>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
              </button>

              {/* NEW: Download server PNG for selected sub + method */}
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

          <div className={isFullscreen ? 'h-[calc(100vh-120px)]' : 'h-120'}>
            <ResponsiveContainer width="100%" height="100%">
              {!current || !series ? (
                <LineChart data={[]} margin={{ top: 7, right: 30, left: 20, bottom: 9 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="x" hide />
                  <YAxis stroke="#6b7280" />
                </LineChart>
              ) : (
                <LineChart
                  data={series.days.map((d, i) => ({ monthIndex: Number(d), flow: Number(series.flows[i]) }))}
                  margin={{ top: 7, right: 30, left: 20, bottom: 9 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="monthIndex"
                    stroke="#6b7280"
                    tick={{ fontSize: 12 }}
                    ticks={monthTicks}
                    domain={[1, 12]}
                    label={{ value: 'Month', position: 'insideBottom', offset: -5 }}
                    tickFormatter={(mi: any) => {
                      const idx = Number(mi) - 1;
                      return MONTHS[idx] ?? `M${mi}`;
                    }}
                  />
                  <YAxis
                    stroke="#6b7280"
                    tick={{ fontSize: 12 }}
                    label={{ value: 'Flow (cms)', angle: -90, position: 'insideLeft' }}
                    domain={yDomain ?? ['auto', 'auto']}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                    }}
                    formatter={(value: number, name: string) => [
                      `${Number(value).toFixed(3)} ${name === 'flow' ? 'cms' : ''}`,
                      name === 'flow' ? 'Flow' : 'Value',
                    ]}
                    labelFormatter={(mi: any) => {
                      const idx = Number(mi) - 1;
                      return MONTHS[idx] ?? `Month ${mi}`;
                    }}
                  />
                  <Line type="monotone" dataKey="flow" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} name="flow" connectNulls />
                  {series?.threshold != null && Number.isFinite(Number(series.threshold)) && (
                    <ReferenceLine
                      ifOverflow="extendDomain"
                      y={Number(series.threshold)}
                      stroke="#7c3aed"
                      strokeDasharray="4 4"
                      label={{ value: `${method} threshold`, position: 'top' }}
                    />
                  )}
                  <Legend />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {!isFullscreen && (
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <h4 className="text-lg font-semibold text-gray-900">Method Comparison (All Subbasins)</h4>
              <p className="text-sm text-gray-600 mt-1">Compare surplus volumes (Mm³/year) across methods.</p>
            </div>
            <div className="p-4">
              <div className="h-66 overflow-auto bg-white border border-gray-200 rounded-md">
                <table className="min-w-full">
                  <thead className="bg-gray-100 sticky top-0">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-700 uppercase tracking-wider">Subbasin</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-700 uppercase tracking-wider">FDC-Q95</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-700 uppercase tracking-wider">FDC-Q90</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-700 uppercase tracking-wider">Tennant-10%</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-700 uppercase tracking-wider">Tennant-30%</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-700 uppercase tracking-wider">Tennant-60%</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-700 uppercase tracking-wider">Smakhtin</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-700 uppercase tracking-wider">Tessmann</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {Object.entries(results ?? {}).filter(([_, v]) => isOk(v)).map(([k, v]) => {
                      const sub = Number(k);
                      const s = (v as any).summary || {};
                      return (
                        <tr key={sub} className="hover:bg-gray-50 transition-colors duration-150">
                          <td className="px-4 py-2 text-sm font-semibold text-gray-900">{sub}</td>
                          <td className="px-4 py-2 text-sm text-gray-900">{s['FDC-Q95'] == null ? '—' : Number(s['FDC-Q95']).toFixed(3)}</td>
                          <td className="px-4 py-2 text-sm text-gray-900">{s['FDC-Q90'] == null ? '—' : Number(s['FDC-Q90']).toFixed(3)}</td>
                          <td className="px-4 py-2 text-sm text-gray-900">{s['Tennant-10%'] == null ? '—' : Number(s['Tennant-10%']).toFixed(3)}</td>
                          <td className="px-4 py-2 text-sm text-gray-900">{s['Tennant-30%'] == null ? '—' : Number(s['Tennant-30%']).toFixed(3)}</td>
                          <td className="px-4 py-2 text-sm text-gray-900">{s['Tennant-60%'] == null ? '—' : Number(s['Tennant-60%']).toFixed(3)}</td>
                          <td className="px-4 py-2 text-sm text-gray-900">{s['Smakhtin'] == null ? '—' : Number(s['Smakhtin']).toFixed(3)}</td>
                          <td className="px-4 py-2 text-sm text-gray-900">{s['Tessmann'] == null ? '—' : Number(s['Tessmann']).toFixed(3)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
