'use client';

import dynamic from 'next/dynamic';
import React from 'react';

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

type Row = {
    month: number;
    flow: number;         // L/s
};

type Props = {
    data: Row[];
    methodLabel: string;
    threshold?: number | null;
    villageName?: string;
    height?: number;
    width?: number | string;
};

export default function EflowPlot({
    data,
    methodLabel,
    threshold = null,
    villageName = '',
    height = 420,
    width = '100%',
}: Props) {
    const x = data.map(d => d.month);
    const flow = data.map(d => d.flow);

    const thr = threshold != null ? Number(threshold) : null;

    // Build shading only for surplus region
    const surplusX: number[] = [];
    const surplusYFlow: number[] = [];
    const surplusYThr: number[] = [];

    if (thr !== null) {
        for (let i = 0; i < data.length; i++) {
            if (flow[i] > thr) {
                surplusX.push(x[i]);
                surplusYFlow.push(flow[i]);
                surplusYThr.push(thr);
            } else {
                // Break the polygon when no surplus
                surplusX.push(NaN);
                surplusYFlow.push(NaN);
                surplusYThr.push(NaN);
            }
        }
    }

    const traces: any[] = [];

    // Threshold horizontal line
    if (thr !== null) {
        traces.push({
            x,
            y: x.map(() => thr),
            mode: 'lines',
            name: `Threshold (${thr} L/s)`,
            line: { color: 'red', width: 2, dash: 'dot' }
        });
    }

    // Surplus area shading (only above threshold)
    if (thr !== null) {
        traces.push({
            x: surplusX,
            y: surplusYFlow,
            fill: 'tonexty',
            fillcolor: 'rgba(255,0,0,0.25)',
            mode: 'lines',
            line: { width: 0 },
            name: 'Surplus region',
            hoverinfo: 'skip'
        });

        traces.push({
            x: surplusX,
            y: surplusYThr,
            mode: 'lines',
            line: { width: 0 },
            showlegend: false,
            hoverinfo: 'skip'
        });
    }

    // Actual flow line
    traces.push({
        x,
        y: flow,
        mode: 'lines+markers',
        name: 'Flow (L/s)',
        line: { color: '#2563eb', width: 3 },
        marker: { size: 6 }
    });

    const layout: Partial<Plotly.Layout> = {
        title: {
            text: `${methodLabel} • ${villageName}`
        },
        height,
        margin: { l: 85, r: 30, t: 60, b: 60 },

        xaxis: {
            title: {
                text: 'Month Index'
            },
            showgrid: false
        },
        yaxis: {
            title: {
                text: "Flow (L/s)<br><span style='font-size:12px'>x × 10⁻⁶ ML = x µL (micro-liters)</span>",
                standoff: 20     // <-- adds spacing to avoid overlap
            },
            gridcolor: 'rgba(200,200,200,0.15)',
        },

        legend: { orientation: 'h', x: 0, y: 1.12 },
        hovermode: 'x unified'
    };

    return (
        <Plot
            data={traces}
            layout={layout}
            style={{ width: width, height }}
            useResizeHandler
            config={{ displaylogo: false }}
        />
    );
}