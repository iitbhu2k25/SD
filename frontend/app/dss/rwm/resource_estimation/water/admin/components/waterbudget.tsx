// 'use client'

// import React from 'react';

// interface WaterBudgetProps {
//   totalWaterBudget: number | null;
//   productType?: string;
//   year?: number | string;
//   season?: string;
//   timeScale?: 'seasonal' | 'yearly';
//   aggregationMethod?: string;
//   layersProcessed?: number;
//   subDistrictCount?: number;
// }

// const WaterBudget: React.FC<WaterBudgetProps> = ({
//   totalWaterBudget,
//   productType = 'Water Budget',
//   year = 0,
//   season = 'N/A',
//   timeScale = 'yearly',
//   aggregationMethod = 'SUM',
//   layersProcessed = 0,
//   subDistrictCount = 0,
// }) => {

//   const formatYear = (y: number | string | undefined) => {
//     if (!y) return 'N/A';
//     const yearStr = y.toString();
//     if (yearStr.includes(',') && !yearStr.includes(', ')) {
//       return yearStr.split(',').join(', ');
//     }
//     return yearStr;
//   };

//   const displayYear = formatYear(year);

//   if (totalWaterBudget === null || totalWaterBudget === undefined) {
//     return null;
//   }

//   const formatWaterBudgetMLD = (value: number): string => {
//     return value.toLocaleString('en-IN', {
//       minimumFractionDigits: 2,
//       maximumFractionDigits: 2,
//     });
//   };

//   const getProductTypeIcon = (type: string): string => {
//     switch (type?.toLowerCase()) {
//       case 'water budget': return '💧';
//       case 'surplus': return '📈';
//       case 'deficit': return '📉';
//       case 'groundwater': return '🌊';
//       case 'surface water': return '🏞️';
//       case 'index': return '📊';
//       default: return '💧';
//     }
//   };

//   const displaySeason = timeScale === 'yearly' ? 'Annual' : (season || 'N/A');

//   return (
//     <div className="bg-gradient-to-br from-blue-50 to-sky-100 border-2 border-blue-300 rounded-xl shadow-sm p-4 h-full flex flex-col justify-between">
//       {/* Header Label */}
//       <div className="mb-3">
//         <h3 className="text-sm font-semibold text-blue-700 flex items-center gap-1.5 uppercase tracking-wide">
//           {getProductTypeIcon(productType)}
//           <span>Total {productType}</span>
//         </h3>
//         <p className="text-xs text-blue-500 mt-0.5">
//           {displayYear} • {displaySeason}
//         </p>
//       </div>

//       {/* Big Value */}
//       <div className="flex items-end justify-between">
//         <p className="text-3xl font-bold text-blue-600 leading-none tracking-tight">
//           {formatWaterBudgetMLD(totalWaterBudget)} MLD
          
//         </p>
//       </div>
//     </div>
//   );
// };

// export default WaterBudget;









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
  availableYears?: number[];
  activeYear?: number | null;
  onYearChange?: (year: number) => void;
}

const WaterBudget: React.FC<WaterBudgetProps> = ({
  totalWaterBudget,
  productType = 'Water Budget',
  year = 0,
  season = 'N/A',
  timeScale = 'yearly',
  availableYears = [],
  activeYear,
  onYearChange,
}) => {

  const formatYear = (y: number | string | undefined) => {
    if (!y) return 'N/A';
    const yearStr = y.toString();
    if (yearStr.includes(',') && !yearStr.includes(', ')) {
      return yearStr.split(',').join(', ');
    }
    return yearStr;
  };

  const displayYear = activeYear ? String(activeYear) : formatYear(year);

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
    <div className="bg-gradient-to-br from-blue-50 to-sky-100 border-2 border-blue-300 rounded-xl shadow-sm p-4 flex flex-col gap-3">

      {/* Header */}
      <div>
        <h3 className="text-xs font-semibold text-blue-700 flex items-center gap-1 uppercase tracking-wide">
          <span className="text-sm">{getProductTypeIcon(productType)}</span>
          <span>Total {productType}</span>
        </h3>
        <p className="text-xs text-blue-400 mt-0.5">
          {displayYear} • {displaySeason}
        </p>
      </div>

      {/* Big Value */}
      <p className="text-2xl font-bold text-blue-600 leading-none tracking-tight">
        {formatWaterBudgetMLD(totalWaterBudget)} MLD
        
      </p>

      {/* Year Radio Buttons */}
      {availableYears.length > 1 && onYearChange && (
        <div className="pt-2 border-t border-blue-200">
          <p className="text-[10px] font-semibold text-blue-500 mb-2 uppercase tracking-widest">
            Select Year
          </p>
          <div className="grid grid-cols-5 gap-x-2 gap-y-1.5">
            {availableYears.map((y) => {
              const isActive = activeYear === y;
              return (
                <label
                  key={y}
                  className="flex items-center gap-1.5 cursor-pointer group"
                >
                  {/* Hidden native radio */}
                  <input
                    type="radio"
                    name="water-budget-year"
                    value={y}
                    checked={isActive}
                    onChange={() => onYearChange(y)}
                    className="sr-only"
                  />

                  {/* Custom circle radio */}
                  <span
                    className={`
                      w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center
                      transition-all duration-150 flex-shrink-0
                      ${isActive
                        ? 'border-blue-600 bg-white'
                        : 'border-blue-300 bg-white group-hover:border-blue-500'
                      }
                    `}
                  >
                    {isActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-600 block" />
                    )}
                  </span>

                  {/* Year label */}
                  <span
                    className={`
                      text-[11px] font-medium transition-colors duration-150
                      ${isActive
                        ? 'text-blue-700 font-semibold'
                        : 'text-blue-400 group-hover:text-blue-600'
                      }
                    `}
                  >
                    {y}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default WaterBudget;