'use client';

import React, { useState, useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, ReferenceLine, ComposedChart, Line, Bar
} from 'recharts';
import { Activity, Droplets, TrendingDown, ShieldCheck, RefreshCw } from 'lucide-react';

interface DrainRecord {
  id: number;
  location: string;
  bod_mg_l: number;
  cod: number;
  do_mg_l: number;
  stream?: string;
}

interface SystemDynamicsProps {
  drainData: DrainRecord[];
}

export default function SystemDynamics({ drainData }: SystemDynamicsProps) {
  // State for simulation variables
  const [interceptionRate, setInterceptionRate] = useState<number>(0); // 0% to 100%
  const [treatmentEfficiency, setTreatmentEfficiency] = useState<number>(85); // STP Efficiency
  const [selfPurificationFactor, setSelfPurificationFactor] = useState<number>(1.2); // Natural river cleaning rate

  // 1. CALCULATION ENGINE: Dynamic System State
  const systemState = useMemo(() => {
    if (!drainData.length) return null;

    // Sort data to simulate Upstream -> Downstream flow (Assuming API order or add sorting logic here)
    // Note: In a real scenario, you would sort by 'river_km' or latitude.
    const sortedData = [...drainData].sort((a, b) => b.bod_mg_l - a.bod_mg_l); // Sorting by pollution intensity for impact visibility

    // Calculate Current Totals (Real Data)
    const totalBODLoad = sortedData.reduce((acc, curr) => acc + curr.bod_mg_l, 0);
    const avgDO = sortedData.reduce((acc, curr) => acc + curr.do_mg_l, 0) / sortedData.length;

    // Calculate Simulated Totals based on Slider Inputs
    // Formula: Remaining Load = Original * (1 - (Interception * Efficiency))
    const interventionFactor = (interceptionRate / 100) * (treatmentEfficiency / 100);
    
    const simulatedData = sortedData.map(site => {
      const reducedBOD = site.bod_mg_l * (1 - interventionFactor);
      
      // Simple Streeter-Phelps inspired approximation for DO recovery
      // As BOD goes down, DO recovers based on self-purification
      const doRecovery = (site.bod_mg_l - reducedBOD) * 0.2 * selfPurificationFactor;
      const predictedDO = Math.min(8.5, site.do_mg_l + doRecovery);

      return {
        name: site.location,
        stream: site.stream,
        Actual_BOD: site.bod_mg_l,
        Predicted_BOD: reducedBOD,
        Actual_DO: site.do_mg_l,
        Predicted_DO: predictedDO,
        critical_limit: 30 // BOD Limit
      };
    });

    const newTotalBOD = simulatedData.reduce((acc, curr) => acc + curr.Predicted_BOD, 0);
    const newAvgDO = simulatedData.reduce((acc, curr) => acc + curr.Predicted_DO, 0) / simulatedData.length;
    const percentReduction = ((totalBODLoad - newTotalBOD) / totalBODLoad) * 100;

    return {
      totalBODLoad,
      newTotalBOD,
      avgDO,
      newAvgDO,
      percentReduction,
      simulatedData
    };
  }, [drainData, interceptionRate, treatmentEfficiency, selfPurificationFactor]);

  if (!systemState) return <div>Loading System Dynamics...</div>;

  return (
    <div className="space-y-6 animate-fadeIn">
      
      {/* CONTROL PANEL & KPI HEADER */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Controls */}
        <div className="lg:col-span-1 bg-white rounded-2xl shadow-lg p-6 border border-slate-200">
          <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
             Simulation Controls
          </h3>
          
          <div className="space-y-6">
            <div>
              <div className="flex justify-between mb-2">
                <label className="font-semibold text-sm text-slate-600">Drain Interception Rate</label>
                <span className="text-blue-600 font-bold">{interceptionRate}%</span>
              </div>
              <input 
                type="range" min="0" max="100" step="5"
                value={interceptionRate}
                onChange={(e) => setInterceptionRate(Number(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <p className="text-xs text-slate-400 mt-1">Percentage of drains diverted to STPs</p>
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <label className="font-semibold text-sm text-slate-600">STP Efficiency</label>
                <span className="text-green-600 font-bold">{treatmentEfficiency}%</span>
              </div>
              <input 
                type="range" min="50" max="99" 
                value={treatmentEfficiency}
                onChange={(e) => setTreatmentEfficiency(Number(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-green-600"
              />
              <p className="text-xs text-slate-400 mt-1">Technology capability (ASP / SBR / MBBR)</p>
            </div>
            
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck className="w-4 h-4 text-blue-600"/>
                <span className="font-bold text-sm text-blue-800">Projected Impact</span>
              </div>
              <p className="text-xs text-blue-700">
                Increasing interception to <strong>{interceptionRate}%</strong> reduces total organic load by <strong>{systemState.percentReduction.toFixed(1)}%</strong>.
              </p>
            </div>
          </div>
        </div>

        {/* System State Visualization (Stock & Flow) */}
        <div className="lg:col-span-2 bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl shadow-lg p-6 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 opacity-10">
            <Activity size={200} />
          </div>
          
          <h3 className="text-xl font-bold mb-6 relative z-10">System Health Forecast</h3>
          
          <div className="grid grid-cols-2 gap-8 relative z-10">
            {/* Pollution Stock */}
            <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
              <div className="text-slate-300 text-sm mb-2">Total Organic Load (BOD Sum)</div>
              <div className="flex items-end gap-2">
                <span className="text-3xl font-bold text-red-400">{systemState.newTotalBOD.toFixed(0)}</span>
                <span className="text-sm text-slate-400 mb-1 line-through">{systemState.totalBODLoad.toFixed(0)}</span>
              </div>
              <div className="w-full bg-slate-700 h-3 rounded-full mt-3 overflow-hidden">
                <div 
                  className="h-full bg-red-500 transition-all duration-500"
                  style={{ width: `${Math.min((systemState.newTotalBOD / 500) * 100, 100)}%` }} // Assuming 500 is max scale
                />
              </div>
              <div className="mt-2 text-xs text-red-300 flex items-center gap-1">
                <TrendingDown size={12} />
                Load decreases as interception rises
              </div>
            </div>

            {/* River Health Stock */}
            <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
              <div className="text-slate-300 text-sm mb-2">Avg. Dissolved Oxygen (DO)</div>
              <div className="flex items-end gap-2">
                <span className={`text-3xl font-bold ${systemState.newAvgDO >= 5 ? 'text-green-400' : 'text-yellow-400'}`}>
                  {systemState.newAvgDO.toFixed(2)}
                </span>
                <span className="text-sm text-slate-400 mb-1 line-through">{systemState.avgDO.toFixed(2)}</span>
                <span className="text-sm text-slate-400 mb-1">mg/L</span>
              </div>
              <div className="w-full bg-slate-700 h-3 rounded-full mt-3 overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 ${systemState.newAvgDO >= 5 ? 'bg-green-500' : 'bg-yellow-500'}`}
                  style={{ width: `${(systemState.newAvgDO / 10) * 100}%` }}
                />
              </div>
              <div className="mt-2 text-xs text-green-300 flex items-center gap-1">
                <Droplets size={12} />
                Recovered via self-purification
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* DYNAMIC CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Chart 1: BOD Reduction Profile */}
        <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-200">
          <h4 className="font-bold text-slate-700 mb-4">BOD Reduction Simulation</h4>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={systemState.simulatedData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0.1}/>
                  </linearGradient>
                  <linearGradient id="colorPred" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" hide />
                <YAxis label={{ value: 'BOD (mg/L)', angle: -90, position: 'insideLeft' }} />
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <ReferenceLine y={30} label="Critical Limit" stroke="red" strokeDasharray="3 3" />
                <Area type="monotone" dataKey="Actual_BOD" stroke="#ef4444" fillOpacity={1} fill="url(#colorActual)" name="Current BOD" />
                <Area type="monotone" dataKey="Predicted_BOD" stroke="#3b82f6" fillOpacity={1} fill="url(#colorPred)" name="Simulated BOD" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-center text-slate-500 mt-2">Comparison of Current vs. Simulated BOD levels across all monitoring stations</p>
        </div>

        {/* Chart 2: Dissolved Oxygen Recovery */}
        <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-200">
          <h4 className="font-bold text-slate-700 mb-4">Dissolved Oxygen Recovery Curve</h4>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={systemState.simulatedData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <XAxis dataKey="name" hide />
                <YAxis domain={[0, 10]} label={{ value: 'DO (mg/L)', angle: -90, position: 'insideLeft' }} />
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <Tooltip 
                   contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <ReferenceLine y={4} label="Min Standard" stroke="orange" strokeDasharray="5 5" />
                
                <Bar dataKey="Actual_DO" barSize={20} fill="#94a3b8" name="Current DO" />
                <Line type="monotone" dataKey="Predicted_DO" stroke="#10b981" strokeWidth={3} dot={false} name="Predicted DO" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
           <p className="text-xs text-center text-slate-500 mt-2">Projected improvement in Dissolved Oxygen based on load reduction</p>
        </div>

      </div>
    </div>
  );
}