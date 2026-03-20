// 'use client';

// import React, { useMemo } from 'react';
// import {
//     LineChart,
//     Line,
//     XAxis,
//     YAxis,
//     CartesianGrid,
//     Tooltip,
//     ResponsiveContainer,
//     Legend,
//     ReferenceLine,
// } from 'recharts';

// // ─── Types ────────────────────────────────────────────────────────────────────

// interface ClippedRaster {
//     year: number;
//     volume_MLD: number;
//     layer_type?: string;
//     season?: string;
// }

// interface RasterResponse {
//     status: string;
//     clipped_rasters: ClippedRaster[];
//     metadata?: {
//         product_type?: string;
//         time_scale?: string;
//         season?: string;
//     };
// }

// interface WaterMLDGraphProps {
//     rasterResponse: RasterResponse | null;
//     timeScale?: string;
//     productType?: string;
// }

// // ─── CSV Download Helper ──────────────────────────────────────────────────────

// const downloadCSV = (
//     data: { year: string; mld: number }[],
//     productType: string,
//     timeScale: string,
//     season?: string
// ) => {
//     const header = ['Year', `${productType} (MLD)`];
//     const rows = data.map(d => [d.year, d.mld.toFixed(4)]);

//     const csvContent = [
//         // Meta info rows
//         [`# Product: ${productType}`],
//         [`# Time Scale: ${timeScale === 'seasonal' ? `Seasonal - ${season ?? ''}` : 'Annual'}`],
//         [`# Exported on: ${new Date().toLocaleDateString('en-IN')}`],
//         [],
//         header,
//         ...rows,
//     ]
//         .map(row => row.join(','))
//         .join('\n');

//     const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
//     const url = URL.createObjectURL(blob);
//     const link = document.createElement('a');
//     link.href = url;
//     link.download = `${productType.replace(/\s+/g, '_')}_MLD_${data[0]?.year}_${data[data.length - 1]?.year}.csv`;
//     link.click();
//     URL.revokeObjectURL(url);
// };

// // ─── Component ────────────────────────────────────────────────────────────────

// const WaterMLDGraph: React.FC<WaterMLDGraphProps> = ({
//     rasterResponse,
//     timeScale = 'yearly',
//     productType = 'Water Budget',
// }) => {

//     const data = useMemo(() => {
//         if (!rasterResponse?.clipped_rasters?.length) return [];
//         return [...rasterResponse.clipped_rasters]
//             .sort((a, b) => a.year - b.year)
//             .map(r => ({
//                 year: String(r.year),
//                 mld: r.volume_MLD,
//             }));
//     }, [rasterResponse]);

//     const avg = useMemo(() =>
//         data.length ? data.reduce((s, d) => s + d.mld, 0) / data.length : null,
//     [data]);

//     if (!rasterResponse || data.length === 0) {
//         return (
//             <div className="bg-white rounded-xl shadow-md p-4 border border-gray-100 flex items-center justify-center h-40 text-gray-400 text-sm">
//                 No data available — process a water raster first.
//             </div>
//         );
//     }

//     return (
//         <div className="bg-white rounded-xl shadow-md p-4 border border-gray-100">

//             {/* ── Header row with title + CSV button ── */}
//             <div className="flex items-start justify-between mb-1">
//                 <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
//                     <span>📊</span>
//                     {productType} — Year-wise MLD
//                 </h3>

//                 <button
//                     onClick={() =>
//                         downloadCSV(
//                             data,
//                             productType,
//                             timeScale,
//                             rasterResponse.metadata?.season
//                         )
//                     }
//                     title="Download data as CSV"
//                     className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
//                                bg-blue-600 text-white hover:bg-blue-700 active:scale-95
//                                transition-all duration-150 shadow-sm whitespace-nowrap"
//                 >
//                     {/* Download icon (inline SVG — no extra dep needed) */}
//                     <svg
//                         xmlns="http://www.w3.org/2000/svg"
//                         className="h-3.5 w-3.5"
//                         viewBox="0 0 20 20"
//                         fill="currentColor"
//                     >
//                         <path
//                             fillRule="evenodd"
//                             d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
//                             clipRule="evenodd"
//                         />
//                     </svg>
//                     Download CSV
//                 </button>
//             </div>

//             <p className="text-xs text-gray-400 mb-4">
//                 {timeScale === 'seasonal'
//                     ? `Seasonal · ${rasterResponse.metadata?.season ?? ''}`
//                     : 'Annual'} · {data[0]?.year}–{data[data.length - 1]?.year}
//             </p>

//             <div className="h-64 w-full">
//                 <ResponsiveContainer width="100%" height="100%">
//                     <LineChart
//                         data={data}
//                         margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
//                     >
//                         <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
//                         <XAxis
//                             dataKey="year"
//                             tick={{ fontSize: 12 }}
//                             stroke="#6b7280"
//                         />
//                         <YAxis
//                             tick={{ fontSize: 12 }}
//                             stroke="#6b7280"
//                             tickFormatter={(v: number) =>
//                                 Math.abs(v) >= 1000
//                                     ? `${(v / 1000).toFixed(1)}k`
//                                     : v.toFixed(1)
//                             }
//                             label={{
//                                 value: 'MLD',
//                                 angle: -90,
//                                 position: 'insideLeft',
//                                 style: { textAnchor: 'middle', fill: '#4b5563' },
//                             }}
//                         />
//                         <Tooltip
//                             contentStyle={{
//                                 backgroundColor: 'rgba(255,255,255,0.97)',
//                                 borderRadius: '8px',
//                                 border: '1px solid #e5e7eb',
//                                 boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
//                             }}
//                             formatter={(value: number) => [
//                                 `${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })} MLD`,
//                                 productType,
//                             ]}
//                         />
//                         <Legend verticalAlign="top" height={36} />

//                         {avg !== null && (
//                             <ReferenceLine
//                                 y={avg}
//                                 stroke="#9ca3af"
//                                 strokeDasharray="5 4"
//                                 label={{
//                                     value: `Avg: ${avg.toFixed(1)}`,
//                                     position: 'insideTopRight',
//                                     fill: '#9ca3af',
//                                     fontSize: 11,
//                                 }}
//                             />
//                         )}

//                         <Line
//                             type="monotone"
//                             dataKey="mld"
//                             name={`${productType} (MLD)`}
//                             stroke="#2563eb"
//                             strokeWidth={3}
//                             dot={{ r: 4, fill: '#2563eb', strokeWidth: 2, stroke: '#fff' }}
//                             activeDot={{ r: 7 }}
//                             animationDuration={1200}
//                         />
//                     </LineChart>
//                 </ResponsiveContainer>
//             </div>

//             {/* Quick stats */}
//             <div className="grid grid-cols-3 gap-2 mt-3">
//                 {[
//                     { label: 'Peak',    value: Math.max(...data.map(d => d.mld)) },
//                     { label: 'Lowest',  value: Math.min(...data.map(d => d.mld)) },
//                     { label: 'Average', value: avg ?? 0 },
//                 ].map(({ label, value }) => (
//                     <div key={label} className="bg-blue-50 rounded-lg px-3 py-2 text-center">
//                         <p className="text-xs text-blue-400 uppercase tracking-wide">{label}</p>
//                         <p className="text-sm font-bold text-blue-700">
//                             {value.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
//                             <span className="text-xs font-normal text-blue-400 ml-1">MLD</span>
//                         </p>
//                     </div>
//                 ))}
//             </div>
//         </div>
//     );
// };

// export default WaterMLDGraph;







// 'use client';

// import React, { useEffect, useRef, useMemo, useCallback } from 'react';
// import Plotly from 'plotly.js-dist-min';

// // ─── Types ────────────────────────────────────────────────────────────────────

// interface ClippedRaster {
//     year: number;
//     volume_MLD: number;
//     layer_type?: string;
//     season?: string;
// }

// interface RasterResponse {
//     status: string;
//     clipped_rasters: ClippedRaster[];
//     metadata?: {
//         product_type?: string;
//         time_scale?: string;
//         season?: string;
//     };
// }

// interface WaterMLDGraphProps {
//     rasterResponse: RasterResponse | null;
//     timeScale?: string;
//     productType?: string;
// }

// // ─── CSV Download Helper ──────────────────────────────────────────────────────

// const downloadCSV = (
//     data: { year: string; mld: number }[],
//     productType: string,
//     timeScale: string,
//     season?: string
// ) => {
//     const metaLines = [
//         `Product: ${productType}`,
//         `Time Scale: ${timeScale === 'seasonal' ? `Seasonal - ${season ?? ''}` : 'Annual'}`,
//         `Exported on: ${new Date().toLocaleDateString('en-IN')}`,
//         `Range: ${data[0]?.year} - ${data[data.length - 1]?.year}`,
//         '',
//     ];
//     const header = `Year,${productType} (MLD)`;
//     const rows = data.map(d => `${d.year},${d.mld.toFixed(4)}`);

//     const blob = new Blob(
//         [[...metaLines, header, ...rows].join('\n')],
//         { type: 'text/csv;charset=utf-8;' }
//     );
//     const url = URL.createObjectURL(blob);
//     const a = document.createElement('a');
//     a.href = url;
//     a.download = `${productType.replace(/\s+/g, '_')}_MLD_${data[0]?.year}_${data[data.length - 1]?.year}.csv`;
//     a.click();
//     URL.revokeObjectURL(url);
// };

// // ─── Component ────────────────────────────────────────────────────────────────

// const WaterMLDGraph: React.FC<WaterMLDGraphProps> = ({
//     rasterResponse,
//     timeScale = 'yearly',
//     productType = 'Water Budget',
// }) => {
//     const plotRef = useRef<HTMLDivElement>(null);

//     const data = useMemo(() => {
//         if (!rasterResponse?.clipped_rasters?.length) return [];
//         return [...rasterResponse.clipped_rasters]
//             .sort((a, b) => a.year - b.year)
//             .map(r => ({ year: String(r.year), mld: r.volume_MLD }));
//     }, [rasterResponse]);

//     const avg = useMemo(() =>
//         data.length ? data.reduce((s, d) => s + d.mld, 0) / data.length : null,
//     [data]);

//     // ── Build & render Plotly chart ──────────────────────────────────────────
//     useEffect(() => {
//         if (!plotRef.current || data.length === 0) return;

//         const years = data.map(d => d.year);
//         const mlds  = data.map(d => d.mld);

//         const trace: Plotly.Data = {
//             x: years,
//             y: mlds,
//             type: 'scatter',
//             mode: 'lines+markers',
//             name: `${productType} (MLD)`,
//             line: { color: '#2563eb', width: 3, shape: 'spline' },
//             marker: {
//                 size: 7,
//                 color: '#2563eb',
//                 line: { color: '#ffffff', width: 2 },
//             },
//             hovertemplate:
//                 '<b>Year:</b> %{x}<br>' +
//                 '<b>Volume:</b> %{y:,.2f} MLD<extra></extra>',
//         };

//         const avgShape: Partial<Plotly.Shape> = avg !== null ? {
//             type: 'line',
//             x0: years[0],
//             x1: years[years.length - 1],
//             y0: avg,
//             y1: avg,
//             line: { color: '#9ca3af', width: 1.5, dash: 'dash' },
//         } : {} as Partial<Plotly.Shape>;

//         const layout: Partial<Plotly.Layout> = {
//             paper_bgcolor: 'rgba(0,0,0,0)',
//             plot_bgcolor: 'rgba(0,0,0,0)',
//             font: { family: 'IBM Plex Sans, sans-serif', color: '#374151' },
//             margin: { t: 20, r: 20, b: 70, l: 60 },
//             xaxis: {
//                 title: { text: 'Year', font: { size: 12 } },
//                 showgrid: true,
//                 gridcolor: '#f3f4f6',
//                 tickfont: { size: 12 },
//                 zeroline: false,
//             },
//             yaxis: {
//                 title: { text: 'Volume (MLD)', font: { size: 12 } },
//                 showgrid: true,
//                 gridcolor: '#f3f4f6',
//                 tickfont: { size: 12 },
//                 zeroline: false,
//             },
//             shapes: avg !== null ? [avgShape as Plotly.Shape] : [],
//             annotations: avg !== null ? [{
//                 x: years[years.length - 1],
//                 y: avg,
//                 xanchor: 'right',
//                 yanchor: 'bottom',
//                 text: `Avg: ${avg.toFixed(1)} MLD`,
//                 showarrow: false,
//                 font: { size: 10, color: '#9ca3af' },
//             }] : [],
//             showlegend: true,
//             legend: { orientation: 'h', y: -0.28, x: 0.5, xanchor: 'center' },
//         };

//         const config: Partial<Plotly.Config> = {
//             responsive: true,
//             displayModeBar: true,
//             modeBarButtonsToRemove: ['select2d', 'lasso2d', 'autoScale2d'],
//             modeBarButtonsToAdd: [
//                 // ── Plotly built-in image download tool ──────────────────
//                 // {
//                 //     name: 'Download PNG',
//                 //     icon: Plotly.Icons.camera,
//                 //     click: (gd: Plotly.PlotlyHTMLElement) => {
//                 //         Plotly.downloadImage(gd, {
//                 //             format: 'png',
//                 //             width: 1200,
//                 //             height: 600,
//                 //             filename: `${productType.replace(/\s+/g, '_')}_MLD_chart`,
//                 //         });
//                 //     },
//                 // },
//             ],
//             toImageButtonOptions: {
//                 format: 'png',
//                 filename: `${productType.replace(/\s+/g, '_')}_chart`,
//                 width: 1200,
//                 height: 600,
//             },
//             displaylogo: false,
//         };

//         Plotly.newPlot(plotRef.current, [trace], layout, config);

//         return () => {
//             if (plotRef.current) Plotly.purge(plotRef.current);
//         };
//     }, [data, avg, productType]);

//     // ── CSV handler ──────────────────────────────────────────────────────────
//     const handleCSVDownload = useCallback(() => {
//         downloadCSV(data, productType, timeScale, rasterResponse?.metadata?.season);
//     }, [data, productType, timeScale, rasterResponse]);

//     // ── Empty state ──────────────────────────────────────────────────────────
//     if (!rasterResponse || data.length === 0) {
//         return (
//             <div className="bg-white rounded-xl shadow-md p-4 border border-gray-100 flex items-center justify-center h-40 text-gray-400 text-sm">
//                 No data available — process a water raster first.
//             </div>
//         );
//     }

//     return (
//         <div className="bg-white rounded-xl shadow-md p-4 border border-gray-100">

//             {/* ── Header ── */}
//             <div className="flex items-start justify-between mb-1">
//                 <div>
//                     <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
//                         <span>📊</span>
//                         {productType} — Year-wise MLD
//                     </h3>
//                     <p className="text-xs text-gray-400 mt-0.5">
//                         {timeScale === 'seasonal'
//                             ? `Seasonal · ${rasterResponse.metadata?.season ?? ''}`
//                             : 'Annual'} · {data[0]?.year}–{data[data.length - 1]?.year}
//                     </p>
//                 </div>

//                 {/* ── CSV Download Button ── */}
//                 <button
//                     onClick={handleCSVDownload}
//                     title="Download data as CSV"
//                     className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer
//                                bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95
//                                transition-all duration-150 shadow-sm whitespace-nowrap"
//                 >
//                     <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
//                         <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
//                     </svg>
//                     Download CSV
//                 </button>
//             </div>

//             {/* ── Plotly chart container ── */}
//             <div ref={plotRef} className="w-full h-64 mt-2" />

//             {/* ── Quick stats ── */}
//             <div className="grid grid-cols-3 gap-2 mt-3">
//                 {[
//                     { label: 'Peak',    value: Math.max(...data.map(d => d.mld)) },
//                     { label: 'Lowest',  value: Math.min(...data.map(d => d.mld)) },
//                     { label: 'Average', value: avg ?? 0 },
//                 ].map(({ label, value }) => (
//                     <div key={label} className="bg-blue-50 rounded-lg px-3 py-2 text-center">
//                         <p className="text-xs text-blue-400 uppercase tracking-wide">{label}</p>
//                         <p className="text-sm font-bold text-blue-700">
//                             {value.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
//                             <span className="text-xs font-normal text-blue-400 ml-1">MLD</span>
//                         </p>
//                     </div>
//                 ))}
//             </div>

            
//         </div>
//     );
// };

// export default WaterMLDGraph;











// 'use client';

// import React, { useEffect, useRef, useMemo, useCallback } from 'react';
// import Plotly from 'plotly.js-dist-min';

// // ─── Types ────────────────────────────────────────────────────────────────────

// interface ClippedRaster {
//     year: number;
//     volume_MLD: number;
//     layer_type?: string;
//     season?: string;
// }

// interface RasterResponse {
//     status: string;
//     clipped_rasters: ClippedRaster[];
//     metadata?: {
//         product_type?: string;
//         time_scale?: string;
//         season?: string;
//     };
// }

// interface WaterMLDGraphProps {
//     rasterResponse: RasterResponse | null;
//     timeScale?: string;
//     productType?: string;
// }

// // ─── CSV Download Helper ──────────────────────────────────────────────────────

// const downloadCSV = (
//     data: { year: string; mld: number }[],
//     productType: string,
//     timeScale: string,
//     season?: string
// ) => {
//     const metaLines = [
//         `Product: ${productType}`,
//         `Time Scale: ${timeScale === 'seasonal' ? `Seasonal - ${season ?? ''}` : 'Annual'}`,
//         `Exported on: ${new Date().toLocaleDateString('en-IN')}`,
//         `Range: ${data[0]?.year} - ${data[data.length - 1]?.year}`,
//         '',
//     ];
//     const header = `Year,${productType} (MLD)`;
//     const rows = data.map(d => `${d.year},${d.mld.toFixed(4)}`);

//     const blob = new Blob(
//         [[...metaLines, header, ...rows].join('\n')],
//         { type: 'text/csv;charset=utf-8;' }
//     );
//     const url = URL.createObjectURL(blob);
//     const a = document.createElement('a');
//     a.href = url;
//     a.download = `${productType.replace(/\s+/g, '_')}_MLD_${data[0]?.year}_${data[data.length - 1]?.year}.csv`;
//     a.click();
//     URL.revokeObjectURL(url);
// };

// // ─── Component ────────────────────────────────────────────────────────────────

// const WaterMLDGraph: React.FC<WaterMLDGraphProps> = ({
//     rasterResponse,
//     timeScale = 'yearly',
//     productType = 'Water Budget',
// }) => {
//     const plotRef = useRef<HTMLDivElement>(null);

//     const data = useMemo(() => {
//         if (!rasterResponse?.clipped_rasters?.length) return [];
//         return [...rasterResponse.clipped_rasters]
//             .sort((a, b) => a.year - b.year)
//             .map(r => ({ year: String(r.year), mld: r.volume_MLD }));
//     }, [rasterResponse]);

//     const avg = useMemo(() =>
//         data.length ? data.reduce((s, d) => s + d.mld, 0) / data.length : null,
//     [data]);

//     // ── Build & render Plotly chart ──────────────────────────────────────────
//     useEffect(() => {
//         if (!plotRef.current || data.length === 0) return;

//         const years = data.map(d => d.year);
//         const mlds  = data.map(d => d.mld);

//         const trace: Plotly.Data = {
//             x: years,
//             y: mlds,
//             type: 'scatter',
//             mode: 'lines+markers',
//             name: `${productType} (MLD)`,
//             line: { color: '#2563eb', width: 3, shape: 'spline' },
//             marker: {
//                 size: 7,
//                 color: '#2563eb',
//                 line: { color: '#ffffff', width: 2 },
//             },
//             hovertemplate:
//                 '<b>Year:</b> %{x}<br>' +
//                 '<b>Volume:</b> %{y:,.2f} MLD<extra></extra>',
//         };

//         const avgShape: Partial<Plotly.Shape> = avg !== null ? {
//             type: 'line',
//             x0: years[0],
//             x1: years[years.length - 1],
//             y0: avg,
//             y1: avg,
//             line: { color: '#9ca3af', width: 1.5, dash: 'dash' },
//         } : {} as Partial<Plotly.Shape>;

//         const layout: Partial<Plotly.Layout> = {
//             paper_bgcolor: 'rgba(0,0,0,0)',
//             plot_bgcolor: 'rgba(0,0,0,0)',
//             font: { family: 'IBM Plex Sans, sans-serif', color: '#374151' },
//             margin: { t: 20, r: 20, b: 70, l: 60 },
//             xaxis: {
//                 title: { text: 'Year', font: { size: 12 } },
//                 showgrid: true,
//                 gridcolor: '#e5e7eb',
//                 tickfont: { size: 12 },
//                 zeroline: false,
//             },
//             yaxis: {
//                 title: { text: 'Volume (MLD)', font: { size: 12 } },
//                 showgrid: true,
//                 gridcolor: '#e5e7eb',
//                 tickfont: { size: 12 },
//                 zeroline: false,
//             },
//             shapes: avg !== null ? [avgShape as Plotly.Shape] : [],
//             annotations: avg !== null ? [{
//                 x: years[years.length - 1],
//                 y: avg,
//                 xanchor: 'right',
//                 yanchor: 'bottom',
//                 text: `Avg: ${avg.toFixed(1)} MLD`,
//                 showarrow: false,
//                 font: { size: 10, color: '#9ca3af' },
//             }] : [],
//             showlegend: true,
//             legend: { orientation: 'h', y: -0.28, x: 0.5, xanchor: 'center' },
//         };

//         const config: Partial<Plotly.Config> = {
//             responsive: true,
//             displayModeBar: true,
//             // Remove default 'toImage' button and replace with our custom one
//             modeBarButtonsToRemove: ['select2d', 'lasso2d', 'autoScale2d', 'toImage'],
//             modeBarButtonsToAdd: [
//                 {
//                     name: 'Download PNG',
//                     title: 'Download PNG' as any,
//                     icon: Plotly.Icons.camera,
//                     click: async (gd: Plotly.PlotlyHTMLElement) => {
//                         // Step 1: Temporarily apply white background so grid lines are visible
//                         await Plotly.relayout(gd, {
//                             'paper_bgcolor': '#ffffff',
//                             'plot_bgcolor': '#ffffff',
//                         });

//                         // Step 2: Export the image with white background
//                         await Plotly.downloadImage(gd, {
//                             format: 'png',
//                             width: 1200,
//                             height: 600,
//                             filename: `${productType.replace(/\s+/g, '_')}_MLD_chart`,
//                         });

//                         // Step 3: Restore transparent background
//                         await Plotly.relayout(gd, {
//                             'paper_bgcolor': 'rgba(0,0,0,0)',
//                             'plot_bgcolor': 'rgba(0,0,0,0)',
//                         });
//                     },
//                 },
//             ],
//             displaylogo: false,
//         };

//         Plotly.newPlot(plotRef.current, [trace], layout, config);

//         return () => {
//             if (plotRef.current) Plotly.purge(plotRef.current);
//         };
//     }, [data, avg, productType]);

//     // ── CSV handler ──────────────────────────────────────────────────────────
//     const handleCSVDownload = useCallback(() => {
//         downloadCSV(data, productType, timeScale, rasterResponse?.metadata?.season);
//     }, [data, productType, timeScale, rasterResponse]);

//     // ── Empty state ──────────────────────────────────────────────────────────
//     if (!rasterResponse || data.length === 0) {
//         return (
//             <div className="bg-white rounded-xl shadow-md p-4 border border-gray-100 flex items-center justify-center h-40 text-gray-400 text-sm">
//                 No data available — process a water raster first.
//             </div>
//         );
//     }

//     return (
//         <div className="bg-white rounded-xl shadow-md p-4 border border-gray-100">

//             {/* ── Header ── */}
//             <div className="flex items-start justify-between mb-1">
//                 <div>
//                     <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
//                         <span>📊</span>
//                         {productType} — Year-wise MLD
//                     </h3>
//                     <p className="text-xs text-gray-400 mt-0.5">
//                         {timeScale === 'seasonal'
//                             ? `Seasonal · ${rasterResponse.metadata?.season ?? ''}`
//                             : 'Annual'} · {data[0]?.year}–{data[data.length - 1]?.year}
//                     </p>
//                 </div>

//                 {/* ── CSV Download Button ── */}
//                 <button
//                     onClick={handleCSVDownload}
//                     title="Download data as CSV"
//                     className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer
//                                bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95
//                                transition-all duration-150 shadow-sm whitespace-nowrap"
//                 >
//                     <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
//                         <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
//                     </svg>
//                     Download CSV
//                 </button>
//             </div>

//             {/* ── Plotly chart container ── */}
//             <div ref={plotRef} className="w-full h-64 mt-2" />

//             {/* ── Quick stats ── */}
//             <div className="grid grid-cols-3 gap-2 mt-3">
//                 {[
//                     { label: 'Peak',    value: Math.max(...data.map(d => d.mld)) },
//                     { label: 'Lowest',  value: Math.min(...data.map(d => d.mld)) },
//                     { label: 'Average', value: avg ?? 0 },
//                 ].map(({ label, value }) => (
//                     <div key={label} className="bg-blue-50 rounded-lg px-3 py-2 text-center">
//                         <p className="text-xs text-blue-400 uppercase tracking-wide">{label}</p>
//                         <p className="text-sm font-bold text-blue-700">
//                             {value.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
//                             <span className="text-xs font-normal text-blue-400 ml-1">MLD</span>
//                         </p>
//                     </div>
//                 ))}
//             </div>

            
//         </div>
//     );
// };

// export default WaterMLDGraph;











// 'use client';

// import React, { useEffect, useRef, useMemo, useCallback } from 'react';
// import Plotly from 'plotly.js-dist-min';

// // ─── Types ────────────────────────────────────────────────────────────────────

// interface ClippedRaster {
//     year: number;
//     volume_MLD: number;
//     layer_type?: string;
//     season?: string;
// }

// interface RasterResponse {
//     status: string;
//     clipped_rasters: ClippedRaster[];
//     metadata?: {
//         product_type?: string;
//         time_scale?: string;
//         season?: string;
//     };
// }

// interface WaterMLDGraphProps {
//     rasterResponse: RasterResponse | null;
//     timeScale?: string;
//     productType?: string;
// }

// // ─── CSV Download Helper ──────────────────────────────────────────────────────

// const downloadCSV = (
//     data: { year: string; mld: number }[],
//     productType: string,
//     timeScale: string,
//     season?: string
// ) => {
//     const metaLines = [
//         `Product: ${productType}`,
//         `Time Scale: ${timeScale === 'seasonal' ? `Seasonal - ${season ?? ''}` : 'Annual'}`,
//         `Exported on: ${new Date().toLocaleDateString('en-IN')}`,
//         `Range: ${data[0]?.year} - ${data[data.length - 1]?.year}`,
//         '',
//     ];
//     const header = `Year,${productType} (MLD)`;
//     const rows = data.map(d => `${d.year},${d.mld.toFixed(4)}`);

//     const blob = new Blob(
//         [[...metaLines, header, ...rows].join('\n')],
//         { type: 'text/csv;charset=utf-8;' }
//     );
//     const url = URL.createObjectURL(blob);
//     const a = document.createElement('a');
//     a.href = url;
//     a.download = `${productType.replace(/\s+/g, '_')}_MLD_${data[0]?.year}_${data[data.length - 1]?.year}.csv`;
//     a.click();
//     URL.revokeObjectURL(url);
// };

// // ─── Component ────────────────────────────────────────────────────────────────

// const WaterMLDGraph: React.FC<WaterMLDGraphProps> = ({
//     rasterResponse,
//     timeScale = 'yearly',
//     productType = 'Water Budget',
// }) => {
//     const plotRef = useRef<HTMLDivElement>(null);

//     const data = useMemo(() => {
//         if (!rasterResponse?.clipped_rasters?.length) return [];
//         return [...rasterResponse.clipped_rasters]
//             .sort((a, b) => a.year - b.year)
//             .map(r => ({ year: String(r.year), mld: r.volume_MLD }));
//     }, [rasterResponse]);

//     const avg = useMemo(() =>
//         data.length ? data.reduce((s, d) => s + d.mld, 0) / data.length : null,
//     [data]);

//     const peakVal   = useMemo(() => data.length ? Math.max(...data.map(d => d.mld)) : 0, [data]);
//     const lowestVal = useMemo(() => data.length ? Math.min(...data.map(d => d.mld)) : 0, [data]);
//     const peakYear   = useMemo(() => data.find(d => d.mld === peakVal)?.year,   [data, peakVal]);
//     const lowestYear = useMemo(() => data.find(d => d.mld === lowestVal)?.year, [data, lowestVal]);

//     // ── Build & render Plotly chart ──────────────────────────────────────────
//     useEffect(() => {
//         if (!plotRef.current || data.length === 0) return;

//         const years = data.map(d => d.year);
//         const mlds  = data.map(d => d.mld);

//         const trace: Plotly.Data = {
//             x: years,
//             y: mlds,
//             type: 'scatter',
//             mode: 'lines+markers',
//             name: `${productType} (MLD)`,
//             line: { color: '#2563eb', width: 3, shape: 'spline' },
//             marker: {
//                 size: mlds.map(v =>
//                     v === peakVal   ? 12 :
//                     v === lowestVal ? 12 : 7
//                 ),
//                 color: mlds.map(v =>
//                     v === peakVal   ? '#2563eb' :
//                     v === lowestVal ? '#dc2626' : '#2563eb'
//                 ),
//                 line: { color: '#ffffff', width: 2 },
//             },
//             hovertemplate:
//                 '<b>Year:</b> %{x}<br>' +
//                 '<b>Volume:</b> %{y:,.2f} MLD<extra></extra>',
//         };

//         const avgShape: Partial<Plotly.Shape> = avg !== null ? {
//             type: 'line',
//             x0: years[0],
//             x1: years[years.length - 1],
//             y0: avg,
//             y1: avg,
//             line: { color: '#16a34a', width: 1.5, dash: 'dash' },
//         } : {} as Partial<Plotly.Shape>;

//         const layout: Partial<Plotly.Layout> = {
//             paper_bgcolor: 'rgba(0,0,0,0)',
//             plot_bgcolor:  'rgba(0,0,0,0)',
//             font: { family: 'IBM Plex Sans, sans-serif', color: '#374151' },
//             margin: { t: 20, r: 20, b: 70, l: 60 },
//             xaxis: {
//                 title: { text: 'Year', font: { size: 12 } },
//                 showgrid: true,
//                 gridcolor: '#e5e7eb',
//                 tickfont:  { size: 12 },
//                 zeroline:  false,
//             },
//             yaxis: {
//                 title: { text: 'Volume (MLD)', font: { size: 12 } },
//                 showgrid: true,
//                 gridcolor: '#e5e7eb',
//                 tickfont:  { size: 12 },
//                 zeroline:  false,
//             },
//             shapes: avg !== null ? [avgShape as Plotly.Shape] : [],
//             annotations: [
//                 // Avg label
//                 ...(avg !== null ? [{
//                     x: years[years.length - 1],
//                     y: avg,
//                     xanchor: 'right' as const,
//                     yanchor: 'bottom' as const,
//                     text: `Avg: ${avg.toFixed(1)} MLD`,
//                     showarrow: false,
//                     font: { size: 10, color: '#16a34a' },
//                 }] : []),
//                 // Peak annotation
//                 ...(peakYear ? [{
//                     x: peakYear,
//                     y: peakVal,
//                     xanchor: 'center' as const,
//                     yanchor: 'bottom' as const,
//                     text: `▲ Peak`,
//                     showarrow: false,
//                     font: { size: 9, color: '#2563eb' },
//                     yshift: 6,
//                 }] : []),
//                 // Lowest annotation
//                 ...(lowestYear ? [{
//                     x: lowestYear,
//                     y: lowestVal,
//                     xanchor: 'center' as const,
//                     yanchor: 'top' as const,
//                     text: `▼ Lowest`,
//                     showarrow: false,
//                     font: { size: 9, color: '#dc2626' },
//                     yshift: -6,
//                 }] : []),
//             ],
//             showlegend: true,
//             legend: { orientation: 'h', y: -0.28, x: 0.5, xanchor: 'center' },
//         };

//         const config: Partial<Plotly.Config> = {
//             responsive: true,
//             displayModeBar: true,
//             modeBarButtonsToRemove: ['select2d', 'lasso2d', 'autoScale2d', 'toImage'],
//             modeBarButtonsToAdd: [
//                 {
//                     name:  'Download PNG',
//                     title: 'Download PNG' as any,
//                     icon:  Plotly.Icons.camera,
//                     click: async (gd: Plotly.PlotlyHTMLElement) => {
//                         await Plotly.relayout(gd, {
//                             'paper_bgcolor': '#ffffff',
//                             'plot_bgcolor':  '#ffffff',
//                         });
//                         await Plotly.downloadImage(gd, {
//                             format:   'png',
//                             width:    1200,
//                             height:   600,
//                             filename: `${productType.replace(/\s+/g, '_')}_MLD_chart`,
//                         });
//                         await Plotly.relayout(gd, {
//                             'paper_bgcolor': 'rgba(0,0,0,0)',
//                             'plot_bgcolor':  'rgba(0,0,0,0)',
//                         });
//                     },
//                 },
//             ],
//             displaylogo: false,
//         };

//         Plotly.newPlot(plotRef.current, [trace], layout, config);

//         return () => {
//             if (plotRef.current) Plotly.purge(plotRef.current);
//         };
//     }, [data, avg, productType, peakVal, lowestVal, peakYear, lowestYear]);

//     // ── CSV handler ──────────────────────────────────────────────────────────
//     const handleCSVDownload = useCallback(() => {
//         downloadCSV(data, productType, timeScale, rasterResponse?.metadata?.season);
//     }, [data, productType, timeScale, rasterResponse]);

//     // ── Empty state ──────────────────────────────────────────────────────────
//     if (!rasterResponse || data.length === 0) {
//         return (
//             <div className="bg-white rounded-xl shadow-md p-4 border border-gray-100 flex items-center justify-center h-40 text-gray-400 text-sm">
//                 No data available — process a water raster first.
//             </div>
//         );
//     }

//     return (
//         <div className="bg-white rounded-xl shadow-md p-4 border border-gray-100">

//             {/* ── Header ── */}
//             <div className="flex items-start justify-between mb-1">
//                 <div>
//                     <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
//                         <span>📊</span>
//                         {productType} — Year-wise MLD
//                     </h3>
//                     <p className="text-xs text-gray-400 mt-0.5">
//                         {timeScale === 'seasonal'
//                             ? `Seasonal · ${rasterResponse.metadata?.season ?? ''}`
//                             : 'Annual'
//                         } · {data[0]?.year}–{data[data.length - 1]?.year}
//                     </p>
//                 </div>

//                 {/* ── CSV Download Button ── */}
//                 <button
//                     onClick={handleCSVDownload}
//                     title="Download data as CSV"
//                     className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer
//                                bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95
//                                transition-all duration-150 shadow-sm whitespace-nowrap"
//                 >
//                     <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
//                         <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
//                     </svg>
//                     Download CSV
//                 </button>
//             </div>

//             {/* ── Plotly chart container ── */}
//             <div ref={plotRef} className="w-full h-64 mt-2" />

//             {/* ── Quick stats ── */}
//             <div className="grid grid-cols-3 gap-2 mt-3">
//                 {[
//                     {
//                         label:      'Peak',
//                         value:      peakVal,
//                         year:       peakYear,
//                         bg:         'bg-blue-50',
//                         border:     'border-blue-300',
//                         labelColor: 'text-blue-500',
//                         valueColor: 'text-blue-700',
//                         unitColor:  'text-blue-400',
//                         dot:        'bg-blue-500',
//                     },
//                     {
//                         label:      'Lowest',
//                         value:      lowestVal,
//                         year:       lowestYear,
//                         bg:         'bg-red-50',
//                         border:     'border-red-300',
//                         labelColor: 'text-red-500',
//                         valueColor: 'text-red-700',
//                         unitColor:  'text-red-400',
//                         dot:        'bg-red-500',
//                     },
//                     {
//                         label:      'Average',
//                         value:      avg ?? 0,
//                         year:       undefined,
//                         bg:         'bg-green-50',
//                         border:     'border-green-300',
//                         labelColor: 'text-green-500',
//                         valueColor: 'text-green-700',
//                         unitColor:  'text-green-400',
//                         dot:        'bg-green-500',
//                     },
//                 ].map(({ label, value, year, bg, border, labelColor, valueColor, unitColor, dot }) => (
//                     <div key={label} className={`${bg} border ${border} rounded-lg px-3 py-2 text-center`}>
//                         <div className="flex items-center justify-center gap-1.5 mb-1">
//                             <span className={`inline-block w-2 h-2 rounded-full ${dot}`} />
//                             <p className={`text-xs font-semibold uppercase tracking-wide ${labelColor}`}>
//                                 {label}
//                             </p>
//                         </div>
//                         <p className={`text-sm font-bold ${valueColor}`}>
//                             {value.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
//                             <span className={`text-xs font-normal ${unitColor} ml-1`}>MLD</span>
//                         </p>
//                         {year && (
//                             <p className={`text-xs ${labelColor} mt-0.5`}>({year})</p>
//                         )}
//                     </div>
//                 ))}
//             </div>
//         </div>
//     );
// };

// export default WaterMLDGraph;












'use client';

import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import Plotly from 'plotly.js-dist-min';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClippedRaster {
    year: number;
    volume_MLD: number;
    layer_type?: string;
    season?: string;
}

interface RasterResponse {
    status: string;
    clipped_rasters: ClippedRaster[];
    metadata?: {
        product_type?: string;
        time_scale?: string;
        season?: string;
    };
}

interface WaterMLDGraphProps {
    rasterResponse: RasterResponse | null;
    timeScale?: string;
    productType?: string;
}

// ─── CSV Download Helper ──────────────────────────────────────────────────────

const downloadCSV = (
    data: { year: string; mld: number }[],
    productType: string,
    timeScale: string,
    season?: string
) => {
    const metaLines = [
        `Product: ${productType}`,
        `Time Scale: ${timeScale === 'seasonal' ? `Seasonal - ${season ?? ''}` : 'Annual'}`,
        `Exported on: ${new Date().toLocaleDateString('en-IN')}`,
        `Range: ${data[0]?.year} - ${data[data.length - 1]?.year}`,
        '',
    ];
    const header = `Year,${productType} (MLD)`;
    const rows = data.map(d => `${d.year},${d.mld.toFixed(4)}`);

    const blob = new Blob(
        [[...metaLines, header, ...rows].join('\n')],
        { type: 'text/csv;charset=utf-8;' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${productType.replace(/\s+/g, '_')}_MLD_${data[0]?.year}_${data[data.length - 1]?.year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
};

// ─── Component ────────────────────────────────────────────────────────────────

const WaterMLDGraph: React.FC<WaterMLDGraphProps> = ({
    rasterResponse,
    timeScale = 'yearly',
    productType = 'Water Budget',
}) => {
    const plotRef = useRef<HTMLDivElement>(null);

    const data = useMemo(() => {
        if (!rasterResponse?.clipped_rasters?.length) return [];
        return [...rasterResponse.clipped_rasters]
            .sort((a, b) => a.year - b.year)
            .map(r => ({ year: String(r.year), mld: r.volume_MLD }));
    }, [rasterResponse]);

    const avg = useMemo(() =>
        data.length ? data.reduce((s, d) => s + d.mld, 0) / data.length : null,
    [data]);

    const peakVal    = useMemo(() => data.length ? Math.max(...data.map(d => d.mld)) : 0, [data]);
    const lowestVal  = useMemo(() => data.length ? Math.min(...data.map(d => d.mld)) : 0, [data]);
    const peakYear   = useMemo(() => data.find(d => d.mld === peakVal)?.year,   [data, peakVal]);
    const lowestYear = useMemo(() => data.find(d => d.mld === lowestVal)?.year, [data, lowestVal]);

    // ── Build & render Plotly chart ──────────────────────────────────────────
    useEffect(() => {
        if (!plotRef.current || data.length === 0) return;

        const years = data.map(d => d.year);
        const mlds  = data.map(d => d.mld);

        // ── AREA CHART TRACE (only change from original) ──────────────────
        const trace: Plotly.Data = {
            x: years,
            y: mlds,
            type: 'scatter',
            mode: 'lines+markers',
            name: `${productType} (MLD)`,
            // Area fill to zero on y-axis
            fill: 'tozeroy',
            fillcolor: 'rgba(37,99,235,0.10)',
            line: { color: '#2563eb', width: 2.5, shape: 'spline' },
            marker: {
                size: mlds.map(v =>
                    v === peakVal   ? 12 :
                    v === lowestVal ? 12 : 7
                ),
                color: mlds.map(v =>
                    v === peakVal   ? '#2563eb' :
                    v === lowestVal ? '#dc2626' : '#2563eb'
                ),
                line: { color: '#ffffff', width: 2 },
            },
            hovertemplate:
                '<b>Year:</b> %{x}<br>' +
                '<b>Volume:</b> %{y:,.2f} MLD<extra></extra>',
        };

        const avgShape: Partial<Plotly.Shape> = avg !== null ? {
            type: 'line',
            x0: years[0],
            x1: years[years.length - 1],
            y0: avg,
            y1: avg,
            line: { color: '#16a34a', width: 1.5, dash: 'dash' },
        } : {} as Partial<Plotly.Shape>;

        const layout: Partial<Plotly.Layout> = {
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor:  'rgba(0,0,0,0)',
            font: { family: 'IBM Plex Sans, sans-serif', color: '#374151' },
            margin: { t: 20, r: 20, b: 70, l: 60 },
            xaxis: {
    title: { text: 'Year', font: { size: 12 } },
    showgrid: true,
    gridcolor: '#e5e7eb',
    tickfont:  { size: 12 },
    zeroline:  false,
    tickmode: 'array',
    tickvals: years.map(Number),
    ticktext: years,
    dtick: 1,
},
            yaxis: {
                title: { text: 'Volume (MLD)', font: { size: 12 } },
                showgrid: true,
                gridcolor: '#e5e7eb',
                tickfont:  { size: 12 },
                zeroline:  false,
                // Start y-axis from 0 so the fill looks correct
                rangemode: 'tozero',
            },
            shapes: avg !== null ? [avgShape as Plotly.Shape] : [],
            annotations: [
                // Avg label
                ...(avg !== null ? [{
                    x: years[years.length - 1],
                    y: avg,
                    xanchor: 'right' as const,
                    yanchor: 'bottom' as const,
                    text: `Avg: ${avg.toFixed(1)} MLD`,
                    showarrow: false,
                    font: { size: 10, color: '#16a34a' },
                }] : []),
                // Peak annotation
                ...(peakYear ? [{
                    x: peakYear,
                    y: peakVal,
                    xanchor: 'center' as const,
                    yanchor: 'bottom' as const,
                    text: `▲ Peak`,
                    showarrow: false,
                    font: { size: 9, color: '#2563eb' },
                    yshift: 6,
                }] : []),
                // Lowest annotation
                ...(lowestYear ? [{
                    x: lowestYear,
                    y: lowestVal,
                    xanchor: 'center' as const,
                    yanchor: 'top' as const,
                    text: `▼ Lowest`,
                    showarrow: false,
                    font: { size: 9, color: '#dc2626' },
                    yshift: -6,
                }] : []),
            ],
            showlegend: true,
            legend: { orientation: 'h', y: -0.28, x: 0.5, xanchor: 'center' },
        };

        const config: Partial<Plotly.Config> = {
            responsive: true,
            displayModeBar: true,
            modeBarButtonsToRemove: ['select2d', 'lasso2d', 'autoScale2d', 'toImage'],
            modeBarButtonsToAdd: [
                {
                    name:  'Download PNG',
                    title: 'Download PNG' as any,
                    icon:  Plotly.Icons.camera,
                    click: async (gd: Plotly.PlotlyHTMLElement) => {
                        await Plotly.relayout(gd, {
                            'paper_bgcolor': '#ffffff',
                            'plot_bgcolor':  '#ffffff',
                        });
                        await Plotly.downloadImage(gd, {
                            format:   'png',
                            width:    1200,
                            height:   600,
                            filename: `${productType.replace(/\s+/g, '_')}_MLD_chart`,
                        });
                        await Plotly.relayout(gd, {
                            'paper_bgcolor': 'rgba(0,0,0,0)',
                            'plot_bgcolor':  'rgba(0,0,0,0)',
                        });
                    },
                },
            ],
            displaylogo: false,
        };

        Plotly.newPlot(plotRef.current, [trace], layout, config);

        return () => {
            if (plotRef.current) Plotly.purge(plotRef.current);
        };
    }, [data, avg, productType, peakVal, lowestVal, peakYear, lowestYear]);

    // ── CSV handler ──────────────────────────────────────────────────────────
    const handleCSVDownload = useCallback(() => {
        downloadCSV(data, productType, timeScale, rasterResponse?.metadata?.season);
    }, [data, productType, timeScale, rasterResponse]);

    // ── Empty state ──────────────────────────────────────────────────────────
    if (!rasterResponse || data.length === 0) {
        return (
            <div className="bg-white rounded-xl shadow-md p-4 border border-gray-100 flex items-center justify-center h-40 text-gray-400 text-sm">
                No data available — process a water raster first.
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl shadow-md p-4 border border-gray-100">

            {/* ── Header ── */}
            <div className="flex items-start justify-between mb-1">
                <div>
                    <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                        <span>📊</span>
                        {productType} — Year-wise MLD
                    </h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                        {timeScale === 'seasonal'
                            ? `Seasonal · ${rasterResponse.metadata?.season ?? ''}`
                            : 'Annual'
                        } · {data[0]?.year}–{data[data.length - 1]?.year}
                    </p>
                </div>

                {/* ── CSV Download Button ── */}
                <button
                    onClick={handleCSVDownload}
                    title="Download data as CSV"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer
                               bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95
                               transition-all duration-150 shadow-sm whitespace-nowrap"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                    Download CSV
                </button>
            </div>

            {/* ── Plotly chart container ── */}
            <div ref={plotRef} className="w-full h-64 mt-2" />

            {/* ── Quick stats ── */}
            <div className="grid grid-cols-3 gap-2 mt-3">
                {[
                    {
                        label:      'Peak',
                        value:      peakVal,
                        year:       peakYear,
                        bg:         'bg-blue-50',
                        border:     'border-blue-300',
                        labelColor: 'text-blue-500',
                        valueColor: 'text-blue-700',
                        unitColor:  'text-blue-400',
                        dot:        'bg-blue-500',
                    },
                    {
                        label:      'Lowest',
                        value:      lowestVal,
                        year:       lowestYear,
                        bg:         'bg-red-50',
                        border:     'border-red-300',
                        labelColor: 'text-red-500',
                        valueColor: 'text-red-700',
                        unitColor:  'text-red-400',
                        dot:        'bg-red-500',
                    },
                    {
                        label:      'Average',
                        value:      avg ?? 0,
                        year:       undefined,
                        bg:         'bg-green-50',
                        border:     'border-green-300',
                        labelColor: 'text-green-500',
                        valueColor: 'text-green-700',
                        unitColor:  'text-green-400',
                        dot:        'bg-green-500',
                    },
                ].map(({ label, value, year, bg, border, labelColor, valueColor, unitColor, dot }) => (
                    <div key={label} className={`${bg} border ${border} rounded-lg px-3 py-2 text-center`}>
                        <div className="flex items-center justify-center gap-1.5 mb-1">
                            <span className={`inline-block w-2 h-2 rounded-full ${dot}`} />
                            <p className={`text-xs font-semibold uppercase tracking-wide ${labelColor}`}>
                                {label}
                            </p>
                        </div>
                        <p className={`text-sm font-bold ${valueColor}`}>
                            {value.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
                            <span className={`text-xs font-normal ${unitColor} ml-1`}>MLD</span>
                        </p>
                        {year && (
                            <p className={`text-xs ${labelColor} mt-0.5`}>({year})</p>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default WaterMLDGraph;