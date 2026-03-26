'use client';

import React, { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Copy, Check, Users, TrendingUp } from 'lucide-react';

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

interface AgeGroup { male: number; female: number; total: number; }
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

function CopyButton({ getData }: { getData: () => string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(getData());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} type="button"
      style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '4px 10px', borderRadius: 6, fontSize: 13, fontWeight: 600,
        border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer',
        color: copied ? '#16a34a' : '#64748b', transition: 'all 0.15s',
      }}>
      {copied ? <Check size={11} /> : <Copy size={11} />}
      {copied ? 'Copied!' : 'Copy CSV'}
    </button>
  );
}

export default function Cohort({ cohortData }: CohortProps) {
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(true);

  // Deduplicate + sort by year, guard null data
  const unique = useMemo(() => {
    if (!cohortData?.length) return [];
    const map: Record<number, CohortEntry> = {};
    for (const entry of cohortData) {
      if (entry && entry.year != null) {
        map[entry.year] = { year: entry.year, data: entry.data ?? {} };
      }
    }
    return Object.values(map).sort((a, b) => a.year - b.year);
  }, [cohortData]);

  const allGroups = useMemo(() => {
    const groups = sortAgeGroups(
      Array.from(new Set(
        unique.flatMap((d) =>
          d.data ? Object.keys(d.data).filter((k) => k !== 'total') : []
        )
      ))
    );
    if (unique.some((d) => d.data?.total)) groups.push('total');
    return groups;
  }, [unique]);

  if (!unique.length) return (
    <div style={{ textAlign: 'center', color: '#94a3b8', padding: 40, fontSize: 13 }}>
      No cohort data returned
    </div>
  );

  const activeYear = selectedYear ?? unique[0].year;
  const yearData = unique.find((d) => d.year === activeYear)?.data ?? {};
  const pyramidGroups = allGroups.filter((g) => g !== 'total').reverse();
const maleVals = pyramidGroups.map((g) => -(yearData[g]?.male ?? 0));
const femaleVals = pyramidGroups.map((g) => yearData[g]?.female ?? 0);
  const totalRow = yearData.total;

  // CSV export
  const getCSV = () => {
    const header = ['Age Group', ...unique.flatMap((d) => [`${d.year} Male`, `${d.year} Female`, `${d.year} Total`])].join(',');
    const rows = allGroups.map((g) =>
      [g === 'total' ? 'TOTAL' : g, ...unique.flatMap((d) => [
        d.data?.[g]?.male ?? '',
        d.data?.[g]?.female ?? '',
        d.data?.[g]?.total ?? '',
      ])].join(',')
    );
    return [header, ...rows].join('\n');
  };

  const summaryStats = [
    { label: 'Total Male', val: totalRow?.male, color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe' },
    { label: 'Total Female', val: totalRow?.female, color: '#ec4899', bg: '#fdf2f8', border: '#fbcfe8' },
    { label: 'Total Population', val: totalRow?.total, color: '#0f766e', bg: '#f0fdfa', border: '#99f6e4' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Summary cards ── */}
      {totalRow && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
          {summaryStats.map(({ label, val, color, bg, border }) => (
            <div key={label} style={{
              background: bg, border: `1px solid ${border}`,
              borderRadius: 10, padding: '12px 10px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 22, fontWeight: 800, color, letterSpacing: '-0.5px' }}>
                {val?.toLocaleString('en-IN') ?? '—'}
              </div>
              <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Table header row ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Users size={13} color="#64748b" />
          <span style={{ fontSize: 13, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Age-wise Breakdown
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <CopyButton getData={getCSV} />
          <button type="button" onClick={() => setShowTable(!showTable)}
            style={{
              padding: '4px 10px', borderRadius: 6, fontSize: 13, fontWeight: 600,
              border: '1px solid #e2e8f0', background: showTable ? '#1e40af' : '#fff',
              color: showTable ? '#fff' : '#64748b', cursor: 'pointer', transition: 'all 0.15s',
            }}>
            {showTable ? 'Hide Table' : 'Show Table'}
          </button>
        </div>
      </div>

      {/* ── Scrollable table ── */}
      {showTable && (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 500 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: unique.length * 200 + 120 }}>
              <thead>
                <tr style={{ background: '#f1f5f9', position: 'sticky', top: 0, zIndex: 10 }}>
                  <th style={{ padding: '10px 16px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', fontWeight: 700, color: '#475569', whiteSpace: 'nowrap', position: 'sticky', left: 0, background: '#f1f5f9', zIndex: 20, minWidth: 110 }}>
                    Age Group
                  </th>
                  {unique.map((d) => (
                    <th key={d.year} colSpan={3} style={{ padding: '10px 16px', textAlign: 'center', borderBottom: '1px solid #e2e8f0', borderLeft: '1px solid #e2e8f0', fontWeight: 700, color: '#1e40af' }}>
                      {d.year}
                    </th>
                  ))}
                </tr>
                <tr style={{ background: '#f8fafc', position: 'sticky', top: 33, zIndex: 9 }}>
                  <th style={{ padding: '9px 16px', textAlign: 'left', borderBottom: '2px solid #e2e8f0', position: 'sticky', left: 0, background: '#f8fafc', zIndex: 20 }} />
                  {unique.map((d) => (
                    <React.Fragment key={d.year}>
                      <th style={{ padding: '7px 10px', textAlign: 'center', borderBottom: '2px solid #e2e8f0', borderLeft: '1px solid #e2e8f0', color: '#3b82f6', fontWeight: 700, fontSize: 12 }}>M</th>
                      <th style={{ padding: '7px 10px', textAlign: 'center', borderBottom: '2px solid #e2e8f0', color: '#ec4899', fontWeight: 700, fontSize: 12 }}>F</th>
                      <th style={{ padding: '7px 10px', textAlign: 'center', borderBottom: '2px solid #e2e8f0', color: '#475569', fontWeight: 700, fontSize: 12 }}>T</th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allGroups.map((g, i) => {
                  const isTotal = g === 'total';
                  return (
                    <tr key={g} style={{ background: isTotal ? '#eff6ff' : i % 2 === 0 ? '#fff' : '#f8fafc', borderTop: isTotal ? '2px solid #bfdbfe' : undefined }}>
                      <td style={{ padding: '9px 16px', borderBottom: '1px solid #f1f5f9', fontWeight: isTotal ? 800 : 600, color: isTotal ? '#1e40af' : '#374151', whiteSpace: 'nowrap', position: 'sticky', left: 0, background: isTotal ? '#eff6ff' : i % 2 === 0 ? '#fff' : '#f8fafc', zIndex: 5 }}>
                        {isTotal ? 'TOTAL' : g}
                      </td>
                      {unique.map((d) => (
                        <React.Fragment key={d.year}>
                          <td style={{ padding: '9px 12px', borderBottom: '1px solid #f1f5f9', textAlign: 'center', borderLeft: '1px solid #f1f5f9', color: isTotal ? '#1d4ed8' : '#3b82f6', fontWeight: isTotal ? 700 : 500 }}>
                            {d.data?.[g]?.male?.toLocaleString('en-IN') ?? '—'}
                          </td>
                          <td style={{ padding: '9px 12px', borderBottom: '1px solid #f1f5f9', textAlign: 'center', color: isTotal ? '#be185d' : '#ec4899', fontWeight: isTotal ? 700 : 500 }}>
                            {d.data?.[g]?.female?.toLocaleString('en-IN') ?? '—'}
                          </td>
                          <td style={{ padding: '9px 12px', borderBottom: '1px solid #f1f5f9', textAlign: 'center', color: isTotal ? '#0f766e' : '#374151', fontWeight: isTotal ? 700 : 500 }}>
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

      {/* ── Pyramid ── */}
      <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 16, background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <TrendingUp size={13} color="#64748b" />
            <span style={{ fontSize: 13, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Age–Sex Pyramid
            </span>
          </div>
          <select value={activeYear} onChange={(e) => setSelectedYear(Number(e.target.value))}
            style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 8px', fontSize: 13, fontWeight: 600, color: '#374151', background: '#f8fafc', cursor: 'pointer' }}>
            {unique.map((d) => <option key={d.year} value={d.year}>{d.year}</option>)}
          </select>
        </div>
        <Plot
          data={[
            {
              y: pyramidGroups,
              x: maleVals,
              type: 'bar',
              orientation: 'h',
              name: 'Male',
              marker: {
                color: 'rgba(59,130,246,0.75)',
                line: { color: '#3b82f6', width: 0.5 }
              }
            },
            {
              y: pyramidGroups,
              x: femaleVals,
              type: 'bar',
              orientation: 'h',
              name: 'Female',
              marker: {
                color: 'rgba(236,72,153,0.75)',
                line: { color: '#ec4899', width: 0.5 }
              }
            },
          ] as any}
          layout={{
            barmode: 'overlay',
            height: 420,
            margin: { l: 70, r: 16, t: 8, b: 40 },
            xaxis: {
              tickfont: { size: 9, family: 'Inter, sans-serif' },
              tickformat: ',.0f',
              title: { text: 'Population', font: { size: 10 } },
              zeroline: true,
              zerolinecolor: '#94a3b8',
              zerolinewidth: 1.5,
              gridcolor: '#f1f5f9',
            },
            yaxis: {
              tickfont: { size: 9, family: 'Inter, sans-serif' },
              autorange: 'reversed',
              gridcolor: 'transparent'
            },
            legend: { orientation: 'h', y: -0.18, font: { size: 10 }, xanchor: 'center', x: 0.5 },
            paper_bgcolor: 'transparent',
            plot_bgcolor: '#f8fafc',
            hovermode: 'closest',
          }}
          config={{
            responsive: true,
            displayModeBar: true,
            modeBarButtonsToRemove: ['lasso2d', 'select2d', 'autoScale2d'],
            displaylogo: false
          }}
          style={{ width: '100%' }}
          useResizeHandler
        />
      </div>
    </div>
  );
}
