'use client';

import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useStreamFlowContext } from '@/contexts/surfacewater_assessment/drain/StreamFlowContext';
import { useLocationContext } from '@/contexts/surfacewater_assessment/drain/LocationContext';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';

const BLUE = '#2563eb';
const RED = '#dc2626';
const MAX_DATA_POINTS = 1000;

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

// Removed old downloadChartSvgAsPng — server PNG will be used

const CustomTooltip = ({ active, payload, label, coordinate }: any) => {
  if (!active || !payload || payload.length === 0) return null;

  const tooltipStyle: React.CSSProperties = {
    position: 'absolute',
    left: coordinate?.x ?? 0,
    top: coordinate?.y ?? 0,
    transform: 'translate(10px, -50%)', // offset so it doesn’t overlap cursor
    backgroundColor: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '0.5rem',
    padding: '8px 12px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    zIndex: 10,
    fontSize: 12,
    minWidth: 180,
    pointerEvents: 'none',
  };

  const safeLabel =
    typeof label === 'number' || typeof label === 'string' ? label : '';

  return (
    <div style={tooltipStyle}>
      <div className="font-medium text-gray-900 mb-1">
        Exceedance: {Number(safeLabel).toFixed(1)}%
      </div>
      {payload.map((entry: any, idx: number) => (
        <div key={idx} className="text-gray-700">
          <span style={{ color: entry.color }}>●</span>{' '}
          {entry.name}: {Number(entry.value).toFixed(3)} m³/s
        </div>
      ))}
    </div>
  );
};



interface ActivePayloadItem {
  value?: number;
  name?: string;
  payload?: Record<string, unknown>;
  color?: string;
}

interface RechartsMouseEvent {
  activeLabel?: number | string;
  activePayload?: ActivePayloadItem[];
}

export default function StreamFlow() {
  const { selectionConfirmed } = useLocationContext();
  const { loading, error, series, hasData, fetchData, lastFetchedSubbasins } = useStreamFlowContext();

  const [selectedSub, setSelectedSub] = useState<number | null>(null);

  useEffect(() => {
    if (series.length > 0) {
      if (selectedSub === null || !series.some(s => s.sub === selectedSub)) {
        const sortedSubIds = series.map(s => s.sub).sort((a, b) => a - b);
        setSelectedSub(sortedSubIds[0]);
      }
    } else {
      setSelectedSub(null);
    }
  }, [series, selectedSub]);

  const subOptions = useMemo(
    () => series.map(s => ({ value: s.sub, label: `Subbasin ${s.sub}` })),
    [series]
  );

  const [hoveredPoint, setHoveredPoint] = useState<{ x: number | null; y: number | null }>({
    x: null,
    y: null,
  });

  const chartData = useMemo(() => {
    if (!selectedSub) return [];

    const byP = new Map<number, Record<string, number>>();
    const selected = series.find(s => s.sub === selectedSub);
    if (!selected) return [];

    for (const pt of selected.curve) {
      const key = Math.round(pt.p * 100) / 100;
      const row = byP.get(key) ?? { p: key };
      row[`sub_${selectedSub}`] = pt.q;
      byP.set(key, row);
    }

    const sortedData = Array.from(byP.values()).sort(
      (a, b) => (a.p as number) - (b.p as number)
    );

    if (sortedData.length > MAX_DATA_POINTS) {
      const step = Math.ceil(sortedData.length / MAX_DATA_POINTS);
      return sortedData.filter((_, index) => index % step === 0);
    }

    return sortedData;
  }, [series, selectedSub]);

  const q25Value = useMemo(() => {
    if (chartData.length === 0 || !selectedSub) return null;
    const closest = chartData.reduce((prev, curr) =>
      Math.abs((curr.p as number) - 25) < Math.abs((prev.p as number) - 25) ? curr : prev
    );
    const k = `sub_${selectedSub}`;
    const val = (closest as any)[k];
    return typeof val === 'number' ? val : null;
  }, [chartData, selectedSub]);

  const handleMouseMove = useCallback((state: RechartsMouseEvent) => {
    const px = typeof state?.activeLabel === 'number' ? state.activeLabel : null;
    const first = state?.activePayload && state.activePayload.length > 0 ? state.activePayload[0] : undefined;
    const py = typeof first?.value === 'number' ? first.value : null;
    setHoveredPoint({ x: px, y: py });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoveredPoint({ x: null, y: null });
  }, []);

  const handleFetch = useCallback(() => {
    const subs = series.length > 0 ? series.map(s => s.sub) : lastFetchedSubbasins;
    fetchData(subs.length > 0 ? subs : undefined);
  }, [series, lastFetchedSubbasins, fetchData]);

  // Fullscreen
  const chartWrapRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
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

  const toggleFullscreen = useCallback(async () => {
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

  // New: Download the server-generated PNG for the selected subbasin
  const downloadServerPng = useCallback(() => {
    if (!selectedSub) return;
    const item = series.find(s => s.sub === selectedSub);
    if (!item?.imageBase64) {
      console.warn('No server PNG available for this subbasin');
      return;
    }
    const a = document.createElement('a');
    a.href = `data:image/png;base64,${item.imageBase64}`;
    a.download = `Subbasin-${selectedSub}_FlowDurationCurve.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, [selectedSub, series]);

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

  if (!selectionConfirmed) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
        <button
          disabled
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-gray-300 px-4 py-2 text-sm font-medium text-white cursor-not-allowed"
        >
          Flow Duration Curve
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="flex items-center gap-3">
          <svg className="animate-spin h-6 w-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-lg text-gray-600">Loading flow duration curves...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <div className="flex items-center gap-3">
          <svg className="h-6 w-6 text-red-600" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
          </svg>
          <div>
            <h3 className="text-lg font-medium text-red-800">Error Loading Stream Flow Data</h3>
            <p className="text-red-600">{error}</p>
          </div>
        </div>
        <button
          onClick={() => fetchData(lastFetchedSubbasins)}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }



  return (
    <div className="space-y-6">
      <style
        dangerouslySetInnerHTML={{
          __html: `
          .custom-scrollbar::-webkit-scrollbar { width: 6px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 3px; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
          .custom-scrollbar { scrollbar-width: thin; scrollbar-color: #cbd5e1 #f1f5f9; }
        `,
        }}
      />

      {!isFullscreen && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Flow Duration Curves</h2>
              <p className="text-sm text-gray-600">
                {series.length} subbasin{series.length !== 1 ? 's' : ''}
                {chartData.length > 0 && (
                  <span className="ml-2 text-gray-500">
                    ({chartData.length} data points)
                  </span>
                )}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleFetch}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Fetch FDC
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        ref={chartWrapRef}
        className={`rounded-lg border border-gray-200 bg-white p-6 shadow-sm ${
          isFullscreen ? 'w-screen h-screen fixed inset-0 z-50 m-0 rounded-none' : ''
        }`}
      >
        <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
          <div className="flex items-center gap-4 flex-wrap">
            <h2 className="text-xl font-semibold text-gray-900">Flow Duration Curve</h2>

            {isFullscreen && (
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-700">Subbasin:</label>
                <select
                  className="border rounded-md px-2 py-1 text-sm"
                  value={selectedSub ?? ''}
                  onChange={(e) => setSelectedSub(Number(e.target.value))}
                  disabled={series.length === 0}
                  title="Select subbasin"
                >
                  {subOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!isFullscreen && (
              <select
                className="border rounded-md px-2 py-1 text-sm"
                value={selectedSub ?? ''}
                onChange={(e) => setSelectedSub(Number(e.target.value))}
                disabled={series.length === 0}
                title="Select subbasin"
              >
                {subOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            )}

            <div className="text-sm text-gray-600">
              {chartData.length} points
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

            {/* New: Download server-rendered PNG for selected subbasin */}
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

        <div className={`w-full relative ${isFullscreen ? 'h-[calc(100vh-140px)]' : 'h-96'}`}>
          {q25Value !== null && (
            <div className="absolute top-2 right-2 z-10 rounded-md bg-white border border-gray-200 px-3 py-1 text-sm font-semibold text-red-700 shadow-sm">
              Q25: {q25Value.toFixed(2)} m³/s
            </div>
          )}

          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 60, bottom: 60 }}
              onMouseMove={(state: any) => {
                const px = typeof state?.activeLabel === 'number' ? state.activeLabel : null;
                const first = state?.activePayload && state.activePayload.length > 0 ? state.activePayload[0] : undefined;
                const py = typeof first?.value === 'number' ? first.value : null;
                setHoveredPoint({ x: px, y: py });
              }}
              onMouseLeave={() => setHoveredPoint({ x: null, y: null })}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="p"
                type="number"
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
                label={{
                  value: 'Percent exceedance probability',
                  position: 'insideBottom',
                  offset: -10,
                  style: { textAnchor: 'middle' },
                }}
              />
              <YAxis
                tickFormatter={(v) => `${Number(v).toFixed(1)}`}
                label={{
                  value: 'Runoff (m³/s)',
                  angle: -90,
                  position: 'insideLeft',
                  style: { textAnchor: 'middle' },
                }}
              />

              <Tooltip
  content={<CustomTooltip />}
  cursor={{ stroke: '#cbd5e1', strokeDasharray: '3 3' }}
/>


              <ReferenceLine
                x={25}
                stroke={RED}
                strokeDasharray="5 5"
                strokeWidth={2}
                ifOverflow="extendDomain"
                label={{
                  value: '25% exceedance',
                  position: 'top',
                  fill: RED,
                  fontSize: 12,
                  fontWeight: 'bold',
                  offset: 10,
                }}
              />

              {q25Value !== null && (
                <ReferenceLine
                  y={q25Value}
                  stroke={RED}
                  strokeDasharray="5 5"
                  strokeWidth={3}
                  ifOverflow="extendDomain"
                />
              )}

              {selectedSub && (
                <Line
                  key={selectedSub}
                  type="monotone"
                  dataKey={`sub_${selectedSub}`}
                  name={`Subbasin ${selectedSub}`}
                  stroke={BLUE}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                  connectNulls={false}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
