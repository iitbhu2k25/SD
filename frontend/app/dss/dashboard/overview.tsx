// frontend/app/dss/varuna/dashboard/overview.tsx

import React, { useMemo, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Droplets, Activity, Factory, MapPin } from 'lucide-react';
import MapStory from './mapstory';

// --- INTERFACES & TYPES (Should be defined/exported from page.tsx or common file) ---

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
  sampling_time?: string;
}

interface SewageStats {
  [key: string]: { feature_count: number } | undefined;
}

interface OverviewProps {
  // Data
  drainData: DrainRecord[];
  sewageStats: SewageStats | null;
  
  // State from page.tsx (Results of useMemo)
  acidicCount: number;
  lowDOCount: number;
  highBODCount: number;
  highCODCount: number;
  worstAcidicSite: DrainRecord | null;
  worstLowDOSite: DrainRecord | null;
  worstHighBODSite: DrainRecord | null;
  worstHighCODSite: DrainRecord | null;

  // Handlers/Helpers
  handleStatClick: (statType: string) => void;
  showNotification: (title: string, message: string, type?: 'success' | 'error' | 'info') => void;
  AnimatedCounter: React.FC<{ value: number; duration?: number }>;
  
  // NEW HANDLER PROPS for navigation
  setActiveTab: (tabId: string) => void; 
  setSelectedFilter: (filter: string | null) => void; 
}


// --- HELPER FUNCTIONS (Moved from page.tsx) ---

// Helper to extract faecal value (needed for calculateBacterialContamination)
const extractFaecalValue = (val: string | null): number => {
    if (!val || val === 'N/A') return 0;
    const parts = val.replace(/,/g, '').split(/–|-/).map(Number);
    return parts.length === 2 ? (parts[0] + parts[1]) / 2 : Number(parts[0]);
};

// Index Calculation Functions
const calculatePollutionLoadIndex = (data: DrainRecord): { score: number; level: string; location: string } => {
    const oxygenDeficit = Math.max(0, 8 - data.do_mg_l);
    const pollutionScore = (data.bod_mg_l * 0.4) + (data.cod * 0.003) + (oxygenDeficit * 10);
    let level: string;
    if (pollutionScore > 50) level = 'EXTREME';
    else if (pollutionScore > 30) level = 'HIGH';
    else if (pollutionScore > 15) level = 'MODERATE';
    else if (pollutionScore > 5) level = 'LOW';
    else level = 'MINIMAL';
    return { score: Math.round(pollutionScore * 10) / 10, level, location: data.location };
};

const calculateEutrophicationRisk = (data: DrainRecord): { score: number; level: string; location: string } => {
    const nitrateScore = typeof data.nitrate === 'number' ? Math.min(data.nitrate * 2, 10) : 0;
    const turbidityScore = Math.min(data.turbidity / 10, 10);
    const oxygenScore = data.do_mg_l < 4 ? 10 : data.do_mg_l < 6 ? 5 : 0;
    const eutrophicationScore = nitrateScore + turbidityScore + oxygenScore;
    let level: string;
    if (eutrophicationScore > 20) level = 'EXTREME';
    else if (eutrophicationScore > 15) level = 'HIGH';
    else if (eutrophicationScore > 10) level = 'MODERATE';
    else if (eutrophicationScore > 5) level = 'LOW';
    else level = 'MINIMAL';
    return { score: Math.round(eutrophicationScore * 10) / 10, level, location: data.location };
};

const calculateBacterialContamination = (data: DrainRecord): { score: number; level: string; location: string } => {
    let bacterialScore = 0;
    let level = 'UNKNOWN';
    
    // Logic extracted from page.tsx
    if (data.faecal_col && data.faecal_col !== 'N/A' && data.faecal_col.trim() !== '') {
      const maxValue = extractFaecalValue(data.faecal_col);
      bacterialScore = Math.log10(maxValue + 1);
      if (maxValue > 100000) level = 'EXTREME';
      else if (maxValue > 50000) level = 'HIGH';
      else if (maxValue > 10000) level = 'MODERATE';
      else if (maxValue > 1000) level = 'LOW';
      else level = 'MINIMAL';
    } else {
      if (data.bod_mg_l > 30) { bacterialScore = 5; level = 'HIGH (BOD-based)'; }
      else if (data.bod_mg_l > 15) { bacterialScore = 3; level = 'MODERATE (BOD-based)'; }
      else { bacterialScore = 1; level = 'LOW (BOD-based)'; }
    }
    return { score: Math.round(bacterialScore * 10) / 10, level, location: data.location };
};

const getWorstSites = (data: DrainRecord[]) => {
    if (data.length === 0) return null;
    const pollutionResults = data.map(calculatePollutionLoadIndex);
    const eutrophicationResults = data.map(calculateEutrophicationRisk);
    const bacterialResults = data.map(calculateBacterialContamination);
    const worstPollution = pollutionResults.sort((a, b) => b.score - a.score)[0];
    const worstEutrophication = eutrophicationResults.sort((a, b) => b.score - a.score)[0];
    const worstBacterial = bacterialResults.sort((a, b) => b.score - a.score)[0];
    return { pollution: worstPollution, eutrophication: worstEutrophication, bacterial: worstBacterial };
};

const getProcessedData = (data: DrainRecord[]) => data.map((entry, index) => ({
    label: entry.location || `Point-${index + 1}`,
    pH: entry.ph,
    DO: entry.do_mg_l,
    BOD: entry.bod_mg_l,
    COD: entry.cod,
    temp: entry.temp,
}));

// --- MAIN OVERVIEW COMPONENT ---

const Overview: React.FC<OverviewProps> = ({
  drainData,
  sewageStats,
  acidicCount,
  lowDOCount,
  highBODCount,
  highCODCount,
  worstAcidicSite,
  worstLowDOSite,
  worstHighBODSite,
  worstHighCODSite,
  handleStatClick,
  showNotification,
  AnimatedCounter,
  setActiveTab,
  setSelectedFilter,
}) => {
  const [selectedParameter, setSelectedParameter] = useState('DO');
  
  // Re-calculate the indices used in the Critical Status block
  const worstSites = useMemo(() => getWorstSites(drainData), [drainData]);
  const sitesData = useMemo(() => getProcessedData(drainData), [drainData]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
      
      {/* Story Map Section */}
      <div className="col-span-full">
        <div className="rounded-2xl overflow-hidden shadow-2xl border border-white/20 animate-fadeIn bg-white">
          <MapStory showNotification={showNotification} />
        </div>
      </div>

      {/* Key Metrics Row */}
      <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl p-8 col-span-full border border-white/20">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
            Key Performance Indicators
          </h2>
          <div className="text-xs text-gray-600 leading-relaxed">
              Click on Cards to see in map
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6">
          
          {/* 1. Acidic pH Site (Navigation added) */}
          <div 
            onClick={() => {
              setActiveTab('water-quality');
              setSelectedFilter('acidic');
            }}
            className="group p-6 bg-gradient-to-br from-red-50 to-pink-50 rounded-xl border border-red-200 hover:shadow-xl transition-all duration-300 transform hover:scale-105 cursor-pointer"
          >
            <div className="text-3xl font-bold text-red-600 mb-2"><AnimatedCounter value={acidicCount} /></div>
            <div className="text-sm font-semibold text-red-800 mb-1">Acidic pH Sites</div>
            <div className="text-xs text-gray-600 leading-relaxed">
              pH &lt; 6.0 • Most acidic observed at <strong>{worstAcidicSite?.location || '—'}</strong>, Value: <strong>{worstAcidicSite?.ph.toFixed(1) || '—'}</strong>
            </div>
            <div className="mt-3 w-full bg-red-200 rounded-full h-2">
              <div className="bg-red-500 h-2 rounded-full" style={{ width: `${(acidicCount / drainData.length) * 100 || 0}%` }}></div>
            </div>
          </div>

          {/* 2. Low DO Sites (Navigation added) */}
          <div 
            onClick={() => {
              setActiveTab('water-quality');
              setSelectedFilter('lowDO');
            }}
            className="group p-6 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl border border-blue-200 hover:shadow-xl transition-all duration-300 transform hover:scale-105 cursor-pointer"
          >
            <div className="text-3xl font-bold text-blue-600 mb-2"><AnimatedCounter value={lowDOCount} /></div>
            <div className="text-sm font-semibold text-orange-800 mb-1">Low DO Sites</div>
            <div className="text-xs text-gray-600 leading-relaxed">
              DO &lt; 2 mg/L • Lowest DO observed at <strong>{worstLowDOSite?.location || '—'}</strong>, Value: <strong>{worstLowDOSite?.do_mg_l.toFixed(1) || '—'} mg/L</strong>
            </div>
            <div className="mt-3 w-full bg-blue-200 rounded-full h-2">
              <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${(lowDOCount / drainData.length) * 100 || 0}%` }}></div>
            </div>
          </div>

          {/* 3. High BOD Sites (Navigation added) */}
          <div 
            onClick={() => {
              setActiveTab('water-quality');
              setSelectedFilter('highBOD');
            }}
            className="group p-6 bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl border border-emerald-200 hover:shadow-xl transition-all duration-300 transform hover:scale-105 cursor-pointer"
          >
            <div className="text-3xl font-bold text-emerald-600 mb-2"><AnimatedCounter value={highBODCount} /></div>
            <div className="text-sm font-semibold text-rose-800 mb-1">High BOD Sites</div>
            <div className="text-xs text-gray-600 leading-relaxed">
              BOD &gt; 30 mg/L • Highest BOD observed at <strong>{worstHighBODSite?.location || '—'}</strong>, Value: <strong>{worstHighBODSite?.bod_mg_l.toFixed(1) || '—'} mg/L</strong>
            </div>
            <div className="mt-3 w-full bg-emerald-200 rounded-full h-2">
              <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${(highBODCount / drainData.length) * 100 || 0}%` }}></div>
            </div>
          </div>

          {/* 4. High COD Sites (Navigation added) */}
          <div 
            onClick={() => {
              setActiveTab('water-quality');
              setSelectedFilter('highCOD');
            }}
            className="group p-6 bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl border border-purple-200 hover:shadow-xl transition-all duration-300 transform hover:scale-105 cursor-pointer"
          >
            <div className="text-3xl font-bold text-purple-600 mb-2"><AnimatedCounter value={highCODCount} /></div>
            <div className="text-sm font-semibold text-purple-800 mb-1">High COD Sites</div>
            <div className="text-xs text-gray-600 leading-relaxed">
              COD &gt; 100 mg/L • Highest COD observed at <strong>{worstHighCODSite?.location || '—'}</strong>, Value: <strong>{worstHighCODSite?.cod.toFixed(1) || '—'} mg/L</strong>
            </div>
            <div className="mt-3 w-full bg-purple-200 rounded-full h-2">
              <div className="bg-purple-500 h-2 rounded-full" style={{ width: `${(highCODCount / drainData.length) * 100 || 0}%` }}></div>
            </div>
          </div>
          
          {/* 5. Sewage Infrastructure Section (Navigation added) */}
          <div 
            onClick={() => setActiveTab('sewage-infrastructure')}
            className="group col-span-1 lg:col-span-2 p-4 bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl border border-orange-200 hover:shadow-xl transition-all duration-300 transform hover:scale-102 flex flex-col justify-center cursor-pointer"
          >
            <div className="flex items-center justify-center gap-2 mb-3">
              <h3 className="text-lg font-bold text-orange-800">Sewage Infrastructure</h3>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/60 p-2 rounded-lg border border-orange-100 text-center">
                <div className="text-xs text-gray-600">Partial Tapped Drain</div>
                <div className="text-xl font-bold text-orange-600">
                  <AnimatedCounter value={sewageStats?.['partial_tapped_drain']?.feature_count || 0} />
                </div>
              </div>
              <div className="bg-white/60 p-2 rounded-lg border border-green-100 text-center">
                <div className="text-xs text-gray-600">Tapped Drain</div>
                <div className="text-xl font-bold text-green-600">
                  <AnimatedCounter value={sewageStats?.['tapped']?.feature_count || 0} />
                </div>
              </div>
              <div className="bg-white/60 p-2 rounded-lg border border-red-100 text-center">
                <div className="text-xs text-gray-600">Untapped Drain</div>
                <div className="text-xl font-bold text-red-600">
                  <AnimatedCounter value={sewageStats?.['untapped_drain']?.feature_count || 0} />
                </div>
              </div>
              <div className="bg-white/60 p-2 rounded-lg border border-blue-100 text-center">
                <div className="text-xs text-gray-600">STP (Sewage Treatment Plant)</div>
                <div className="text-xl font-bold text-blue-600">
                  <AnimatedCounter value={sewageStats?.['STP']?.feature_count || 0} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Critical Status - Calculated Indices (Left Side) */}
      <div className="col-span-1 bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl p-8 border border-white/20 h-full">
        <h3 className="text-xl font-bold mb-6 bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">
          Critical Status - Calculated Indices
        </h3>
        <div className="space-y-4">
          {worstSites ? (
            <>
              {/* Pollution Load Index */}
              <div className="flex flex-col p-4 bg-gradient-to-r from-red-50 to-pink-50 rounded-xl border border-red-200 hover:shadow-lg transition-all duration-300">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-semibold text-gray-800 text-sm block">{worstSites.pollution.location}</span>
                  <span className={`text-white px-2 py-1 rounded-full text-xs font-bold ${
                    worstSites.pollution.level === 'EXTREME' ? 'bg-red-600 pulse-glow' : 'bg-orange-500'
                  }`}>
                    {worstSites.pollution.level}
                  </span>
                </div>
                <span className="text-sm text-red-600 font-medium">
                  Pollution Load Index: {worstSites.pollution.score}
                </span>
              </div>
              {/* Eutrophication Risk */}
              <div className="flex flex-col p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200 hover:shadow-lg transition-all duration-300">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-semibold text-gray-800 text-sm block">{worstSites.eutrophication.location}</span>
                  <span className={`text-white px-2 py-1 rounded-full text-xs font-bold ${
                    worstSites.eutrophication.level === 'EXTREME' ? 'bg-red-600 pulse-glow' : 'bg-green-500'
                  }`}>
                    {worstSites.eutrophication.level}
                  </span>
                </div>
                <span className="text-sm text-green-600 font-medium">
                  Eutrophication Risk: {worstSites.eutrophication.score}
                </span>
              </div>
              {/* Bacterial Contamination Level */}
              <div className="flex flex-col p-4 bg-gradient-to-r from-purple-50 to-violet-50 rounded-xl border border-purple-200 hover:shadow-lg transition-all duration-300">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-semibold text-gray-800 text-sm block">{worstSites.bacterial.location}</span>
                  <span className={`text-white px-2 py-1 rounded-full text-xs font-bold ${
                    worstSites.bacterial.level.includes('EXTREME') ? 'bg-red-600 pulse-glow' : 'bg-purple-500'
                  }`}>
                    {worstSites.bacterial.level.split(' ')[0]}
                  </span>
                </div>
                <span className="text-sm text-purple-600 font-medium">
                  Bacterial Level: {worstSites.bacterial.score}
                </span>
              </div>
            </>
          ) : (
            <div className="text-center text-gray-500 py-8">
              <p>Loading data...</p>
            </div>
          )}
        </div>
        
        {/* Summary Statistics */}
        <div className="mt-6 p-4 bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl border border-gray-200">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-lg font-bold text-red-600">
                {drainData.filter(d => calculatePollutionLoadIndex(d).level === 'HIGH').length}
              </div>
              <div className="text-[10px] text-gray-600">High Pollution</div>
            </div>
            <div>
              <div className="text-lg font-bold text-green-600">
                {drainData.filter(d => calculateEutrophicationRisk(d).level === 'HIGH').length}
              </div>
              <div className="text-[10px] text-gray-600">Eutrophication</div>
            </div>
            <div>
              <div className="text-lg font-bold text-purple-600">
                {drainData.filter(d => calculateBacterialContamination(d).level.includes('HIGH')).length}
              </div>
              <div className="text-[10px] text-gray-600">Bacterial</div>
            </div>
          </div>
        </div>
      </div>

      {/* Water Quality Analysis (Right Side - Expanded) */}
      <div className="col-span-1 lg:col-span-2 bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl p-8 border border-white/20 h-full">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
            Water Quality Analysis
          </h2>
          <div className="flex gap-4 w-full sm:w-auto">
            <select
              value={selectedParameter}
              onChange={(e) => setSelectedParameter(e.target.value)}
              className="w-full sm:w-auto border-2 border-gray-200 rounded-xl px-4 py-2 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            >
              <option value="BOD">BOD (mg/l)</option>
              <option value="COD">COD (mg/l)</option>
              <option value="DO">DO (mg/l)</option>
              <option value="pH">pH</option>
              <option value="temp">Temperature (°C)</option>
            </select>
          </div>
        </div>

        <div className="mb-8 h-[400px]"> {/* Fixed height to fill space */}
          <h3 className="font-semibold mb-4 text-lg">Temporal Variation - {selectedParameter}</h3>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart 
              data={sitesData}
              margin={{ top: 5, right: 30, left: 20, bottom: 50 }} 
            >
              <defs>
                <linearGradient id="parameterGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.2}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="label"
                tick={false}
                axisLine={true}
                height={30}
                label={{ 
                  value: 'Monitoring Location (Hover for details)', 
                  position: 'insideBottom', 
                  dy: 10, 
                  fill: '#6B7280', 
                  fontSize: 12 
                }}
              />
              <YAxis 
                dataKey={selectedParameter}
                label={{ value: selectedParameter, angle: -90, position: 'insideLeft', dx: -10, fill: '#4B5563' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  border: 'none',
                  borderRadius: '12px',
                  boxShadow: '0 10px 30px rgba(0, 0, 0, 0.1)'
                }}
              />
              <Area
                type="monotone"
                dataKey={selectedParameter}
                stroke="#2563eb"
                strokeWidth={3}
                fill="url(#parameterGradient)"
                animationDuration={2000}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default Overview;