'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Copy, Check, Users, TrendingUp } from 'lucide-react';

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

interface AgeGroup   { male: number; female: number; total: number; }
interface CohortEntry { year: number; data?: Record<string, AgeGroup> | null; }
interface CohortProps { cohortData: CohortEntry[]; }

function sortAgeGroups(groups: string[]): string[] {
  return [...groups].sort((a, b) => {
    if (a === 'total') return 1;
    if (b === 'total') return -1;
    const aNum = parseInt(a.split('-')[0].replace('+', '')) || 0;
    const bNum = parseInt(b.split('-')[0].replace('+', '')) || 0;
    return aNum - bNum;
  });
}

function CopyButton({ getData, compact }: { getData: () => string; compact: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(getData());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} type="button" style={{
      display: 'flex', alignItems: 'center', gap: 3,
      padding: compact ? '3px 7px' : '4px 10px',
      borderRadius: 6, fontSize: compact ? 11 : 12, fontWeight: 600,
      border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer',
      color: copied ? '#16a34a' : '#64748b', transition: 'all 0.15s',
      whiteSpace: 'nowrap',
    }}>
      {copied ? <Check size={10} /> : <Copy size={10} />}
      {!compact && (copied ? 'Copied!' : 'CSV')}
    </button>
  );
}

export default function Cohort({ cohortData }: CohortProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [cw, setCw] = useState(600); // container width
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(true);

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver((entries) => setCw(entries[0].contentRect.width));
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  // breakpoints
  const compact = cw < 400;   // medium-small
  const narrow  = cw < 300;   // very small

  // Deduplicate + sort by year
  const unique = useMemo(() => {
    if (!cohortData?.length) return [];
    const map: Record<number, CohortEntry> = {};
    for (const entry of cohortData) {
      if (entry?.year != null)
        map[entry.year] = { year: entry.year, data: entry.data ?? {} };
    }
    return Object.values(map).sort((a, b) => a.year - b.year);
  }, [cohortData]);

  const allGroups = useMemo(() => {
    const groups = sortAgeGroups(
      Array.from(new Set(
        unique.flatMap((d) => d.data ? Object.keys(d.data).filter((k) => k !== 'total') : [])
      ))
    );
    if (unique.some((d) => d.data?.total)) groups.push('total');
    return groups;
  }, [unique]);

  if (!unique.length) return (
    <div style={{ textAlign: 'center', color: '#94a3b8', padding: 32, fontSize: 13 }}>
      No cohort data returned
    </div>
  );

  const activeYear  = selectedYear ?? unique[0].year;
  const yearData    = unique.find((d) => d.year === activeYear)?.data ?? {};
  const pyramidGroups = allGroups.filter((g) => g !== 'total').reverse();
  const maleVals    = pyramidGroups.map((g) => -(yearData[g]?.male   ?? 0));
  const femaleVals  = pyramidGroups.map((g) =>   yearData[g]?.female ?? 0);
  const totalRow    = yearData.total;

  const getCSV = () => {
    const header = ['Age Group', ...unique.flatMap((d) => [`${d.year} Male`, `${d.year} Female`, `${d.year} Total`])].join(',');
    const rows = allGroups.map((g) =>
      [g === 'total' ? 'TOTAL' : g, ...unique.flatMap((d) => [
        d.data?.[g]?.male ?? '', d.data?.[g]?.female ?? '', d.data?.[g]?.total ?? '',
      ])].join(',')
    );
    return [header, ...rows].join('\n');
  };

  const summaryStats = [
    { label: 'Male',       val: totalRow?.male,   color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe' },
    { label: 'Female',     val: totalRow?.female, color: '#ec4899', bg: '#fdf2f8', border: '#fbcfe8' },
    { label: 'Population', val: totalRow?.total,  color: '#0f766e', bg: '#f0fdfa', border: '#99f6e4' },
  ];

  // Pyramid sizing
  const pyramidHeight  = narrow ? 200 : compact ? 280 : 380;
  const marginLeft     = narrow ? 44  : compact ? 54  : 70;
  const tickFontSize   = narrow ? 7   : compact ? 8   : 9;
  const axisTitleSize  = narrow ? 8   : compact ? 9   : 10;

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', gap: compact ? 10 : 14, minWidth: 0, overflow: 'hidden' }}>

      {/* ── Summary cards ── */}
      {totalRow && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: narrow ? '1fr' : 'repeat(3,1fr)',
          gap: compact ? 6 : 10,
        }}>
          {summaryStats.map(({ label, val, color, bg, border }) => (
            <div key={label} style={{
              background: bg, border: `1px solid ${border}`,
              borderRadius: 9,
              padding: narrow ? '8px 10px' : compact ? '9px 8px' : '11px 10px',
              textAlign: 'center',
              display: 'flex', flexDirection: narrow ? 'row' : 'column',
              alignItems: 'center', justifyContent: 'center', gap: narrow ? 8 : 2,
            }}>
              <div style={{
                fontSize: narrow ? 14 : compact ? 16 : 20,
                fontWeight: 800, color, letterSpacing: '-0.5px', lineHeight: 1,
              }}>
                {val?.toLocaleString('en-IN') ?? '—'}
              </div>
              <div style={{ fontSize: narrow ? 10 : compact ? 10 : 11, color: '#64748b', fontWeight: 600 }}>
                {label}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Table toolbar ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <Users size={12} color="#64748b" />
          <span style={{
            fontSize: compact ? 10 : 12, fontWeight: 700, color: '#374151',
            textTransform: 'uppercase', letterSpacing: '0.05em',
          }}>
            {compact ? 'Age Breakdown' : 'Age-wise Breakdown'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          <CopyButton getData={getCSV} compact={compact} />
          <button type="button" onClick={() => setShowTable(!showTable)} style={{
            padding: compact ? '3px 7px' : '4px 10px',
            borderRadius: 6, fontSize: compact ? 11 : 12, fontWeight: 600,
            border: '1px solid #e2e8f0',
            background: showTable ? '#1e40af' : '#fff',
            color: showTable ? '#fff' : '#64748b',
            cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
          }}>
            {showTable ? (compact ? 'Hide' : 'Hide Table') : (compact ? 'Show' : 'Show Table')}
          </button>
        </div>
      </div>

      {/* ── Scrollable table ── */}
      {showTable && (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 9, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: compact ? 260 : 400 }}>
            <table style={{
              width: '100%', borderCollapse: 'collapse',
              fontSize: compact ? 11 : 12,
              minWidth: unique.length * (compact ? 120 : 180) + 90,
            }}>
              <thead>
                <tr style={{ background: '#f1f5f9', position: 'sticky', top: 0, zIndex: 10 }}>
                  <th style={{
                    padding: compact ? '7px 10px' : '9px 14px',
                    textAlign: 'left', borderBottom: '1px solid #e2e8f0',
                    fontWeight: 700, color: '#475569', whiteSpace: 'nowrap',
                    position: 'sticky', left: 0, background: '#f1f5f9', zIndex: 20,
                    minWidth: compact ? 70 : 100,
                  }}>
                    Age
                  </th>
                  {unique.map((d) => (
                    <th key={d.year} colSpan={3} style={{
                      padding: compact ? '7px 6px' : '9px 12px',
                      textAlign: 'center', borderBottom: '1px solid #e2e8f0',
                      borderLeft: '1px solid #e2e8f0', fontWeight: 700, color: '#1e40af',
                      fontSize: compact ? 11 : 12,
                    }}>
                      {d.year}
                    </th>
                  ))}
                </tr>
                <tr style={{ background: '#f8fafc', position: 'sticky', top: compact ? 28 : 34, zIndex: 9 }}>
                  <th style={{
                    padding: compact ? '5px 10px' : '7px 14px',
                    textAlign: 'left', borderBottom: '2px solid #e2e8f0',
                    position: 'sticky', left: 0, background: '#f8fafc', zIndex: 20,
                  }} />
                  {unique.map((d) => (
                    <React.Fragment key={d.year}>
                      {(['M','F','T'] as const).map((lbl, li) => (
                        <th key={lbl} style={{
                          padding: compact ? '4px 6px' : '6px 10px',
                          textAlign: 'center', borderBottom: '2px solid #e2e8f0',
                          borderLeft: li === 0 ? '1px solid #e2e8f0' : undefined,
                          color: lbl === 'M' ? '#3b82f6' : lbl === 'F' ? '#ec4899' : '#475569',
                          fontWeight: 700, fontSize: compact ? 10 : 11,
                        }}>
                          {lbl}
                        </th>
                      ))}
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allGroups.map((g, i) => {
                  const isTotal = g === 'total';
                  const rowBg   = isTotal ? '#eff6ff' : i % 2 === 0 ? '#fff' : '#f8fafc';
                  return (
                    <tr key={g} style={{ background: rowBg, borderTop: isTotal ? '2px solid #bfdbfe' : undefined }}>
                      <td style={{
                        padding: compact ? '6px 10px' : '8px 14px',
                        borderBottom: '1px solid #f1f5f9',
                        fontWeight: isTotal ? 800 : 600,
                        color: isTotal ? '#1e40af' : '#374151',
                        whiteSpace: 'nowrap',
                        position: 'sticky', left: 0, background: rowBg, zIndex: 5,
                        fontSize: compact ? 10 : 12,
                      }}>
                        {isTotal ? 'TOTAL' : g}
                      </td>
                      {unique.map((d) => (
                        <React.Fragment key={d.year}>
                          <td style={{ padding: compact ? '6px 6px' : '8px 10px', borderBottom: '1px solid #f1f5f9', textAlign: 'center', borderLeft: '1px solid #f1f5f9', color: isTotal ? '#1d4ed8' : '#3b82f6', fontWeight: isTotal ? 700 : 500, fontSize: compact ? 10 : 12 }}>
                            {d.data?.[g]?.male?.toLocaleString('en-IN') ?? '—'}
                          </td>
                          <td style={{ padding: compact ? '6px 6px' : '8px 10px', borderBottom: '1px solid #f1f5f9', textAlign: 'center', color: isTotal ? '#be185d' : '#ec4899', fontWeight: isTotal ? 700 : 500, fontSize: compact ? 10 : 12 }}>
                            {d.data?.[g]?.female?.toLocaleString('en-IN') ?? '—'}
                          </td>
                          <td style={{ padding: compact ? '6px 6px' : '8px 10px', borderBottom: '1px solid #f1f5f9', textAlign: 'center', color: isTotal ? '#0f766e' : '#374151', fontWeight: isTotal ? 700 : 500, fontSize: compact ? 10 : 12 }}>
                            {d.data?.[g]?.total?.toLocaleString('en-IN') ?? '—'}
                          </td>
                        </React.Fragment>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Age-Sex Pyramid ── */}
      <div style={{
        border: '1px solid #e2e8f0', borderRadius: 9,
        padding: compact ? 10 : 14,
        background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        overflow: 'hidden', minWidth: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 6, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <TrendingUp size={12} color="#64748b" />
            <span style={{ fontSize: compact ? 10 : 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {compact ? 'Pyramid' : 'Age–Sex Pyramid'}
            </span>
          </div>
          <select
            value={activeYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            style={{
              border: '1px solid #e2e8f0', borderRadius: 6,
              padding: compact ? '3px 6px' : '4px 8px',
              fontSize: compact ? 11 : 12, fontWeight: 600,
              color: '#374151', background: '#f8fafc', cursor: 'pointer',
            }}
          >
            {unique.map((d) => <option key={d.year} value={d.year}>{d.year}</option>)}
          </select>
        </div>

        <Plot
          data={[
            {
              y: pyramidGroups, x: maleVals, type: 'bar', orientation: 'h', name: 'Male',
              marker: { color: 'rgba(59,130,246,0.75)', line: { color: '#3b82f6', width: 0.5 } },
            },
            {
              y: pyramidGroups, x: femaleVals, type: 'bar', orientation: 'h', name: 'Female',
              marker: { color: 'rgba(236,72,153,0.75)', line: { color: '#ec4899', width: 0.5 } },
            },
          ] as any}
          layout={{
            barmode: 'overlay',
            height: pyramidHeight,
            margin: { l: marginLeft, r: 10, t: 4, b: 32 },
            xaxis: {
              tickfont: { size: tickFontSize, family: 'Inter, sans-serif' },
              tickformat: ',.0f',
              title: { text: 'Population', font: { size: axisTitleSize } },
              zeroline: true, zerolinecolor: '#94a3b8', zerolinewidth: 1.5,
              gridcolor: '#f1f5f9',
            },
            yaxis: {
              tickfont: { size: tickFontSize, family: 'Inter, sans-serif' },
              autorange: 'reversed', gridcolor: 'transparent',
            },
            legend: {
              orientation: 'h', y: -0.16, font: { size: compact ? 9 : 10 },
              xanchor: 'center', x: 0.5,
            },
            paper_bgcolor: 'transparent',
            plot_bgcolor: '#f8fafc',
            hovermode: 'closest',
          }}
          config={{
            responsive: true, displayModeBar: !compact,
            modeBarButtonsToRemove: ['lasso2d', 'select2d', 'autoScale2d'],
            displaylogo: false,
          }}
          style={{ width: '100%', maxWidth: '100%' }}
          useResizeHandler
        />
      </div>

    </div>
  );
}
