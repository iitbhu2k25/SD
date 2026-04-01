'use client';

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Info } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Sector,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { DashboardInfoContent, DashboardInfoKey, getDashboardInfo, InfoPopup } from './info';

/* ─────────────── Types ─────────────── */
interface DashboardDepthRecord        { id: number; district: string; year: number; season: string; depth_m: number | string; description: string | null; }
interface DashboardRainfallRecord     { id: number; district: string; year: number; annual_rainfall: number | string; observation: string | null; }
interface DashboardDistributionRecord { id: number; year: string; category: string; percentage: number | string; observation: string | null; }
interface DashboardIndustrialRecord   { id: number; district: string; category: string; pollution_index: string | null; observation: string | null; }

/* ─────────────── Icons ─────────────── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ActivePieSlice = (props: any) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, midAngle } = props;
  const RAD = Math.PI / 180;
  const pushOut = 22;
  const shiftedCx = cx + Math.cos(-midAngle * RAD) * pushOut;
  const shiftedCy = cy + Math.sin(-midAngle * RAD) * pushOut;
  return (
    <g>
      <Sector
        cx={shiftedCx}
        cy={shiftedCy}
        innerRadius={Math.max(0, innerRadius - 12)}
        outerRadius={outerRadius + 34}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        opacity={0.28}
        stroke={fill}
        strokeWidth={2}
      />
      <Sector
        cx={shiftedCx}
        cy={shiftedCy}
        innerRadius={Math.max(0, innerRadius - 8)}
        outerRadius={outerRadius + 26}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        stroke="#fff"
        strokeWidth={6}
        style={{ filter: `drop-shadow(0 0 18px ${fill}dd)` }}
      />
    </g>
  );
};

// Recharts runtime supports activeIndex/activeShape on Pie, but some TS defs may miss them.
const PieWithActive = Pie as unknown as React.ComponentType<any>;

/* ═══════════════════════════════════════════════════════════
   CANVAS SLIDING LINE CHART with hover tooltip
═══════════════════════════════════════════════════════════ */
interface SlidePoint { year: number; [key: string]: number | null; }
interface SeriesCfg  { key: string; label: string; color: string; }

interface SlidingChartProps {
  title:      string;
  data:       SlidePoint[];
  series:     SeriesCfg[];
  windowSize: number;
  headIdx:    number;
  yMaxOverride?: number;
  yLabel?:    string;
  headerBg?:  string;
}

const CHART_HEIGHT = 280;
const PAD_L = 52, PAD_R = 28, PAD_T = 28, PAD_B = 42;

const SlidingLineChart: React.FC<SlidingChartProps> = ({
  title, data, series, windowSize, headIdx, yMaxOverride, yLabel = '', headerBg = '#1e3a5f',
}) => {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const animRef    = useRef<number>(0);
  const prevHead   = useRef<number>(headIdx);
  const isSliding  = useRef<boolean>(false);
  const canvasSize = useRef<{ w: number; h: number }>({ w: 420, h: CHART_HEIGHT });

  const tooltipRef = useRef<HTMLDivElement>(null);

  /* ── resize observer ── */
  useEffect(() => {
    const wrapper = wrapperRef.current;
    const canvas  = canvasRef.current;
    if (!wrapper || !canvas) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.floor(entry.contentRect.width);
        const h = CHART_HEIGHT;
        if (w !== canvasSize.current.w || h !== canvasSize.current.h) {
          canvasSize.current = { w, h };
          const dpr = window.devicePixelRatio || 1;
          canvas.width  = w * dpr;
          canvas.height = h * dpr;
          canvas.style.width  = `${w}px`;
          canvas.style.height = `${h}px`;
          const ctx = canvas.getContext('2d');
          if (ctx) { ctx.scale(dpr, dpr); draw(ctx, w, h, prevHead.current, prevHead.current, 1); }
        }
      }
    });
    ro.observe(wrapper);
    return () => ro.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getVisible = useCallback((head: number) => {
    const start = Math.max(0, head - windowSize + 1);
    return data.slice(start, head + 1);
  }, [data, windowSize]);

  const draw = useCallback((
    ctx: CanvasRenderingContext2D, W: number, H: number,
    head: number, prevHeadV: number, slideT: number,
  ) => {
    ctx.clearRect(0, 0, W, H);
    const chartW = W - PAD_L - PAD_R;
    const chartH = H - PAD_T - PAD_B;

    const curSlice    = getVisible(head);
    const prevSlice   = getVisible(prevHeadV);
    const windowMoved = head !== prevHeadV && slideT < 1;

    const allVals   = data.flatMap(d => series.map(s => (typeof d[s.key] === 'number' ? (d[s.key] as number) : 0)));
    const localMax  = Math.max(10, ...allVals);
    const baseMax   = yMaxOverride && yMaxOverride > 0 ? yMaxOverride : localMax;
    const yMax      = Math.ceil(baseMax * 1.15 / 5) * 5;

    const toX = (idx: number, total: number, offset = 0) =>
      PAD_L + ((idx + offset) / Math.max(1, total - 1)) * chartW;
    const toY = (v: number | null) =>
      v == null ? null : PAD_T + chartH - (v / yMax) * chartH;

    /* grid */
    ctx.strokeStyle = '#e8edf4'; ctx.lineWidth = 1;
    const ySteps = 5;
    for (let i = 0; i <= ySteps; i++) {
      const y = PAD_T + (i / ySteps) * chartH;
      ctx.beginPath(); ctx.moveTo(PAD_L, y); ctx.lineTo(PAD_L + chartW, y); ctx.stroke();
    }

    /* Y axis labels */
    ctx.fillStyle = '#64748b'; ctx.font = '11px system-ui,sans-serif'; ctx.textAlign = 'right';
    for (let i = 0; i <= ySteps; i++) {
      const val = yMax - (i / ySteps) * yMax;
      const y   = PAD_T + (i / ySteps) * chartH;
      ctx.fillText(val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val.toFixed(val < 10 ? 1 : 0), PAD_L - 6, y + 4);
    }

    if (yLabel) {
      ctx.save();
      ctx.translate(13, PAD_T + chartH / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center'; ctx.font = '10px system-ui,sans-serif'; ctx.fillStyle = '#94a3b8';
      ctx.fillText(yLabel, 0, 0);
      ctx.restore();
    }

    /* clip */
    ctx.save();
    ctx.beginPath(); ctx.rect(PAD_L, PAD_T - 4, chartW + 4, chartH + 8); ctx.clip();

    series.forEach(s => {
      const slices: { pts: SlidePoint[]; xOff: number; alpha: number }[] = [];
      if (windowMoved) {
        const pixPerStep = chartW / Math.max(1, windowSize - 1);
        const xShift     = slideT * pixPerStep;
        slices.push({ pts: prevSlice, xOff: -xShift,             alpha: 1 - slideT * 0.4 });
        slices.push({ pts: curSlice,  xOff: pixPerStep - xShift,  alpha: slideT });
      } else {
        slices.push({ pts: curSlice, xOff: 0, alpha: 1 });
      }

      slices.forEach(({ pts, xOff, alpha }) => {
        if (!pts.length) return;
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = s.color; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.lineCap = 'round';

        ctx.beginPath();
        let started = false;
        pts.forEach((pt, i) => {
          const v = typeof pt[s.key] === 'number' ? pt[s.key] as number : null;
          const x = toX(i, pts.length) + xOff;
          const y = toY(v);
          if (y == null) { started = false; return; }
          if (!started) { ctx.moveTo(x, y); started = true; } else { ctx.lineTo(x, y); }
        });
        ctx.stroke();

        pts.forEach((pt, i) => {
          const v = typeof pt[s.key] === 'number' ? pt[s.key] as number : null;
          if (v == null) return;
          const x = toX(i, pts.length) + xOff;
          const y = toY(v)!;
          const isLast = i === pts.length - 1;

          ctx.beginPath();
          ctx.arc(x, y, isLast ? 6 : 3.5, 0, Math.PI * 2);
          ctx.fillStyle = isLast ? s.color : '#fff'; ctx.strokeStyle = s.color; ctx.lineWidth = isLast ? 2.5 : 1.5;
          if (isLast) { ctx.shadowColor = s.color; ctx.shadowBlur = 8; }
          ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0;

          ctx.fillStyle = s.color; ctx.font = `${isLast ? 'bold ' : ''}10px system-ui,sans-serif`; ctx.textAlign = 'center';
          const yOff = series.indexOf(s) % 2 === 0 ? -10 : 12;
          ctx.fillText(v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(v < 10 ? 2 : 1), x, y + yOff);
        });
        ctx.globalAlpha = 1;
      });
    });

    ctx.restore();

    /* X axis labels */
    ctx.fillStyle = '#475569'; ctx.font = '11px system-ui,sans-serif'; ctx.textAlign = 'center';
    if (windowMoved) {
      const pixPerStep = chartW / Math.max(1, windowSize - 1);
      const xShift     = slideT * pixPerStep;
      ctx.globalAlpha  = 1 - slideT;
      prevSlice.forEach((pt, i) => {
        const x = toX(i, prevSlice.length) - xShift;
        if (x >= PAD_L - 10 && x <= PAD_L + chartW + 10) ctx.fillText(String(pt.year), x, PAD_T + chartH + 18);
      });
      ctx.globalAlpha = slideT;
      curSlice.forEach((pt, i) => {
        const x = toX(i, curSlice.length) + pixPerStep - xShift;
        if (x >= PAD_L - 10 && x <= PAD_L + chartW + 10) ctx.fillText(String(pt.year), x, PAD_T + chartH + 18);
      });
      ctx.globalAlpha = 1;
    } else {
      curSlice.forEach((pt, i) => ctx.fillText(String(pt.year), toX(i, curSlice.length), PAD_T + chartH + 18));
    }

    /* axis lines */
    ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(PAD_L, PAD_T); ctx.lineTo(PAD_L, PAD_T + chartH); ctx.lineTo(PAD_L + chartW, PAD_T + chartH); ctx.stroke();
  }, [data, series, windowSize, getVisible, yLabel, yMaxOverride]);

  /* animation loop */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w: W, h: H } = canvasSize.current;
    if (headIdx !== prevHead.current) { isSliding.current = true; }

    const DURATION = 1000;
    let start: number | null = null;
    const capturedPrev = prevHead.current;
    const step = (ts: number) => {
      if (!start) start = ts;
      const t    = isSliding.current ? Math.min((ts - start) / DURATION, 1) : 1;
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      draw(ctx, W, H, headIdx, capturedPrev, ease);
      if (t < 1) { animRef.current = requestAnimationFrame(step); }
      else { prevHead.current = headIdx; isSliding.current = false; }
    };
    cancelAnimationFrame(animRef.current);
    animRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headIdx, draw]);

  const headIdxRef   = useRef<number>(headIdx);
  const getVisibleRef = useRef(getVisible);
  const seriesRef     = useRef(series);

  useEffect(() => { headIdxRef.current   = headIdx;    }, [headIdx]);
  useEffect(() => { getVisibleRef.current = getVisible; }, [getVisible]);
  useEffect(() => { seriesRef.current     = series;     }, [series]);

  /* ── hover: manipulate DOM directly — no setState, no re-render ── */
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas  = canvasRef.current;
    const tipEl   = tooltipRef.current;
    if (!canvas || !tipEl) return;

    const rect   = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const W      = canvasSize.current.w;
    const chartW = W - PAD_L - PAD_R;
    const chartH = CHART_HEIGHT - PAD_T - PAD_B;

    if (mouseX < PAD_L || mouseX > PAD_L + chartW || mouseY < PAD_T || mouseY > PAD_T + chartH) {
      tipEl.style.display = 'none'; return;
    }

    const curSlice = getVisibleRef.current(headIdxRef.current);
    if (!curSlice.length) { tipEl.style.display = 'none'; return; }

    const stepW = chartW / Math.max(1, curSlice.length - 1);
    const idx   = Math.max(0, Math.min(Math.round((mouseX - PAD_L) / stepW), curSlice.length - 1));
    const pt    = curSlice[idx];
    if (!pt) { tipEl.style.display = 'none'; return; }

    const items = seriesRef.current
      .map(s => ({ label: s.label, value: typeof pt[s.key] === 'number' ? pt[s.key] as number : null, color: s.color }))
      .filter((i): i is { label: string; value: number; color: string } => i.value !== null);

    const tipX = PAD_L + idx * stepW;
    const left = tipX + 14 > W - 160 ? tipX - 155 : tipX + 14;
    const top  = Math.max(8, mouseY - 24);

    tipEl.style.display = 'block';
    tipEl.style.left    = `${left}px`;
    tipEl.style.top     = `${top}px`;
    tipEl.innerHTML     = `
      <div style="font-weight:700;color:#334155;margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid #f1f5f9;font-size:11px;">Year: ${pt.year}</div>
      ${items.map(item => `
        <div style="display:flex;align-items:center;gap:6px;padding:2px 0;">
          <span style="width:8px;height:8px;border-radius:50%;background:${item.color};flex-shrink:0;display:inline-block;"></span>
          <span style="color:#94a3b8;font-size:10px;">${item.label}:</span>
          <span style="font-weight:700;margin-left:auto;padding-left:8px;font-size:11px;color:${item.color};">${item.value >= 1000 ? `${(item.value / 1000).toFixed(1)}k` : item.value.toFixed(2)}</span>
        </div>
      `).join('')}
    `;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-md bg-white" style={{ fontFamily: 'system-ui,sans-serif' }}>
      <div className="px-4 py-2.5 flex items-center justify-between" style={{ background: headerBg }}>
        <span className="text-sm font-bold text-white tracking-wide">{title}</span>
        <div className="flex gap-3">
          {series.map(s => (
            <span key={s.key} className="flex items-center gap-1.5 text-xs text-white/90">
              <span className="inline-block w-6 h-0.5 rounded" style={{ background: s.color }} />
              <span className="w-2 h-2 rounded-full border-2" style={{ borderColor: s.color, background: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      </div>

      <div ref={wrapperRef} className="w-full relative">
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: `${CHART_HEIGHT}px`, display: 'block', cursor: 'crosshair' }}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => { if (tooltipRef.current) tooltipRef.current.style.display = 'none'; }}
        />
        {/* Tooltip — controlled via DOM ref, never causes re-render */}
        <div
          ref={tooltipRef}
          style={{
            display:        'none',
            position:       'absolute',
            zIndex:         20,
            pointerEvents:  'none',
            background:     '#fff',
            border:         '1px solid #e2e8f0',
            borderRadius:   '12px',
            boxShadow:      '0 10px 30px rgba(15,23,42,.12)',
            padding:        '10px 12px',
            minWidth:       '140px',
            fontFamily:     'system-ui,sans-serif',
          }}
        />
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════ */
const TrendAnalysis: React.FC = () => {
  const [depthRecords,        setDepthRecords]        = useState<DashboardDepthRecord[]>([]);
  const [loadingDepth,        setLoadingDepth]        = useState(true);
  const [depthError,          setDepthError]          = useState<string | null>(null);

  const [rainfallRecords,     setRainfallRecords]     = useState<DashboardRainfallRecord[]>([]);
  const [loadingRainfall,     setLoadingRainfall]     = useState(true);
  const [rainfallError,       setRainfallError]       = useState<string | null>(null);

  const [distributionRecords, setDistributionRecords] = useState<DashboardDistributionRecord[]>([]);
  const [loadingDistribution, setLoadingDistribution] = useState(true);
  const [distributionError,   setDistributionError]   = useState<string | null>(null);
  const [industrialRecords,   setIndustrialRecords]   = useState<DashboardIndustrialRecord[]>([]);
  const [loadingIndustrial,   setLoadingIndustrial]   = useState(true);
  const [industrialError,     setIndustrialError]     = useState<string | null>(null);
  const [selectedInfo,        setSelectedInfo]        = useState<DashboardInfoContent | null>(null);
  const [selectedInfoAnchor,  setSelectedInfoAnchor]  = useState<HTMLElement | null>(null);

  const WINDOW = 5;
  const [headIdx, setHeadIdx] = useState(WINDOW - 1);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [autoSlices,   setAutoSlices]   = useState<Record<string, number>>({});
  const [pinnedSlices, setPinnedSlices] = useState<Record<string, number | null>>({});
  const pieTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── fetches ── */
  useEffect(() => {
    (async () => {
      const b = process.env.NEXT_PUBLIC_DJANGO_URL;
      for (const u of [ `${b}/drain-water-quality/depth`]) {
        try { const r = await fetch(u); if (!r.ok) continue; const d = await r.json(); setDepthRecords(Array.isArray(d) ? d : []); setDepthError(null); setLoadingDepth(false); return; } catch { /**/ }
      }
      setDepthError('Unable to load depth records.'); setLoadingDepth(false);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const b = process.env.NEXT_PUBLIC_DJANGO_URL;
      for (const u of [ `${b}/drain-water-quality/rainfall/`]) {
        try { const r = await fetch(u); if (!r.ok) continue; const d = await r.json(); setRainfallRecords(Array.isArray(d) ? d : []); setRainfallError(null); setLoadingRainfall(false); return; } catch { /**/ }
      }
      setRainfallError('Unable to load rainfall records.'); setLoadingRainfall(false);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const b = process.env.NEXT_PUBLIC_DJANGO_URL;
      for (const u of [ `${b}/drain-water-quality/distribution/`]) {
        try { const r = await fetch(u); if (!r.ok) continue; const d = await r.json(); setDistributionRecords(Array.isArray(d) ? d : []); setDistributionError(null); setLoadingDistribution(false); return; } catch { /**/ }
      }
      setDistributionError('Unable to load distribution records.'); setLoadingDistribution(false);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const b = process.env.NEXT_PUBLIC_DJANGO_URL;
      for (const u of [ `${b}/drain-water-quality/industrial/`]) {
        try {
          const r = await fetch(u);
          if (!r.ok) continue;
          const d = await r.json();
          setIndustrialRecords(Array.isArray(d) ? d : []);
          setIndustrialError(null);
          setLoadingIndustrial(false);
          return;
        } catch { /**/ }
      }
      setIndustrialError('Unable to load industrial pollution records.');
      setLoadingIndustrial(false);
    })();
  }, []);

  /* ── depth data (doubled for circular wrap) ── */
  const normSeason = (v: string) => String(v || '').toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-').trim();

  const depthBase = useMemo(() => {
    const norm = depthRecords.map(r => ({
      district: String(r.district || '').trim(),
      season:   normSeason(String(r.season || '')),
      depth:    Number(r.depth_m),
      year:     Number(r.year),
    }));
    const districts = Array.from(new Set(norm.map(r => r.district))).filter(Boolean);
    const years     = Array.from(new Set(norm.map(r => r.year))).sort((a, b) => a - b);
    const byDistrict: Record<string, SlidePoint[]> = {};
    districts.forEach(d => {
      const pts = years.map(year => {
        const pre  = norm.find(r => r.year === year && r.district === d && r.season === 'pre-monsoon');
        const post = norm.find(r => r.year === year && r.district === d && r.season === 'post-monsoon');
        return { year, preMonsoon: pre ? pre.depth : null, postMonsoon: post ? post.depth : null };
      });
      byDistrict[d] = [...pts, ...pts];
    });
    return { districts, years, byDistrict };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depthRecords]);

  /* ── rainfall data (doubled for circular wrap) ── */
  const rainfallBase = useMemo(() => {
    const norm = rainfallRecords.map(r => ({
      district: String(r.district || '').trim(),
      rainfall: Number(r.annual_rainfall),
      year:     Number(r.year),
    }));
    const districts = Array.from(new Set(norm.map(r => r.district))).filter(Boolean);
    const years     = Array.from(new Set(norm.map(r => r.year))).sort((a, b) => a - b);
    const byDistrict: Record<string, SlidePoint[]> = {};
    districts.forEach(d => {
      const pts = years.map(year => {
        const f = norm.find(r => r.year === year && r.district === d);
        return { year, rainfall: f ? f.rainfall : null };
      });
      byDistrict[d] = [...pts, ...pts];
    });
    return { districts, years, byDistrict };
  }, [rainfallRecords]);

  const totalYears = Math.max(depthBase.years.length, rainfallBase.years.length, WINDOW);
  const sharedDepthYMax = useMemo(() => {
    const vals = Object.values(depthBase.byDistrict).flatMap((pts) =>
      pts.flatMap((p) => [p.preMonsoon, p.postMonsoon]).filter((v): v is number => typeof v === 'number')
    );
    return vals.length ? Math.max(...vals) : 10;
  }, [depthBase.byDistrict]);

  const sharedRainfallYMax = useMemo(() => {
    const vals = Object.values(rainfallBase.byDistrict).flatMap((pts) =>
      pts.map((p) => p.rainfall).filter((v): v is number => typeof v === 'number')
    );
    return vals.length ? Math.max(...vals) : 10;
  }, [rainfallBase.byDistrict]);

  /* ── auto-play timer ── */
  useEffect(() => {
    if (totalYears === 0) return;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setHeadIdx(prev => {
        const next = prev + 1;
        return next >= totalYears + WINDOW - 1 ? WINDOW - 1 : next;
      });
    }, 2400);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [totalYears]);

  /* ── depth layout: Varanasi + Prayagraj → row1, rest → row2 ── */
  const arrangedDistricts = useMemo(() => {
    const normalize = (v: string) => v.toLowerCase().replace(/\s+/g, '');
    const all       = depthBase.districts;
    const varanasi  = all.find(d => ['varanasi', 'varansi'].includes(normalize(d))) ?? null;
    const prayagraj = all.find(d => normalize(d) === 'prayagraj') ?? null;
    const row1      = [varanasi, prayagraj].filter((d): d is string => Boolean(d));
    const row2      = all.filter(d => !row1.includes(d)).sort((a, b) => a.localeCompare(b));
    return { row1, row2 };
  }, [depthBase.districts]);

  /* ── rainfall layout: same pattern ── */
  const arrangedRainfallDistricts = useMemo(() => {
    const normalize = (v: string) => v.toLowerCase().replace(/\s+/g, '');
    const all       = [...rainfallBase.districts];
    const varanasi  = all.find(d => ['varanasi', 'varansi'].includes(normalize(d))) ?? null;
    const prayagraj = all.find(d => normalize(d) === 'prayagraj') ?? null;
    const row1      = [varanasi, prayagraj].filter((d): d is string => Boolean(d));
    const row2      = all.filter(d => !row1.includes(d)).sort((a, b) => a.localeCompare(b)).slice(0, 3);
    return { row1, row2 };
  }, [rainfallBase.districts]);

  const rainfallColors = ['#2563eb', '#16a34a', '#dc2626', '#9333ea', '#ea580c', '#0891b2', '#db2777', '#65a30d'];

  /* ── distribution ── */
  const distributionSeries = useMemo(() => {
    const norm  = distributionRecords
      .map(r => ({ year: String(r.year || '').trim(), category: String(r.category || '').trim(), value: Number(r.percentage) }))
      .filter(r => r.year && r.category && !isNaN(r.value));
    const ys    = (y: string) => { const p = Number(y.split('-')[0]?.trim()); return isNaN(p) ? 0 : p; };
    const years = Array.from(new Set(norm.map(r => r.year))).sort((a, b) => ys(a) - ys(b));
    const byYear: Record<string, typeof norm> = {};
    years.forEach(y => { byYear[y] = norm.filter(r => r.year === y); });
    return { years, byYear };
  }, [distributionRecords]);

  const pieCols: Record<string, string> = {
    Critical: '#dc2626', 'Over-Exploited': '#f97316', Safe: '#16a34a', 'Semi-Critical': '#2563eb',
  };

  const pieCards = distributionSeries.years.map(year => ({
    year,
    data: (distributionSeries.byYear[year] ?? []).map(d => ({
      ...d, color: pieCols[d.category] ?? '#7c3aed',
    })),
  }));

  const industrialBands = [
    { key: 'band_blue', label: '0-25', color: '#2563eb' },
    { key: 'band_green', label: '25-55', color: '#16a34a' },
    { key: 'band_orange', label: '55-80', color: '#f97316' },
    { key: 'band_red', label: '80-100', color: '#dc2626' },
  ] as const;

  const industrialCategoryCounts = useMemo(() => {
    const getBandKey = (pollutionIndex: string | null, category: string): (typeof industrialBands)[number]['key'] | null => {
      const raw = String(pollutionIndex || '').trim();
      const upperCat = String(category || '').trim().toUpperCase();

      const nums = raw.match(/\d+(\.\d+)?/g)?.map(Number) ?? [];
      const probe = nums.length >= 2 ? (nums[0] + nums[1]) / 2 : nums.length === 1 ? nums[0] : null;

      if (probe !== null && !Number.isNaN(probe)) {
        if (probe <= 25) return 'band_blue';
        if (probe <= 55) return 'band_green';
        if (probe <= 80) return 'band_orange';
        return 'band_red';
      }

      if (upperCat.includes('BLUE')) return 'band_blue';
      if (upperCat.includes('GREEN')) return 'band_green';
      if (upperCat.includes('ORANGE')) return 'band_orange';
      if (upperCat.includes('RED')) return 'band_red';
      return null;
    };

    const normalized = industrialRecords
      .map((r) => ({
        district: String(r.district || '').trim(),
        bandKey: getBandKey(r.pollution_index, String(r.category || '')),
      }))
      .filter((r) => r.district && r.bandKey);

    const districts = Array.from(new Set(normalized.map((r) => r.district))).sort((a, b) => a.localeCompare(b));

    const chartData = districts.map((district) => {
      const row: Record<string, string | number> = {
        district,
        total: 0,
        band_blue: 0,
        band_green: 0,
        band_orange: 0,
        band_red: 0,
      };

      normalized
        .filter((r) => r.district === district)
        .forEach((r) => {
          const k = r.bandKey as keyof typeof row;
          row[k] = Number(row[k] || 0) + 1;
          row.total = Number(row.total) + 1;
        });
      return row;
    });

    return { chartData };
  }, [industrialRecords]);

  /* ── pie auto-rotate slowly (3 s per category) ── */
  useEffect(() => {
    if (!pieCards.length) return;
    setAutoSlices(Object.fromEntries(pieCards.map(c => [c.year, 0])));
    pieTimer.current = setInterval(() => {
      setAutoSlices(prev =>
        Object.fromEntries(pieCards.map(c => [c.year, c.data.length ? ((prev[c.year] ?? 0) + 1) % c.data.length : 0]))
      );
    }, 3000);
    return () => { if (pieTimer.current) clearInterval(pieTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pieCards.length]);

  const getSlice = (year: string) => {
    const p = pinnedSlices[year];
    return (p !== undefined && p !== null) ? p : (autoSlices[year] ?? 0);
  };

  const openInfo = (key: DashboardInfoKey, event?: React.MouseEvent<HTMLElement>) => {
    setSelectedInfoAnchor(event ? event.currentTarget : null);
    setSelectedInfo(getDashboardInfo(key));
  };

  /* ── render depth district group ── */
  const renderDepthGroup = (districts: string[]) => {
    if (!districts.length) return null;
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
        {districts.map(district => {
          const pts    = depthBase.byDistrict[district] ?? [];
          const preValues = pts.map((p) => p.preMonsoon).filter((v): v is number => v !== null);
          const postValues = pts.map((p) => p.postMonsoon).filter((v): v is number => v !== null);
          const avgOf = (vals: number[]) =>
            vals.length ? (vals.reduce((sum, n) => sum + n, 0) / vals.length) : null;
          const preAvg = avgOf(preValues);
          const postAvg = avgOf(postValues);
          return (
            <div key={district} className="rounded-2xl overflow-hidden border border-slate-200 shadow-md">
              <SlidingLineChart
                title={district.charAt(0).toUpperCase() + district.slice(1)}
                data={pts}
                series={[
                  { key: 'preMonsoon',  label: 'Pre-Monsoon',  color: '#16a34a' },
                  { key: 'postMonsoon', label: 'Post-Monsoon', color: '#2563eb' },
                ]}
                windowSize={WINDOW}
                headIdx={Math.min(headIdx, pts.length - 1)}
                yMaxOverride={sharedDepthYMax}
                yLabel="Depth (m)"
                headerBg="#1e3a5f"
              />
              <div className="px-3 py-2 flex gap-3 bg-slate-50 border-t border-slate-100 flex-wrap">
                {preAvg !== null && (
                  <span className="text-[11px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                    Pre Avg: {preAvg.toFixed(2)} m
                  </span>
                )}
                {postAvg !== null && (
                  <span className="text-[11px] font-semibold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                    Post Avg: {postAvg.toFixed(2)} m
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  /* ════════════════════════════════ RENDER ════════════════════════════════ */
  return (
    <div className="space-y-8">

      {/* ══ Groundwater Depth Analysis ══ */}
      <div className="bg-white rounded-2xl shadow-lg p-10 border border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-700 to-cyan-700 bg-clip-text text-transparent">
              Groundwater Depth Analysis
            </h2>
            <button
              onClick={(event) => openInfo('trend-groundwater-depth', event)}
              aria-label="Groundwater depth analysis info"
              className="w-6 h-6 rounded-full border border-blue-300 bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-100 transition-colors"
            >
              <Info size={14} />
            </button>
          </div>
        </div>

        {loadingDepth ? (
          <div className="h-48 flex items-center justify-center text-slate-500">Loading depth charts…</div>
        ) : depthError ? (
          <div className="h-48 flex items-center justify-center text-red-600 font-medium text-center px-4">{depthError}</div>
        ) : depthBase.districts.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-slate-500">No depth data available.</div>
        ) : (
          renderDepthGroup([...arrangedDistricts.row1, ...arrangedDistricts.row2])
        )}
      </div>

      {/* ══ Annual Rainfall Analysis ══ */}
      <div className="bg-white rounded-2xl shadow-lg p-8 border border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-700 to-sky-700 bg-clip-text text-transparent">Annual Rainfall Analysis</h2>
            <button
              onClick={(event) => openInfo('trend-annual-rainfall', event)}
              aria-label="Annual rainfall analysis info"
              className="w-6 h-6 rounded-full border border-indigo-300 bg-indigo-50 text-indigo-600 flex items-center justify-center hover:bg-indigo-100 transition-colors"
            >
              <Info size={14} />
            </button>
          </div>
        </div>

        {loadingRainfall ? (
          <div className="h-48 flex items-center justify-center text-slate-500">Loading rainfall charts…</div>
        ) : rainfallError ? (
          <div className="h-48 flex items-center justify-center text-red-600 font-medium text-center px-4">{rainfallError}</div>
        ) : rainfallBase.districts.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-slate-500">No rainfall data available.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
            {[...arrangedRainfallDistricts.row1, ...arrangedRainfallDistricts.row2].map((district, idx) => {
              const pts    = rainfallBase.byDistrict[district] ?? [];
              const color  = rainfallColors[idx % rainfallColors.length];
              const rainfallValues = pts.map((p) => p.rainfall).filter((v): v is number => v !== null);
              const rainfallAvg = rainfallValues.length
                ? rainfallValues.reduce((sum, n) => sum + n, 0) / rainfallValues.length
                : null;
              return (
                <div key={district} className="rounded-2xl overflow-hidden border border-indigo-200 shadow-md">
                  <SlidingLineChart title={district.charAt(0).toUpperCase() + district.slice(1)} data={pts} series={[{ key: 'rainfall', label: 'Rainfall (mm)', color }]} windowSize={WINDOW} headIdx={Math.min(headIdx, pts.length - 1)} yMaxOverride={sharedRainfallYMax} yLabel="mm" headerBg="#1e3a5f" />
                  {rainfallAvg !== null && (
                    <div className="px-3 py-2 bg-slate-50 border-t border-slate-100">
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: `${color}18`, color }}>Avg Rainfall: {rainfallAvg.toFixed(1)} mm</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ══ Distribution Pie Analysis ══ */}
      <div className="bg-white rounded-2xl shadow-lg p-8 border border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-fuchsia-700 to-rose-700 bg-clip-text text-transparent">
               GroundWater Area Analysis
            </h2>
            <button
              onClick={(event) => openInfo('trend-distribution-analysis', event)}
              aria-label="Distribution analysis info"
              className="w-6 h-6 rounded-full border border-rose-300 bg-rose-50 text-rose-600 flex items-center justify-center hover:bg-rose-100 transition-colors"
            >
              <Info size={14} />
            </button>
          </div>
        </div>

        {loadingDistribution ? (
          <div className="h-48 flex items-center justify-center text-slate-500">Loading…</div>
        ) : distributionError ? (
          <div className="h-48 flex items-center justify-center text-red-600 font-medium text-center px-4">{distributionError}</div>
        ) : !distributionSeries.years.length ? (
          <div className="h-48 flex items-center justify-center text-slate-500">No data available.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
            {pieCards.map(card => {
              const ai = getSlice(card.year);
              const ae = card.data[ai];
              const ip = pinnedSlices[card.year] !== undefined && pinnedSlices[card.year] !== null;
              return (
                <div key={card.year} className="rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-50/70 to-white p-4 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-sm font-extrabold text-slate-900 bg-rose-100 px-2 py-1 rounded">{card.year}</h4>
                    <div className="flex items-center gap-2">
                      {ip && (
                        <button onClick={() => setPinnedSlices(p => { const nn = { ...p }; delete nn[card.year]; return nn; })} className="text-[9px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-600 border border-rose-200 hover:bg-rose-200 font-semibold">Unpin</button>
                      )}
                    </div>
                  </div>

                  {ae && (
                    <div key={`${card.year}-${ai}`} className="mb-2 flex items-center gap-2 px-2 py-1 rounded-lg text-xs font-semibold" style={{ background: `${ae.color}18`, color: ae.color, border: `1px solid ${ae.color}44`, animation: 'popIn .4s cubic-bezier(.34,1.56,.64,1) both' }}>
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: ae.color }} />
                      {ae.category}: {Number(ae.value).toFixed(2)}%
                      {ip && <span className="ml-auto text-[9px] opacity-60">pinned</span>}
                    </div>
                  )}

                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Tooltip
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          formatter={(v, _name, p: any) => [`${Number(v ?? 0).toFixed(2)}%`, p?.payload?.category ?? 'Category']}
                          contentStyle={{ borderRadius: 10, border: '1px solid #fecdd3', boxShadow: '0 10px 30px rgba(15,23,42,.1)' }}
                        />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        {/* Single pie only — duplicate shadow pie removed */}
                        <PieWithActive
                          data={card.data} dataKey="value" nameKey="category"
                          activeIndex={ai} activeShape={ActivePieSlice}
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          onClick={(_: any, i: number) =>
                            setPinnedSlices(p =>
                              p[card.year] === i
                                ? (({ [card.year]: _x, ...r }) => r)(p)
                                : { ...p, [card.year]: i }
                            )
                          }
                          cx="50%" cy="50%" innerRadius={44} outerRadius={78}
                          startAngle={50} endAngle={-310} paddingAngle={2}
                          isAnimationActive animationDuration={800} animationEasing="ease-in-out"
                          style={{ cursor: 'pointer' }}
                        >
                          {card.data.map((e, i) => (
                            <Cell
                              key={`c${i}`}
                              fill={e.color}
                              stroke="#fff"
                              strokeWidth={i === ai ? 6 : 1.2}
                              style={{
                                opacity: 1,
                                transition: 'opacity .35s ease, transform .35s ease',
                              }}
                            />
                          ))}
                        </PieWithActive>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ══ District-wise Industrial Pollution Category Count ══ */}
      <div className="bg-white rounded-2xl shadow-lg p-8 border border-slate-200">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-orange-700 to-amber-700 bg-clip-text text-transparent">
              Pollution Inventory
            </h2>
            <button
              onClick={(event) => openInfo('trend-industrial-pollution', event)}
              aria-label="Pollution inventory info"
              className="w-6 h-6 rounded-full border border-orange-300 bg-orange-50 text-orange-600 flex items-center justify-center hover:bg-orange-100 transition-colors"
            >
              <Info size={14} />
            </button>
          </div>

        </div>

        {loadingIndustrial ? (
          <div className="h-72 flex items-center justify-center text-slate-500">Loading industrial pollution chart...</div>
        ) : industrialError ? (
          <div className="h-72 flex items-center justify-center text-red-600 font-medium text-center px-4">{industrialError}</div>
        ) : industrialCategoryCounts.chartData.length === 0 ? (
          <div className="h-72 flex items-center justify-center text-slate-500">No industrial pollution data available.</div>
        ) : (
          <div className="h-[560px] flex flex-col">
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={industrialCategoryCounts.chartData}
                  margin={{ top: 16, right: 16, left: 4, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="district"
                    height={56}
                    tickMargin={8}
                    tick={{ fill: '#334155', fontSize: 12 }}
                    label={{ value: 'Districts', position: 'insideBottom', dy: 16, fill: '#1d4ed8', fontSize: 12 }}
                  />
                  <YAxis
                    allowDecimals={false}
                    domain={[0, 1600]}
                    ticks={[200, 400, 600, 800, 1000, 1200, 1400,1600]}
                    tick={{ fill: '#334155', fontSize: 12 }}
                    label={{ value: 'Count', angle: -90, position: 'insideLeft', fill: '#b45309', fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: 10, border: '1px solid #fed7aa', boxShadow: '0 10px 30px rgba(15,23,42,.1)' }}
                    formatter={(value, name) => [`${Number(value ?? 0)}`, String(name ?? 'Count')]}
                  />
                  {industrialBands.map((band) => (
                    <Bar
                      key={band.key}
                      dataKey={band.key}
                      name={band.label}
                      fill={band.color}
                      radius={[4, 4, 0, 0]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="pt-3 text-center border-t border-slate-100">
              <div className="flex items-center justify-center gap-4 flex-wrap">
                <div className="text-xs font-semibold text-cyan-600">Pollution Index :</div>
                {industrialBands.map((band) => (
                  <div key={band.key} className="inline-flex items-center gap-1.5 text-xs">
                    <span className="inline-block w-3 h-3 rounded-sm" style={{ background: band.color }} />
                    <span style={{ color: band.color }} className="font-medium">{band.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes popIn {
          from { opacity: 0; transform: scale(.8) translateX(-6px); }
          to   { opacity: 1; transform: scale(1)  translateX(0);    }
        }
      `}</style>

      <InfoPopup
        content={selectedInfo}
        anchor={selectedInfoAnchor}
        onClose={() => {
          setSelectedInfo(null);
          setSelectedInfoAnchor(null);
        }}
      />
    </div>
  );
};

export default TrendAnalysis;
