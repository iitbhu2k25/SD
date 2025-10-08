// app/(routes)/surfacewater_assessment/admin/ClimateAdmin.tsx
'use client';

import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { useClimateAdmin } from '@/contexts/surfacewater_assessment/admin/ClimateContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const SCENARIO_OPTIONS: { value: number; label: string }[] = [
  { value: 126, label: ' 126' },
  { value: 245, label: ' 245' },
  { value: 370, label: ' 370' },
  { value: 585, label: ' 585' },
];

function getFullscreenElement() {
  return document.fullscreenElement
    || (document as any).webkitFullscreenElement
    || (document as any).mozFullScreenElement
    || (document as any).msFullscreenElement
    || null;
}

async function requestElFullscreen(el: HTMLElement) {
  if (el.requestFullscreen) await el.requestFullscreen();
  else if ((el as any).webkitRequestFullscreen) await (el as any).webkitRequestFullScreen?.();
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
  return v && typeof v === 'object' && !('error' in v) && v.data && v.subdistrict_code !== undefined && v.vlcode !== undefined;
}

function sanitizeFilenamePart(s: string) {
  return String(s).replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '_').slice(0, 80);
}

export default function ClimateAdmin() {
  const {
    posting, error, results, selectionConfirmed,
    selectedSubdistrictIds, selectedSourceId, selectedStartYear, selectedEndYear,
    setSelectedSourceId, setSelectedStartYear, setSelectedEndYear, run
  } = useClimateAdmin();

  const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:9000';

  const canRunBase = selectionConfirmed && selectedSubdistrictIds.length > 0 && !posting && selectedSourceId !== null && selectedSourceId !== '';

  const combos = useMemo(() => {
    if (!results) return [] as { value: string; label: string }[];
    const src = String(selectedSourceId ?? '');
    const sdSet = new Set(selectedSubdistrictIds.map(String));
    return Object.entries(results)
      .filter(([_, v]) => isOk(v))
      .map(([k, v]: [string, any]) => {
        const sd = String(v.subdistrict_code);
        const sId = String(v.source_id);
        if (sId !== src) return null;
        if (!sdSet.has(sd)) return null;
        return {
          value: k,
          label: ` ${v.village}`
        };
      })
      .filter(Boolean) as { value: string; label: string }[];
  }, [results, selectedSourceId, selectedSubdistrictIds]);

  const [selectedCombo, setSelectedCombo] = useState<string | null>(null);

  useEffect(() => {
    if (!results) {
      setSelectedCombo(null);
      return;
    }
    if (selectedCombo && results[selectedCombo] && isOk(results[selectedCombo])) return;
    const firstOk = combos[0]?.value;
    if (firstOk) setSelectedCombo(firstOk);
    else setSelectedCombo(null);
  }, [results, selectedCombo, combos]);

  const current = useMemo(() => {
    if (!results || !selectedCombo) return null as any;
    const r = results[selectedCombo];
    if (!isOk(r)) return null as any;
    return r as any;
  }, [results, selectedCombo]);

  const chartData = useMemo(() => {
    if (!current?.data?.points) return [];
    return current.data.points.map((p: any) => ({
      ym: `${p.year}-${String(p.mon).padStart(2, '0')}`,
      year: p.year,
      mon: p.mon,
      runoff: typeof p.runoff === 'number' ? p.runoff : (typeof p.surq_cnt_m3 === 'number' ? p.surq_cnt_m3 : 0),
      monthLabel: MONTHS[(p.mon ?? 1) - 1] ?? p.mon,
      x_index: p.x_index,
    }));
  }, [current]);

  const { tableHeaders, tableRows } = useMemo(() => {
    if (!results) return { tableHeaders: [], tableRows: [] };

    const src = String(selectedSourceId ?? '');
    const sdSet = new Set(selectedSubdistrictIds.map(String));

    const yearlyDataByVillage: { [villageName: string]: { [year: string]: number } } = {};
    const allYears = new Set<number>();

    Object.values(results).forEach((v: any) => {
      if (!isOk(v)) return;

      const sd = String(v.subdistrict_code);
      const sId = String(v.source_id);
      if (sId !== src || !sdSet.has(sd)) return;

      const villageName = v.village || `Village ${v.vlcode}`;
      if (!yearlyDataByVillage[villageName]) {
        yearlyDataByVillage[villageName] = {};
      }

      v.data?.points?.forEach((p: any) => {
        const year = p.year;
        const runoff = typeof p.runoff === 'number' ? p.runoff : (typeof p.surq_cnt_m3 === 'number' ? p.surq_cnt_m3 : 0);

        allYears.add(year);
        yearlyDataByVillage[villageName][year] = (yearlyDataByVillage[villageName][year] || 0) + runoff;
      });
    });

    const sortedYears = Array.from(allYears).sort((a, b) => a - b);
    const tableHeaders = ['Village', ...sortedYears.map(String)];

    const tableRows = Object.entries(yearlyDataByVillage).map(([villageName, yearData]) => {
      const row: { [key: string]: string | number } = { villageName };
      sortedYears.forEach(year => {
        row[year] = yearData[year] !== undefined ? parseFloat(yearData[year].toFixed(2)) : 'N/A';
      });
      return row;
    });

    return { tableHeaders, tableRows };
  }, [results, selectedSourceId, selectedSubdistrictIds]);

  const chartWrapRef = useRef<HTMLDivElement>(null);
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
      console.error('Fullscreen error', e);
    }
  }, [isFullscreen]);

  const getSelectedRecord = useCallback(() => {
    if (!results || !selectedCombo) return null;
    const r = results[selectedCombo as keyof typeof results] as any;
    return isOk(r) ? r : null;
  }, [results, selectedCombo]);

  const fetchServerPng = useCallback(async () => {
    const rec = getSelectedRecord();
    if (!rec) return null;

    const body = {
      vlcode: rec.vlcode,
      source_id: Number(selectedSourceId),
      start_year: Number(selectedStartYear),
      end_year: Number(selectedEndYear),
    };

    const res = await fetch(`${apiBase}/swa/adminclimateimage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Image request failed (${res.status}) ${text}`);
    }

    const payload = await res.json();
    if (!payload?.image_base64) {
      throw new Error('No image_base64 in response');
    }
    return { rec, b64: payload.image_base64 };
  }, [apiBase, getSelectedRecord, selectedSourceId, selectedStartYear, selectedEndYear]);

  const downloadServerPng = useCallback(async () => {
    try {
      const out = await fetchServerPng();
      if (!out) return;

      const { rec, b64 } = out;

      // Convert Base64 -> Blob for safe download via Object URL
      // Prefer modern decoding helpers when available; atob fallback otherwise.
      let bytes: Uint8Array;
      if ((Uint8Array as any).fromBase64) {
        bytes = (Uint8Array as any).fromBase64(b64);
      } else {
        const byteChars = atob(b64);
        const byteNums = new Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
        bytes = new Uint8Array(byteNums);
      }

     const blob = new Blob([new Uint8Array(bytes)], { type: 'image/png' });
const url = URL.createObjectURL(blob);


      const a = document.createElement('a');
      const sd = sanitizeFilenamePart(rec.subdistrict_code);
      const src = sanitizeFilenamePart(rec.source_id);
      const vl = sanitizeFilenamePart(rec.vlcode);
      const vn = sanitizeFilenamePart(rec.village || 'village');
      const sY = rec.start_year ?? selectedStartYear;
      const eY = rec.end_year ?? selectedEndYear;
      a.href = url;
      a.download = `ClimateAdmin_${sd}_${src}_${vl}_${vn}_${sY}-${eY}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Download PNG error', e);
      alert((e as Error)?.message || 'Failed to download PNG');
    }
  }, [fetchServerPng, selectedStartYear, selectedEndYear]);

  const downloadTableAsCSV = useCallback(() => {
    if (tableRows.length === 0) return;

    const csvContent = [
      tableHeaders.join(','),
      ...tableRows.map(row =>
        tableHeaders.map(header => {
          if (header === 'Village') return `"${(row as any).villageName}"`;
          return (row as any)[header] ?? '';
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;

    const src = sanitizeFilenamePart(String(selectedSourceId ?? ''));
    const sY = selectedStartYear;
    const eY = selectedEndYear;
    a.download = `ClimateAdmin_Summary_${src}_${sY}-${eY}.csv`;

    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [tableHeaders, tableRows, selectedSourceId, selectedStartYear, selectedEndYear]);

  const MIN_YEAR = 1900;
  const MAX_YEAR = 2100;

  const startValid = Number.isFinite(selectedStartYear) && selectedStartYear >= MIN_YEAR && selectedStartYear <= MAX_YEAR;
  const endValid = Number.isFinite(selectedEndYear) && selectedEndYear >= MIN_YEAR && selectedEndYear <= MAX_YEAR;
  const rangeValid = startValid && endValid && selectedStartYear <= selectedEndYear;
  const canRunNow = canRunBase && rangeValid;

  const onStartYearChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === '') { setSelectedStartYear(NaN as unknown as number); return; }
    const v = Number(raw);
    if (Number.isFinite(v)) setSelectedStartYear(v);
  }, [setSelectedStartYear]);

  const onStartYearBlur = useCallback(() => {
    let v = Number(selectedStartYear);
    if (!Number.isFinite(v)) v = MIN_YEAR;
    if (v < MIN_YEAR) v = MIN_YEAR;
    if (v > MAX_YEAR) v = MAX_YEAR;
    setSelectedStartYear(v);
    if (Number.isFinite(selectedEndYear) && v > selectedEndYear) setSelectedEndYear(v);
  }, [selectedStartYear, selectedEndYear, setSelectedStartYear, setSelectedEndYear]);

  const onEndYearChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === '') { setSelectedEndYear(NaN as unknown as number); return; }
    const v = Number(raw);
    if (Number.isFinite(v)) setSelectedEndYear(v);
  }, [setSelectedEndYear]);

  const onEndYearBlur = useCallback(() => {
    let v = Number(selectedEndYear);
    if (!Number.isFinite(v)) v = MAX_YEAR;
    if (v < MIN_YEAR) v = MIN_YEAR;
    if (v > MAX_YEAR) v = MAX_YEAR;
    setSelectedEndYear(v);
    if (Number.isFinite(selectedStartYear) && v < selectedStartYear) setSelectedStartYear(v);
  }, [selectedStartYear, selectedEndYear, setSelectedEndYear, setSelectedStartYear]);

  const isScenarioAllowed = (val: any) => {
    const n = Number(val);
    return [126, 245, 370, 585].includes(n);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200 p-6 flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-gray-900 mb-1">Admin Climate Analysis</h3>
          <p className="text-xs text-gray-600">Monthly surface runoff aggregated per village</p>
        </div>
        <button
          onClick={() => run({ source_id: Number(selectedSourceId), start_year: selectedStartYear, end_year: selectedEndYear })}
          disabled={!canRunNow}
          className={`px-6 py-2 rounded-lg font-medium text-sm transition-all duration-200 transform ${canRunNow ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg hover:scale-105'
            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
        >
          {posting ? (
            <span className="inline-flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Running...
            </span>
          ) : 'Run Admin Climate'}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-gradient-to-r from-red-50 to-red-100 border border-red-200 rounded-lg mt-4">
          <p className="text-red-800 font-medium text-lg">Admin Climate Error</p>
          <p className="text-red-700">{error}</p>
        </div>
      )}

      <div className="p-6 grid grid-cols-1 md:grid-cols-6 gap-4">
        <div className="flex flex-col gap-2 md:col-span-3">
          <label className="text-sm font-medium text-gray-700">Village</label>
          <select
            className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm"
            value={selectedCombo ?? ''}
            onChange={(e) => setSelectedCombo(e.target.value || null)}
            disabled={!results || Object.keys(results).length === 0 || combos.length === 0}
            title="Select village"
          >
            <option value="">Select...</option>
            {combos.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700">Scenario</label>
          <select
            className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm"
            value={String(selectedSourceId ?? 126)}
            onChange={(e) => {
              const v = Number(e.target.value);
              setSelectedSourceId(isScenarioAllowed(v) ? v : 126);
            }}
            title="Select scenario"
          >
            {SCENARIO_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700">Start Year</label>
          <input
            type="number"
            inputMode="numeric"
            min={1900}
            max={2100}
            step={1}
            className={`px-3 py-2 border rounded-lg bg-white text-sm ${startValid ? 'border-gray-300' : 'border-red-400'}`}
            value={Number.isFinite(selectedStartYear) ? selectedStartYear : ''}
            onChange={onStartYearChange}
            onBlur={onStartYearBlur}
            placeholder="1900"
          />
          {!startValid && <span className="text-xs text-red-600">Enter 1900–2100</span>}
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700">End Year</label>
          <input
            type="number"
            inputMode="numeric"
            min={1900}
            max={2100}
            step={1}
            className={`px-3 py-2 border rounded-lg bg-white text-sm ${endValid ? 'border-gray-300' : 'border-red-400'}`}
            value={Number.isFinite(selectedEndYear) ? selectedEndYear : ''}
            onChange={onEndYearChange}
            onBlur={onEndYearBlur}
            placeholder="2100"
          />
          {!endValid && <span className="text-xs text-red-600">Enter 1900–2100</span>}
          {startValid && endValid && selectedStartYear > selectedEndYear && (
            <span className="text-xs text-red-600">Start year must be ≤ end year</span>
          )}
        </div>
      </div>

      <div
        ref={chartWrapRef}
        className={`bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg border border-gray-200 p-4 mt-6 ${isFullscreen ? 'fixed inset-0 z-50 m-0 rounded-none bg-white p-6' : ''}`}
        style={isFullscreen ? { width: '100vw', height: '100vh', overflow: 'auto' } : {}}
      >
        <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
          <h4 className="text-lg font-semibold text-gray-900">
            {current
              ? `Admin Climate:  Village: ${current.village}, Scenario ${current.source_id}, ${current.start_year}-${current.end_year}`
              : 'Admin Climate'}
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
              disabled={!selectedCombo || !current}
            >
              Download PNG
            </button>
            <button
              onClick={downloadTableAsCSV}
              title="Download data as CSV"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              disabled={tableRows.length === 0}
            >
              Download CSV
            </button>
          </div>
        </div>
        <select
          className={`px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm ${isFullscreen ? 'relative z-[10000]' : ''
            }`}
          value={selectedCombo ?? ''}
          onChange={(e) => setSelectedCombo(e.target.value || null)}
          disabled={!results || Object.keys(results).length === 0 || combos.length === 0}
          title="Select village"
        >
          <option value="">Select...</option>
          {combos.map(c => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>

        {current?.data?.points && (
          <ResponsiveContainer width="100%" height={isFullscreen ? '85%' : 420}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="year"
              ticks={
  ([...new Set(chartData.map((d: any) => d.year))] as number[])
    .filter(y => y % 2 === 0)
}

                tickFormatter={(val: number) => String(val)}
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
              <Line type="monotone" dataKey="runoff" stroke="#dc2626" dot={{ r: 2 }} name="Surface Water Contributing Runoff (m³)" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="mt-6 p-6 border-t border-gray-200">
        <h4 className="text-lg font-semibold text-gray-900 mb-4">
          Annual Runoff Summary (m³)
        </h4>
        {tableRows.length > 0 ? (
          <div className="overflow-auto rounded-lg border border-gray-200 max-h-[60vh]">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {tableHeaders.map((header) => (
                    <th key={header} className="sticky top-0 z-10 whitespace-nowrap bg-gray-100 px-4 py-2 text-left font-medium text-gray-900">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {tableRows.map((row, rowIndex) => (
                  <tr key={rowIndex} className="hover:bg-gray-50">
                    {tableHeaders.map((header, colIndex) => (
                      <td key={`${rowIndex}-${colIndex}`} className="whitespace-nowrap px-4 py-2 font-medium text-gray-700">
                        {header === 'Village' ? (row as any).villageName : (row as any)[header]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 px-4 bg-gray-50 rounded-lg">
            <p className="text-gray-500">
              No summary data to display. Run the analysis to generate results.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
