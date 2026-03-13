'use client'
import { api } from '@/services/api';
import React, { useState, useMemo, useEffect } from 'react';
import { toast } from 'react-toastify';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';

interface WaterLevelData {
  DateTime: string;
  Water_Level_m: number;
}

const WaterLevelDashboard: React.FC = () => {
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');
  const [chartType, setChartType] = useState<'line' | 'area'>('area');
  const [data, setData] = useState<WaterLevelData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const resp = await api.get('/rainwater/modeled_water');
        if (resp.status !== 200 && resp.status !== 201) {
          toast.error("Failed to connect to the server", {
            position: "top-center",
          });
        } else {
          toast.success("Data Fetched Successfully", {
          
          });
          const New_data = resp.message as unknown as { data: WaterLevelData[] };
          setData(New_data.data as WaterLevelData[]);
        }
      } catch (error) {
        console.error(error);
        toast.error("Error fetching data", {
          position: "top-center",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Calculate statistics with safety checks
  const stats = useMemo(() => {
    if (data.length === 0) {
      return { max: 0, min: 0, avg: 0, latest: 0, change: 0 };
    }

    const levels = data.map(d => d.Water_Level_m);
    const max = Math.max(...levels);
    const min = Math.min(...levels);
    const avg = levels.reduce((a, b) => a + b, 0) / levels.length;
    const latest = levels[levels.length - 1];
    const change = levels[levels.length - 1] - levels[0];

    return { max, min, avg, latest, change };
  }, [data]);

  // Format data for chart
  const chartData = useMemo(() => {
    return data.map(item => ({
      ...item,
      time: new Date(item.DateTime).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      }),
      fullDate: item.DateTime,
    }));
  }, [data]);

  // Custom tooltip - FIXED
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
          <p className="text-xs text-gray-600 mb-1">{payload[0].payload.fullDate}</p>
          <p className="text-sm font-semibold text-blue-600">
            {payload[0].value.toFixed(2)} m
          </p>
        </div>
      );
    }
    return null;
  };

  // CSV Download Function
  const downloadCSV = () => {
    if (data.length === 0) {
      toast.warning("No data to download", {
        position: "top-center",
      });
      return;
    }

    // Create CSV content
    const headers = ['DateTime', 'Water_Level_m'];
    const csvContent = [
      headers.join(','),
      ...data.map(row => `${row.DateTime},${row.Water_Level_m}`)
    ].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `water_level_data_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success("CSV Downloaded Successfully", {
      position: "top-center",
    });
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Loading water level data...</p>
        </div>
      </div>
    );
  }

  // Empty state
  if (data.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50 flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-xl shadow-lg">
          <p className="text-gray-600 text-lg">No data available</p>
          <p className="text-gray-500 text-sm mt-2">Please check your data source</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              Water Level Monitoring
            </h1>
            <p className="text-gray-600">Real-time water level time series data</p>
          </div>
          
          {/* Download CSV Button */}
          <button
            onClick={downloadCSV}
            className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors shadow-md flex items-center gap-2"
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-5 w-5" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" 
              />
            </svg>
            Download CSV
          </button>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-md p-4 border-l-4 border-blue-500">
            <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Current Level</p>
            <p className="text-2xl font-bold text-gray-800">{stats.latest.toFixed(2)} m</p>
            <p className={`text-xs mt-1 ${stats.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {stats.change >= 0 ? '↑' : '↓'} {Math.abs(stats.change).toFixed(2)} m
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-md p-4 border-l-4 border-green-500">
            <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Maximum</p>
            <p className="text-2xl font-bold text-gray-800">{stats.max.toFixed(2)} m</p>
            <p className="text-xs text-gray-500 mt-1">Peak level</p>
          </div>

          <div className="bg-white rounded-xl shadow-md p-4 border-l-4 border-orange-500">
            <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Minimum</p>
            <p className="text-2xl font-bold text-gray-800">{stats.min.toFixed(2)} m</p>
            <p className="text-xs text-gray-500 mt-1">Lowest level</p>
          </div>

          <div className="bg-white rounded-xl shadow-md p-4 border-l-4 border-purple-500">
            <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Average</p>
            <p className="text-2xl font-bold text-gray-800">{stats.avg.toFixed(2)} m</p>
            <p className="text-xs text-gray-500 mt-1">Mean level</p>
          </div>

          <div className="bg-white rounded-xl shadow-md p-4 border-l-4 border-cyan-500">
            <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Data Points</p>
            <p className="text-2xl font-bold text-gray-800">{data.length}</p>
            <p className="text-xs text-gray-500 mt-1">Total readings</p>
          </div>
        </div>

        {/* Main Content Card */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          {/* Controls */}
          <div className="flex flex-wrap gap-3 mb-6 items-center justify-between">
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('chart')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${viewMode === 'chart'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                Chart View
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${viewMode === 'table'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                Table View
              </button>
            </div>

            {viewMode === 'chart' && (
              <div className="flex gap-2">
                <button
                  onClick={() => setChartType('area')}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${chartType === 'area'
                      ? 'bg-blue-100 text-blue-700 border border-blue-300'
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                    }`}
                >
                  Area Chart
                </button>
                <button
                  onClick={() => setChartType('line')}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${chartType === 'line'
                      ? 'bg-blue-100 text-blue-700 border border-blue-300'
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                    }`}
                >
                  Line Chart
                </button>
              </div>
            )}
          </div>

          {/* Chart View */}
          {viewMode === 'chart' && (
            <div className="w-full">
              <ResponsiveContainer width="100%" height={400}>
                {chartType === 'area' ? (
                  <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorLevel" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="time"
                      stroke="#6b7280"
                      style={{ fontSize: '12px' }}
                    />
                    <YAxis
                      stroke="#6b7280"
                      style={{ fontSize: '12px' }}
                      domain={['dataMin - 0.05', 'dataMax + 0.05']}
                      label={{ value: 'Water Level (m)', angle: -90, position: 'insideLeft', style: { fontSize: '12px' } }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="Water_Level_m"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      fill="url(#colorLevel)"
                    />
                  </AreaChart>
                ) : (
                  <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="time"
                      stroke="#6b7280"
                      style={{ fontSize: '12px' }}
                    />
                    <YAxis
                      stroke="#6b7280"
                      style={{ fontSize: '12px' }}
                      domain={['dataMin - 0.05', 'dataMax + 0.05']}
                      label={{ value: 'Water Level (m)', angle: -90, position: 'insideLeft', style: { fontSize: '12px' } }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="Water_Level_m"
                      stroke="#3b82f6"
                      strokeWidth={3}
                      dot={{ fill: '#3b82f6', r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                )}
              </ResponsiveContainer>
            </div>
          )}

          {/* Table View */}
          {viewMode === 'table' && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Date & Time</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">Water Level (m)</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((item, index) => {
                    const prevLevel = index > 0 ? data[index - 1].Water_Level_m : item.Water_Level_m;
                    const change = item.Water_Level_m - prevLevel;

                    return (
                      <tr
                        key={index}
                        className="border-b border-gray-100 hover:bg-blue-50 transition-colors"
                      >
                        <td className="py-3 px-4 text-gray-800">{item.DateTime}</td>
                        <td className="py-3 px-4 text-right font-semibold text-gray-800">
                          {item.Water_Level_m.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {index > 0 && (
                            <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${change > 0
                                ? 'bg-green-100 text-green-700'
                                : change < 0
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-gray-100 text-gray-700'
                              }`}>
                              {change > 0 ? '↑' : change < 0 ? '↓' : '→'} {Math.abs(change).toFixed(3)} m
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer Info with Live Indicator */}
        <div className="mt-6 text-center">
          <div className="inline-flex items-center gap-2 bg-white px-4 py-2 rounded-lg shadow-sm">
            {/* Blinking Live Dot */}
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </span>
            
            {/* Last Updated Text */}
            <p className="text-sm text-gray-600">
              <span className="font-semibold text-gray-700">Last updated:</span>{' '}
              {data[data.length - 1]?.DateTime}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WaterLevelDashboard;