"use client";

import React from "react";

interface PdfReportSectionProps {
    selectedParameters: string[];
    reportParameters: any[];
    handleSelectAllParameters: () => void;
    handleParameterToggle: (paramKey: string) => void;
    handleGenerateReport: () => void;
    TOP_TEN_PRIORITY: Record<string, number>;
    handleSelectTopTen: () => void;
    handleDeselectTopTen: () => void;
    allTopTenSelected: boolean;
}

const PdfReportSection: React.FC<PdfReportSectionProps> = ({
    selectedParameters,
    reportParameters,
    handleSelectAllParameters,
    handleParameterToggle,
    handleGenerateReport,
    TOP_TEN_PRIORITY,
    handleSelectTopTen,
    handleDeselectTopTen,
    allTopTenSelected,
}) => {
    const sortedReportParameters = reportParameters
        .slice()
        .sort((a, b) => {
            const priorityA = TOP_TEN_PRIORITY[a.key] || 999;
            const priorityB = TOP_TEN_PRIORITY[b.key] || 999;
            return priorityA - priorityB;
        });

    return (
        <div className="mb-2">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border-l-4 border-l-pink-400">
                <div className="p-5">
                    <div className="flex items-center gap-3 mb-5">
                        <div className="w-3 h-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full shadow-sm"></div>
                        <h3 className="text-lg font-bold text-gray-800">
                            Generate PDF Report
                        </h3>
                    </div>

                    <div className="mb-5">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <div>
                                    <label className="text-xs font-semibold text-gray-700">
                                        Select Water Quality Parameters
                                    </label>
                                </div>
                                {/* Question Mark Info Button */}
                                <div className="relative group ml-1">
                                    <button
                                        type="button"
                                        className="inline-flex items-center justify-center w-4 h-4 text-[9px] font-black text-white bg-blue-500 rounded-full hover:bg-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 cursor-help shadow-sm"
                                        aria-label="Information about priority rankings"
                                    >
                                        ?
                                    </button>

                                    {/* Tooltip */}
                                    <div
                                        role="tooltip"
                                        className="absolute left-1/2 -translate-x-1/2 top-full mt-2 px-3 py-2.5 w-56 text-xs text-white bg-gray-900/95 backdrop-blur-sm rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition-all duration-200 pointer-events-none z-50 border border-white/10"
                                    >
                                        <p className="font-bold text-sm mb-1.5 text-blue-300">
                                            Priority Rankings
                                        </p>
                                        <p className="text-gray-300 leading-relaxed font-medium">
                                            Parameters numbered 1-10 are the most important
                                            indicators for water quality assessment, ranked by
                                            significance.
                                        </p>
                                        {/* Tooltip Arrow */}
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 -mb-px">
                                            <div className="border-[5px] border-transparent border-b-gray-900/95"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="px-2.5 py-1 bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-700 text-xs font-semibold rounded-full">
                                    {selectedParameters.length} / {reportParameters.length}
                                </div>
                                <button
                                    type="button"
                                    onClick={
                                        allTopTenSelected
                                            ? handleDeselectTopTen
                                            : handleSelectTopTen
                                    }
                                    className="text-xs text-blue-600 hover:text-white font-semibold px-3 py-1 rounded-full border border-blue-200 hover:bg-blue-500 transition-all duration-200 cursor-pointer"
                                >
                                    {allTopTenSelected ? "Deselect Top 10" : "Select Top 10"}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSelectAllParameters}
                                    className="text-xs text-blue-600 hover:text-white font-semibold px-3 py-1 rounded-full border border-blue-200 hover:bg-blue-500 transition-all duration-200 cursor-pointer"
                                >
                                    {selectedParameters.length === reportParameters.length
                                        ? "Deselect All"
                                        : "Select All"}
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 md:grid-cols-4 gap-2.5">
                            {sortedReportParameters.map((param) => {
                                const topTenPriority = TOP_TEN_PRIORITY[param.key];
                                const isSelected = selectedParameters.includes(param.key);

                                return (
                                    <div
                                        key={param.key}
                                        className={`flex items-center justify-between p-2.5 border-2 rounded-xl transition-all duration-200 cursor-pointer ${isSelected
                                                ? "border-blue-400 bg-gradient-to-r from-blue-50 to-indigo-50 shadow-sm hover:shadow-md -translate-y-0.5"
                                                : "border-gray-200/80 bg-white hover:border-gray-300 hover:shadow-sm hover:-translate-y-0.5 opacity-80 hover:opacity-100"
                                            }`}
                                        onClick={() => handleParameterToggle(param.key)}
                                    >
                                        <div className="flex items-center min-w-0 flex-1">
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onClick={(e) => e.stopPropagation()}
                                                onChange={() => handleParameterToggle(param.key)}
                                                className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer flex-shrink-0"
                                            />
                                            <div className="ml-2 text-xs min-w-0 flex-1">
                                                <label className={`font-semibold cursor-pointer block truncate ${isSelected ? "text-blue-900" : "text-gray-900"}`}>
                                                    {param.label}
                                                </label>
                                                {param.unit && (
                                                    <p className={`text-[10px] truncate ${isSelected ? "text-blue-600/80 font-medium" : "text-gray-400"}`}>
                                                        {param.unit}
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        {topTenPriority && (
                                            <div className="ml-2 flex-shrink-0 bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center shadow-sm">
                                                {topTenPriority}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="flex flex-col items-center mt-2">
                        <button
                            onClick={handleGenerateReport}
                            disabled={selectedParameters.length === 0}
                            className={`
                                group relative overflow-hidden w-full max-w-lg py-3.5 px-6 rounded-xl font-bold text-sm text-white transition-all duration-300 flex items-center justify-center gap-3 cursor-pointer shadow-lg
                                ${selectedParameters.length === 0
                                    ? "bg-gray-400 cursor-not-allowed opacity-70"
                                    : "bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:from-indigo-600 hover:via-purple-600 hover:to-pink-600 hover:shadow-xl hover:scale-[1.01]"
                                }
                            `}
                        >
                            <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></span>
                            <span className="text-xl relative z-10 drop-shadow-sm filter">📄</span>
                            <span className="relative z-10 tracking-wide text-[15px]">Generate PDF Report</span>
                            {selectedParameters.length > 0 && (
                                <span className="relative z-10 text-xs px-2 py-0.5 bg-white/20 rounded-md backdrop-blur-sm border border-white/20">
                                    {selectedParameters.length} item{selectedParameters.length !== 1 ? 's' : ''}
                                </span>
                            )}
                        </button>

                        <p className="text-[11px] text-gray-400 text-center mt-3 font-medium flex items-center gap-1.5">
                            <span>ⓘ</span> Report will include study area map, methodology, and data for selected parameters
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PdfReportSection;
