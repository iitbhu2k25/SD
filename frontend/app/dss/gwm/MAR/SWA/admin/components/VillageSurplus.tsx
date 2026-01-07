'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVillageSurplusContext } from '@/contexts/surfacewater_assessment/admin/VillageSurplusContext';
import { useLocationContext } from '@/contexts/surfacewater_assessment/admin/LocationContext';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine,
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

  const tooltipStyle: React.CSSProperties = {
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

  const safeLabel = typeof label === 'number' || typeof label === 'string' ? label : '';

  return (
    <div style={tooltipStyle}>
      <div className="font-medium text-gray-900 mb-1">Month: {String(safeLabel)}</div>
      {payload.map((entry: any, idx: number) => (
        <div key={idx} className="text-gray-700">
          <span style={{ color: entry.color }}>●</span>{' '}
          {entry.name}: {Number(entry.value).toFixed(3)} m³
        </div>
      ))}
    </div>
  );
};

export default function VillageSurplus() {
  const { selectionConfirmed, getConfirmedSubdistrictIds } = useLocationContext();
  const { loading, error, items, hasData, fetchData, lastFetchedSubdistricts, fetchVillagePng } =
    useVillageSurplusContext();

  const [selectedVillage, setSelectedVillage] = useState<string | null>(null);
  const [villageSearchTerm, setVillageSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [chartKey, setChartKey] = useState(0);

  useEffect(() => {
    if (items.length > 0) {
      if (selectedVillage === null || !items.some((s) => s.vlcode === selectedVillage)) {
        const sortedNames = items.map((s) => s.village);
        const first = items.find((s) => s.village === sortedNames.sort((a, b) => a.localeCompare(b))[0]);
        if (first?.vlcode) {
          setSelectedVillage(first.vlcode);
          setChartKey((prev) => prev + 1);
        }
      }
    } else {
      setSelectedVillage(null);
    }
  }, [items, selectedVillage]);

  const villageOptions = useMemo(
    () =>
      items.map((s) => ({
        value: s.vlcode,
        label: s.subdistrictCode ? `${s.village} ` : s.village,
      })),
    [items]
  );

  const filteredVillageOptions = useMemo(
    () =>
      villageOptions.filter((opt) =>
        opt.label.toLowerCase().includes(villageSearchTerm.toLowerCase())
      ),
    [villageOptions, villageSearchTerm]
  );

  const currentVillageData = useMemo(() => {
    if (!selectedVillage || items.length === 0) return null;
    return items.find((s) => String(s.vlcode) === String(selectedVillage)) ?? null;
  }, [items, selectedVillage]);

  const chartData = useMemo(() => {
    if (!currentVillageData) return [];
    const rows = (currentVillageData.timeseries ?? [])
      .map((e) => ({ month: e.month, flow: e.flow }))
      .sort((a, b) => a.month - b.month);
    if (rows.length > MAX_DATA_POINTS) {
      const step = Math.ceil(rows.length / MAX_DATA_POINTS);
      return rows.filter((_, idx) => idx % step === 0);
    }
    return rows;
  }, [currentVillageData]);

  const q25Value = currentVillageData?.Q25_m3 ?? null;
  const villageName = currentVillageData?.village ?? 'Unknown Village';

  const handleFetch = useCallback(() => {
    const ids = getConfirmedSubdistrictIds();
    if (ids.length > 0) fetchData(ids);
  }, [getConfirmedSubdistrictIds, fetchData]);

  const handleVillageChange = useCallback(
    (newVillage: string) => {
      setSelectedVillage(newVillage);
      setChartKey((prev) => prev + 1);
    },
    []
  );

  // Fullscreen
  const chartWrapRef = useRef<HTMLDivElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
        setVillageSearchTerm('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  // Download server PNG by posting only vlcode
  const downloadServerPng = useCallback(async () => {
    if (!currentVillageData) return;
    const b64 = await fetchVillagePng(currentVillageData.vlcode);
    if (!b64) return;
    const safeVillage = (currentVillageData.village || 'Village').replace(/[^a-z0-9-_]+/gi, '_');
    const a = document.createElement('a');
    a.href = `data:image/png;base64,${b64}`;
    a.download = `${safeVillage}_SurplusRunoff.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, [currentVillageData, fetchVillagePng]);

  if (!selectionConfirmed) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
        <button disabled className="mt-4 inline-flex items-center gap-2 rounded-lg bg-gray-300 px-4 py-2 text-sm font-medium text-white cursor-not-allowed">
          Village Surplus
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
          <span className="text-lg text-gray-600">Loading village surplus...</span>
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
            <h3 className="text-lg font-medium text-red-800">Error Loading Village Surplus</h3>
            <p className="text-red-600">{error}</p>
          </div>
        </div>
        <button
          onClick={() => {
            const ids =
              lastFetchedSubdistricts.length > 0 ? lastFetchedSubdistricts : getConfirmedSubdistrictIds();
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
          Village Surplus
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div
        ref={chartWrapRef}
        className={`rounded-lg border border-gray-200 bg-white p-6 shadow-sm ${
          isFullscreen ? 'w-screen h-screen fixed inset-0 z-50 m-0 rounded-none' : ''
        }`}
      >
        <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
          <div className="flex items-center gap-4 flex-wrap">
            <h2 className="text-xl font-semibold text-gray-900">Village Chart: {villageName}</h2>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="border rounded-md px-3 py-1.5 text-sm bg-white hover:bg-gray-50 min-w-[200px] text-left flex items-center justify-between"
                disabled={items.length === 0}
                title="Select village"
              >
                <span className="truncate">
                  {selectedVillage
                    ? villageOptions.find((opt) => opt.value === selectedVillage)?.label
                    : 'Select village'}
                </span>
                <svg className="w-4 h-4 ml-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-300 rounded-md shadow-lg z-50 max-h-80 overflow-hidden flex flex-col">
                  <div className="p-2 border-b border-gray-200">
                    <input
                      type="text"
                      placeholder="Search villages..."
                      value={villageSearchTerm}
                      onChange={(e) => setVillageSearchTerm(e.target.value)}
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      autoFocus
                    />
                  </div>
                  <div className="overflow-y-auto max-h-60">
                    {filteredVillageOptions.length > 0 ? (
                      filteredVillageOptions.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => {
                            handleVillageChange(opt.value);
                            setIsDropdownOpen(false);
                            setVillageSearchTerm('');
                          }}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 ${
                            selectedVillage === opt.value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-sm text-gray-500 text-center">No villages found</div>
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
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                  d="M8 3H5a2 2 0 00-2 2v3m0 8v3a2 2 0 002 2h3m8-18h3a2 2 0 012 2v3m0 8v3a2 2 0 01-2 2h-3" />
              </svg>
              <span>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
            </button>

            {currentVillageData && (
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
            )}
          </div>
        </div>

        <div className={`w-full relative ${isFullscreen ? 'h-[calc(100vh-140px)]' : 'h-96'}`}>
          {q25Value !== null && (
            <div className="absolute top-2 right-2 z-10 rounded-md bg-white border border-gray-200 px-3 py-1 text-sm font-semibold text-red-700 shadow-sm">
              Q25: {q25Value.toFixed(2)} m³
            </div>
          )}

          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                key={chartKey}
                data={chartData}
                margin={{ top: 20, right: 30, left: 60, bottom: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="month"
                  type="number"
                  domain={[1, 12]}
                  tickFormatter={(v) => `${v}`}
                  label={{ value: 'Month', position: 'insideBottom', offset: -10, style: { textAnchor: 'middle' } }}
                />
                <YAxis
                  tickFormatter={(v) => `${Number(v).toFixed(1)}`}
                  label={{ value: 'Flow (m³)', angle: -90, position: 'insideLeft', offset: -30, style: { textAnchor: 'middle' } }}
                />
                <Tooltip
                  content={<CustomTooltip />}
                  position={{ x: 0, y: 0 }}
                  cursor={{ stroke: '#cbd5e1', strokeDasharray: '3 3' }}
                />
                {q25Value !== null && (
                  <ReferenceLine
                    y={q25Value}
                    stroke={RED}
                    strokeDasharray="5 5"
                    strokeWidth={3}
                    ifOverflow="extendDomain"
                    label={{ value: 'Q25', position: 'left', fill: RED, fontSize: 12 }}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="flow"
                  name={villageName}
                  stroke={BLUE}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  isAnimationActive={false}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              No data available for selected village
            </div>
          )}
        </div>
      </div>
    </div>
  );
}