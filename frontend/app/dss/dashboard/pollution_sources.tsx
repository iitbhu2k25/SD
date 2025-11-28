'use client';

import React, { useMemo, useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Cell
} from 'recharts';

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

interface PollutionSourcesProps {
  drainData: DrainRecord[];
}

interface BODPriorityAnalysis {
  priority: number;
  range: string;
  description: string;
  color: string;
  count: number;
  locations: DrainRecord[];
  criteria: string[];
  action: string;
}

interface BODSummary {
  priority: number;
  stretches: number;
  color: string;
}

// Helper function for parsing coliform data
const extractFaecalValue = (val: string | null): number => {
  if (!val || val === 'N/A') return 0;
  const parts = val.replace(/,/g, '').split(/–|-/).map(Number);
  return parts.length === 2 ? (parts[0] + parts[1]) / 2 : Number(parts[0]);
};

const PollutionSources: React.FC<PollutionSourcesProps> = ({ drainData }) => {
  const [codChartIndex, setCodChartIndex] = useState(0);

  // ============================================================
  // 1. BOD PRIORITY CLASSIFICATION LOGIC
  // ============================================================
  
  const bodPriorityAnalysis = useMemo(() => {
    if (!drainData || drainData.length === 0) return [];

    const priorityMap: { [key: number]: BODPriorityAnalysis } = {
      1: {
        priority: 1,
        range: '>30 mg/L',
        description: 'Critical Sewage Load - Exceeds STP Standards',
        color: '#dc2626',
        count: 0,
        locations: [],
        criteria: [
          'BOD concentration exceeds 30 mg/L',
          'Exceeds 6 mg/L on all occasions',
          'Standard of sewage treatment plant discharge',
          'Requires immediate intervention'
        ],
        action: ' CRITICAL - Immediate remediation required'
      },
      2: {
        priority: 2,
        range: '20-30 mg/L',
        description: 'Very High Pollution - Heavy Sewage Influence',
        color: '#ea580c',
        count: 0,
        locations: [],
        criteria: [
          'BOD concentration between 20-30 mg/L',
          'Exceeds 6 mg/L on all occasions',
          'Indicates significant untreated discharge'
        ],
        action: ' HIGH PRIORITY - Urgent action needed'
      },
      3: {
        priority: 3,
        range: '10-20 mg/L',
        description: 'High Pollution - Moderate Sewage Load',
        color: '#f59e0b',
        count: 0,
        locations: [],
        criteria: [
          'BOD concentration between 10-20 mg/L',
          'Exceeds 6 mg/L on all occasions',
          'Moderate pollution requiring intervention'
        ],
        action: ' MEDIUM-HIGH - Planned intervention'
      },
      4: {
        priority: 4,
        range: '6-10 mg/L',
        description: 'Moderate Pollution - Manageable Levels',
        color: '#eab308',
        count: 0,
        locations: [],
        criteria: [
          'BOD concentration between 6-10 mg/L',
          'Exceeds desired water quality',
          'Manageable with standard treatment'
        ],
        action: ' MEDIUM - Regular monitoring required'
      },
      5: {
        priority: 5,
        range: '3-6 mg/L',
        description: 'Low Pollution - Near Acceptable Levels',
        color: '#84cc16',
        count: 0,
        locations: [],
        criteria: [
          'BOD concentration between 3-6 mg/L',
          'Approaching desired water quality',
          'Acceptable with continued monitoring'
        ],
        action: ' LOW - Continue monitoring'
      }
    };

    drainData.forEach(record => {
      let priority = 5;
      if (record.bod_mg_l > 30) priority = 1;
      else if (record.bod_mg_l >= 20) priority = 2;
      else if (record.bod_mg_l >= 10) priority = 3;
      else if (record.bod_mg_l >= 6) priority = 4;

      priorityMap[priority].count++;
      priorityMap[priority].locations.push(record);
    });
    
    Object.values(priorityMap).forEach(analysis => {
        analysis.locations.sort((a, b) => (b.bod_mg_l || 0) - (a.bod_mg_l || 0));
    });

    return Object.values(priorityMap).sort((a, b) => a.priority - b.priority);
  }, [drainData]);

  // ============================================================
  // 2. STRETCHES OUTCOME
  // ============================================================
  
  const stretchesOutcome = useMemo(() => {
    const summary: BODSummary[] = [
      { priority: 1, stretches: 0, color: '#dc2626' },
      { priority: 2, stretches: 0, color: '#ea580c' },
      { priority: 3, stretches: 0, color: '#f59e0b' },
      { priority: 4, stretches: 0, color: '#eab308' },
      { priority: 5, stretches: 0, color: '#84cc16' }
    ];

    bodPriorityAnalysis.forEach(analysis => {
      const summaryItem = summary.find(s => s.priority === analysis.priority);
      if (summaryItem) {
        summaryItem.stretches = analysis.count;
      }
    });

    return summary;
  }, [bodPriorityAnalysis]);

  // ============================================================
  // 3. STATISTICS & WORST SITES CALCULATION
  // ============================================================

  const bodStats = useMemo(() => {
    const validBOD = drainData.filter(d => d.bod_mg_l !== null && d.bod_mg_l !== undefined);
    if (validBOD.length === 0) return null;

    const bodValues = validBOD.map(d => d.bod_mg_l);
    const average = bodValues.reduce((a, b) => a + b, 0) / bodValues.length;
    const max = Math.max(...bodValues);
    const min = Math.min(...bodValues);
    const median = bodValues.sort((a, b) => a - b)[Math.floor(validBOD.length / 2)];

    return { average, max, min, median, count: validBOD.length };
  }, [drainData]);

  const bodChartData = useMemo(() => {
    return bodPriorityAnalysis.map(p => ({
      name: `P${p.priority}`,
      count: p.count,
      range: p.range,
      fill: p.color
    }));
  }, [bodPriorityAnalysis]);

  const {
    worstNitrate,
    worstBOD,
    worstFaecalColiform,
    worstAlgaeRisk,
    worstChemicalRisk,
    worstTurbidity,
    worstSalinity,
    worstIndustrial,
    worstLandDumping,
    worstDetergentRisk,
    acidicSites,
  } = useMemo(() => {
    const formatLoc = (d: DrainRecord) => d.stream ? `${d.location} (${d.stream})` : d.location;

    // 1. Organic (BOD)
    const bodSorted = [...drainData]
      .filter(site => site.bod_mg_l !== null && site.bod_mg_l !== undefined)
      .sort((a, b) => b.bod_mg_l - a.bod_mg_l);
    const worstBOD = bodSorted.length > 0 
      ? { location: formatLoc(bodSorted[0]), value: bodSorted[0].bod_mg_l.toFixed(2) }
      : { location: '–', value: '–' };

    // 2. Pathogen (Faecal Coliform)
    const faecalSites = drainData.filter(d => {
      const val = d.faecal_col;
      if (!val || val === 'N/A') return false;
      const parsed = extractFaecalValue(val);
      return !isNaN(parsed) && parsed > 0;
    });
    const worstFaecal = faecalSites.sort(
      (a, b) => extractFaecalValue(b.faecal_col) - extractFaecalValue(a.faecal_col)
    )[0];
    const worstFaecalColiform = worstFaecal
      ? { location: formatLoc(worstFaecal), value: extractFaecalValue(worstFaecal.faecal_col).toFixed(0) }
      : { location: '–', value: '–' };

    // 3. Chemical Pollution (COD + TSS)
    const chemicalRiskCandidates = drainData.filter(d => d.cod !== null && d.tss_mg_l !== null);
    const highestChemicalSite = chemicalRiskCandidates.sort(
      (a, b) => (b.cod + b.tss_mg_l) - (a.cod + a.tss_mg_l)
    )[0];
    const worstChemicalRisk = highestChemicalSite
      ? { location: formatLoc(highestChemicalSite), cod: highestChemicalSite.cod.toFixed(2), tss: highestChemicalSite.tss_mg_l.toFixed(2) }
      : { location: '–', cod: '–', tss: '–' };

    // 4. Turbidity
    const highTurbiditySite = drainData
      .filter(d => typeof d.turbidity === 'number')
      .sort((a, b) => b.turbidity - a.turbidity)[0];
    const worstTurbidity = highTurbiditySite
      ? { location: formatLoc(highTurbiditySite), value: highTurbiditySite.turbidity.toFixed(2) }
      : { location: '–', value: '–' };

    // 5. Salinity (TDS + EC)
    const salinityCandidates = drainData.filter(d => d.tds_ppm > 0 || d.ec_us_cm > 0);
    const highestSalinitySite = salinityCandidates.sort(
      (a, b) => (b.tds_ppm + b.ec_us_cm) - (a.tds_ppm + a.ec_us_cm)
    )[0];
    const worstSalinity = highestSalinitySite
      ? { location: formatLoc(highestSalinitySite), tds: highestSalinitySite.tds_ppm.toFixed(0), ec: highestSalinitySite.ec_us_cm.toFixed(0) }
      : { location: '–', tds: '–', ec: '–' };

    // 6. Nitrates
    const nitrateSorted = [...drainData]
      .filter(site => site.nitrate !== null && site.nitrate !== undefined)
      .sort((a, b) => b.nitrate - a.nitrate);
    const worstNitrate = nitrateSorted.length > 0 
      ? { location: formatLoc(nitrateSorted[0]), value: nitrateSorted[0].nitrate.toFixed(2) }
      : { location: '–', value: '–' };

    // 7. Algae (Nitrate + BOD)
    const algaeRiskCandidates = drainData.filter(d => d.nitrate !== null && d.bod_mg_l !== null);
    const highestAlgaeSite = algaeRiskCandidates.sort(
      (a, b) => (b.nitrate + b.bod_mg_l) - (a.nitrate + a.bod_mg_l)
    )[0];
    const worstAlgaeRisk = highestAlgaeSite
      ? { location: formatLoc(highestAlgaeSite), nitrate: highestAlgaeSite.nitrate.toFixed(2), bod: highestAlgaeSite.bod_mg_l.toFixed(2) }
      : { location: '–', nitrate: '–', bod: '–' };

    // 8. Industrial (COD + TDS)
    const industrialCandidates = drainData.filter(d => d.cod && d.tds_ppm);
    const highestIndustrial = industrialCandidates.sort(
      (a, b) => (b.cod + b.tds_ppm) - (a.cod + a.tds_ppm)
    )[0];
    const worstIndustrial = highestIndustrial
      ? { location: formatLoc(highestIndustrial), cod: highestIndustrial.cod.toFixed(1), tds: highestIndustrial.tds_ppm.toFixed(0) }
      : { location: '–', cod: '–', tds: '–' };

    // 9. Detergents (BOD + COD)
    const detergentRiskCandidates = drainData.filter(d => d.bod_mg_l !== null && d.cod !== null);
    const worstDetergentSite = detergentRiskCandidates.sort(
      (a, b) => (b.bod_mg_l + b.cod) - (a.bod_mg_l + a.cod)
    )[0];
    const worstDetergentRisk = worstDetergentSite
      ? { location: formatLoc(worstDetergentSite), bod: worstDetergentSite.bod_mg_l.toFixed(1), cod: worstDetergentSite.cod.toFixed(1) }
      : { location: '–', bod: '–', cod: '–' };

    // 10. Land Dumping (TSS + Turb + TS)
    const landDumpingCandidates = drainData.filter(
      d => d.tss_mg_l > 0 || d.turbidity > 0 || d.ts_mg_l > 0
    );
    const worstDumpingSite = landDumpingCandidates.sort(
      (a, b) => (b.tss_mg_l + b.turbidity + b.ts_mg_l) - (a.tss_mg_l + a.turbidity + a.ts_mg_l)
    )[0];
    const worstLandDumping = worstDumpingSite
      ? { location: formatLoc(worstDumpingSite), tss: worstDumpingSite.tss_mg_l.toFixed(0), turbidity: worstDumpingSite.turbidity.toFixed(0), ts: worstDumpingSite.ts_mg_l.toFixed(0) }
      : { location: '–', tss: '–', turbidity: '–', ts: '–' };
    
    const acidicSites = drainData
      .filter(d => d.ph < 6.5)
      .sort((a, b) => a.ph - b.ph);

    return {
      worstNitrate,
      worstBOD,
      worstFaecalColiform,
      worstAlgaeRisk,
      worstChemicalRisk,
      worstTurbidity,
      worstSalinity,
      worstIndustrial,
      worstLandDumping,
      worstDetergentRisk,
      acidicSites, 
    };
  }, [drainData]);

  return (
    <div className="space-y-8">

      {/* SECTION 2: BOD INDICATORS (Chart) */}
      <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl p-8 border border-white/20">
        <h2 className="text-3xl font-bold mb-6 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
          BOD Indicators
        </h2>

        <div className="mb-6">
          <h3 className="font-semibold text-gray-800 mb-4">Comparative Analysis of Top Polluted Sites</h3>

          {/* Slider Control */}
          <div className="mb-4 flex items-center gap-4">
            <input
              type="range"
              min="0"
              max={Math.max(0, drainData.length - 8)}
              value={codChartIndex || 0}
              onChange={(e) => setCodChartIndex(parseInt(e.target.value))}
              className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
            />
            <span className="text-sm font-semibold text-gray-700 whitespace-nowrap">
              Showing {(codChartIndex || 0) + 1}-{Math.min((codChartIndex || 0) + 8, drainData.length)}
            </span>
          </div>

          <ResponsiveContainer width="100%" height={450}>
            <BarChart
              data={drainData
                .sort((a, b) => b.bod_mg_l - a.bod_mg_l)
                .slice(codChartIndex || 0, (codChartIndex || 0) + 8)
                .map((drain) => ({
                  location: drain.location,
                  bod: drain.bod_mg_l,
                  cod: drain.cod,
                  turbidity: drain.turbidity,
                  stream: drain.stream
                }))}
              margin={{ top: 20, right: 30, left: 60, bottom: 120 }}
            >
              <defs>
                <linearGradient id="bodGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#dc2626" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#dc2626" stopOpacity={0.3} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="location"
                angle={-45}
                textAnchor="end"
                height={110}
                interval={0}
                tick={{ fontSize: 10, fill: '#4B5563' }}
                label={{ value: 'Monitoring Location', position: 'insideBottom', dy: 95, fill: '#4B5563' }}
              />
              <YAxis
                domain={[0, 'dataMax + 5']}
                label={{ value: 'BOD (mg/L)', angle: -90, position: 'insideLeft', dx: -10, fill: '#4B5563' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  border: 'none',
                  borderRadius: '12px',
                  boxShadow: '0 10px 30px rgba(0, 0, 0, 0.1)'
                }}
                formatter={(value: number) => [`${value.toFixed(1)} mg/L`, 'BOD']}
                labelFormatter={(label) => `Location: ${label}`}
              />
              <Bar dataKey="bod" fill="url(#bodGradient)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* BOD Pollution Cards */}
        <h3 className="font-semibold text-gray-800 mb-4">Organic Pollution : BOD {'>'} 10</h3>

        <div className="overflow-x-auto pb-4 -mx-8 px-8">
          <div className="flex gap-4 min-w-min">
            {drainData
              .filter(d => d.bod_mg_l > 10)
              .sort((a, b) => b.bod_mg_l - a.bod_mg_l)
              .slice(codChartIndex || 0, (codChartIndex || 0) + 8)
              .map((drain, idx) => (
                <div
                  key={idx}
                  className="flex-shrink-0 w-80 p-4 rounded-lg border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-violet-50 hover:shadow-lg transition-all duration-300 transform hover:scale-105"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-800 text-sm truncate">{drain.location}</p>
                      <p className="text-xs text-gray-600 truncate">{drain.stream || 'N/A'}</p>
                    </div>
                    <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full font-bold ml-2 flex-shrink-0">
                      #{(codChartIndex || 0) + idx + 1}
                    </span>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between p-2 bg-white rounded">
                      <span className="text-gray-700">BOD:</span>
                      <span className="font-bold text-red-600">{drain.bod_mg_l.toFixed(1)} mg/L</span>
                    </div>
                    <div className="flex justify-between p-2 bg-white rounded">
                      <span className="text-gray-700">COD:</span>
                      <span className="font-bold text-orange-600">{drain.cod.toFixed(1)} mg/L</span>
                    </div>
                  </div>

                  <div className="mt-3 w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-gradient-to-r from-red-500 to-purple-600 h-3 rounded-full transition-all duration-1000"
                      style={{ width: `${Math.min((drain.bod_mg_l / 50) * 100, 100)}%` }}
                    ></div>
                  </div>

                  <p className="text-xs text-gray-600 mt-2">
                    {Math.min((drain.bod_mg_l / 30) * 100, 100).toFixed(0)}% of critical threshold (30 mg/L)
                  </p>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* SECTION 2.5: BOD PRIORITY ANALYSIS */}
      <div className="space-y-8 bg-gradient-to-br from-gray-50 to-white rounded-2xl shadow-xl p-8 border border-gray-200">
        {/* HEADER */}
        <div className="border-b-2 border-orange-200 pb-6">
          <h2 className="text-3xl font-bold mb-2 bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent flex items-center gap-3">
            Chemical Pollution: BOD Analysis & Priority Classification
          </h2>
          <p className="text-gray-600 text-sm">
            Comprehensive Biochemical Oxygen Demand assessment based on 5-tier priority system
          </p>
        </div>

        {/* OVERALL STATISTICS */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {bodStats && (
            <>
              <div className="p-4 bg-gradient-to-br from-red-50 to-orange-50 rounded-lg border border-red-200">
                <div className="text-sm text-red-700 font-semibold mb-1">Maximum BOD</div>
                <div className="text-3xl font-bold text-red-600">{bodStats.max.toFixed(1)}</div>
                <div className="text-xs text-red-600 mt-2">mg/L (Critical Level)</div>
              </div>
              <div className="p-4 bg-gradient-to-br from-orange-50 to-yellow-50 rounded-lg border border-orange-200">
                <div className="text-sm text-orange-700 font-semibold mb-1">Average BOD</div>
                <div className="text-3xl font-bold text-orange-600">{bodStats.average.toFixed(1)}</div>
                <div className="text-xs text-orange-600 mt-2">mg/L (Average)</div>
              </div>
              <div className="p-4 bg-gradient-to-br from-yellow-50 to-green-50 rounded-lg border border-yellow-200">
                <div className="text-sm text-yellow-700 font-semibold mb-1">Median BOD</div>
                <div className="text-3xl font-bold text-yellow-600">{bodStats.median.toFixed(1)}</div>
                <div className="text-xs text-yellow-600 mt-2">mg/L (Median)</div>
              </div>
              <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border border-green-200">
                <div className="text-sm text-green-700 font-semibold mb-1">Minimum BOD</div>
                <div className="text-3xl font-bold text-green-600">{bodStats.min.toFixed(1)}</div>
                <div className="text-xs text-green-600 mt-2">mg/L (Lowest)</div>
              </div>
            </>
          )}
        </div>

        {/* PRIORITY CLASSIFICATION TABLE */}
        <div className="space-y-6">
          <h3 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            5-Tier BOD Priority Classification System
          </h3>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Priority Cards */}
            <div className="space-y-3 h-full">
              {bodPriorityAnalysis.map((analysis, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-lg border-l-4 transition-all hover:shadow-lg"
                  style={{
                    borderLeftColor: analysis.color,
                    backgroundColor: `${analysis.color}08`
                  }}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-bold text-lg" style={{ color: analysis.color }}>
                        Priority {analysis.priority}
                      </h4>
                      <p className="text-sm font-semibold text-gray-700">{analysis.description}</p>
                    </div>
                    <span className="text-2xl font-bold" style={{ color: analysis.color }}>
                      {analysis.range}
                    </span>
                  </div>
                  <div className="bg-white/60 rounded px-3 py-2 mb-2">
                    <div className="text-xs text-gray-600">
                      <strong>Locations Identified:</strong> {analysis.count} site{analysis.count !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <div className="text-sm text-gray-700 font-medium">{analysis.action}</div>
                </div>
              ))}
            </div>

            {/* Criteria Breakdown */}
            <div className="space-y-3 h-full">
              <div className="p-4 rounded-lg border-2 border-gray-300 bg-gray-50 h-full overflow-y-auto">
                <h4 className="font-bold text-gray-800 mb-3">Classification Criteria</h4>
                <div className="space-y-4 text-sm">
                  {bodPriorityAnalysis.map((analysis, idx) => (
                    <div key={idx} className="pb-3 border-b border-gray-200 last:border-0">
                      <p className="font-semibold mb-1" style={{ color: analysis.color }}>
                        Priority {analysis.priority}: {analysis.range} mg/L
                      </p>
                      <ul className="space-y-1 text-xs text-gray-700">
                        {analysis.criteria.map((criterion, cidx) => (
                          <li key={cidx} className="flex gap-2">
                            <span className="text-gray-400">◆</span>
                            <span>{criterion}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* OUTCOME - STRETCHES DISTRIBUTION */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border-2 border-blue-300 p-6">
          <h3 className="text-2xl font-bold text-blue-900 mb-4 flex items-center gap-2">
            OUTCOME: Priority-Wise observation points Distribution
          </h3>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                    <th className="border border-blue-700 px-4 py-3 text-left font-bold">Priority Level</th>
                    <th className="border border-blue-700 px-4 py-3 text-center font-bold">BOD Range</th>
                    <th className="border border-blue-700 px-4 py-3 text-center font-bold">Number of observations</th>
                  </tr>
                </thead>
                <tbody>
                  {stretchesOutcome.map((item, idx) => (
                    <tr
                      key={idx}
                      className="border border-gray-300 hover:bg-gray-100 transition-colors"
                    >
                      <td className="border border-gray-300 px-4 py-3">
                        <div
                          className="inline-block px-3 py-1 rounded-full font-bold text-white text-sm"
                          style={{ backgroundColor: item.color }}
                        >
                          Priority {item.priority}
                        </div>
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-center font-semibold">
                        {bodPriorityAnalysis.find(a => a.priority === item.priority)?.range}
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-center">
                        <span className="text-2xl font-bold" style={{ color: item.color }}>
                          {item.stretches}
                        </span>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-gradient-to-r from-gray-800 to-gray-900 text-white font-bold text-sm">
                    <td colSpan={2} className="border border-gray-700 px-4 py-3">
                      Total observation points Identified
                    </td>
                    <td className="border border-gray-700 px-4 py-3 text-center text-xl">
                      {stretchesOutcome.reduce((sum, item) => sum + item.stretches, 0)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Chart */}
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bodChartData} margin={{ left: 10, right: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 11 }} 
                    label={{ value: 'Priority Level', position: 'bottom-19', fill: '#4B5563', dy: 25 }} 
                  />
                  <YAxis 
                    label={{ value: 'No. of Observations',position: 'bottom-5', angle: -90,  dx: -19 }} 
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'rgba(255,255,255,0.95)', border: 'none', borderRadius: '8px' }}
                    formatter={(value) => [`${value} observations`, 'Count']}
                    labelFormatter={(label) => `Priority ${label.replace('P', '')}`}
                  />
                  <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                    {bodChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* PRIORITY-WISE DETAILED LOCATIONS */}
        <div className="space-y-4">
          <h3 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <span>📍</span>
            Identified observation points by Priority
          </h3>

          {/* ROW 1: PRIORITY 1, 2, 3 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"> 
            {bodPriorityAnalysis.slice(0, 3).map((analysis, idx) => (
              <div
                key={idx}
                className="rounded-lg border-2 p-3" 
                style={{ 
                    borderColor: analysis.color, 
                    backgroundColor: `${analysis.color}05`,
                }}
              >
                <div className="flex items-start justify-between mb-2"> 
                  <div>
                    <h4 className="font-bold text-base" style={{ color: analysis.color }}>
                      Priority {analysis.priority}: BOD {analysis.range} 
                    </h4>
                    <p className="text-xs text-gray-600 mt-0">{analysis.count} monitoring location{analysis.count !== 1 ? 's' : ''}</p>
                  </div>
                  <span className="text-xl font-bold" style={{ color: analysis.color }}>
                    {analysis.count}
                  </span>
                </div>

                {analysis.locations.length > 0 && (
                  <div className="mt-2 pt-2 border-t" style={{ borderColor: `${analysis.color}30` }}>
                    <p className="text-xs font-semibold text-gray-700 mb-1">📍 Locations :</p>
                    <div className="space-y-1 max-h-60 overflow-y-auto custom-scrollbar-thin">
                      {analysis.locations.map((loc, locIdx) => (
                        <div
                          key={locIdx}
                          className="text-xs bg-white/60 p-1.5 rounded border-l-2"
                          style={{ borderLeftColor: analysis.color }}
                        >
                          <p className="font-medium text-gray-800 truncate">{loc.location}</p>
                          <p className="text-gray-600">
                            BOD: <strong>{loc.bod_mg_l.toFixed(1)} mg/L</strong>
                            {loc.stream && ` • ${loc.stream}`}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-3 p-2 bg-white/70 rounded text-xs text-gray-700">
                  <strong>Action:</strong> {analysis.action.split(' - ')[1] || analysis.action}
                </div>
              </div>
            ))}
          </div>

          {/* ROW 2: PRIORITY 4, 5 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4"> 
            {bodPriorityAnalysis.slice(3, 5).map((analysis, idx) => ( 
              <div
                key={idx}
                className="rounded-lg border-2 p-3" 
                style={{ 
                    borderColor: analysis.color, 
                    backgroundColor: `${analysis.color}05`,
                }}
              >
                <div className="flex items-start justify-between mb-2"> 
                  <div>
                    <h4 className="font-bold text-base" style={{ color: analysis.color }}>
                      Priority {analysis.priority}: BOD {analysis.range}
                    </h4>
                    <p className="text-xs text-gray-600 mt-0">{analysis.count} monitoring location{analysis.count !== 1 ? 's' : ''}</p>
                  </div>
                  <span className="text-xl font-bold" style={{ color: analysis.color }}>
                    {analysis.count}
                  </span>
                </div>

                {analysis.locations.length > 0 && (
                  <div className="mt-2 pt-2 border-t" style={{ borderColor: `${analysis.color}30` }}>
                    <p className="text-xs font-semibold text-gray-700 mb-1">📍 Locations :</p>
                    <div className="space-y-1 max-h-60 overflow-y-auto custom-scrollbar-thin">
                      {analysis.locations.map((loc, locIdx) => (
                        <div
                          key={locIdx}
                          className="text-xs bg-white/60 p-1.5 rounded border-l-2"
                          style={{ borderLeftColor: analysis.color }}
                        >
                          <p className="font-medium text-gray-800 truncate">{loc.location}</p>
                          <p className="text-gray-600">
                            BOD: <strong>{loc.bod_mg_l.toFixed(1)} mg/L</strong>
                            {loc.stream && ` • ${loc.stream}`}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-3 p-2 bg-white/70 rounded text-xs text-gray-700">
                  <strong>Action:</strong> {analysis.action.split(' - ')[1] || analysis.action}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SECTION 1: CRITICAL POLLUTION HOTSPOTS */}
      <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl p-8 border border-white/20">
        <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">
          Critical Pollution Hotspots
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* High COD Locations */}
          <div className="border-l-4 border-red-500 bg-gradient-to-br from-red-50 to-pink-50 p-6 rounded-lg">
            <h3 className="font-bold text-red-800 mb-4 flex items-center gap-2">
               Highest COD Levels
            </h3>
            <div className="space-y-3">
              {drainData
                .sort((a, b) => b.cod - a.cod)
                .slice(0, 5)
                .map((drain, idx) => (
                  <div key={idx} className="flex justify-between items-center p-3 bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-300">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 text-sm">{idx + 1}. {drain.location}</p>
                      <p className="text-xs text-gray-600">{drain.stream || 'N/A'}</p>
                    </div>
                    <span className="text-lg font-bold text-red-600 ml-2 flex-shrink-0">
                      {drain.cod.toFixed(1)} mg/L
                    </span>
                  </div>
                ))}
            </div>
          </div>

          {/* Acidic pH Zones */}
          <div className="border-l-4 border-purple-500 bg-gradient-to-br from-purple-50 to-violet-50 p-6 rounded-lg">
            <h3 className="font-bold text-purple-800 mb-4 flex items-center gap-2">
               Acidic pH Zones
            </h3>
            <div className="space-y-3">
              {acidicSites.slice(0, 5).map((drain, idx) => (
                  <div key={idx} className="flex justify-between items-center p-3 bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-300">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 text-sm">{idx + 1}. {drain.location}</p>
                      <p className="text-xs text-gray-600">{drain.stream || 'N/A'}</p>
                    </div>
                    <span className="text-lg font-bold text-purple-600 ml-2 flex-shrink-0">{drain.ph.toFixed(2)} pH</span>
                  </div>
                ))}
                {acidicSites.length === 0 && (
                    <p className="text-center text-gray-500 py-4 text-sm">No acidic zones (pH {'<'} 6.5) currently detected.</p>
                )}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 3: DISSOLVED OXYGEN CRISIS ZONES */}
      <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl p-8 border border-white/20">
        <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
          Dissolved Oxygen Crisis Zones
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Severe Hypoxia */}
          <div className="p-6 rounded-lg bg-gradient-to-br from-red-50 to-pink-50 border-2 border-red-300 hover:shadow-lg transition-all duration-300">
            <h4 className="font-bold text-red-800 mb-3 text-lg">🔴 Severe Hypoxia</h4>
            <div className="text-4xl font-bold text-red-600 mb-2">{drainData.filter(d => d.do_mg_l < 2).length}</div>
            <p className="text-xs text-gray-700 mb-4 font-medium">DO {'<'} 2 mg/L - Aquatic life death zone</p>

            <div className="space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar-thin">
              {drainData
                .filter(d => d.do_mg_l < 2)
                .sort((a, b) => a.do_mg_l - b.do_mg_l)
                .map((d, i) => (
                <div key={i} className="text-xs text-red-700 font-medium p-2 bg-white rounded hover:bg-red-50 truncate" title={`${d.location} (${d.stream || 'N/A'})`}>
                  • {d.location}{d.stream ? ` (${d.stream})` : ''} (DO: <strong>{d.do_mg_l.toFixed(2)}</strong>)
                </div>
              ))}
            </div>
          </div>

          {/* Moderate Stress */}
          <div className="p-6 rounded-lg bg-gradient-to-br from-orange-50 to-amber-50 border-2 border-orange-300 hover:shadow-lg transition-all duration-300">
            <h4 className="font-bold text-orange-800 mb-3 text-lg">🟠 Moderate Stress</h4>
            <div className="text-4xl font-bold text-orange-600 mb-2">{drainData.filter(d => d.do_mg_l >= 2 && d.do_mg_l < 4).length}</div>
            <p className="text-xs text-gray-700 mb-4 font-medium">DO 2-4 mg/L - Fish stress zone</p>

            <div className="space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar-thin">
              {drainData
                .filter(d => d.do_mg_l >= 2 && d.do_mg_l < 4)
                .sort((a, b) => a.do_mg_l - b.do_mg_l)
                .map((d, i) => (
                <div key={i} className="text-xs text-orange-700 font-medium p-2 bg-white rounded hover:bg-orange-50 truncate" title={`${d.location} (${d.stream || 'N/A'})`}>
                  • {d.location}{d.stream ? ` (${d.stream})` : ''} (DO: <strong>{d.do_mg_l.toFixed(2)}</strong>)
                </div>
              ))}
            </div>
          </div>

          {/* Acceptable */}
          <div className="p-6 rounded-lg bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300 hover:shadow-lg transition-all duration-300">
            <h4 className="font-bold text-green-800 mb-3 text-lg">🟢 Acceptable</h4>
            <div className="text-4xl font-bold text-green-600 mb-2">{drainData.filter(d => d.do_mg_l >= 4).length}</div>
            <p className="text-xs text-gray-700 mb-4 font-medium">DO ≥ 4 mg/L - Safe for aquatic life</p>

            <div className="space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar-thin">
              {drainData
                .filter(d => d.do_mg_l >= 4)
                .sort((a, b) => b.do_mg_l - a.do_mg_l)
                .map((d, i) => (
                <div key={i} className="text-xs text-green-700 font-medium p-2 bg-white rounded hover:bg-green-50 truncate" title={`${d.location} (${d.stream || 'N/A'})`}>
                  • {d.location}{d.stream ? ` (${d.stream})` : ''} (DO: <strong>{d.do_mg_l.toFixed(2)}</strong>)
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 4: POTENTIAL POLLUTION SOURCES - UPDATED RENDER LOGIC */}
      <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl p-8 pb-12 border border-white/20">
        <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
           Potential Pollution Sources
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
          {[
            {
              title: "Organic Pollution",
              image: "https://dialogue.earth/content/uploads/2015/12/India-Ganga-pollution-scaled.jpg",
              icon: "🧫",
              limit: "BOD ≤ 3.00 mg/L",
              observed: `BOD: ${worstBOD.value} mg/L`,
              location: worstBOD.location,
              description: "High organic load from untreated sewage. Promotes microbial growth, reduces dissolved oxygen.",
              bgColor: "from-green-100 to-white",
            },
            {
              title: "Pathogen Risk",
              icon: "🦠",
              image: "https://t4.ftcdn.net/jpg/08/42/76/07/360_F_842760775_8ccQDE8g6eKeuVy2jHffnZxU13MZrpEG.jpg",
              limit: "Faecal Coliform ≤ 500 MPN",
              observed: `Faecal Coliform: ${worstFaecalColiform.value} MPN`,
              location: worstFaecalColiform.location,
              description: "High faecal contamination from untreated sewage poses serious health hazards.",
              bgColor: "from-red-100 to-white",
            },
            {
              title: "Chemical Pollution",
              icon: "⚗️",
              image: "https://static.vecteezy.com/system/resources/thumbnails/057/512/892/small_2x/close-up-of-a-barrel-with-green-leaking-toxic-waste-standing-in-nature-photo.jpg",
              limit: "COD ≤ 30 | TSS ≤ 100",
              observed: `COD: ${worstChemicalRisk.cod} | TSS: ${worstChemicalRisk.tss}`,
              location: worstChemicalRisk.location,
              description: "Chemical residues, fertilizers, oils alter water chemistry and harm aquatic life.",
              bgColor: "from-yellow-100 to-white",
            },
            {
              title: "Turbidity",
              icon: "🌫️",
              image: "https://ecoreportcard.org/site/assets/files/2218/chesterville_branch_turbidity.700x0.jpg",
              limit: "Safe Limit: ≤ 25 NTU",
              observed: `Turbidity: ${worstTurbidity.value} NTU`,
              location: worstTurbidity.location,
              description: "Suspended solids reduce light penetration and disrupt photosynthesis.",
              bgColor: "from-gray-100 to-white",
            },
            {
              title: "Salinity",
              icon: "🧂",
              image: "https://www.waterquality.gov.au/sites/default/files/images/salt.jpg",
              limit: "TDS ≤ 1000 | EC ≤ 2250",
              observed: `TDS: ${worstSalinity.tds} | EC: ${worstSalinity.ec}`,
              location: worstSalinity.location,
              description: "Excess salts from sewage affect water quality and aquatic ecosystems.",
              bgColor: "from-blue-100 to-white",
            },
            {
              title: "Nitrates",
              icon: "🌾",
              image: "https://nexteel.in/wp-content/uploads/2025/04/Nitrate-Pollution-in-water-1024x576.jpg",
              limit: "Safe Limit: ≤ 2.00 mg/L",
              observed: `Nitrate: ${worstNitrate.value} mg/L`,
              location: worstNitrate.location,
              description: "Nutrient overload from agriculture promotes algal blooms.",
              bgColor: "from-lime-100 to-white",
            },
            {
              title: "Algae Growth",
              icon: "🌿",
              image: "https://assets.telegraphindia.com/telegraph/5jamriver2.jpg",
              limit: "Nitrate ≤ 2 | BOD ≤ 3",
              observed: `Nitrate: ${worstAlgaeRisk.nitrate} | BOD: ${worstAlgaeRisk.bod}`,
              location: worstAlgaeRisk.location,
              description: "Excess nutrients cause oxygen depletion and aquatic death.",
              bgColor: "from-emerald-100 to-white",
            },
            {
              title: "Industrial Contaminants",
              icon: "🏭",
              image: "https://images.assettype.com/english-sentinelassam/import/wp-content/uploads/2019/01/industrial-wastewater.jpg",
              limit: "COD ≤ 250 | TDS ≤ 2100",
              observed: `COD: ${worstIndustrial.cod} | TDS: ${worstIndustrial.tds}`,
              location: worstIndustrial.location,
              description: "Toxic discharge bioaccumulates in fish, poses long-term health risks.",
              bgColor: "from-indigo-100 to-white",
            },
            {
              title: "Detergents",
              icon: "🧼",
              image: "https://asset.library.wisc.edu/1711.dl/ER5CSR223WOWA8F/M/h1380-2ce93.jpg",
              limit: "BOD ≤ 3 | COD ≤ 250",
              observed: `BOD: ${worstDetergentRisk.bod} | COD: ${worstDetergentRisk.cod}`,
              location: worstDetergentRisk.location,
              description: "Greywater with detergents promotes algal growth and eutrophication.",
              bgColor: "from-purple-100 to-white",
            },
            {
              title: "Land Dumping",
              icon: "🗑️",
              image: "https://dialogue.earth/content/uploads/2021/12/2CMW2JH-1-scaled.jpg",
              limit: "TSS ≤ 100 | Turb ≤ 25 | TS ≤ 2000",
              observed: `TSS: ${worstLandDumping.tss} | Turb: ${worstLandDumping.turbidity} | TS: ${worstLandDumping.ts}`,
              location: worstLandDumping.location,
              description: "Runoff and solid waste degrade river clarity and water quality.",
              bgColor: "from-rose-100 to-white",
            },
          ].map((item, index) => (
            <div
              key={index}
              className={`w-full h-[500px] flex flex-col justify-between rounded-2xl px-5 py-5 bg-gradient-to-br ${item.bgColor} shadow-md border border-gray-200 transform hover:scale-105 hover:shadow-2xl transition-transform duration-300 ease-in-out`}
            >
              {/* Top Half - Image */}
              {item.image && (
                <div className="-mx-5 -mt-5 mb-4">
                  <img
                    src={item.image}
                    alt={item.title}
                    className="w-full h-[240px] object-cover rounded-t-2xl"
                  />
                </div>
              )}
              
              <div className="flex flex-col justify-between h-full">
                <div>
                  <h4 className="text-lg font-bold text-gray-800 mb-3">{item.title}</h4>
                  
                  {/* Split Data Lines */}
                  <div className="space-y-3">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Safe Limits</span>
                      <span className="text-xs font-medium text-gray-800 break-words leading-tight">{item.limit}</span>
                    </div>
                    
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Highest Observed</span>
                      <span className="text-xs font-bold text-red-600 break-words leading-tight">{item.observed}</span>
                    </div>

                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Observed At</span>
                      <span className="text-xs font-medium text-gray-700 bg-white/60 p-1.5 rounded border border-gray-200 break-words leading-tight">
                        📍 {item.location || 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>

                <p className="text-[10px] text-gray-600 mt-4 pt-4 border-t border-gray-200/50 italic">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <style jsx global>{`
        .custom-scrollbar-thin::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar-thin::-webkit-scrollbar-thumb { background: rgba(100, 116, 139, 0.4); border-radius: 10px; }
        .custom-scrollbar-thin::-webkit-scrollbar-thumb:hover { background: rgba(100, 116, 139, 0.6); }
      `}</style>
    </div>
  );
};

export default PollutionSources;