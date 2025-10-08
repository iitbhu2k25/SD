'use client';

import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { useClimate } from '@/contexts/surfacewater_assessment/drain/ClimateContext';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const SCENARIOS = [
  { value: 585, label: 'RCP 8.5 (585)' },
  { value: 370, label: 'RCP 6.0 (370)' },
  { value: 245, label: 'RCP 4.5 (245)' },
  { value: 126, label: 'RCP 2.6 (126)' },
];

function getFullscreenElement() {
  return (
    document.fullscreenElement ||
    (document as any).webkitFullscreenElement ||
    (document as any).mozFullScreenElement ||
    (document as any).msFullscreenElement ||
    null
  );
}

async function requestElFullscreen(el: HTMLElement) {
  if (el.requestFullscreen) await el.requestFullscreen();
  else if ((el as any).webkitRequestFullscreen) await (el as any).webkitRequestFullscreen();
  else if ((el as any).mozRequestFullScreen) await (el as any).mozRequestFullScreen();
  else if ((el as any).msRequestFullscreen) await (el as any).msRequestFullscreen();
  else throw new Error('Fullscreen API not supported');
}

async function exitDocFullscreen() {
  if (document.exitFullscreen) await document.exitFullscreen();
  else if ((document as any).webkitExitFullscreen) await (document as any).webkitExitFullscreen();
  else if ((document as any).mozCancelFullScreen) await (document as any).mozCancelFullScreen();
  else if ((document as any).msExitFullscreen) await (document as any).msExitFullscreen();
}

function isOk(v: any) {
  return v && typeof v === 'object' && !('error' in v) && v.data && v.subbasin_id;
}

export default function Climate() {
  const {
    posting,
    error,
    results,
    hasSelection,
    selectionConfirmed,
    selectedSubs,
    selectedScenario,
    selectedStartYear,
    selectedEndYear,
    run,
    setSelectedScenario,
    setSelectedStartYear,
    setSelectedEndYear,
  } = useClimate();

  const canRunBase = hasSelection && selectionConfirmed && !posting;

  // Extract options for subbasins from results keys
  const subOptions = useMemo(() => {
    if (!results) return [];
    const keys = Object.keys(results).filter((k) => isOk(results[k]));
    const subs = keys.map((k) => {
      const [sub] = k.split('_');
      return { value: Number(sub), label: `Subbasin ${sub}` };
    });
    return subs.filter((item, index, self) => self.findIndex((i) => i.value === item.value) === index);
  }, [results]);

  const [selectedSub, setSelectedSub] = useState<number | null>(null);

  useEffect(() => {
    if (!results) return;
    if (selectedSub !== null && isOk(results[`${selectedSub}_${selectedScenario}`])) return;
    const firstKey = Object.keys(results).find((k) => isOk(results[k]));
    if (firstKey) {
      const [subString] = firstKey.split('_');
      setSelectedSub(Number(subString));
    }
  }, [results, selectedSub, selectedScenario]);

  const current = useMemo(() => {
    if (!results || selectedSub === null) return null;
    const key = `${selectedSub}_${selectedScenario}`;
    const r = results[key];
    if (!isOk(r)) return null;
    return r as any;
  }, [results, selectedSub, selectedScenario]);

  // Build data for recharts - use year for x-axis instead of year-month
  const chartData = useMemo(() => {
    if (!current?.data?.points) return [];
    return current.data.points.map((p: any) => ({
      year: p.year, // Use year directly for x-axis
      flow_in: p.flow_in,
      flow_out: p.flow_out,
      mon: p.mon,
      x_index: p.x_index,
      // Keep month info for tooltip
      monthLabel: MONTHS[(p.mon ?? 1) - 1] ?? p.mon,
    }));
  }, [current]);

  // Fullscreen
  const chartWrapRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const handler = () => setIsFullscreen(!!getFullscreenElement());
    document.addEventListener('fullscreenchange', handler);
    document.addEventListener('webkitfullscreenchange', handler);
    document.addEventListener('mozfullscreenchange', handler);
    document.addEventListener('MSFullscreenChange', handler);
    return () => {
      document.removeEventListener('fullscreenchange', handler);
      document.removeEventListener('webkitfullscreenchange', handler);
      document.removeEventListener('mozfullscreenchange', handler);
      document.removeEventListener('MSFullscreenChange', handler);
    };
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (isFullscreen) await exitDocFullscreen();
      else if (chartWrapRef.current) await requestElFullscreen(chartWrapRef.current);
    } catch (e) {
      console.error('Fullscreen error', e);
    }
  }, [isFullscreen]);

  // Download server PNG base64 (filename includes range)
  const downloadServerPng = useCallback(() => {
    if (!current || !current.image_base64) return;
    const a = document.createElement('a');
    a.href = `data:image/png;base64,${current.image_base64}`;
    const sub = current.subbasin_id || 'subbasin';
    const scenario = current.scenario || 'scenario';
    const sY = current.start_year ?? selectedStartYear;
    const eY = current.end_year ?? selectedEndYear;
    a.download = `Climate_${sub}_${scenario}_${sY}-${eY}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, [current, selectedStartYear, selectedEndYear]);

  // Numeric inputs with 2021–2100 constraints
  const MIN_YEAR = 2021;
  const MAX_YEAR = 2100;
  const years = chartData.map((d: { year: any; }) => d.year);
  const dataMin = years.length ? Math.min(...years) : 2021;
  const dataMax = years.length ? Math.max(...years) : 2100;


  const startValid =
    Number.isFinite(selectedStartYear) &&
    selectedStartYear >= MIN_YEAR &&
    selectedStartYear <= MAX_YEAR;

  const endValid =
    Number.isFinite(selectedEndYear) &&
    selectedEndYear >= MIN_YEAR &&
    selectedEndYear <= MAX_YEAR;

  const rangeValid = startValid && endValid && selectedStartYear <= selectedEndYear;
  const canRunNow = canRunBase && rangeValid;

  // New handlers: allow free typing; clamp on blur
  const onStartYearChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === '') {
      // allow empty while typing
      setSelectedStartYear(NaN as unknown as number);
      return;
    }
    const v = Number(raw);
    if (Number.isFinite(v)) {
      setSelectedStartYear(v);
    }
  }, [setSelectedStartYear]);

  const onStartYearBlur = useCallback(() => {
    let v = Number(selectedStartYear);
    if (!Number.isFinite(v)) v = MIN_YEAR;
    if (v < MIN_YEAR) v = MIN_YEAR;
    if (v > MAX_YEAR) v = MAX_YEAR;
    setSelectedStartYear(v);
    // keep range invariant
    if (Number.isFinite(selectedEndYear) && v > selectedEndYear) {
      setSelectedEndYear(v);
    }
  }, [selectedStartYear, selectedEndYear, setSelectedStartYear, setSelectedEndYear]);

  const onEndYearChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === '') {
      setSelectedEndYear(NaN as unknown as number);
      return;
    }
    const v = Number(raw);
    if (Number.isFinite(v)) {
      setSelectedEndYear(v);
    }
  }, [setSelectedEndYear]);

  const onEndYearBlur = useCallback(() => {
    let v = Number(selectedEndYear);
    if (!Number.isFinite(v)) v = MAX_YEAR;
    if (v < MIN_YEAR) v = MIN_YEAR;
    if (v > MAX_YEAR) v = MAX_YEAR;
    setSelectedEndYear(v);
    if (Number.isFinite(selectedStartYear) && v < selectedStartYear) {
      setSelectedStartYear(v);
    }
  }, [selectedStartYear, selectedEndYear, setSelectedEndYear, setSelectedStartYear]);

  // generate ticks at every 2-year interval
  const ticks = useMemo(() => {
    if (!years.length) return [];
    const start = Math.ceil(dataMin / 2) * 2; // round up to nearest even year
    const end = Math.floor(dataMax / 2) * 2; // round down
    const arr: number[] = [];
    for (let y = start; y <= end; y += 2) {
      arr.push(y);
    }
    return arr;
  }, [dataMin, dataMax, years]);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-b border-gray-200 p-6 flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-gray-900 mb-1">Climate Change Impact Analysis</h3>
          <p className="text-xs text-gray-600">Monthly flow patterns under different climate scenarios</p>
        </div>
        <button
          onClick={() => run({ scenario: selectedScenario, start_year: selectedStartYear, end_year: selectedEndYear })}
          disabled={!canRunNow}
          className={`px-6 py-2 rounded-lg font-medium text-sm transition-all duration-200 transform ${canRunNow
              ? 'bg-green-600 hover:bg-green-700 text-white shadow-md hover:shadow-lg hover:scale-105'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
        >
          {posting ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Analyzing...
            </div>
          ) : (
            'Run Climate Analysis'
          )}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-gradient-to-r from-red-50 to-red-100 border border-red-200 rounded-lg mt-4">
          <p className="text-red-800 font-medium text-lg">Climate Analysis Error</p>
          <p className="text-red-700">{error}</p>
        </div>
      )}

      <div className="p-6 grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700">Subbasin</label>
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

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700">Scenario</label>
          <select
            className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm"
            value={selectedScenario}
            onChange={(e) => setSelectedScenario(Number(e.target.value))}
          >
            {SCENARIOS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700">Start Year</label>
          <input
            type="number"
            inputMode="numeric"
            min={MIN_YEAR}
            max={MAX_YEAR}
            step={1}
            className={`px-3 py-2 border rounded-lg bg-white text-sm no-spinners ${startValid ? 'border-gray-300' : 'border-red-400'}`}
            value={Number.isFinite(selectedStartYear) ? selectedStartYear : ''}
            onChange={onStartYearChange}
            onBlur={onStartYearBlur}
            placeholder={`${MIN_YEAR}`}
          />
          {!startValid && (
            <span className="text-xs text-red-600">{`Enter ${MIN_YEAR}–${MAX_YEAR}`}</span>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700">End Year</label>
          <input
            type="number"
            inputMode="numeric"
            min={MIN_YEAR}
            max={MAX_YEAR}
            step={1}
            className={`px-3 py-2 border rounded-lg bg-white text-sm no-spinners ${endValid ? 'border-gray-300' : 'border-red-400'}`}
            value={Number.isFinite(selectedEndYear) ? selectedEndYear : ''}
            onChange={onEndYearChange}
            onBlur={onEndYearBlur}
            placeholder={`${MAX_YEAR}`}
          />
          {!endValid && (
            <span className="text-xs text-red-600">{`Enter ${MIN_YEAR}–${MAX_YEAR}`}</span>
          )}
          {startValid && endValid && selectedStartYear > selectedEndYear && (
            <span className="text-xs text-red-600">Start year must be ≤ end year</span>
          )}
        </div>
      </div>



      <div
        ref={chartWrapRef}
        className={`bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg border border-gray-200 p-4 mt-6 ${isFullscreen ? 'fixed inset-0 z-50 m-0 rounded-none bg-white p-6' : ''
          }`}
        style={isFullscreen ? { width: '100vw', height: '100vh', overflow: 'auto' } : {}}
      >
        <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
          <h4 className="text-lg font-semibold text-gray-900">
            Climate: Subbasin {current?.subbasin_id}, Scenario {current?.scenario}, Years{' '}
            {current?.start_year}-{current?.end_year}
          </h4>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            >
              {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            </button>
            <button
              onClick={downloadServerPng}
              title="Download PNG"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            >
              Download PNG
            </button>
          </div>
        </div>

        {current?.data?.points && (
          <ResponsiveContainer width="100%" height={isFullscreen ? '85%' : 420}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="year"
                type="number"
                domain={[dataMin, dataMax]}
                ticks={ticks}
                tickFormatter={(value) => value.toString()}
              />

              <YAxis />
          <Tooltip
  formatter={(value: any) => [Number(value).toFixed(2), ' Runoff (m³)']}
  labelFormatter={(_: any, payload: readonly any[]) => {
    if (!payload?.length) return '';
    const p = payload[0]?.payload;
    return `Year ${p.year}, ${p.monthLabel}`;
  }}
/>

              <Legend />
              {/* <Line type="monotone" dataKey="flow_in" stroke="#2563eb" dot={{ r: 3 }} name="Inflow" /> */}
              <Line type="monotone" dataKey="flow_out" stroke="#dc2626" dot={{ r: 3 }} name="Outflow" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <style jsx>{`
        .no-spinners::-webkit-outer-spin-button,
        .no-spinners::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        .no-spinners[type=number] {
          -moz-appearance: textfield;
        }
      `}</style>
    </div>
  );
}
