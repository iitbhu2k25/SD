'use client';

import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import type Plotly from 'plotly.js-dist-min';
import { useStreamFlowContext } from '@/contexts/surfacewater_assessment/drain/StreamFlowContext';
import { useLocationContext } from '@/contexts/surfacewater_assessment/drain/LocationContext';

const Plot = dynamic(() => import('react-plotly.js'), {
  ssr: false,
});

const BLUE = '#2563eb';
const RED = '#dc2626';
const MAX_DATA_POINTS = 1000;

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

export default function StreamFlow() {
  const { selectionConfirmed } = useLocationContext();
  const { loading, error, series, hasData, fetchData, lastFetchedSubbasins } = useStreamFlowContext();

  const [selectedSub, setSelectedSub] = useState<number | null>(null);
  const [subbasinSearchTerm, setSubbasinSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  const chartWrapRef = useRef<HTMLDivElement | null>(null);
  const plotRef = useRef<any>(null);
  
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [xRange, setXRange] = useState<[number, number] | null>(null);
  const [yRange, setYRange] = useState<[number, number] | null>(null);

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

  const filteredSubOptions = useMemo(
    () =>
      subOptions.filter((opt) =>
        opt.label.toLowerCase().includes(subbasinSearchTerm.toLowerCase())
      ),
    [subOptions, subbasinSearchTerm]
  );

  const chartData = useMemo(() => {
    if (!selectedSub) return { x: [], y: [] };
    
    const selected = series.find(s => s.sub === selectedSub);
    if (!selected) return { x: [], y: [] };

    let sortedData = [...selected.curve].sort((a, b) => a.p - b.p);

    if (sortedData.length > MAX_DATA_POINTS) {
      const step = Math.ceil(sortedData.length / MAX_DATA_POINTS);
      sortedData = sortedData.filter((_, index) => index % step === 0);
    }

    return {
      x: sortedData.map(pt => Math.round(pt.p * 100) / 100),
      y: sortedData.map(pt => pt.q)
    };
  }, [series, selectedSub]);

  const q25Value = useMemo(() => {
    if (chartData.x.length === 0) return null;
    
    let closestIndex = 0;
    let minDiff = Math.abs(chartData.x[0] - 25);
    
    for (let i = 1; i < chartData.x.length; i++) {
      const diff = Math.abs(chartData.x[i] - 25);
      if (diff < minDiff) {
        minDiff = diff;
        closestIndex = i;
      }
    }
    
    return chartData.y[closestIndex];
  }, [chartData]);

  const handleFetch = useCallback(() => {
    const subs = series.length > 0 ? series.map(s => s.sub) : lastFetchedSubbasins;
    fetchData(subs.length > 0 ? subs : undefined);
  }, [series, lastFetchedSubbasins, fetchData]);

  useEffect(() => {
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
    if (!selectedSub) return;
    const item = series.find(s => s.sub === selectedSub);
    if (!item?.imageBase64) {
      console.warn('No server PNG available for this subbasin');
      return;
    }
    const safeSubbasin = `Subbasin_${selectedSub}`;
    const a = document.createElement('a');
    a.href = `data:image/png;base64,${item.imageBase64}`;
    a.download = `${safeSubbasin}_FlowDurationCurve.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, [selectedSub, series]);

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
      a.download = `Subbasin_${selectedSub}_FlowDurationCurve_plot.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      console.error('Plotly export error', err);
    }
  }, [plotRef, selectedSub]);

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
        title: { text: 'Percent exceedance probability', standoff: 10 },
        range: xRange ?? [0, 100],
        tickformat: ',.0f',
        ticksuffix: '%',
        zeroline: false,
      },
      yaxis: {
        title: { text: 'Runoff (m³/s)' },
        autorange: yRange === null,
        range: yRange ?? undefined,
        zeroline: false,
        tickformat: '.2f',
      },
      shapes:
        q25Value !== null
          ? [
              {
                type: 'line',
                x0: 25,
                x1: 25,
                xref: 'x',
                y0: 0,
                y1: 1,
                yref: 'paper',
                line: { color: RED, dash: 'dashdot', width: 2 },
              },
            ]
          : [],
      annotations:
        q25Value !== null
          ? [
              {
                x: 25,
                y: 1,
                xref: 'x',
                yref: 'paper',
                text: '25% exceedance',
                showarrow: false,
                xanchor: 'left',
                yanchor: 'bottom',
                font: { color: RED, size: 12, family: 'Inter, Arial' },
              },
            ]
          : [],
    }),
    [xRange, yRange, q25Value]
  );

  const traces: Plotly.Data[] = useMemo(() => {
    if (chartData.x.length === 0) return [];
    return [
      {
        x: chartData.x,
        y: chartData.y,
        type: 'scatter',
        mode: 'lines',
        name: `Subbasin ${selectedSub}`,
        line: { color: BLUE, width: 2 },
        hovertemplate: '%{x:.2f}%<br>%{y:.4f} m³/s<extra></extra>',
      },
    ];
  }, [chartData, selectedSub]);

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

  if (!hasData && series.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Flow Duration Curve</h2>
        <button
          onClick={handleFetch}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Fetch FDC
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!isFullscreen && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Flow Duration Curves</h2>
              <p className="text-sm text-gray-600">
                {series.length} subbasin{series.length !== 1 ? 's' : ''}
                {chartData.x.length > 0 && (
                  <span className="ml-2 text-gray-500">
                    ({chartData.x.length} data points)
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
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="border rounded-md px-3 py-1.5 text-sm bg-white hover:bg-gray-50 min-w-[200px] text-left flex items-center justify-between"
                disabled={series.length === 0}
                title="Select subbasin"
              >
                <span className="truncate">
                  {selectedSub
                    ? subOptions.find((opt) => opt.value === selectedSub)?.label
                    : 'Select subbasin'}
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

            {selectedSub && (
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

        <div className={`w-full relative ${isFullscreen ? 'h-[calc(100vh-140px)]' : 'h-96'}`}>
          {q25Value !== null && (
            <div className="absolute top-7 right-2 z-10 rounded-md bg-white border border-gray-200 px-3 py-1 text-sm font-semibold text-red-700 shadow-sm">
              Q25: {q25Value.toFixed(2)} m³/s
            </div>
          )}

          <Plot
            data={traces}
            layout={defaultLayout}
            config={{
              responsive: true,
              displayModeBar: true,
              modeBarButtonsToRemove: ['toggleSpikelines', 'sendDataToCloud'],
              toImageButtonOptions: {
                format: 'png',
                filename: `Subbasin_${selectedSub}_flow_duration_curve`,
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
      </div>
    </div>
  );
}