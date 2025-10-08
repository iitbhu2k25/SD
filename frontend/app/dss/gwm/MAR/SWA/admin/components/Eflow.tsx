'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useEflowContext } from '@/contexts/surfacewater_assessment/admin/EflowContext';
import { useLocationContext } from '@/contexts/surfacewater_assessment/admin/LocationContext';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from 'recharts';

const BLUE = '#2563eb';

const getOriginalColumnName = (displayName: string): string => {
  try {
    const mappingJson = sessionStorage.getItem('stress_column_mapping');
    if (mappingJson) {
      const mapping: Record<string, string> = JSON.parse(mappingJson);
      return mapping[displayName] || displayName;
    }
  } catch (e) {
    console.error('Failed to get column mapping:', e);
  }
  return displayName;
};

function getFullscreenElement(): Element | null {
  // @ts-ignore
  return document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;
}

async function requestElFullscreen(el: HTMLElement) {
  // @ts-ignore
  const req = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
  if (req) await req.call(el);
  else throw new Error('Fullscreen API not supported');
}

async function exitDocFullscreen() {
  // @ts-ignore
  const exit = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;
  if (exit) await exit.call(document);
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || payload.length === 0) return null;
  const containerRect = document.querySelector('.recharts-wrapper')?.getBoundingClientRect();
  if (!containerRect) return null;
  const style: React.CSSProperties = {
    position: 'fixed',
    top: containerRect.top + 50,
    right: window.innerWidth - containerRect.right - 10,
    backgroundColor: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '0.5rem',
    padding: '8px 12px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    zIndex: 1000,
    fontSize: 12,
    minWidth: 160,
    pointerEvents: 'none',
  };
  return (
    <div style={style}>
      <div className="font-medium text-gray-900 mb-1">Month: {String(label)}</div>
      {payload.map((entry: any, idx: number) => (
        <div key={idx} className="text-gray-700">
          <span style={{ color: entry.color }}>●</span>{' '}
          {entry.name}: {Number(entry.value).toFixed(3)} cms
        </div>
      ))}
    </div>
  );
};

export default function Eflow() {
  const { selectionConfirmed, getConfirmedSubdistrictIds } = useLocationContext();
  const {
    loading,
    error,
    items,
    mergedItems,
    hasData,
    hasStressData,
    fetchData,
    lastFetchedSubdistricts,
    stressColumns,
    fetchMethodPng,
  } = useEflowContext();

  const [selectedVillage, setSelectedVillage] = useState<number | null>(null);
  const [chartKey, setChartKey] = useState(0);

  useEffect(() => {
    if (items.length > 0) {
      if (selectedVillage === null || !items.some((s) => s.vlcode === selectedVillage)) {
        const sortedByName = [...items].sort((a, b) => a.village.localeCompare(b.village));
        setSelectedVillage(sortedByName[0]?.vlcode ?? null);
        setChartKey((prev) => prev + 1);
      }
    } else {
      setSelectedVillage(null);
    }
  }, [items, selectedVillage]);

  const villageOptions = useMemo(
    () =>
      items.map((s) => ({
        value: s.vlcode,
        label: `${s.village} `,
      })),
    [items]
  );

  const currentVillage = useMemo(() => {
    if (!selectedVillage) return null;
    return items.find((s) => s.vlcode === selectedVillage) ?? null;
  }, [items, selectedVillage]);

  const handleFetch = useCallback(() => {
    const ids = getConfirmedSubdistrictIds();
    if (ids.length > 0) fetchData(ids);
  }, [getConfirmedSubdistrictIds, fetchData]);

  type MethodKey = 'FDC-Q95' | 'FDC-Q90' | 'Tennant-10%' | 'Tennant-30%' | 'Tennant-60%' | 'Smakhtin' | 'Tessmann';
  const [selectedMethod, setSelectedMethod] = useState<MethodKey>('FDC-Q95');
  const methodsOrder: MethodKey[] = ['FDC-Q95', 'FDC-Q90', 'Tennant-10%', 'Tennant-30%', 'Tennant-60%', 'Smakhtin', 'Tessmann'];

  // CSV download
  const handleDownloadCSV = useCallback(() => {
    if (mergedItems.length === 0) return;

    const header = ['Village', 'Subdistrict', ...methodsOrder, ...stressColumns].join(',');

    const rows = mergedItems.map((r) => {
      const eflowVals = methodsOrder.map((k) => String(r.summary?.[k]?.toFixed(3) ?? ''));
      const stressVals = stressColumns.map((displayCol) => {
        const originalCol = getOriginalColumnName(displayCol);
        const val = r.stressData?.[originalCol];
        return val !== undefined && val !== null ? String(val) : '';
      });
      return [r.village, String(r.subdistrict_code), ...eflowVals, ...stressVals].join(',');
    });

    const csv = [header, ...rows].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    a.download = 'eflow_with_stress_data.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }, [mergedItems, stressColumns]);

  // PNG download via dedicated API
  const handleDownloadPNG = useCallback(
    async (vlcode: number, method: MethodKey) => {
      const rec = items.find((r) => r.vlcode === vlcode);
      if (!rec) return;

      const b64 = await fetchMethodPng(vlcode, method);
      if (!b64) return;

      const villageName = rec.village.replace(/[^a-z0-9-_]+/gi, '_');
      const a = document.createElement('a');
      a.href = `data:image/png;base64,${b64}`;
      a.download = `eflow_${villageName}_${method}.png`;
      a.click();
    },
    [items, fetchMethodPng]
  );

  // Fullscreen
  const chartWrapRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
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

  const chartData = useMemo(() => {
    if (!currentVillage) return [];
    const curve = currentVillage.curves?.[selectedMethod];
    if (!curve) return [];
    return (curve.days ?? []).map((m, i) => ({
      month: m,
      flow: curve.flows?.[i] ?? null,
    }));
  }, [currentVillage, selectedMethod]);

  const threshold = currentVillage?.curves?.[selectedMethod]?.threshold ?? null;
  const villageName = currentVillage?.village ?? 'Unknown Village';

  if (!selectionConfirmed) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
        <button disabled className="mt-4 inline-flex items-center gap-2 rounded-lg bg-gray-300 px-4 py-2 text-sm font-medium text-white cursor-not-allowed">
          Environmental Flow
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
          <span className="text-lg text-gray-600">Loading environmental flows...</span>
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
            <h3 className="text-lg font-medium text-red-800">Error Loading Environmental Flow</h3>
            <p className="text-red-600">{error}</p>
          </div>
        </div>
        <button
          onClick={() => {
            const ids = lastFetchedSubdistricts.length > 0 ? lastFetchedSubdistricts : getConfirmedSubdistrictIds();
            if (ids.length > 0) fetchData(ids);
          }}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
        <button
          onClick={handleFetch}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Fetch E-flow
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
              <h2 className="text-xl font-semibold text-gray-900">Environmental Flow</h2>
              <p className="text-sm text-gray-600">
                {items.length} village{items.length !== 1 ? 's' : ''}
                {hasStressData && (
                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                    ✓ With Groundwater MAR Injection Need
                  </span>
                )}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleFetch}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Fetch E-flow
              </button>
            </div>
          </div>
        </div>
      )}

      {!isFullscreen && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Method Comparison (All Villages)
              {hasStressData && <span className="ml-2 text-sm text-green-600">+ Groundwater MAR Injection Need </span>}
            </h3>
            <button
              onClick={handleDownloadCSV}
              className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium border bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
              title="Download CSV"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                  d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" />
              </svg>
              <span>Download CSV</span>
            </button>
          </div>

          <div className="overflow-auto max-h-96">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="text-left border-b">
                  <th className="px-3 py-2 bg-gray-50">Village</th>
                  <th className="px-3 py-2 bg-blue-50">FDC-Q95 (Mm³/yr)</th>
                  <th className="px-3 py-2 bg-blue-50">FDC-Q90</th>
                  <th className="px-3 py-2 bg-blue-50">Tennant-10%</th>
                  <th className="px-3 py-2 bg-blue-50">Tennant-30%</th>
                  <th className="px-3 py-2 bg-blue-50">Tennant-60%</th>
                  <th className="px-3 py-2 bg-blue-50">Smakhtin</th>
                  <th className="px-3 py-2 bg-blue-50">Tessmann</th>

                  {hasStressData &&
                    stressColumns.map((displayCol) => (
                      <th key={displayCol} className="px-3 py-2 bg-green-50 text-green-800">
                        {displayCol}
                      </th>
                    ))}
                </tr>
              </thead>
              <tbody>
                {mergedItems.map((r) => (
                  <tr key={r.vlcode} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium">{r.village}</td>

                    <td className="px-3 py-2">{r.summary['FDC-Q95']?.toFixed(3) ?? '-'}</td>
                    <td className="px-3 py-2">{r.summary['FDC-Q90']?.toFixed(3) ?? '-'}</td>
                    <td className="px-3 py-2">{r.summary['Tennant-10%']?.toFixed(3) ?? '-'}</td>
                    <td className="px-3 py-2">{r.summary['Tennant-30%']?.toFixed(3) ?? '-'}</td>
                    <td className="px-3 py-2">{r.summary['Tennant-60%']?.toFixed(3) ?? '-'}</td>
                    <td className="px-3 py-2">{r.summary['Smakhtin']?.toFixed(3) ?? '-'}</td>
                    <td className="px-3 py-2">{r.summary['Tessmann']?.toFixed(3) ?? '-'}</td>

                    {hasStressData &&
                      stressColumns.map((displayCol) => {
                        const originalCol = getOriginalColumnName(displayCol);
                        const value = r.stressData?.[originalCol];
                        const displayValue =
                          value !== undefined && value !== null
                            ? typeof value === 'number'
                              ? value.toFixed(4)
                              : String(value)
                            : '-';
                        return (
                          <td key={displayCol} className="px-3 py-2 bg-green-50">
                            {displayValue}
                          </td>
                        );
                      })}
                  </tr>
                ))}
                {mergedItems.length === 0 && (
                  <tr>
                    <td colSpan={7 + stressColumns.length} className="px-3 py-4 text-gray-500 text-center">
                      No data. Click Fetch E-flow.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div
        ref={chartWrapRef}
        className={`rounded-lg border border-gray-200 bg-white p-6 shadow-sm ${isFullscreen ? 'w-screen h-screen fixed inset-0 z-50 m-0 rounded-none' : ''}`}
      >
        <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
          <div className="flex items-center gap-4 flex-wrap">
            <h2 className="text-xl font-semibold text-gray-900">Flow Curves: {villageName}</h2>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-700">Village:</label>
            <select
              className="border rounded-md px-2 py-1 text-sm"
              value={selectedVillage ?? ''}
              onChange={(e) => setSelectedVillage(Number(e.target.value))}
              disabled={items.length === 0}
              title="Select village"
            >
              {villageOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <label className="text-sm text-gray-700 ml-2">Method:</label>
            <select
              className="border rounded-md px-2 py-1 text-sm"
              value={selectedMethod}
              onChange={(e) => setSelectedMethod(e.target.value as MethodKey)}
            >
              {methodsOrder.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>

            <button
              onClick={toggleFullscreen}
              className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                isFullscreen ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
              title={isFullscreen ? 'Exit fullscreen (Esc)' : 'Enter fullscreen'}
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                  d="M8 3H5a2 2 0 00-2 2v3m0 8v3a2 2 0 002 2h3m8-18h3a2 2 0 012 2v3m0 8v3a2 2 0 01-2 2h-3" />
              </svg>
              <span>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
            </button>

            {currentVillage && (
              <button
                onClick={() => selectedVillage && handleDownloadPNG(selectedVillage, selectedMethod)}
                className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium border bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                title="Download PNG"
              >
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                    d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" />
                </svg>
                <span>Download PNG</span>
              </button>
            )}
          </div>
        </div>

        <div className={`w-full relative ${isFullscreen ? 'h-[calc(100vh-140px)]' : 'h-96'}`}>
          {threshold !== null && (
            <div className="absolute top-2 right-2 z-10 rounded-md bg-white border border-gray-200 px-3 py-1 text-sm font-semibold text-purple-700 shadow-sm">
              {selectedMethod}: {threshold.toFixed(2)} cms
            </div>
          )}

          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart key={chartKey} data={chartData} margin={{ top: 20, right: 30, left: 60, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" type="number" domain={[1, 12]} label={{ value: 'Month', position: 'insideBottom', offset: -10, style: { textAnchor: 'middle' } }} />
                <YAxis label={{ value: 'Flow (cms)', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' } }} />
                <Tooltip content={<CustomTooltip />} position={{ x: 0, y: 0 }} cursor={{ stroke: '#cbd5e1', strokeDasharray: '3 3' }} />
                {threshold !== null && (
                  <ReferenceLine
                    y={threshold}
                    stroke="#7c3aed"
                    strokeDasharray="5 5"
                    strokeWidth={2}
                    label={{ value: `${selectedMethod} threshold`, position: 'left', fill: '#7c3aed', fontSize: 12 }}
                  />
                )}
                <Line type="monotone" dataKey="flow" name="Monthly flow" stroke={BLUE} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">No data available for selected village</div>
          )}
        </div>
      </div>
    </div>
  );
}
