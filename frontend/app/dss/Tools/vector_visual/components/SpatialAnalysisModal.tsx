'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ManagedLayer, NotificationType } from '../types/map.types';

/* ─── Types ─────────────────────────────────────────────────────────────── */
interface SpatialAnalysisModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  managedLayers: ManagedLayer[];
  showNotification: (title: string, message: string, type?: NotificationType) => void;
  onAnalysisComplete: (geojson: any, operationName: string) => void;
}
interface Parameter {
  name: string; label: string; type: 'number' | 'text' | 'select';
  default?: any; options?: string[]; required?: boolean; placeholder?: string;
}
interface Operation {
  id: string; name: string; description: string; icon: string;
  category: string; minFiles: number; maxFiles?: number;
  layerLabels?: string[]; parameters?: Parameter[];
}
interface QueryDef {
  id: string; name: string; description: string; icon: string;
  category: string; parameters?: Parameter[];
  layerLabels: [string, string];
}

/* ─── Operations catalogue ───────────────────────────────────────────────── */
const OPERATIONS: Operation[] = [
  { id:'intersection',         icon:'⊕', name:'Intersection',       category:'Overlay',   minFiles:2, layerLabels:['Layer A','Layer B'],           description:'Find the overlap area shared by all selected layers' },
  { id:'union',                icon:'⊔', name:'Union',              category:'Overlay',   minFiles:2, layerLabels:['Layer A','Layer B'],           description:'Merge all selected layers into a single combined layer' },
  { id:'difference',           icon:'⊖', name:'Difference',         category:'Overlay',   minFiles:2, layerLabels:['Input Layer','Erase Layer'],   description:'Subtract the erase layer from the input layer' },
  { id:'symmetric_difference', icon:'⊗', name:'Sym. Difference',    category:'Overlay',   minFiles:2, maxFiles:2, layerLabels:['Layer A','Layer B'],description:'Areas belonging to one layer but not both' },
  { id:'clip',                 icon:'✂', name:'Clip',               category:'Overlay',   minFiles:2, maxFiles:2, layerLabels:['Input Layer','Clip Boundary'], description:'Clip the input layer to the shape of the boundary layer' },
  { id:'buffer',               icon:'◎', name:'Buffer',             category:'Geometric', minFiles:1, layerLabels:['Input Layer'],                description:'Grow a zone of given distance around each feature',
    parameters:[{ name:'distance', label:'Distance (meters)', type:'number', default:100, required:true }] },
  { id:'dissolve',             icon:'⬡', name:'Dissolve',           category:'Geometric', minFiles:1, layerLabels:['Input Layer'],                description:'Merge adjacent features, optionally by attribute',
    parameters:[{ name:'dissolve_field', label:'Group Field', type:'text', placeholder:'Leave blank = dissolve all' }] },
  { id:'centroid',             icon:'⦿', name:'Centroid',           category:'Geometric', minFiles:1, layerLabels:['Input Layer'],                description:'Replace each feature with its centroid point' },
  { id:'bounding_box',         icon:'⬜', name:'Bounding Box',      category:'Geometric', minFiles:1, layerLabels:['Input Layer'],                description:'Compute the rectangular envelope of each feature' },
  { id:'convex_hull',          icon:'△', name:'Convex Hull',        category:'Geometric', minFiles:1, layerLabels:['Input Layer'],                description:'Create the smallest convex polygon enclosing all features' },
  { id:'simplify',             icon:'≈',  name:'Simplify',           category:'Geometric', minFiles:1, layerLabels:['Input Layer'],                description:'Reduce vertex count while preserving topology',
    parameters:[{ name:'tolerance', label:'Tolerance', type:'number', default:0.001, required:true, placeholder:'0.001' }] },
  { id:'statistics',           icon:'∑', name:'Statistics',         category:'Analysis',  minFiles:1, layerLabels:['Input Layer'],                description:'Compute area, length, perimeter or centroid metrics',
    parameters:[{ name:'stats_type', label:'Metric', type:'select', default:'area', required:true, options:['area','length','perimeter','centroid','bounds'] }] },
  { id:'spatial_join',         icon:'⋈', name:'Spatial Join',       category:'Analysis',  minFiles:2, maxFiles:2, layerLabels:['Target Layer','Join Layer'], description:'Attach attributes from Join Layer to Target by location',
    parameters:[
      { name:'join_type', label:'Join Type', type:'select', default:'inner', required:true, options:['inner','left','right'] },
      { name:'predicate', label:'Predicate', type:'select', default:'intersects', required:true, options:['intersects','within','contains'] },
    ] },
  { id:'nearest',              icon:'↔', name:'Nearest Neighbor',   category:'Analysis',  minFiles:2, maxFiles:2, layerLabels:['Source Layer','Target Layer'], description:'Find the closest feature in Target for each Source feature' },
  { id:'point_in_polygon',     icon:'⊙', name:'Point in Polygon',   category:'Analysis',  minFiles:2, maxFiles:2, layerLabels:['Points Layer','Polygons Layer'], description:'Select points that fall inside the polygons layer' },
  { id:'area_comparison',      icon:'⚖', name:'Area Comparison',    category:'Analysis',  minFiles:1, layerLabels:['Input Layer'],                description:'Rank features by area and compute percentage shares' },
  { id:'topology_check',       icon:'✔', name:'Topology Check',     category:'Analysis',  minFiles:1, layerLabels:['Input Layer'],                description:'Detect invalid geometries and attempt auto-repair' },
  { id:'merge',                icon:'⊞', name:'Merge Layers',       category:'Utility',   minFiles:1, description:'Concatenate multiple layers into a single feature collection' },
  { id:'filter',               icon:'⌥', name:'Filter',             category:'Utility',   minFiles:1, layerLabels:['Input Layer'],                description:'Keep only features matching an attribute condition',
    parameters:[
      { name:'field',    label:'Field Name', type:'text',   required:true },
      { name:'operator', label:'Operator',   type:'select', default:'equals', required:true, options:['equals','greater','less','contains'] },
      { name:'value',    label:'Value',      type:'text',   required:true },
    ] },
  { id:'voronoi',              icon:'⬢', name:'Voronoi Diagram',    category:'Utility',   minFiles:1, layerLabels:['Points Layer'],               description:'Generate Voronoi tessellation from point features' },
  { id:'reproject',            icon:'⟳', name:'Reproject',          category:'Utility',   minFiles:1, layerLabels:['Input Layer'],                description:'Transform layer to a different coordinate reference system',
    parameters:[{ name:'target_crs', label:'Target CRS', type:'text', default:'EPSG:4326', placeholder:'e.g. EPSG:3857' }] },
];

const CATS = [
  { id:'Overlay',   label:'Overlay',   icon:'⊕', color:'#0ea5e9', bg:'#f0f9ff' },
  { id:'Geometric', label:'Geometric', icon:'◎', color:'#8b5cf6', bg:'#f5f3ff' },
  { id:'Analysis',  label:'Analysis',  icon:'∑', color:'#10b981', bg:'#f0fdf4' },
  { id:'Utility',   label:'Utility',   icon:'⚙', color:'#f59e0b', bg:'#fffbeb' },
];
const getCat = (id: string) => CATS.find(c => c.id === id) ?? CATS[0];

/* ─── Spatial Queries catalogue ──────────────────────────────────────────── */
const QUERY_CATS = [
  { id:'Topological', label:'Topological', icon:'⊛', color:'#0f766e', bg:'#f0fdfa' },
  { id:'Distance',    label:'Distance',    icon:'↔', color:'#7c3aed', bg:'#faf5ff' },
  { id:'Aggregate',   label:'Aggregate',   icon:'∑', color:'#b45309', bg:'#fffbeb' },
  { id:'Advanced',    label:'Advanced',    icon:'⚡', color:'#dc2626', bg:'#fef2f2' },
];
const getQCat = (id: string) => QUERY_CATS.find(c => c.id === id) ?? QUERY_CATS[0];

const QUERIES: QueryDef[] = [
  // Topological
  { id:'intersects',        icon:'⊕', name:'Intersects',            category:'Topological', layerLabels:['Source Layer','Target Layer'],   description:'Select source features that intersect any target feature' },
  { id:'within',            icon:'⊃', name:'Within',                category:'Topological', layerLabels:['Source Layer','Target Layer'],   description:'Select source features completely inside any target feature' },
  { id:'contains',          icon:'⊂', name:'Contains',              category:'Topological', layerLabels:['Source Layer','Target Layer'],   description:'Select source features that fully contain any target feature' },
  { id:'touches',           icon:'∂', name:'Touches',               category:'Topological', layerLabels:['Source Layer','Target Layer'],   description:'Select source features sharing a boundary with any target feature' },
  { id:'crosses',           icon:'✕', name:'Crosses',               category:'Topological', layerLabels:['Source Layer','Target Layer'],   description:'Select source lines/polygons that cross any target feature' },
  { id:'overlaps',          icon:'⋂', name:'Overlaps',              category:'Topological', layerLabels:['Source Layer','Target Layer'],   description:'Select source features that partially overlap any target feature' },
  { id:'disjoint',          icon:'⊄', name:'Disjoint',              category:'Topological', layerLabels:['Source Layer','Target Layer'],   description:'Select source features with NO spatial relation to target' },
  // Distance
  { id:'within_distance',     icon:'◉', name:'Within Distance',      category:'Distance', layerLabels:['Source Layer','Target Layer'],
    description:'Select source features within a given distance of any target feature',
    parameters:[{ name:'distance_m', label:'Distance (meters)', type:'number', default:1000, required:true }] },
  { id:'not_within_distance', icon:'◎', name:'Not Within Distance',  category:'Distance', layerLabels:['Source Layer','Target Layer'],
    description:'Select source features farther than a given distance from all target features',
    parameters:[{ name:'distance_m', label:'Distance (meters)', type:'number', default:1000, required:true }] },
  { id:'distance_band',       icon:'⊙', name:'Distance Band',        category:'Distance', layerLabels:['Source Layer','Target Layer'],
    description:'Select source features between a minimum and maximum distance from target',
    parameters:[
      { name:'min_dist_m', label:'Min Distance (m)', type:'number', default:0,    required:true },
      { name:'max_dist_m', label:'Max Distance (m)', type:'number', default:5000, required:true },
    ] },
  { id:'nearest_n',           icon:'↔', name:'Nearest N Features',  category:'Distance', layerLabels:['Source Layer','Target Layer'],
    description:'For each source feature find the N nearest target features',
    parameters:[{ name:'n', label:'Number of nearest (N)', type:'number', default:1, required:true }] },
  // Aggregate
  { id:'count_within',    icon:'#', name:'Count Within',         category:'Aggregate', layerLabels:['Source Polygons','Target Features'],  description:"Count how many target features fall inside each source polygon" },
  { id:'sum_within',      icon:'∑', name:'Sum Field Within',     category:'Aggregate', layerLabels:['Source Polygons','Target Features'],  description:'Sum a numeric field of target features inside each source polygon',
    parameters:[{ name:'stat_field', label:'Target Field to Sum', type:'text', required:true, placeholder:'e.g. population' }] },
  { id:'intersect_area',  icon:'⊠', name:'Intersection Area',   category:'Aggregate', layerLabels:['Source Polygons','Target Polygons'],  description:'Compute intersection area (km²) and % coverage between layers' },
  { id:'largest_overlap', icon:'▣', name:'Largest Overlap',     category:'Aggregate', layerLabels:['Source Polygons','Target Polygons'],  description:'Find which target polygon each source polygon overlaps most with' },
  // Advanced
  { id:'select_by_location', icon:'⊡', name:'Select by Location', category:'Advanced', layerLabels:['Source Layer','Target Layer'],
    description:'Filter source by any DE-9IM spatial predicate',
    parameters:[{ name:'predicate', label:'Spatial Predicate', type:'select', default:'intersects', required:true,
      options:['intersects','within','contains','touches','crosses','overlaps','disjoint'] }] },
  { id:'relate',             icon:'≡', name:'Spatial Relate (all)', category:'Advanced', layerLabels:['Source Layer','Target Layer'],
    description:'Compute all DE-9IM relationship flags for each source feature' },
];

/* ─── Helpers ────────────────────────────────────────────────────────────── */
function computeLayout() {
  if (typeof window === 'undefined') return { x:60, y:40, w:1080, h:680 };
  const vw = window.innerWidth, vh = window.innerHeight;
  const w = Math.max(820, Math.min(1200, vw - 60));
  const h = Math.max(560, Math.min(800, vh - 60));
  return { x: Math.round((vw - w) / 2), y: Math.round((vh - h) / 2), w, h };
}

function layerToGeoJSON(lyr: any): any {
  const features: any[] = [];
  const conv = (l: any) => {
    try {
      if (l.getRadius && l.getLatLng) {
        const c = l.getLatLng(), r = l.getRadius();
        const coords = Array.from({ length:65 }, (_:any, i:number) => {
          const a = (i / 64) * 2 * Math.PI;
          return [c.lng + (r * Math.sin(a)) / (111320 * Math.cos(c.lat * Math.PI / 180)),
                  c.lat + (r * Math.cos(a)) / 111320] as [number,number];
        });
        features.push({ type:'Feature', geometry:{ type:'Polygon', coordinates:[coords] }, properties: l.feature?.properties||{} });
      } else if (typeof l.toGeoJSON === 'function') {
        const g = l.toGeoJSON();
        if (g.type === 'FeatureCollection') features.push(...(g.features||[]));
        else if (g.type === 'Feature') features.push(g);
      }
    } catch {}
  };
  if (typeof lyr.eachLayer === 'function') lyr.eachLayer(conv); else conv(lyr);
  return { type:'FeatureCollection', features };
}

/* ─── Shared sub-components ─────────────────────────────────────────────── */
function LayerOrderList({ ordered, onReorder, labels, color }: {
  ordered: string[]; onReorder: (n: string[]) => void; labels?: string[]; color: string;
}) {
  const di = useRef<number|null>(null);
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
      {ordered.map((name, i) => (
        <div key={name+i} draggable
          onDragStart={() => { di.current = i; }}
          onDragOver={e => {
            e.preventDefault();
            if (di.current===null||di.current===i) return;
            const n=[...ordered]; const [x]=n.splice(di.current,1); n.splice(i,0,x);
            di.current=i; onReorder(n);
          }}
          onDragEnd={() => { di.current=null; }}
          style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 14px',
            background:'#fff', borderLeft:`4px solid ${color}`, borderRadius:'0 8px 8px 0',
            border:`1px solid ${color}30`, borderLeftWidth:4, borderLeftColor:color,
            cursor:'grab', boxShadow:'0 1px 4px rgba(0,0,0,0.07)' }}
        >
          <span style={{ color:'#94a3b8', fontSize:14 }}>⠿</span>
          <span style={{ background:color, color:'#fff', fontSize:10, padding:'2px 8px',
            borderRadius:12, fontWeight:800, flexShrink:0, whiteSpace:'nowrap' }}>
            {labels?.[i] ?? `Layer ${i+1}`}
          </span>
          <span style={{ fontSize:12, color:'#1e293b', flex:1, overflow:'hidden',
            textOverflow:'ellipsis', whiteSpace:'nowrap', fontWeight:500 }}>{name}</span>
          <span style={{ fontSize:11, color:'#94a3b8', fontFamily:'monospace' }}>#{i+1}</span>
        </div>
      ))}
    </div>
  );
}

function LayerPicker({ label, badge, color, bg, value, onChange, layers, exclude }: {
  label: string; badge: string; color: string; bg: string;
  value: string; onChange: (id: string) => void;
  layers: ManagedLayer[]; exclude?: string;
}) {
  const available = layers.filter(l => l.id !== exclude);
  return (
    <div style={{ flex:1 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
        <span style={{ background:color, color:'#fff', fontSize:10, padding:'2px 9px',
          borderRadius:12, fontWeight:800 }}>{badge}</span>
        <span style={{ fontSize:11, fontWeight:700, color:'#374151', textTransform:'uppercase',
          letterSpacing:0.8 }}>{label}</span>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:5, maxHeight:200, overflowY:'auto' }}>
        {available.length === 0
          ? <div style={{ padding:'20px', textAlign:'center', color:'#94a3b8', fontSize:12,
              border:'2px dashed #e2e8f0', borderRadius:10 }}>No layers on map</div>
          : available.map(ml => {
              const isSel = value === ml.id;
              return (
                <button key={ml.id} onClick={() => onChange(isSel ? '' : ml.id)}
                  style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px',
                    borderRadius:9, textAlign:'left', width:'100%',
                    background: isSel ? bg : '#f8fafc',
                    border: isSel ? `2px solid ${color}` : '2px solid #e2e8f0',
                    cursor:'pointer', transition:'all 0.1s' }}
                >
                  <div style={{ width:22, height:22, borderRadius:6, flexShrink:0,
                    background: isSel ? color : '#e2e8f0',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:12, color:'#fff', fontWeight:800 }}>
                    {isSel ? '✓' : ''}
                  </div>
                  <div style={{ flex:1, overflow:'hidden' }}>
                    <div style={{ fontSize:12, fontWeight:600, color:'#1e293b',
                      overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ml.name}</div>
                    <div style={{ fontSize:10, color:'#94a3b8', textTransform:'uppercase', letterSpacing:0.5 }}>{ml.type}</div>
                  </div>
                </button>
              );
            })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Main component
══════════════════════════════════════════════════════════════════════════════ */
export default function SpatialAnalysisModal({
  isOpen, onOpenChange, managedLayers, showNotification, onAnalysisComplete,
}: SpatialAnalysisModalProps) {
  const [mounted, setMounted]             = useState(false);
  // 'operations' | 'queries'
  const [mainTab, setMainTab]             = useState<'operations'|'queries'>('operations');

  // ── Operations state ──
  const [selectedOp, setSelectedOp]       = useState<Operation|null>(null);
  const [activeCategory, setActiveCategory] = useState('Overlay');
  const [selectedIds, setSelectedIds]     = useState<string[]>([]);
  const [opParams, setOpParams]           = useState<Record<string,any>>({});
  const [opProcessing, setOpProcessing]   = useState(false);

  // ── Queries state ──
  const [selectedQuery, setSelectedQuery] = useState<QueryDef|null>(null);
  const [activeQCat, setActiveQCat]       = useState('Topological');
  const [sourceId, setSourceId]           = useState('');
  const [targetId, setTargetId]           = useState('');
  const [qParams, setQParams]             = useState<Record<string,any>>({});
  const [qProcessing, setQProcessing]     = useState(false);
  const [qResult, setQResult]             = useState<{matched:number;source:number;message?:string}|null>(null);

  // Layout
  const [layout, setLayout] = useState(() => computeLayout());
  const dragging  = useRef(false);
  const resizing  = useRef(false);
  const dragOrig  = useRef({ mx:0,my:0,lx:0,ly:0 });
  const resOrig   = useRef({ mx:0,my:0,lw:0,lh:0 });

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (isOpen) setLayout(computeLayout()); }, [isOpen]);

  const bindDrag = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button,input,select,a')) return;
    e.preventDefault();
    dragging.current = true;
    dragOrig.current = { mx:e.clientX, my:e.clientY, lx:layout.x, ly:layout.y };
    const mv = (ev: MouseEvent) => {
      if (!dragging.current) return;
      setLayout(l => ({ ...l, x: dragOrig.current.lx+ev.clientX-dragOrig.current.mx, y: dragOrig.current.ly+ev.clientY-dragOrig.current.my }));
    };
    const up = () => { dragging.current=false; window.removeEventListener('mousemove',mv); window.removeEventListener('mouseup',up); };
    window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
  };

  const bindResize = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    resizing.current = true;
    resOrig.current = { mx:e.clientX, my:e.clientY, lw:layout.w, lh:layout.h };
    const mv = (ev: MouseEvent) => {
      if (!resizing.current) return;
      setLayout(l => ({ ...l,
        w: Math.max(820, resOrig.current.lw+ev.clientX-resOrig.current.mx),
        h: Math.max(560, resOrig.current.lh+ev.clientY-resOrig.current.my),
      }));
    };
    const up = () => { resizing.current=false; window.removeEventListener('mousemove',mv); window.removeEventListener('mouseup',up); };
    window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
  };

  /* ── Operations helpers ──────────────────────────────────────────────── */
  const selectOp = useCallback((op: Operation) => {
    setSelectedOp(op); setSelectedIds([]);
    const def: Record<string,any> = {};
    op.parameters?.forEach(p => { if (p.default!==undefined) def[p.name]=p.default; });
    setOpParams(def);
  }, []);

  const toggleLayer = (id: string) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x!==id);
      if (selectedOp?.maxFiles && prev.length >= selectedOp.maxFiles) {
        showNotification('Limit', `Max ${selectedOp.maxFiles} layers`, 'error'); return prev;
      }
      return [...prev, id];
    });
  };

  const canRunOp = () => {
    if (!selectedOp) return false;
    if (selectedIds.length < selectedOp.minFiles) return false;
    if (selectedOp.maxFiles && selectedIds.length > selectedOp.maxFiles) return false;
    return !selectedOp.parameters?.some(p => p.required && !opParams[p.name] && opParams[p.name]!==0);
  };

  const runOp = async () => {
    if (!selectedOp || !canRunOp()) return;
    setOpProcessing(true);
    showNotification('Processing', `Running ${selectedOp.name}…`, 'info');
    try {
      const fd = new FormData();
      fd.append('operation', selectedOp.id);
      selectedIds.forEach((id, i) => {
        const ml = managedLayers.find(l => l.id===id);
        if (ml?.layer) fd.append(`geojson_${i}`, JSON.stringify(layerToGeoJSON(ml.layer)));
      });
      Object.entries(opParams).forEach(([k,v]) => { if (v!==undefined&&v!==null&&v!=='') fd.append(k,String(v)); });
      const res  = await fetch(`${process.env.NEXT_PUBLIC_DJANGO_URL}/mapplot/spatial/process`, { method:'POST', body:fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Server error ${res.status}`);
      if (data.message) { showNotification('Result', data.message, 'info'); }
      else { onAnalysisComplete(data, selectedOp.name); showNotification('Success', `${selectedOp.name} completed`, 'success'); onOpenChange(false); }
    } catch (err: any) { showNotification('Error', err.message||'Operation failed', 'error'); }
    finally { setOpProcessing(false); }
  };

  /* ── Query helpers ───────────────────────────────────────────────────── */
  const selectQuery = useCallback((q: QueryDef) => {
    setSelectedQuery(q); setSourceId(''); setTargetId(''); setQResult(null);
    const def: Record<string,any> = {};
    q.parameters?.forEach(p => { if (p.default!==undefined) def[p.name]=p.default; });
    setQParams(def);
  }, []);

  const canRunQuery = () => {
    if (!selectedQuery || !sourceId || !targetId) return false;
    return !selectedQuery.parameters?.some(p => p.required && !qParams[p.name] && qParams[p.name]!==0);
  };

  const runQuery = async () => {
    if (!selectedQuery || !canRunQuery()) return;
    setQProcessing(true); setQResult(null);
    showNotification('Processing', `Running query: ${selectedQuery.name}…`, 'info');
    try {
      const fd = new FormData();
      fd.append('query_type', selectedQuery.id);
      const srcML = managedLayers.find(l => l.id===sourceId);
      const tgtML = managedLayers.find(l => l.id===targetId);
      if (!srcML?.layer || !tgtML?.layer) throw new Error('Could not find selected layers');
      fd.append('geojson_0', JSON.stringify(layerToGeoJSON(srcML.layer)));
      fd.append('geojson_1', JSON.stringify(layerToGeoJSON(tgtML.layer)));
      Object.entries(qParams).forEach(([k,v]) => { if (v!==undefined&&v!==null&&v!=='') fd.append(k,String(v)); });
      const res  = await fetch(`${process.env.NEXT_PUBLIC_DJANGO_URL}/mapplot/spatial/query`, { method:'POST', body:fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Server error ${res.status}`);
      if (data.message) {
        setQResult({ matched:0, source: data.source_count??0, message: data.message });
        showNotification('Result', data.message, 'info');
      } else {
        const matched = data.matched_count ?? data.features?.length ?? 0;
        setQResult({ matched, source: data.source_count??0 });
        onAnalysisComplete(data, selectedQuery.name);
        showNotification('Success', `${selectedQuery.name}: ${matched} features matched`, 'success');
      }
    } catch (err: any) { showNotification('Error', err.message||'Query failed', 'error'); }
    finally { setQProcessing(false); }
  };

  if (!isOpen || !mounted) return null;

  const cat           = getCat(activeCategory);
  const filteredOps   = OPERATIONS.filter(o => o.category===activeCategory);
  const selectedNames = selectedIds.map(id => managedLayers.find(l => l.id===id)?.name ?? id);
  const needMore      = selectedOp ? Math.max(0, selectedOp.minFiles - selectedIds.length) : 0;
  const opReady       = canRunOp();

  const qcat          = getQCat(activeQCat);
  const filteredQs    = QUERIES.filter(q => q.category===activeQCat);
  const qReady        = canRunQuery();

  // shared button styles
  const hdrBtn = (extra: React.CSSProperties = {}): React.CSSProperties => ({
    background:'rgba(255,255,255,0.08)', color:'#94a3b8',
    border:'1px solid rgba(255,255,255,0.15)', borderRadius:8, width:32, height:32,
    display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:14,
    ...extra,
  });

  return createPortal(
    <div style={{ position:'fixed', inset:0, zIndex:99998, pointerEvents:'all',
      background:'rgba(2,6,23,0.65)', backdropFilter:'blur(4px)' }}
      onClick={e => { if (e.target===e.currentTarget) onOpenChange(false); }}
    >
      <div onClick={e => e.stopPropagation()} style={{
        position:'absolute', left:layout.x, top:layout.y,
        width:layout.w, height:layout.h, minWidth:820, minHeight:560,
        background:'#fff', borderRadius:16,
        boxShadow:'0 40px 120px rgba(0,0,0,0.35), 0 0 0 1px rgba(0,0,0,0.07)',
        display:'flex', flexDirection:'column', overflow:'hidden', pointerEvents:'all',
      }}>

        {/* ══ HEADER ══════════════════════════════════════════════════════ */}
        <div onMouseDown={bindDrag} style={{
          height:58, flexShrink:0, display:'flex', alignItems:'center',
          justifyContent:'space-between', padding:'0 16px',
          background:'linear-gradient(105deg,#0f172a 0%,#1e3a8a 50%,#2563eb 100%)',
          cursor:'grab', userSelect:'none',
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <svg width="12" height="20" fill="rgba(255,255,255,0.35)">
              {[0,7,14].map(y=>[0,6].map(x=><circle key={`${x}${y}`} cx={x+1} cy={y+2} r="2"/>))}
            </svg>
            <div style={{ width:34, height:34, borderRadius:10, background:'rgba(255,255,255,0.12)',
              display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>🔬</div>
            {/* Main tab switcher */}
            <div style={{ display:'flex', gap:3, background:'rgba(0,0,0,0.2)', padding:3, borderRadius:10 }}>
              {(['operations','queries'] as const).map(tab => (
                <button key={tab} onMouseDown={e=>e.stopPropagation()} onClick={()=>setMainTab(tab)}
                  style={{ padding:'5px 14px', borderRadius:7, border:'none', cursor:'pointer',
                    background: mainTab===tab ? '#fff' : 'transparent',
                    color: mainTab===tab ? '#1e3a8a' : '#93c5fd',
                    fontWeight: mainTab===tab ? 700 : 500, fontSize:12,
                    transition:'all 0.15s' }}>
                  {tab === 'operations' ? '⚙ Operations' : '🔍 Spatial Queries'}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:6 }} onMouseDown={e=>e.stopPropagation()}>
            <span style={{ fontSize:10, color:'#bfdbfe', background:'rgba(255,255,255,0.08)',
              padding:'2px 10px', borderRadius:20, border:'1px solid rgba(255,255,255,0.12)' }}>
              {managedLayers.length} layer{managedLayers.length!==1?'s':''} loaded
            </span>
            <button onClick={()=>setLayout({...computeLayout(),x:16,y:16,w:window.innerWidth-32,h:window.innerHeight-32})} title="Maximise" style={hdrBtn()}>⤢</button>
            <button onClick={()=>setLayout(computeLayout())} title="Reset" style={hdrBtn()}>⊡</button>
            <button onClick={()=>onOpenChange(false)} style={hdrBtn({ background:'rgba(239,68,68,0.15)', color:'#fca5a5', border:'1px solid rgba(239,68,68,0.25)', fontWeight:700, fontSize:16 })}>✕</button>
          </div>
        </div>

        {/* ══ BODY ════════════════════════════════════════════════════════ */}
        {mainTab === 'operations' ? (

          /* ─────────────── OPERATIONS TAB ─────────────────────────────── */
          <div style={{ display:'flex', flex:1, overflow:'hidden' }}>

            {/* Col 1: Categories */}
            <div style={{ width:148, background:'#f8fafc', borderRight:'1px solid #e2e8f0',
              flexShrink:0, display:'flex', flexDirection:'column', padding:'14px 10px', gap:3 }}>
              <div style={{ fontSize:9, fontWeight:800, color:'#94a3b8', letterSpacing:2,
                textTransform:'uppercase', padding:'0 6px 10px' }}>Category</div>
              {CATS.map(c => {
                const active = activeCategory===c.id;
                return (
                  <button key={c.id} onClick={()=>{setActiveCategory(c.id);setSelectedOp(null);setSelectedIds([]);}}
                    style={{ display:'flex', alignItems:'center', gap:9, padding:'11px 12px',
                      borderRadius:10, border:'none', textAlign:'left', width:'100%',
                      background: active ? c.color : 'transparent', color: active ? '#fff' : '#475569',
                      cursor:'pointer', fontWeight: active ? 700 : 500, fontSize:13,
                      boxShadow: active ? `0 2px 10px ${c.color}50` : 'none', transition:'all 0.15s' }}
                    onMouseEnter={e=>{ if(!active)(e.currentTarget as HTMLElement).style.background='#e2e8f0'; }}
                    onMouseLeave={e=>{ if(!active)(e.currentTarget as HTMLElement).style.background='transparent'; }}
                  >
                    <span style={{ fontSize:16 }}>{c.icon}</span>{c.label}
                  </button>
                );
              })}
              <div style={{ marginTop:'auto', borderTop:'1px solid #e2e8f0', paddingTop:10,
                fontSize:10, color:'#94a3b8', textAlign:'center' }}>
                {managedLayers.length} layer{managedLayers.length!==1?'s':''} loaded
              </div>
            </div>

            {/* Col 2: Op list */}
            <div style={{ width:210, borderRight:'1px solid #e2e8f0',
              display:'flex', flexDirection:'column', flexShrink:0, overflow:'hidden' }}>
              <div style={{ padding:'12px 14px 8px', borderBottom:'1px solid #e2e8f0', background:cat.bg, flexShrink:0 }}>
                <div style={{ fontSize:11, fontWeight:800, color:cat.color, letterSpacing:1.2, textTransform:'uppercase' }}>
                  {cat.icon} {cat.label}
                </div>
                <div style={{ fontSize:11, color:'#94a3b8', marginTop:1 }}>{filteredOps.length} operations</div>
              </div>
              <div style={{ flex:1, overflowY:'auto', padding:'8px' }}>
                {filteredOps.map(op => {
                  const active = selectedOp?.id===op.id;
                  return (
                    <button key={op.id} onClick={()=>selectOp(op)}
                      style={{ display:'flex', alignItems:'flex-start', gap:10, width:'100%',
                        padding:'11px 12px', borderRadius:10, marginBottom:3, border:'none',
                        textAlign:'left', cursor:'pointer',
                        background: active ? cat.bg : 'transparent',
                        boxShadow: active ? `inset 3px 0 0 ${cat.color}` : 'none', transition:'all 0.1s' }}
                      onMouseEnter={e=>{ if(!active)(e.currentTarget as HTMLElement).style.background='#f8fafc'; }}
                      onMouseLeave={e=>{ if(!active)(e.currentTarget as HTMLElement).style.background='transparent'; }}
                    >
                      <span style={{ fontSize:19, flexShrink:0, width:24, textAlign:'center', color: active ? cat.color : '#94a3b8', lineHeight:1.2 }}>{op.icon}</span>
                      <div>
                        <div style={{ fontSize:13, fontWeight:600, color: active ? cat.color : '#1e293b', lineHeight:1.3 }}>{op.name}</div>
                        <div style={{ fontSize:10, color:'#94a3b8', marginTop:2 }}>
                          {op.minFiles===op.maxFiles?`${op.minFiles} layer${op.minFiles>1?'s':''}`:
                            `${op.minFiles}${op.maxFiles?`–${op.maxFiles}`:'+'} layers`}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Col 3: Op config */}
            <div style={{ flex:1, overflowY:'auto', background:'#fafbfc', display:'flex', flexDirection:'column' }}>
              {!selectedOp ? (
                <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center',
                  justifyContent:'center', padding:48, gap:20, color:'#94a3b8' }}>
                  <div style={{ fontSize:80 }}>🗺️</div>
                  <div style={{ fontSize:18, fontWeight:800, color:'#64748b' }}>Select an Operation</div>
                  <div style={{ fontSize:13, color:'#94a3b8', textAlign:'center', maxWidth:300, lineHeight:1.7 }}>
                    Pick a category on the left, then click an operation to configure it.
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, width:'100%', maxWidth:380, marginTop:8 }}>
                    {CATS.map(c => (
                      <button key={c.id} onClick={()=>setActiveCategory(c.id)}
                        style={{ padding:'14px 16px', borderRadius:12, border:`2px solid ${c.color}25`,
                          background:`${c.color}08`, cursor:'pointer', textAlign:'left', transition:'all 0.15s' }}
                        onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background=`${c.color}18`}
                        onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background=`${c.color}08`}
                      >
                        <div style={{ fontSize:22, marginBottom:4 }}>{c.icon}</div>
                        <div style={{ fontSize:12, fontWeight:700, color:c.color }}>{c.label}</div>
                        <div style={{ fontSize:10, color:'#94a3b8', marginTop:2 }}>
                          {OPERATIONS.filter(o=>o.category===c.id).length} ops
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ padding:'22px 26px', display:'flex', flexDirection:'column', gap:18, flex:1 }}>
                  {/* Op header */}
                  <div style={{ display:'flex', gap:14, padding:'16px 20px', background:'#fff',
                    border:`1.5px solid ${cat.color}25`, borderRadius:12, boxShadow:'0 1px 5px rgba(0,0,0,0.05)' }}>
                    <div style={{ width:50, height:50, borderRadius:13, background:cat.bg,
                      display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, flexShrink:0 }}>
                      {selectedOp.icon}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:17, fontWeight:800, color:'#0f172a' }}>{selectedOp.name}</div>
                      <div style={{ fontSize:12, color:'#64748b', marginTop:3, lineHeight:1.5 }}>{selectedOp.description}</div>
                      <div style={{ display:'flex', gap:6, marginTop:7 }}>
                        <span style={{ background:cat.color, color:'#fff', fontSize:10, padding:'2px 9px', borderRadius:20, fontWeight:700 }}>{cat.label}</span>
                        <span style={{ background:'#f1f5f9', color:'#475569', fontSize:10, padding:'2px 9px', borderRadius:20 }}>
                          {selectedOp.minFiles}{selectedOp.maxFiles&&selectedOp.maxFiles!==selectedOp.minFiles?`–${selectedOp.maxFiles}`:''} layer{selectedOp.minFiles>1?'s':''} required
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Layer selection */}
                  <div style={{ background:'#fff', borderRadius:12, border:'1.5px solid #e2e8f0', overflow:'hidden' }}>
                    <div style={{ padding:'11px 16px', background:cat.bg, borderBottom:`1px solid ${cat.color}20`,
                      display:'flex', alignItems:'center', gap:10 }}>
                      <div style={{ width:22, height:22, borderRadius:6, background:cat.color,
                        display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:11, fontWeight:800 }}>1</div>
                      <span style={{ fontSize:13, fontWeight:700, color:'#1e293b' }}>Select &amp; Order Layers</span>
                      <span style={{ marginLeft:'auto', fontSize:11,
                        color: needMore>0 ? '#b45309' : '#065f46',
                        background: needMore>0 ? '#fef3c7' : '#d1fae5',
                        padding:'2px 9px', borderRadius:10, fontWeight:600 }}>
                        {needMore>0 ? `${needMore} more needed` : selectedIds.length>=selectedOp.minFiles ? '✓ Ready' : `${selectedIds.length}/${selectedOp.minFiles}`}
                      </span>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 46px 1fr' }}>
                      <div style={{ padding:'12px 14px' }}>
                        <div style={{ fontSize:10, fontWeight:700, color:'#94a3b8', letterSpacing:1.1, textTransform:'uppercase', marginBottom:8 }}>Available</div>
                        <div style={{ display:'flex', flexDirection:'column', gap:5, maxHeight:220, overflowY:'auto' }}>
                          {managedLayers.length===0
                            ? <div style={{ padding:'24px', textAlign:'center', color:'#94a3b8', fontSize:12, border:'2px dashed #e2e8f0', borderRadius:10 }}>No layers</div>
                            : managedLayers.map(ml => {
                                const isSel = selectedIds.includes(ml.id);
                                const idx   = selectedIds.indexOf(ml.id);
                                return (
                                  <button key={ml.id} onClick={()=>toggleLayer(ml.id)}
                                    style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 11px',
                                      borderRadius:9, textAlign:'left', width:'100%',
                                      background: isSel ? cat.bg : '#f8fafc',
                                      border: isSel ? `2px solid ${cat.color}` : '2px solid #e2e8f0',
                                      cursor:'pointer', transition:'all 0.1s' }}
                                  >
                                    <div style={{ width:22, height:22, borderRadius:6, flexShrink:0,
                                      background: isSel ? cat.color : '#e2e8f0',
                                      display:'flex', alignItems:'center', justifyContent:'center',
                                      fontSize:11, color:'#fff', fontWeight:800 }}>
                                      {isSel ? idx+1 : ''}
                                    </div>
                                    <div style={{ flex:1, overflow:'hidden' }}>
                                      <div style={{ fontSize:12, fontWeight:600, color:'#1e293b', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ml.name}</div>
                                      <div style={{ fontSize:10, color:'#94a3b8', textTransform:'uppercase', letterSpacing:0.4 }}>{ml.type}</div>
                                    </div>
                                    {isSel && <span style={{ color:cat.color, fontWeight:800 }}>✓</span>}
                                  </button>
                                );
                              })}
                        </div>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', borderLeft:'1px solid #f1f5f9', borderRight:'1px solid #f1f5f9' }}>
                        <div style={{ width:28, height:28, borderRadius:'50%', background:cat.bg, display:'flex', alignItems:'center', justifyContent:'center', color:cat.color, fontSize:14, fontWeight:800 }}>→</div>
                      </div>
                      <div style={{ padding:'12px 14px' }}>
                        <div style={{ fontSize:10, fontWeight:700, color:'#94a3b8', letterSpacing:1.1, textTransform:'uppercase', marginBottom:8 }}>Order (drag)</div>
                        {selectedIds.length===0
                          ? <div style={{ border:'2px dashed #e2e8f0', borderRadius:10, padding:'32px 12px', textAlign:'center', color:'#cbd5e1', fontSize:12 }}>← Click layers to add</div>
                          : <>
                              <LayerOrderList ordered={selectedNames} labels={selectedOp.layerLabels} color={cat.color}
                                onReorder={names => {
                                  const m = Object.fromEntries(selectedIds.map(id => [managedLayers.find(l=>l.id===id)?.name??id, id]));
                                  setSelectedIds(names.map(n=>m[n]).filter(Boolean));
                                }} />
                              {selectedOp.layerLabels && (
                                <div style={{ marginTop:8, padding:'8px 11px', background:'#fffbeb', border:'1px solid #fde68a', borderRadius:8 }}>
                                  {selectedOp.layerLabels.map((lbl,i) => (
                                    <div key={i} style={{ fontSize:11, color:'#78350f', lineHeight:1.9 }}>
                                      <span style={{ fontFamily:'monospace', background:'#fef3c7', padding:'0 4px', borderRadius:3, fontWeight:700 }}>#{i+1}</span>{' '}{lbl}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </>}
                      </div>
                    </div>
                  </div>

                  {/* Parameters */}
                  {selectedOp.parameters && selectedOp.parameters.length>0 && (
                    <div style={{ background:'#fff', borderRadius:12, border:'1.5px solid #e2e8f0', overflow:'hidden' }}>
                      <div style={{ padding:'11px 16px', background:cat.bg, borderBottom:`1px solid ${cat.color}20`,
                        display:'flex', alignItems:'center', gap:10 }}>
                        <div style={{ width:22, height:22, borderRadius:6, background:cat.color,
                          display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:11, fontWeight:800 }}>2</div>
                        <span style={{ fontSize:13, fontWeight:700, color:'#1e293b' }}>Parameters</span>
                      </div>
                      <div style={{ padding:'16px 18px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                        {selectedOp.parameters.map(param => (
                          <div key={param.name}>
                            <label style={{ display:'block', fontSize:12, fontWeight:700, color:'#374151', marginBottom:5 }}>
                              {param.label}{param.required && <span style={{ color:'#ef4444', marginLeft:3 }}>*</span>}
                            </label>
                            {param.type==='select'
                              ? <select value={opParams[param.name]??param.default??''} onChange={e=>setOpParams(p=>({...p,[param.name]:e.target.value}))}
                                  style={{ width:'100%', padding:'9px 12px', border:'1.5px solid #d1d5db', borderRadius:8, fontSize:13, outline:'none', background:'#fff', cursor:'pointer' }}>
                                  {param.options?.map(opt=><option key={opt} value={opt}>{opt.charAt(0).toUpperCase()+opt.slice(1).replace(/_/g,' ')}</option>)}
                                </select>
                              : <input type={param.type} value={opParams[param.name]??param.default??''}
                                  onChange={e=>setOpParams(p=>({...p,[param.name]:e.target.value}))}
                                  placeholder={param.placeholder??(param.default!==undefined?String(param.default):'')}
                                  style={{ width:'100%', padding:'9px 12px', border:'1.5px solid #d1d5db', borderRadius:8, fontSize:13, outline:'none', boxSizing:'border-box' }} />}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Execute */}
                  <div style={{ display:'flex', gap:10, paddingTop:4, marginTop:'auto' }}>
                    <button onClick={runOp} disabled={!opReady||opProcessing}
                      style={{ flex:1, padding:'14px 24px', borderRadius:11, fontWeight:800, fontSize:14, border:'none',
                        cursor: opReady&&!opProcessing ? 'pointer' : 'not-allowed',
                        background: opReady&&!opProcessing ? `linear-gradient(135deg,${cat.color},${cat.color}bb)` : '#e2e8f0',
                        color: opReady&&!opProcessing ? '#fff' : '#94a3b8',
                        boxShadow: opReady&&!opProcessing ? `0 6px 20px ${cat.color}40` : 'none', transition:'all 0.2s' }}>
                      {opProcessing ? '⏳  Processing…' : `${selectedOp.icon}  Execute ${selectedOp.name}`}
                    </button>
                    <button onClick={()=>{setSelectedOp(null);setSelectedIds([]);}}
                      style={{ padding:'14px 18px', borderRadius:11, fontWeight:600, fontSize:13, cursor:'pointer', background:'#f1f5f9', color:'#475569', border:'1.5px solid #e2e8f0' }}>← Back</button>
                    <button onClick={()=>onOpenChange(false)}
                      style={{ padding:'14px 18px', borderRadius:11, fontWeight:600, fontSize:13, cursor:'pointer', background:'#fff', color:'#94a3b8', border:'1.5px solid #e2e8f0' }}>Close</button>
                  </div>
                </div>
              )}
            </div>
          </div>

        ) : (

          /* ─────────────── SPATIAL QUERIES TAB ────────────────────────── */
          <div style={{ display:'flex', flex:1, overflow:'hidden' }}>

            {/* Col 1: Query categories */}
            <div style={{ width:148, background:'#f8fafc', borderRight:'1px solid #e2e8f0',
              flexShrink:0, display:'flex', flexDirection:'column', padding:'14px 10px', gap:3 }}>
              <div style={{ fontSize:9, fontWeight:800, color:'#94a3b8', letterSpacing:2,
                textTransform:'uppercase', padding:'0 6px 10px' }}>Query Type</div>
              {QUERY_CATS.map(c => {
                const active = activeQCat===c.id;
                return (
                  <button key={c.id} onClick={()=>{setActiveQCat(c.id);setSelectedQuery(null);setQResult(null);}}
                    style={{ display:'flex', alignItems:'center', gap:9, padding:'11px 12px',
                      borderRadius:10, border:'none', textAlign:'left', width:'100%',
                      background: active ? c.color : 'transparent', color: active ? '#fff' : '#475569',
                      cursor:'pointer', fontWeight: active ? 700 : 500, fontSize:13,
                      boxShadow: active ? `0 2px 10px ${c.color}50` : 'none', transition:'all 0.15s' }}
                    onMouseEnter={e=>{ if(!active)(e.currentTarget as HTMLElement).style.background='#e2e8f0'; }}
                    onMouseLeave={e=>{ if(!active)(e.currentTarget as HTMLElement).style.background='transparent'; }}
                  >
                    <span style={{ fontSize:16 }}>{c.icon}</span>{c.label}
                  </button>
                );
              })}
              <div style={{ marginTop:'auto', borderTop:'1px solid #e2e8f0', paddingTop:10 }}>
                <div style={{ fontSize:10, color:'#94a3b8', textAlign:'center', lineHeight:1.6 }}>
                  Source → SELECT FROM<br/>
                  Target → CONDITION
                </div>
              </div>
            </div>

            {/* Col 2: Query list */}
            <div style={{ width:210, borderRight:'1px solid #e2e8f0',
              display:'flex', flexDirection:'column', flexShrink:0, overflow:'hidden' }}>
              <div style={{ padding:'12px 14px 8px', borderBottom:'1px solid #e2e8f0', background:qcat.bg, flexShrink:0 }}>
                <div style={{ fontSize:11, fontWeight:800, color:qcat.color, letterSpacing:1.2, textTransform:'uppercase' }}>
                  {qcat.icon} {qcat.label}
                </div>
                <div style={{ fontSize:11, color:'#94a3b8', marginTop:1 }}>{filteredQs.length} queries</div>
              </div>
              <div style={{ flex:1, overflowY:'auto', padding:'8px' }}>
                {filteredQs.map(q => {
                  const active = selectedQuery?.id===q.id;
                  return (
                    <button key={q.id} onClick={()=>selectQuery(q)}
                      style={{ display:'flex', alignItems:'flex-start', gap:10, width:'100%',
                        padding:'11px 12px', borderRadius:10, marginBottom:3, border:'none',
                        textAlign:'left', cursor:'pointer',
                        background: active ? qcat.bg : 'transparent',
                        boxShadow: active ? `inset 3px 0 0 ${qcat.color}` : 'none', transition:'all 0.1s' }}
                      onMouseEnter={e=>{ if(!active)(e.currentTarget as HTMLElement).style.background='#f8fafc'; }}
                      onMouseLeave={e=>{ if(!active)(e.currentTarget as HTMLElement).style.background='transparent'; }}
                    >
                      <span style={{ fontSize:18, flexShrink:0, width:24, textAlign:'center', color: active ? qcat.color : '#94a3b8', lineHeight:1.2 }}>{q.icon}</span>
                      <div>
                        <div style={{ fontSize:12, fontWeight:600, color: active ? qcat.color : '#1e293b', lineHeight:1.3 }}>{q.name}</div>
                        <div style={{ fontSize:10, color:'#94a3b8', marginTop:2 }}>Source + Target</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Col 3: Query config */}
            <div style={{ flex:1, overflowY:'auto', background:'#fafbfc', display:'flex', flexDirection:'column' }}>
              {!selectedQuery ? (
                <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center',
                  justifyContent:'center', padding:48, gap:20, color:'#94a3b8' }}>
                  <div style={{ fontSize:80 }}>🔍</div>
                  <div style={{ fontSize:18, fontWeight:800, color:'#64748b' }}>Spatial Queries</div>
                  <div style={{ fontSize:13, color:'#94a3b8', textAlign:'center', maxWidth:340, lineHeight:1.7 }}>
                    Spatial queries let you <strong style={{ color:'#475569' }}>select features from a Source layer</strong> based on their
                    spatial relationship with a <strong style={{ color:'#475569' }}>Target layer</strong>.<br/><br/>
                    Pick a query type from the left to get started.
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, width:'100%', maxWidth:380, marginTop:8 }}>
                    {QUERY_CATS.map(c => (
                      <button key={c.id} onClick={()=>setActiveQCat(c.id)}
                        style={{ padding:'14px 16px', borderRadius:12, border:`2px solid ${c.color}25`,
                          background:`${c.color}08`, cursor:'pointer', textAlign:'left', transition:'all 0.15s' }}
                        onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background=`${c.color}18`}
                        onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background=`${c.color}08`}
                      >
                        <div style={{ fontSize:22, marginBottom:4 }}>{c.icon}</div>
                        <div style={{ fontSize:12, fontWeight:700, color:c.color }}>{c.label}</div>
                        <div style={{ fontSize:10, color:'#94a3b8', marginTop:2 }}>
                          {QUERIES.filter(q=>q.category===c.id).length} queries
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ padding:'22px 26px', display:'flex', flexDirection:'column', gap:18, flex:1 }}>

                  {/* Query header */}
                  <div style={{ display:'flex', gap:14, padding:'16px 20px', background:'#fff',
                    border:`1.5px solid ${qcat.color}25`, borderRadius:12, boxShadow:'0 1px 5px rgba(0,0,0,0.05)' }}>
                    <div style={{ width:50, height:50, borderRadius:13, background:qcat.bg,
                      display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, flexShrink:0 }}>
                      {selectedQuery.icon}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:17, fontWeight:800, color:'#0f172a' }}>{selectedQuery.name}</div>
                      <div style={{ fontSize:12, color:'#64748b', marginTop:3, lineHeight:1.5 }}>{selectedQuery.description}</div>
                      <div style={{ display:'flex', gap:6, marginTop:7, flexWrap:'wrap' }}>
                        <span style={{ background:qcat.color, color:'#fff', fontSize:10, padding:'2px 9px', borderRadius:20, fontWeight:700 }}>{qcat.label}</span>
                        <span style={{ background:'#f1f5f9', color:'#475569', fontSize:10, padding:'2px 9px', borderRadius:20 }}>Source + Target layers</span>
                        <span style={{ background:'#f0fdf4', color:'#065f46', fontSize:10, padding:'2px 9px', borderRadius:20 }}>
                          SELECT FROM source WHERE … target
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Result banner */}
                  {qResult && (
                    <div style={{ padding:'12px 18px', background: qResult.matched>0 ? '#f0fdf4' : '#fef3c7',
                      border:`1.5px solid ${qResult.matched>0 ? '#86efac' : '#fde68a'}`,
                      borderRadius:10, display:'flex', alignItems:'center', gap:12 }}>
                      <span style={{ fontSize:20 }}>{qResult.matched>0 ? '✅' : '⚠️'}</span>
                      <div>
                        {qResult.message
                          ? <div style={{ fontSize:13, fontWeight:600, color:'#92400e' }}>{qResult.message}</div>
                          : <><div style={{ fontSize:13, fontWeight:700, color:'#065f46' }}>
                              {qResult.matched} of {qResult.source} source features matched
                            </div>
                            <div style={{ fontSize:11, color:'#047857' }}>Result added to map as new layer</div></>}
                      </div>
                    </div>
                  )}

                  {/* Layer pickers: source + target */}
                  <div style={{ background:'#fff', borderRadius:12, border:'1.5px solid #e2e8f0', overflow:'hidden' }}>
                    <div style={{ padding:'11px 16px', background:qcat.bg, borderBottom:`1px solid ${qcat.color}20`,
                      display:'flex', alignItems:'center', gap:10 }}>
                      <div style={{ width:22, height:22, borderRadius:6, background:qcat.color,
                        display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:11, fontWeight:800 }}>1</div>
                      <span style={{ fontSize:13, fontWeight:700, color:'#1e293b' }}>Select Source &amp; Target Layers</span>
                      {sourceId && targetId
                        ? <span style={{ marginLeft:'auto', fontSize:11, color:'#065f46', background:'#d1fae5', padding:'2px 9px', borderRadius:10, fontWeight:600 }}>✓ Ready</span>
                        : <span style={{ marginLeft:'auto', fontSize:11, color:'#b45309', background:'#fef3c7', padding:'2px 9px', borderRadius:10, fontWeight:600 }}>
                            {!sourceId && !targetId ? 'Select both layers' : !sourceId ? 'Select source' : 'Select target'}
                          </span>}
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:0 }}>
                      {/* Source */}
                      <div style={{ padding:'14px 16px', borderRight:'1px solid #f1f5f9' }}>
                        <LayerPicker
                          label={selectedQuery.layerLabels[0]}
                          badge="SOURCE"
                          color={qcat.color}
                          bg={qcat.bg}
                          value={sourceId}
                          onChange={setSourceId}
                          layers={managedLayers}
                          exclude={targetId}
                        />
                        <div style={{ marginTop:8, padding:'7px 10px', background:'#f0f9ff',
                          border:'1px solid #bae6fd', borderRadius:7, fontSize:11, color:'#0369a1' }}>
                          ← SELECT FROM this layer
                        </div>
                      </div>
                      {/* Target */}
                      <div style={{ padding:'14px 16px' }}>
                        <LayerPicker
                          label={selectedQuery.layerLabels[1]}
                          badge="TARGET"
                          color="#6b7280"
                          bg="#f9fafb"
                          value={targetId}
                          onChange={setTargetId}
                          layers={managedLayers}
                          exclude={sourceId}
                        />
                        <div style={{ marginTop:8, padding:'7px 10px', background:'#faf5ff',
                          border:'1px solid #d8b4fe', borderRadius:7, fontSize:11, color:'#7e22ce' }}>
                          ← Spatial condition layer
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Query parameters */}
                  {selectedQuery.parameters && selectedQuery.parameters.length>0 && (
                    <div style={{ background:'#fff', borderRadius:12, border:'1.5px solid #e2e8f0', overflow:'hidden' }}>
                      <div style={{ padding:'11px 16px', background:qcat.bg, borderBottom:`1px solid ${qcat.color}20`,
                        display:'flex', alignItems:'center', gap:10 }}>
                        <div style={{ width:22, height:22, borderRadius:6, background:qcat.color,
                          display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:11, fontWeight:800 }}>2</div>
                        <span style={{ fontSize:13, fontWeight:700, color:'#1e293b' }}>Parameters</span>
                      </div>
                      <div style={{ padding:'16px 18px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                        {selectedQuery.parameters.map(param => (
                          <div key={param.name}>
                            <label style={{ display:'block', fontSize:12, fontWeight:700, color:'#374151', marginBottom:5 }}>
                              {param.label}{param.required && <span style={{ color:'#ef4444', marginLeft:3 }}>*</span>}
                            </label>
                            {param.type==='select'
                              ? <select value={qParams[param.name]??param.default??''} onChange={e=>setQParams(p=>({...p,[param.name]:e.target.value}))}
                                  style={{ width:'100%', padding:'9px 12px', border:'1.5px solid #d1d5db', borderRadius:8, fontSize:13, outline:'none', background:'#fff', cursor:'pointer' }}>
                                  {param.options?.map(opt=><option key={opt} value={opt}>{opt.charAt(0).toUpperCase()+opt.slice(1).replace(/_/g,' ')}</option>)}
                                </select>
                              : <input type={param.type} value={qParams[param.name]??param.default??''}
                                  onChange={e=>setQParams(p=>({...p,[param.name]:e.target.value}))}
                                  placeholder={param.placeholder??(param.default!==undefined?String(param.default):'')}
                                  style={{ width:'100%', padding:'9px 12px', border:'1.5px solid #d1d5db', borderRadius:8, fontSize:13, outline:'none', boxSizing:'border-box' }} />}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Run query */}
                  <div style={{ display:'flex', gap:10, paddingTop:4, marginTop:'auto' }}>
                    <button onClick={runQuery} disabled={!qReady||qProcessing}
                      style={{ flex:1, padding:'14px 24px', borderRadius:11, fontWeight:800, fontSize:14, border:'none',
                        cursor: qReady&&!qProcessing ? 'pointer' : 'not-allowed',
                        background: qReady&&!qProcessing ? `linear-gradient(135deg,${qcat.color},${qcat.color}bb)` : '#e2e8f0',
                        color: qReady&&!qProcessing ? '#fff' : '#94a3b8',
                        boxShadow: qReady&&!qProcessing ? `0 6px 20px ${qcat.color}40` : 'none', transition:'all 0.2s' }}>
                      {qProcessing ? '⏳  Running Query…' : `${selectedQuery.icon}  Run: ${selectedQuery.name}`}
                    </button>
                    <button onClick={()=>{setSelectedQuery(null);setQResult(null);}}
                      style={{ padding:'14px 18px', borderRadius:11, fontWeight:600, fontSize:13, cursor:'pointer', background:'#f1f5f9', color:'#475569', border:'1.5px solid #e2e8f0' }}>← Back</button>
                    <button onClick={()=>onOpenChange(false)}
                      style={{ padding:'14px 18px', borderRadius:11, fontWeight:600, fontSize:13, cursor:'pointer', background:'#fff', color:'#94a3b8', border:'1.5px solid #e2e8f0' }}>Close</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Resize handle */}
        <div onMouseDown={bindResize} title="Drag to resize"
          style={{ position:'absolute', bottom:0, right:0, width:22, height:22,
            cursor:'se-resize', zIndex:10, display:'flex', alignItems:'flex-end', justifyContent:'flex-end', padding:5 }}>
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path d="M11 1L1 11M7 1L1 7M11 5L5 11" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
      </div>
    </div>,
    document.body
  );
}