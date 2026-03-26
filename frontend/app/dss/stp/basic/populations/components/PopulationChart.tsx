'use client';

import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';
import { Copy, Check, BarChart2 } from 'lucide-react';

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

interface PopulationChartProps {
  results: Record<string, Record<string | number, number>>;
  title?: string;
  singleYear?: number | null;
}

const COLORS = ['#ef4444','#3b82f6','#10b981','#f59e0b','#8b5cf6','#f97316','#06b6d4','#84cc16'];

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
        padding:'4px 10px', borderRadius:6, fontSize:11, fontWeight:600,
        border:'1px solid #e2e8f0', background:'#fff', cursor:'pointer',
        color: copied ? '#16a34a' : '#64748b', transition:'all 0.15s',
      }}>
      {copied ? <Check size={11}/> : <Copy size={11}/>}
      {copied ? 'Copied!' : 'Copy CSV'}
    </button>
  );
}

export default function PopulationChart({ results, title, singleYear }: PopulationChartProps) {
  const { labels, datasets } = useMemo(() => {
    if (!results) return { labels:[], datasets:[] };
    const allYears = new Set<number>();
    const models = Object.keys(results);
    models.forEach((m) => Object.keys(results[m]).forEach((y) => {
      const n = Number(y); if (!isNaN(n)) allYears.add(n);
    }));
    const sorted = Array.from(allYears).sort((a,b) => a-b);
    let toPlot: number[];
    if (sorted.length <= 2) {
      toPlot = sorted;
    } else {
      const first = sorted[0];
      toPlot = sorted.filter((y) => (y - first) % 5 === 0);
      const last = sorted[sorted.length - 1];
      if (!toPlot.includes(last)) toPlot.push(last);
      if (singleYear && !toPlot.includes(singleYear)) toPlot.push(singleYear);
      toPlot.sort((a,b) => a-b);
    }
    return {
      labels: toPlot,
      datasets: models.map((m) => ({
        name: m,
        values: toPlot.map((y) => results[m][y] ?? results[m][String(y)] ?? null),
      })),
    };
  }, [results, singleYear]);

  const isBar = labels.length <= 2;

  const getCSV = () => {
    const header = ['Year', ...datasets.map((d) => d.name)].join(',');
    const rows = labels.map((y, i) => [y, ...datasets.map((d) => d.values[i] ?? '')].join(','));
    return [header, ...rows].join('\n');
  };

  const shapes = singleYear && labels.includes(singleYear)
    ? [{ type:'line', x0:singleYear, x1:singleYear, y0:0, y1:1, xref:'x', yref:'paper',
         line:{ color:'#ef4444', width:1.5, dash:'dot' } }]
    : [];

  if (!labels.length) return null;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <BarChart2 size={13} color="#64748b"/>
          <span style={{ fontSize:11, fontWeight:700, color:'#475569', textTransform:'uppercase', letterSpacing:'0.05em' }}>
            {title ?? 'Projection Chart'}
          </span>
        </div>
        <CopyButton getData={getCSV} />
      </div>

      <div style={{ border:'1px solid #e2e8f0', borderRadius:10, overflow:'hidden', background:'#fff', boxShadow:'0 1px 3px rgba(0,0,0,0.05)' }}>
        <Plot
          data={datasets.map((ds, i) => ({
            x: labels,
            y: ds.values,
            type: isBar ? 'bar' : 'scatter',
            mode: isBar ? undefined : 'lines+markers',
            name: ds.name,
            line:{ color: COLORS[i % COLORS.length], width:2.5, shape:'spline', smoothing:0.3 },
            marker:{ size:6, color: COLORS[i % COLORS.length], symbol:'circle' },
          })) as any}
          layout={{
            autosize:true,
            height:360,
            margin:{ l:56, r:16, t:12, b:40 },
            xaxis:{
              title:{ text:'Year', font:{ size:10, color:'#64748b' } },
              tickfont:{ size:9, family:'Inter, sans-serif' },
              gridcolor:'#f1f5f9', linecolor:'#e2e8f0',
            },
            yaxis:{
              title:{ text:'Population', font:{ size:10, color:'#64748b' } },
              tickfont:{ size:9, family:'Inter, sans-serif' },
              gridcolor:'#f1f5f9', linecolor:'#e2e8f0',
              tickformat:',.0f',
            },
            shapes: shapes as any,
            showlegend:true,
            legend:{ orientation:'h', y:-0.22, font:{ size:10 }, xanchor:'center', x:0.5 },
            paper_bgcolor:'transparent',
            plot_bgcolor:'#f8fafc',
            hovermode:'x unified',
          }}
          config={{ responsive:true, displayModeBar:true, modeBarButtonsToRemove:['lasso2d','select2d'], displaylogo:false }}
          style={{ width:'100%' }}
          useResizeHandler
        />
      </div>

      {singleYear && labels.includes(singleYear) && (
        <div style={{ textAlign:'center' }}>
          <span style={{ fontSize:11, background:'#dbeafe', color:'#1d4ed8', borderRadius:6, padding:'3px 10px', fontWeight:600 }}>
            Intermediate Year: {singleYear}
          </span>
        </div>
      )}
    </div>
  );
}