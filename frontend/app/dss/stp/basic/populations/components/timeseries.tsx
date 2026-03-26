'use client';

import { useState } from 'react';
import { Copy, Check, Table2 } from 'lucide-react';

interface TimeseriesTableProps {
  data: Record<string, Record<string | number, number>>;
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
        display:'flex', alignItems:'center', gap:4,
        padding:'4px 10px', borderRadius:6, fontSize:13, fontWeight:600,
        border:'1px solid #e2e8f0', background:'#fff', cursor:'pointer',
        color: copied ? '#16a34a' : '#64748b', transition:'all 0.15s',
      }}>
      {copied ? <Check size={11}/> : <Copy size={11}/>}
      {copied ? 'Copied!' : 'Copy CSV'}
    </button>
  );
}

export default function TimeseriesTable({ data }: TimeseriesTableProps) {
  if (!data || !Object.keys(data).length) return null;

  const models = Object.keys(data);
  const allYears = Array.from(
    new Set(models.flatMap((m) => Object.keys(data[m]).map(Number)))
  ).sort((a, b) => a - b);

  const getCSV = () => {
    const header = ['Year', ...models].join(',');
    const rows = allYears.map((y) =>
      [y, ...models.map((m) => data[m][y] ?? data[m][String(y)] ?? '')].join(',')
    );
    return [header, ...rows].join('\n');
  };

  // Highlight base year (2011)
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <Table2 size={13} color="#64748b"/>
          <span style={{ fontSize:13, fontWeight:700, color:'#475569', textTransform:'uppercase', letterSpacing:'0.05em' }}>
            Data Table
          </span>
        </div>
        <CopyButton getData={getCSV} />
      </div>

      <div style={{ border:'1px solid #e2e8f0', borderRadius:10, overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ overflowX:'auto', overflowY:'auto', maxHeight:500 }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ background:'#f1f5f9', position:'sticky', top:0, zIndex:5 }}>
                <th style={{ padding:'10px 16px', textAlign:'left', borderBottom:'2px solid #e2e8f0', fontWeight:700, color:'#475569', whiteSpace:'nowrap', minWidth:60 }}>
                  Year
                </th>
                {models.map((m) => (
                  <th key={m} style={{ padding:'10px 16px', textAlign:'right', borderBottom:'2px solid #e2e8f0', borderLeft:'1px solid #e2e8f0', fontWeight:700, color:'#1e40af', whiteSpace:'nowrap', minWidth:100 }}>
                    {m}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allYears.map((y, i) => {
                const isBase = y === 2011;
                return (
                  <tr key={y} style={{ background: isBase ? '#fefce8' : i % 2 === 0 ? '#fff' : '#f8fafc', transition:'background 0.1s' }}>
                    <td style={{ padding:'9px 16px', borderBottom:'1px solid #f1f5f9', fontWeight: isBase ? 800 : 600, color: isBase ? '#92400e' : '#374151' }}>
                      {y}{isBase && <span style={{ marginLeft:4, fontSize:9, background:'#fbbf24', color:'#78350f', borderRadius:4, padding:'1px 4px' }}>Base</span>}
                    </td>
                    {models.map((m) => {
                      const val = data[m][y] ?? data[m][String(y)];
                      return (
                        <td key={m} style={{ padding:'9px 16px', borderBottom:'1px solid #f1f5f9', borderLeft:'1px solid #f1f5f9', textAlign:'right', color: isBase ? '#92400e' : '#374151', fontWeight: isBase ? 700 : 400 }}>
                          {val != null ? Number(val).toLocaleString('en-IN') : '—'}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}