'use client';

import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import type Plotly from 'plotly.js-dist-min';
import { useEflow } from '@/contexts/surfacewater_assessment/drain/EFlowContext';

const Plot = dynamic(() => import('react-plotly.js'), {
  ssr: false,
});

const BLUE = '#2563eb';
const PURPLE = '#7c3aed';

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

  const [selectedSub, setSelectedSub] = useState<number | null>(null);
  const [method, setMethod] = useState<MethodKey>('FDC-Q90');
  const [subbasinSearchTerm, setSubbasinSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [methodSearchTerm, setMethodSearchTerm] = useState('');
  const [isMethodDropdownOpen, setIsMethodDropdownOpen] = useState(false);

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

  const filteredSubOptions = useMemo(
    () =>
      subOptions.filter((opt) =>
        opt.label.toLowerCase().includes(subbasinSearchTerm.toLowerCase())
      ),
    [subOptions, subbasinSearchTerm]
  );

  const filteredMethodOptions = useMemo(
    () =>
      availableMethods.filter((m) =>
        m.toLowerCase().includes(methodSearchTerm.toLowerCase())
      ),
    [availableMethods, methodSearchTerm]
  );

  const chartData = React.useMemo(() => {
    if (!series) return { x: [], y: [] };
    return {
      x: series.days.map(d => Number(d)),
      y: series.flows.map(f => Number(f))
    };
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

  const downloadClientPng = useCallback(async () => {
    try {
      if (!plotRef.current) return;
      const gd = plotRef.current.getPlotly ? plotRef.current : plotRef.current.container;
      // @ts-ignore
      const imgData = await (window as any).Plotly.toImage(gd, {
        format: 'png',
        height: 800,
        width: 1200,
      });
      const a = document.createElement('a');
      a.href = imgData;
      const safeMethod = method.replace(/[^A-Za-z0-9%-]+/g, '_');
      a.download = `Subbasin-${selectedSub}_${safeMethod}_plot.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      console.error('Plotly export error', err);
    }
  }, [plotRef, selectedSub, method]);

  const resetAxes = useCallback(() => {
    setXRange(null);
    setYRange(null);
    if (plotRef.current && plotRef.current.relayout) {
      plotRef.current
        .relayout({
          'xaxis.autorange': true,
          'yaxis.autorange': true,
        })
        .catch(() => {});
    }
  }, []);

  const defaultLayout: Partial<Plotly.Layout> = useMemo(
    () => ({
      autosize: true,
      margin: { l: 70, r: 30, t: 40, b: 80 },
      hovermode: 'x unified',
      xaxis: {
        title: { text: 'Month', standoff: 10 },
        range: xRange ?? [1, 12],
        autorange: xRange === null,
        tickmode: 'array',
        tickvals: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        ticktext: MONTHS,
        zeroline: false,
      },
      yaxis: {
        title: { text: 'Flow (cms)' },
        autorange: yRange === null,
        range: yRange ?? undefined,
        zeroline: false,
        tickformat: '.3f',
      },
      shapes:
        series?.threshold != null && Number.isFinite(Number(series.threshold))
          ? [
              {
                type: 'line',
                x0: 0,
                x1: 1,
                xref: 'paper',
                y0: Number(series.threshold),
                y1: Number(series.threshold),
                line: { color: PURPLE, dash: 'dash', width: 2 },
              },
            ]
          : [],
      annotations:
        series?.threshold != null && Number.isFinite(Number(series.threshold))
          ? [
              {
                x: 0.5,
                y: Number(series.threshold),
                xref: 'paper',
                yref: 'y',
                text: `${method} threshold`,
                showarrow: false,
                yshift: 10,
                font: { color: PURPLE, size: 12, family: 'Inter, Arial' },
              },
            ]
          : [],
    }),
    [xRange, yRange, series, method]
  );

  const traces: Plotly.Data[] = useMemo(() => {
    if (chartData.x.length === 0) return [];
    return [
      {
        x: chartData.x,
        y: chartData.y,
        type: 'scatter',
        mode: 'lines+markers',
        name: 'Flow',
        line: { color: BLUE, width: 2 },
        marker: { size: 6, color: BLUE },
        hovertemplate: '%{text}<br>%{y:.3f} cms<extra></extra>',
        text: chartData.x.map(mi => MONTHS[(mi - 1) % 12] ?? `Month ${mi}`),
      },
    ];
  }, [chartData]);

  const FullscreenIcon = (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
        d="M8 3H5a2 2 0 00-2 2v3m0 8v3a2 2 0 002 2h3m8-18h3a2 2 0 012 2v3m0 8v3a2 2 0 01-2 2h-3" />
    </svg>
  );

  const ExitFullscreenIcon = (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

                  <div className="relative">
                    <button
                      onClick={() => setIsMethodDropdownOpen(!isMethodDropdownOpen)}
                      className="border rounded-md px-3 py-1.5 text-sm bg-white hover:bg-gray-50 min-w-[150px] text-left flex items-center justify-between"
                      disabled={availableMethods.length === 0}
                      title="Select method"
                    >
                      <span className="truncate">{method}</span>
                      <svg
                        className="w-4 h-4 ml-2 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {isMethodDropdownOpen && (
                      <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-300 rounded-md shadow-lg z-50 max-h-80 overflow-hidden flex flex-col">
                        <div className="p-2 border-b border-gray-200">
                          <input
                            type="text"
                            placeholder="Search methods..."
                            value={methodSearchTerm}
                            onChange={(e) => setMethodSearchTerm(e.target.value)}
                            className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            autoFocus
                          />
                        </div>
                        <div className="overflow-y-auto max-h-60">
                          {filteredMethodOptions.length > 0 ? (
                            filteredMethodOptions.map((m) => (
                              <button
                                key={m}
                                onClick={() => {
                                  setMethod(m);
                                  setIsMethodDropdownOpen(false);
                                  setMethodSearchTerm('');
                                }}
                                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 ${
                                  method === m
                                    ? 'bg-blue-50 text-blue-700 font-medium'
                                    : 'text-gray-700'
                                }`}
                              >
                                {m}
                              </button>
                            ))
                          ) : (
                            <div className="px-3 py-2 text-sm text-gray-500 text-center">No methods found</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {!isFullscreen && (
                <div className="relative">
                  <button
                    onClick={() => setIsMethodDropdownOpen(!isMethodDropdownOpen)}
                    className="border rounded-md px-3 py-1.5 text-sm bg-white hover:bg-gray-50 min-w-[150px] text-left flex items-center justify-between"
                    disabled={availableMethods.length === 0}
                    title="Select method"
                  >
                    <span className="truncate">{method}</span>
                    <svg
                      className="w-4 h-4 ml-2 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {isMethodDropdownOpen && (
                    <div className="absolute top-full right-0 mt-1 w-48 bg-white border border-gray-300 rounded-md shadow-lg z-50 max-h-80 overflow-hidden flex flex-col">
                      <div className="p-2 border-b border-gray-200">
                        <input
                          type="text"
                          placeholder="Search methods..."
                          value={methodSearchTerm}
                          onChange={(e) => setMethodSearchTerm(e.target.value)}
                          className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          autoFocus
                        />
                      </div>
                      <div className="overflow-y-auto max-h-60">
                        {filteredMethodOptions.length > 0 ? (
                          filteredMethodOptions.map((m) => (
                            <button
                              key={m}
                              onClick={() => {
                                setMethod(m);
                                setIsMethodDropdownOpen(false);
                                setMethodSearchTerm('');
                              }}
                              className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 ${
                                method === m
                                  ? 'bg-blue-50 text-blue-700 font-medium'
                                  : 'text-gray-700'
                              }`}
                            >
                              {m}
                            </button>
                          ))
                        ) : (
                          <div className="px-3 py-2 text-sm text-gray-500 text-center">No methods found</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
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
                {isFullscreen ? ExitFullscreenIcon : FullscreenIcon}
                <span>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
              </button>

              <button
                onClick={resetAxes}
                className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium border bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                title="Reset axes / autoscale"
              >
                Reset axes
              </button>

              <button
                onClick={downloadClientPng}
                className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium border bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                title="Download PNG (client-rendered)"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                      d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" />
                </svg>
                <span>Download PNG</span>
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

          <div className={isFullscreen ? 'h-[calc(100vh-120px)]' : 'h-120'}>
            {!current || !series ? (
              <div className="flex items-center justify-center h-full text-gray-500">
                <p>No data available</p>
              </div>
            ) : (
              <Plot
                data={traces}
                layout={defaultLayout}
                config={{
                  responsive: true,
                  displayModeBar: true,
                  modeBarButtonsToRemove: ['toggleSpikelines', 'sendDataToCloud'],
                  toImageButtonOptions: {
                    format: 'png',
                    filename: `Subbasin_${selectedSub}_${method}_eflow`,
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
            )}
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