'use client'

import React from 'react';

interface WaterBudgetProps {
  totalWaterBudget: number | null;
  productType?: string;
  year?: number | string;
  season?: string;
  timeScale?: 'seasonal' | 'yearly';
  aggregationMethod?: string;
  layersProcessed?: number;
  subDistrictCount?: number;
}

const WaterBudget: React.FC<WaterBudgetProps> = ({
  totalWaterBudget,
  productType = 'Water Budget',
  year = 0,
  season = 'N/A',
  timeScale = 'yearly',
  aggregationMethod = 'SUM',
  layersProcessed = 0,
  subDistrictCount = 0,
}) => {

  const formatYear = (y: number | string | undefined) => {
    if (!y) return 'N/A';
    const yearStr = y.toString();
    if (yearStr.includes(',') && !yearStr.includes(', ')) {
      return yearStr.split(',').join(', ');
    }
    return yearStr;
  };

  const displayYear = formatYear(year);

  if (totalWaterBudget === null || totalWaterBudget === undefined) {
    return null;
  }

  const formatWaterBudgetMLD = (value: number): string => {
    return value.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const getProductTypeIcon = (type: string): string => {
    switch (type?.toLowerCase()) {
      case 'water budget': return '💧';
      case 'surplus': return '📈';
      case 'deficit': return '📉';
      case 'groundwater': return '🌊';
      case 'surface water': return '🏞️';
      case 'index': return '📊';
      default: return '💧';
    }
  };

  const displaySeason = timeScale === 'yearly' ? 'Annual' : (season || 'N/A');

  return (
    <div className="bg-gradient-to-br from-blue-50 to-sky-100 border-2 border-blue-300 rounded-xl shadow-sm p-4 h-full flex flex-col justify-between">
      {/* Header Label */}
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-blue-700 flex items-center gap-1.5 uppercase tracking-wide">
          {getProductTypeIcon(productType)}
          <span>Total {productType}</span>
        </h3>
        <p className="text-xs text-blue-500 mt-0.5">
          {displayYear} • {displaySeason}
        </p>
      </div>

      {/* Big Value */}
      <div className="flex items-end justify-between">
        <p className="text-3xl font-bold text-blue-600 leading-none tracking-tight">
          {formatWaterBudgetMLD(totalWaterBudget)} MLD
          
        </p>
      </div>
    </div>
  );
};

export default WaterBudget;