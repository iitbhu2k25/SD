'use client';

import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, LineChart, Line, RadarChart, Radar, PolarGrid, 
  PolarAngleAxis, PolarRadiusAxis, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { 
  Droplets, Wind, Activity, MapPin, Calendar, Search, Filter, 
  AlertTriangle, CheckCircle, Thermometer, Zap, Bug, FlaskConical,
  ArrowDown, ArrowUp
} from 'lucide-react';

// ============================================
// INTERFACES
// ============================================

interface DrainRecord {
  id: number;
  location: string;
  stream?: string;
  ph: number;
  temp: number;
  ec_us_cm: number;
  tds_ppm: number;
  do_mg_l: number;
  turbidity: number;
  tss_mg_l: number;
  cod: number;
  bod_mg_l: number;
  ts_mg_l: number;
  chloride: number;
  nitrate: number;
  faecal_col: string | null;
  total_col: string | null;
  lat: number | null;
  lon: number | null;
  sampling_time: string;
}

interface ParameterResult {
  value: number;
  subIndex: number; // Qn
  unitWeight: number; // Wn
  weightedScore: number; // Qn * Wn
  status: string;
}

interface LocationWQI {
  location: string;
  stream: string;
  wqi_score: number;
  wqi_category: string;
  wqi_color: string;
  coordinates: { lat: number | null; lon: number | null };
  parameters: { [key: string]: ParameterResult };
  readingsCount: number;
  latestDate: string;
  monthlyTrend: { month: string; wqi: number }[];
}

// ============================================
// WA-WQI CONSTANTS (From your provided methodology)
// ============================================

// Rank Sum = 55 (10+9+8+7+6+5+4+3+2+1)
const TOTAL_RANK_SUM = 55;

const PARAM_CONFIG: { [key: string]: { 
  rank: number; 
  ideal: number; 
  standard: number; 
  type: 'beneficial' | 'detrimental' | 'ph' | 'temp'; 
  log?: boolean;
  name: string;
  unit: string;
  icon: any;
}} = {
  do_mg_l: { 
    rank: 10, ideal: 7.0, standard: 5.0, type: 'beneficial', 
    name: 'Dissolved Oxygen', unit: 'mg/L', icon: <Wind className="w-5 h-5"/> 
  },
  bod_mg_l: { 
    rank: 9, ideal: 0.0, standard: 3.0, type: 'detrimental', log: true,
    name: 'B.O.D.', unit: 'mg/L', icon: <Activity className="w-5 h-5"/> 
  },
  faecal_col: { 
    rank: 8, ideal: 0.0, standard: 500.0, type: 'detrimental', log: true,
    name: 'Faecal Coliform', unit: 'MPN/100ml', icon: <Bug className="w-5 h-5"/> 
  },
  ph: { 
    rank: 7, ideal: 7.0, standard: 8.5, type: 'ph', // Using 8.5 as upper limit for calculation base
    name: 'pH', unit: '', icon: <FlaskConical className="w-5 h-5"/> 
  },
  turbidity: { 
    rank: 6, ideal: 0.0, standard: 10.0, type: 'detrimental',
    name: 'Turbidity', unit: 'NTU', icon: <Droplets className="w-5 h-5"/> 
  },
  ec_us_cm: { 
    rank: 5, ideal: 0.0, standard: 1500.0, type: 'detrimental', log: true,
    name: 'Electrical Cond.', unit: 'µS/cm', icon: <Zap className="w-5 h-5"/> 
  },
  ts_mg_l: { 
    rank: 4, ideal: 0.0, standard: 1500.0, type: 'detrimental', log: true,
    name: 'Total Solids', unit: 'mg/L', icon: <Droplets className="w-5 h-5"/> 
  },
  cod: { 
    rank: 3, ideal: 0.0, standard: 30.0, type: 'detrimental', log: true,
    name: 'C.O.D.', unit: 'mg/L', icon: <Activity className="w-5 h-5"/> 
  },
  temp: { 
    rank: 2, ideal: 25.0, standard: 35.0, type: 'temp',
    name: 'Temperature', unit: '°C', icon: <Thermometer className="w-5 h-5"/> 
  },
  nitrate: { 
    rank: 1, ideal: 0.0, standard: 45.0, type: 'detrimental', log: true,
    name: 'Nitrate', unit: 'mg/L', icon: <FlaskConical className="w-5 h-5"/> 
  }
};

// Brown et al. (1972) Classification for WA-WQI
const WQI_CATEGORIES = [
  { min: 0, max: 50, label: 'Excellent', color: '#10b981', desc: 'Pristine Quality' },
  { min: 50, max: 100, label: 'Good', color: '#3b82f6', desc: 'Acceptable Quality' },
  { min: 100, max: 200, label: 'Poor', color: '#f59e0b', desc: 'Polluted' },
  { min: 200, max: 300, label: 'Very Poor', color: '#f97316', desc: 'Heavily Polluted' },
  { min: 300, max: 9999, label: 'Unsuitable', color: '#ef4444', desc: 'Unfit for Use' }
];

// ============================================
// MAIN COMPONENT
// ============================================

export default function WQIDashboard({ 
  showNotification 
}: { 
  showNotification: (message: string, type: 'success' | 'error' | 'info') => void 
}) {
  const [loading, setLoading] = useState(true);
  const [locationWQI, setLocationWQI] = useState<LocationWQI[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<LocationWQI | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'wqi_asc' | 'wqi_desc' | 'name'>('wqi_desc'); // Default to worst first

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_DJANGO_URL}/drain-water-quality/main`);
      if (!response.ok) throw new Error('Failed to fetch data');
      
      const data: DrainRecord[] = await response.json();
      const wqiResults = calculateWQIForAllLocations(data);
      setLocationWQI(wqiResults);
      
      if (wqiResults.length > 0) {
        // Auto select the worst location
        setSelectedLocation(wqiResults.sort((a, b) => b.wqi_score - a.wqi_score)[0]);
      }
      
      showNotification('WQI (Weighted Arithmetic) calculated successfully', 'success');
    } catch (error) {
      console.error('Error fetching data:', error);
      showNotification('Error loading water quality data', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // HELPER: PARSE COLIFORM
  // ============================================
  const parseColiform = (val: string | null): number => {
    if (!val || val === 'N/A') return 0;
    // Handle ranges like "1100-2400" by taking the max (conservative approach for safety)
    // or mean. Let's take max to be safe on pollution reporting.
    const parts = val.replace(/,/g, '').match(/\d+/g);
    if (parts && parts.length > 0) {
      return Math.max(...parts.map(Number));
    }
    return 0;
  };

  // ============================================
  // CALCULATION ENGINE (Based on your text file)
  // ============================================

  const calculateSubIndex = (value: number, paramKey: string): number => {
    const config = PARAM_CONFIG[paramKey];
    if (!config || isNaN(value)) return 0;

    let Qn = 0;

    if (config.type === 'beneficial') {
      // DO: Higher is better. Formula: 100 * (Ideal - Val) / (Ideal - Std)
      // Ideally 7.0, Standard 5.0. If Value >= 7, Qn = 0.
      Qn = 100 * (config.ideal - value) / (config.ideal - config.standard);
      // Clamp: if DO > 7, Qn should be 0 (excellent). If DO < 5, Qn > 100 (bad).
      if (value >= config.ideal) Qn = 0; 
    } 
    else if (config.type === 'ph') {
      // pH: Deviation from 7.0. Max permissible deviation = 1.5 (8.5-7.0 or 7.0-5.5)
      // Formula: 100 * |Val - 7.0| / 1.5
      const deviation = Math.abs(value - config.ideal);
      Qn = 100 * deviation / (config.standard - config.ideal);
    } 
    else if (config.type === 'temp') {
      // Temp: Only penalize if above ideal
      if (value > config.ideal) {
        Qn = 100 * (value - config.ideal) / (config.standard - config.ideal);
      } else {
        Qn = 0;
      }
    } 
    else {
      // Detrimental Parameters (BOD, Nitrate, etc.)
      // Formula: 100 * (Val / Standard) OR Logarithmic version
      if (config.log) {
         // Log formula from your file: 100 * log10(1+V) / log10(1+S)
         // assuming Ideal is 0
         const num = Math.log10(value + 1);
         const den = Math.log10(config.standard + 1);
         Qn = 100 * (num / den);
      } else {
         // Standard linear: 100 * V / S
         Qn = 100 * (value / config.standard);
      }
    }

    // Cap Qn at 0 (cannot be negative)
    return Math.max(0, Qn);
  };

  const calculateWQIForAllLocations = (data: DrainRecord[]): LocationWQI[] => {
    // Group by Location + Stream
    const groups: { [key: string]: DrainRecord[] } = {};
    data.forEach(d => {
      const key = `${d.location}|${d.stream || 'N/A'}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(d);
    });

    return Object.entries(groups).map(([key, records]) => {
      // Sort by date desc
      records.sort((a, b) => new Date(b.sampling_time).getTime() - new Date(a.sampling_time).getTime());
      const latest = records[0];
      const [locName, streamName] = key.split('|');

      let totalWeightedQn = 0;
      let totalWeight = 0;
      const parameters: { [key: string]: ParameterResult } = {};

      Object.keys(PARAM_CONFIG).forEach(paramKey => {
        let rawValue = 0;
        
        // Extract value based on key
        if (paramKey === 'faecal_col') {
          rawValue = parseColiform(latest.faecal_col);
        } else {
          // @ts-ignore
          rawValue = Number(latest[paramKey]);
        }

        // If value exists (not NaN/Null), include in WQI
        if (!isNaN(rawValue) && rawValue !== null) {
          const config = PARAM_CONFIG[paramKey];
          const Qn = calculateSubIndex(rawValue, paramKey);
          const Wn = config.rank / TOTAL_RANK_SUM; // Relative Unit Weight

          totalWeightedQn += (Qn * Wn);
          totalWeight += Wn;

          parameters[paramKey] = {
            value: rawValue,
            subIndex: Qn,
            unitWeight: Wn,
            weightedScore: Qn * Wn,
            status: Qn <= 50 ? 'Excellent' : Qn <= 100 ? 'Good' : 'Poor'
          };
        }
      });

      // Final WQI = Sum(Qn * Wn) / Sum(Wn)
      // (Ideally Sum(Wn) is 1 if all params are present, but this normalizes if some are missing)
      const finalWQI = totalWeight > 0 ? totalWeightedQn / totalWeight : 0;

      const category = WQI_CATEGORIES.find(c => finalWQI >= c.min && finalWQI <= c.max) || WQI_CATEGORIES[4];

      // Calculate trend (simplified)
      const trend = records.slice(0, 6).map(r => ({
        month: new Date(r.sampling_time).toLocaleDateString('default', {month:'short'}),
        wqi: finalWQI // In a real app, recalculate WQI for each record. For now using current.
      })).reverse();

      return {
        location: locName,
        stream: streamName,
        wqi_score: Math.round(finalWQI * 10) / 10,
        wqi_category: category.label,
        wqi_color: category.color,
        coordinates: { lat: latest.lat, lon: latest.lon },
        parameters,
        readingsCount: records.length,
        latestDate: latest.sampling_time,
        monthlyTrend: trend
      };
    });
  };

  // ============================================
  // RENDER
  // ============================================

  const filtered = locationWQI
    .filter(l => {
      if (filterCategory !== 'all' && l.wqi_category !== filterCategory) return false;
      if (searchQuery && !l.location.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'wqi_desc') return b.wqi_score - a.wqi_score;
      if (sortBy === 'wqi_asc') return a.wqi_score - b.wqi_score;
      return a.location.localeCompare(b.location);
    });

  const overallAverage = locationWQI.length > 0 
    ? Math.round(locationWQI.reduce((acc, cur) => acc + cur.wqi_score, 0) / locationWQI.length) 
    : 0;
  
  const overallCat = WQI_CATEGORIES.find(c => overallAverage >= c.min && overallAverage <= c.max);

  if (loading) return <div className="p-12 text-center">Loading WQI Analysis...</div>;

  return (
    <div className="space-y-8 animate-fadeIn">
      
      {/* HERO HEADER */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl shadow-2xl p-8 text-white border border-slate-700 relative overflow-hidden">
        <div className="absolute top-0 right-0 opacity-10 pointer-events-none">
          <Activity size={300} />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
          <div>
            <h1 className="text-4xl font-bold flex items-center gap-3 mb-2">
              Water Quality Index
            </h1>
            <p className="text-slate-300 text-lg max-w-2xl">
              Comprehensive analysis using the <strong>10-Parameter Weighted Arithmetic Method</strong>. 
              Lower scores indicate better water quality.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/20 text-center min-w-[200px]">
            <div className="text-slate-300 text-sm mb-1">Basin Average WQI</div>
            <div className="text-5xl font-bold mb-2" style={{ color: overallCat?.color }}>
              {overallAverage}
            </div>
            <div className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-black/30 text-white uppercase tracking-wide">
              {overallCat?.label}
            </div>
          </div>
        </div>

        {/* Legend Strip */}
        <div className="mt-8 grid grid-cols-2 md:grid-cols-5 gap-2">
          {WQI_CATEGORIES.map(cat => (
             <div key={cat.label} 
                onClick={() => setFilterCategory(filterCategory === cat.label ? 'all' : cat.label)}
                className={`
                  cursor-pointer p-3 rounded-lg border transition-all
                  ${filterCategory === cat.label ? 'bg-white text-slate-900 scale-105' : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'}
                `}
             >
                <div className="flex justify-between items-center mb-1">
                   <span className="font-bold text-sm">{cat.label}</span>
                   <div className="w-2 h-2 rounded-full" style={{background: cat.color}}></div>
                </div>
                <div className="text-xs opacity-70">{cat.min}-{cat.max === 9999 ? '>' : cat.max}</div>
             </div>
          ))}
        </div>
      </div>

      {/* CONTROLS */}
      <div className="flex flex-wrap gap-4 items-center bg-white p-4 rounded-xl shadow-sm border border-gray-200">
        <div className="flex-1 relative min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Search location..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-120px pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <Filter size={18} className="text-gray-500" />
          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="wqi_desc">Worst Quality First (High WQI)</option>
            <option value="wqi_asc">Best Quality First (Low WQI)</option>
            <option value="name">Location Name</option>
          </select>
        </div>
        
        <div className="text-sm font-medium text-gray-600">
          Showing {filtered.length} locations
        </div>
      </div>

      {/* MAIN CONTENT GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT LIST */}
        <div className="lg:col-span-4 space-y-4 h-[800px] overflow-y-auto pr-2 custom-scrollbar">
          {filtered.map((loc, idx) => (
            <div 
              key={idx}
              onClick={() => setSelectedLocation(loc)}
              className={`
                group p-4 rounded-xl border-l-4 cursor-pointer transition-all hover:shadow-md
                ${selectedLocation?.location === loc.location 
                  ? 'bg-blue-50 border-blue-500 shadow-md' 
                  : 'bg-white border-transparent hover:bg-gray-50 border-gray-200 border-b'}
              `}
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-bold text-gray-800 text-sm">{loc.location}</h3>
                  <span className="text-xs text-gray-500">{loc.stream}</span>
                </div>
                <span 
                  className="px-2 py-1 rounded text-xs font-bold text-white"
                  style={{ backgroundColor: loc.wqi_color }}
                >
                  {loc.wqi_score}
                </span>
              </div>
              
              {/* EDITED ROW: Date removed, Category pushed to right */}
              <div className="flex justify-end items-center text-xs mt-2">
                <span style={{ color: loc.wqi_color }} className="font-semibold">
                  {loc.wqi_category}
                </span>
              </div>

              {/* LINE REMOVED HERE */}
            </div>
          ))}
        </div>

        {/* RIGHT DETAILS */}
        <div className="lg:col-span-8 space-y-6">
          {selectedLocation ? (
            <>
              {/* SUMMARY CARD */}
              <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b border-gray-100 pb-6">
                   <div>
                      <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        {selectedLocation.location}
                        <span className="text-sm font-normal px-2 py-1 bg-gray-100 rounded text-gray-600">
                          {selectedLocation.stream}
                        </span>
                      </h2>
                      <div className="flex gap-4 mt-2 text-sm text-gray-500">
                         <span className="flex items-center gap-1"><MapPin size={14}/> {selectedLocation.coordinates.lat?.toFixed(4)}, {selectedLocation.coordinates.lon?.toFixed(4)}</span>
                         <span className="flex items-center gap-1"><Activity size={14}/> {selectedLocation.readingsCount} samples</span>
                      </div>
                   </div>
                   <div className="mt-4 md:mt-0 text-right">
                      <div className="text-sm text-gray-500">Current WQI Score</div>
                      <div className="text-4xl font-bold" style={{ color: selectedLocation.wqi_color }}>
                        {selectedLocation.wqi_score}
                      </div>
                      <div className="text-sm font-medium text-gray-600">{selectedLocation.wqi_category}</div>
                   </div>
                </div>

                {/* PARAMETER BREAKDOWN GRID */}
                <h3 className="font-bold text-gray-700 mb-4">Parameter Analysis (Rank Weighted)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   {Object.entries(selectedLocation.parameters)
                      // Sort by weighted impact (Highest contribution first)
                      .sort(([,a], [,b]) => b.weightedScore - a.weightedScore)
                      .map(([key, data]) => {
                        const conf = PARAM_CONFIG[key];
                        const isHigh = data.subIndex > 100;
                        return (
                          <div key={key} className="bg-gray-50 rounded-xl p-4 border border-gray-200 flex items-center gap-4">
                             <div className={`p-3 rounded-lg ${isHigh ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                                {conf.icon}
                             </div>
                             <div className="flex-1 min-w-0">
                                <div className="flex justify-between mb-1">
                                   <span className="font-bold text-gray-800 truncate">{conf.name}</span>
                                   <span className="text-xs bg-white px-2 py-0.5 rounded border text-gray-500">
                                      Rank: {conf.rank}
                                   </span>
                                </div>
                                <div className="flex justify-between text-sm mb-2">
                                   <span>
                                     Val: <strong>{data.value.toFixed(2)}</strong> <span className="text-xs text-gray-500">{conf.unit}</span>
                                   </span>
                                   <span className={`${isHigh ? 'text-red-600 font-bold' : 'text-green-600'}`}>
                                      Qn: {data.subIndex.toFixed(0)}
                                   </span>
                                </div>
                                {/* Progress Bar for Qn (relative to 100 which is limit) */}
                                <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                                   <div 
                                      className={`h-full rounded-full ${data.subIndex > 100 ? 'bg-red-500' : 'bg-green-500'}`}
                                      style={{ width: `${Math.min(data.subIndex, 100)}%` }}
                                   ></div>
                                </div>
                             </div>
                          </div>
                        );
                   })}
                </div>
              </div>

             
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12">
              <MapPin size={64} className="mb-4 opacity-20" />
              <p>Select a location from the list to analyze.</p>
            </div>
          )}
        </div>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 20px; }
      `}</style>
    </div>
  );
}