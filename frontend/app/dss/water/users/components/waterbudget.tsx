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
    year = 0,
    season = 'N/A',
    timeScale = 'yearly',
}) => {

    const formatYear = (y: number | string | undefined) => {
        if (!y) return 'N/A';
        const yearStr = y.toString();
        if (yearStr.includes(',') && !yearStr.includes(', ')) {
            return yearStr.split(',').join(', ');
        }
        return yearStr;
    };

    if (totalWaterBudget === null || totalWaterBudget === undefined) {
        return null;
    }

    const formatWaterBudgetMLD = (value: number): string => {
        return value.toLocaleString('en-IN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
    };

    const displayYear = formatYear(year);
    const displaySeason = timeScale === 'yearly' ? 'Annual' : (season || 'N/A');

    return (
        <div className="flex-1 p-4 bg-blue-50 rounded-xl border-2 border-blue-300 shadow-sm flex flex-col justify-between min-h-[110px]">
            <div>
                <p className="text-xs font-semibold text-blue-500 uppercase tracking-wide flex items-center gap-1 mb-1">
                    <span>💧</span> TOTAL WATER BUDGET
                </p>
                <p className="text-xs text-gray-500 mb-3">
                    {displayYear} • {displaySeason}
                </p>
            </div>
            <p className="text-3xl font-bold text-blue-600">
                {formatWaterBudgetMLD(totalWaterBudget)} MLD
            </p>
        </div>
    );
};

export default WaterBudget;