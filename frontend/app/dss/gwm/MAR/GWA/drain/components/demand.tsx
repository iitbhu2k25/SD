"use client";

import React, { useMemo, useState, useEffect } from 'react';
import { useDemand, IndustrialSubtype } from '@/contexts/groundwater_assessment/drain/DemandContext';
import { useLocation } from '@/contexts/groundwater_assessment/drain/LocationContext';
import dynamic from "next/dynamic";
const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

interface EyeIconProps {
    isVisible: boolean;
}

// Field Definitions & Labels (ALIGNED WITH ADMIN CASE)
const DOMESTIC_DISPLAY_FIELDS: string[] = [
    'village_name',
    'village_code', // Added
    'demand_mld',
    'forecast_population',
    'target_year',
    'lpcd'
];

const AGRICULTURAL_DISPLAY_FIELDS: string[] = [
    'village',
    'village_code', // Added
    'cropland',
    'village_demand'
];

const DOMESTIC_LABEL_MAP: Record<string, string> = {
    village_name: "Village Name",
    village_code: "Village Code", // Added
    demand_mld: "Demand (Million litres/Year)",
    forecast_population: "Forecasted Population",
    target_year: "Target Year",
    lpcd: "LPCD",
};

const AGRICULTURAL_LABEL_MAP: Record<string, string> = {
    village: "Village Name",
    village_code: "Village Code", // Added
    cropland: "Cropland (M²)",
    village_demand: "Agriculture Demand (Million litres/Year)",
};

const formatLabel = (key: string, map: Record<string, string>) =>
    map[key] || key.replace(/_/g, " ");

// --- End Field Definitions ---

const Demand = () => {
    const {
        domesticChecked,
        agriculturalChecked,
        industrialChecked,
        perCapitaConsumption,
        kharifChecked,
        rabiChecked,
        zaidChecked,
        availableCrops,
        selectedCrops,
        cropsLoading,
        cropsError,
        groundwaterFactor,
        industrialData,
        industrialGWShare,
        chartData,
        chartsError,
        domesticTableData,
        agriculturalTableData,
        industrialTableData,
        domesticLoading,
        agriculturalLoading,
        industrialLoading,
        domesticError,
        agriculturalError,
        industrialError,
        setDomesticChecked,
        setAgriculturalChecked,
        setIndustrialChecked,
        setPerCapitaConsumption,
        setGroundwaterFactor,
        setIndustrialGWShare,
        updateIndustrialProduction,
        updateIndustrialConsumption,
        clearChartData,
        setKharifChecked,
        setRabiChecked,
        setZaidChecked,
        toggleCropSelection,
        computeDomesticDemand,
        computeAgriculturalDemand,
        computeIndustrialDemand,
        canComputeDomesticDemand,
        canComputeAgriculturalDemand,
        canComputeIndustrialDemand
    } = useDemand();

    const { selectedVillages } = useLocation();

    // State for chart selection
    const [selectedChart, setSelectedChart] = useState<'individual' | 'cumulative'>('individual');

    const [showSelectionWarning, setShowSelectionWarning] = useState(false);

    // Domestic Table States for Search & Sort
    const [domesticSearchInput, setDomesticSearchInput] = useState("");
    const [domesticAppliedSearch, setDomesticAppliedSearch] = useState("");
    const [domesticAppliedSort, setDomesticAppliedSort] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

    // Agricultural Table States for Search & Sort
    const [agriculturalSearchInput, setAgriculturalSearchInput] = useState("");
    const [agriculturalAppliedSearch, setAgriculturalAppliedSearch] = useState("");
    const [agriculturalAppliedSort, setAgriculturalAppliedSort] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

    // Industrial Table States for Search & Sort (NEW)
    const [industrialSearchInput, setIndustrialSearchInput] = useState("");
    const [industrialAppliedSearch, setIndustrialAppliedSearch] = useState("");
    const [industrialAppliedSort, setIndustrialAppliedSort] = useState<{
        key: string;
        direction: "asc" | "desc";
    } | null>(null);
    /* Add these state variables at the top of your component */
    const [showDomesticTable, setShowDomesticTable] = useState(false);
    const [showAgriculturalTable, setShowAgriculturalTable] = useState(false);
    const [showIndustrialTable, setShowIndustrialTable] = useState(false);
    const [showCombinedTable, setShowCombinedTable] = useState(true);

    /* Toggle functions */
    const toggleDomesticTable = () => setShowDomesticTable(!showDomesticTable);
    const toggleAgriculturalTable = () => setShowAgriculturalTable(!showAgriculturalTable);
    const toggleIndustrialTable = () => setShowIndustrialTable(!showIndustrialTable);
    const toggleCombinedTable = () => setShowCombinedTable(!showCombinedTable);



    // Handle Agricultural Compute with Validation
    const handleAgriculturalClick = () => {
        const isAnySeasonSelected = kharifChecked || rabiChecked || zaidChecked;
        const isAnyCropSelected = Object.values(selectedCrops).some(cropsArray => cropsArray && cropsArray.length > 0);
        if (!isAnySeasonSelected || !isAnyCropSelected) {
            setShowSelectionWarning(true);
            return;
        }
        setShowSelectionWarning(false);
        computeAgriculturalDemand();
    };
    const EyeIcon: React.FC<EyeIconProps> = ({ isVisible }) => (
        isVisible ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
        ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
            </svg>
        )
    );
    // --- Table Processing Logic (Same as Admin Case) ---

    const sortData = (data: any[], sortConfig: typeof domesticAppliedSort) => {
        if (!sortConfig) return data;
        const { key, direction } = sortConfig;

        return [...data].sort((a, b) => {
            const aValue = a[key];
            const bValue = b[key];
            if (aValue == null) return direction === 'asc' ? -1 : 1;
            if (bValue == null) return direction === 'asc' ? 1 : -1;
            if (typeof aValue === 'string' && typeof bValue === 'string') {
                return direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
            }
            const numA = parseFloat(String(aValue));
            const numB = parseFloat(String(bValue));
            if (!isNaN(numA) && !isNaN(numB)) {
                return direction === 'asc' ? numA - numB : numB - numA;
            }
            return 0;
        });
    };

    // Domestic Table Processing
    const processedDomesticData = useMemo(() => {
        let data = domesticTableData.filter(row =>
            !domesticAppliedSearch || String(row.village_name || "").toLowerCase().includes(domesticAppliedSearch.toLowerCase()) || String(row.village_code || "").toLowerCase().includes(domesticAppliedSearch.toLowerCase())
        );
        return sortData(data, domesticAppliedSort);
    }, [domesticTableData, domesticAppliedSearch, domesticAppliedSort]);

    // Agricultural Table Processing
    const processedAgriculturalData = useMemo(() => {
        let data = agriculturalTableData.filter(row =>
            !agriculturalAppliedSearch || String(row.village || "").toLowerCase().includes(agriculturalAppliedSearch.toLowerCase()) || String(row.village_code || "").toLowerCase().includes(agriculturalAppliedSearch.toLowerCase())
        );
        return sortData(data, agriculturalAppliedSort);
    }, [agriculturalTableData, agriculturalAppliedSearch, agriculturalAppliedSort]);

    // Industrial Table Processing
    const processedIndustrialData = useMemo(() => {
        let data = industrialTableData.filter((row: any) =>
            !industrialAppliedSearch || Object.values(row).some((val) =>
                String(val ?? "").toLowerCase().includes(industrialAppliedSearch.toLowerCase())
            )
        );
        return sortData(data, industrialAppliedSort);
    }, [industrialTableData, industrialAppliedSearch, industrialAppliedSort]);

    // --- Handlers (Same as Admin Case) ---
    const handleDomesticApplySearch = () => setDomesticAppliedSearch(domesticSearchInput.trim());
    const handleDomesticResetSort = () => setDomesticAppliedSort(null);
    const handleAgriculturalApplySearch = () => setAgriculturalAppliedSearch(agriculturalSearchInput.trim());
    const handleAgriculturalResetSort = () => setAgriculturalAppliedSort(null);
    const handleIndustrialApplySearch = () => setIndustrialAppliedSearch(industrialSearchInput.trim());
    const handleIndustrialResetSort = () => setIndustrialAppliedSort(null);

    // --- Table Components (Re-implemented with Updates) ---

    // Domestic Table Component
    type DomesticTableProps = {
        tableData: any[];
        title: string;
        sortConfig?: { key?: string; direction?: "asc" | "desc" };
        onSort?: (field: string) => void;
        isSearched?: boolean;
    };

    const DomesticTable = ({ tableData, title, sortConfig, onSort, isSearched }: DomesticTableProps) => {
        const handleSort = (field: string) => onSort?.(field);

        const getSortIcon = (field: string) => {
            if (sortConfig?.key !== field) return null;
            return sortConfig.direction === "asc" ? (
                <span className="ml-1 text-blue-600">▲</span>
            ) : (
                <span className="ml-1 text-blue-600">▼</span>
            );
        };

        return (
            <div className="mt-4">
                <h4 className="text-md font-semibold text-gray-800 mb-2 flex items-center gap-2">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {title}
                </h4>
                <div className="overflow-x-auto overflow-y-auto max-h-96 bg-white border border-gray-200 rounded-lg shadow-sm">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50 sticky top-0 z-10">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-wider bg-gray-50 border-b-2 border-gray-200">
                                    S.No.
                                </th>
                                {DOMESTIC_DISPLAY_FIELDS.map((header) => (
                                    <th
                                        key={header}
                                        onClick={() => handleSort(header)}
                                        className={`
                                            px-4 py-3 text-left text-xs font-medium text-gray-600 tracking-wider
                                            bg-gray-50 border-b-2 border-gray-200 cursor-pointer
                                            hover:bg-gray-100 transition-colors select-none
                                        `}
                                    >
                                        <div className="flex items-center">
                                            {formatLabel(header, DOMESTIC_LABEL_MAP)}
                                            {getSortIcon(header)}
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {tableData.map((row, index) => (
                                <tr
                                    key={index}
                                    className={`${index % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-blue-50 transition-colors`}
                                >
                                    <td className="px-4 py-3 text-sm text-gray-900 font-medium whitespace-nowrap">
                                        {index + 1}
                                    </td>
                                    {DOMESTIC_DISPLAY_FIELDS.map((field) => (
                                        <td
                                            key={field}
                                            className={`px-4 py-3 text-sm whitespace-nowrap ${field === 'demand_mld' ? 'text-blue-900 font-semibold' : 'text-gray-900'
                                                }`}
                                        >
                                            {row[field] !== null && row[field] !== undefined ? String(row[field]) : 'N/A'}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="mt-3 text-sm text-gray-600 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <span>
                        Showing <strong>{tableData.length}</strong> record{tableData.length !== 1 ? "s" : ""}
                        {(sortConfig?.key || isSearched) ? ` (filtered)` : ""}
                    </span>
                </div>
            </div>
        );
    };

    // Agricultural Table Component
    type AgriculturalTableProps = {
        tableData: any[];
        title: string;
        sortConfig?: { key?: string; direction?: "asc" | "desc" };
        onSort?: (field: string) => void;
        isSearched?: boolean;
    };

    const AgriculturalTable = ({ tableData, title, sortConfig, onSort, isSearched }: AgriculturalTableProps) => {
        const handleSort = (field: string) => onSort?.(field);

        const getSortIcon = (field: string) => {
            if (sortConfig?.key !== field) return null;
            return sortConfig.direction === "asc" ? (
                <span className="ml-1 text-blue-600">▲</span>
            ) : (
                <span className="ml-1 text-blue-600">▼</span>
            );
        };

        return (
            <div className="mt-4">
                <h4 className="text-md font-semibold text-gray-800 mb-2 flex items-center gap-2">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {title}
                </h4>
                <div className="overflow-x-auto overflow-y-auto max-h-96 bg-white border border-gray-200 rounded-lg shadow-sm">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50 sticky top-0 z-10">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-wider bg-gray-50 border-b-2 border-gray-200">
                                    S.No.
                                </th>
                                {AGRICULTURAL_DISPLAY_FIELDS.map((header) => (
                                    <th
                                        key={header}
                                        onClick={() => handleSort(header)}
                                        className={`
                                            px-4 py-3 text-left text-xs font-medium text-gray-600 tracking-wider
                                            bg-gray-50 border-b-2 border-gray-200 cursor-pointer
                                            hover:bg-gray-100 transition-colors select-none
                                        `}
                                    >
                                        <div className="flex items-center">
                                            {formatLabel(header, AGRICULTURAL_LABEL_MAP)}
                                            {getSortIcon(header)}
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {tableData.map((row, index) => (
                                <tr
                                    key={index}
                                    className={`${index % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-blue-50 transition-colors`}
                                >
                                    <td className="px-4 py-3 text-sm text-gray-900 font-medium whitespace-nowrap">
                                        {index + 1}
                                    </td>
                                    {AGRICULTURAL_DISPLAY_FIELDS.map((field) => (
                                        <td
                                            key={field}
                                            className={`px-4 py-3 text-sm whitespace-nowrap ${field === 'village_demand' ? 'text-green-700 font-semibold' : 'text-gray-900'
                                                }`}
                                        >
                                            {row[field] !== null && row[field] !== undefined ? String(row[field]) : 'N/A'}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="mt-3 text-sm text-gray-600 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <span>
                        Showing <strong>{tableData.length}</strong> village{tableData.length !== 1 ? "s" : ""}
                        {(sortConfig?.key || isSearched) ? ` (filtered)` : ""}
                    </span>
                </div>
            </div>
        );
    };

    // Generic Table for Industrial & Final Results (Updated for sort/search)
    const TableDisplay = ({
        tableData,
        title,
        sortConfig,
        onSort,
        isSearched,
        searchBar
    }: {
        tableData: any[];
        title: string;
        sortConfig?: { key?: string; direction?: "asc" | "desc" };
        onSort?: (field: string) => void;
        isSearched?: boolean;
        searchBar?: boolean;
    }) => {
        const handleSort = (field: string) => onSort?.(field);

        const getSortIcon = (field: string) => {
            if (sortConfig?.key !== field) return null;
            return sortConfig.direction === "asc" ? (
                <span className="ml-1 text-blue-600">▲</span>
            ) : (
                <span className="ml-1 text-blue-600">▼</span>
            );
        };

        const headers = Object.keys(tableData[0] || {});

        return (
            <div className="mt-4">
                <div className="flex items-center gap-2 mb-3">
                    <svg
                        className="w-5 h-5 text-green-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                    </svg>
                    <h4 className="text-md font-semibold text-gray-800">{title}</h4>
                </div>

                <div className="overflow-x-auto overflow-y-auto max-h-96 bg-white border border-gray-200 rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50 sticky top-0">
                            <tr>
                                {headers.map((header) => (
                                    <th
                                        key={header}
                                        onClick={() => handleSort(header)}
                                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                                    >
                                        <div className="flex items-center">
                                            {header.replace(/_/g, " ")}
                                            {getSortIcon(header)}
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {tableData.map((row, index) => (
                                <tr
                                    key={index}
                                    className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                                >
                                    {Object.values(row).map((value, cellIndex) => (
                                        <td
                                            key={cellIndex}
                                            className={`px-4 py-3 text-sm whitespace-nowrap ${headers[cellIndex].includes('demand') ? 'font-semibold text-purple-700' : 'text-gray-900'}`}
                                        >
                                            {String(value)}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="mt-2 text-sm text-gray-600">
                    Showing {tableData.length} record{tableData.length !== 1 ? "s" : ""}
                    {(sortConfig?.key || isSearched) ? " (filtered)" : ""}
                </div>
            </div>
        );
    };


    // Industrial Demand Input Table Component
    const IndustrialDemandInputTable = () => {
        // Local state for input values to avoid re-render issues
        const [localInputs, setLocalInputs] = useState<Record<string, string>>({});

        // Initialize local inputs from context data
        useEffect(() => {
            const initialInputs: Record<string, string> = {};
            industrialData.forEach(item => {
                const key = `${item.industry}-${item.subtype}`;
                initialInputs[key] = item.production === 0 ? "" : item.production.toString();
            });
            setLocalInputs(initialInputs);
        }, [industrialData]);

        const groupedData = industrialData.reduce((acc, item) => {
            if (!acc[item.industry]) {
                acc[item.industry] = [];
            }
            acc[item.industry].push(item);
            return acc;
        }, {} as Record<string, IndustrialSubtype[]>);

        const totalAnnualDemand = industrialData.reduce((sum, item) => {
            return sum + (item.production * item.consumptionValue);
        }, 0);

        const totalGWIndustrialDemand = totalAnnualDemand * industrialGWShare;

        const getInputLabel = (item: IndustrialSubtype): string => {
            return item.industry === "Thermal Power Plants" ? "MW" : "MT";
        };

        const formatConsumptionValue = (item: IndustrialSubtype): string => {
            const unit = item.industry === "Thermal Power Plants" ? "MW" : "MT";
            return `${item.consumptionValue} m³/${unit}`;
        };

        // Handle input change with local state
        const handleInputChange = (industry: string, subtype: string, value: string) => {
            const key = `${industry}-${subtype}`;
            if (value === "" || /^\d*\.?\d*$/.test(value)) {
                setLocalInputs(prev => ({
                    ...prev,
                    [key]: value
                }));
            }
        };

        // Handle blur to update context (prevents repeated re-renders)
        const handleInputBlur = (industry: string, subtype: string) => {
            const key = `${industry}-${subtype}`;
            const value = localInputs[key];

            if (value === undefined || value.trim() === "") {
                updateIndustrialProduction(industry, subtype, 0);
                setLocalInputs(prev => ({
                    ...prev,
                    [key]: ""
                }));
                return;
            }

            const num = parseFloat(value);
            if (!isNaN(num) && num >= 0) {
                updateIndustrialProduction(industry, subtype, num);
            } else {
                const currentItem = industrialData.find(
                    item => item.industry === industry && item.subtype === subtype
                );
                setLocalInputs(prev => ({
                    ...prev,
                    [key]: currentItem?.production === 0 ? "" : (currentItem?.production.toString() || "")
                }));
            }
        };

        // Handle Enter key press to move to next input
        const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>, industry: string, subtype: string) => {
            if (e.key === 'Enter') {
                handleInputBlur(industry, subtype);
                const form = e.currentTarget.form;
                if (form) {
                    const inputs = Array.from(form.querySelectorAll('input'));
                    const currentIndex = inputs.indexOf(e.currentTarget);
                    if (currentIndex < inputs.length - 1) {
                        (inputs[currentIndex + 1] as HTMLInputElement).focus();
                    }
                }
            }
        };

        // Handle GW Share input with local state
        const [localGWShare, setLocalGWShare] = useState<string>((industrialGWShare * 100).toFixed(2).toString());

        const handleGWShareChange = (value: string) => {
            if (value === "" || /^\d*\.?\d*$/.test(value)) {
                setLocalGWShare(value);
            }
        };

        const handleGWShareBlur = () => {
            if (localGWShare.trim() === "") {
                setIndustrialGWShare(0);
                setLocalGWShare("0.00");
                return;
            }

            const num = parseFloat(localGWShare);
            if (!isNaN(num)) {
                const clamped = Math.max(0, Math.min(100, num));
                setIndustrialGWShare(clamped / 100);
                setLocalGWShare(clamped.toFixed(2));
            } else {
                setLocalGWShare((industrialGWShare * 100).toFixed(2));
            }
        };

        const handleGWShareKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Enter') {
                handleGWShareBlur();
                e.currentTarget.blur();
            }
        };

        return (
            <div className="mt-6 p-6 bg-white border border-gray-300 rounded-xl shadow-sm">
                <h5 className="text-lg font-bold text-gray-800 mb-6">
                    Industrial Water Demand Input
                </h5>

                <form onSubmit={(e) => e.preventDefault()}>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                        Industry
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                        Sub-Type
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                        Default Water Use
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                        Annual Production
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                        Calculated Demand (m³)
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-100">
                                {Object.entries(groupedData).map(([industry, subtypes]) =>
                                    subtypes.map((item, subIndex) => {
                                        const key = `${item.industry}-${item.subtype}`;
                                        return (
                                            <tr
                                                key={key}
                                                className={subIndex === 0 ? "border-t-4 border-purple-400" : ""}
                                            >
                                                {subIndex === 0 && (
                                                    <td
                                                        rowSpan={subtypes.length}
                                                        className="px-6 py-4 text-sm font-bold text-purple-800 bg-purple-50 whitespace-nowrap align-top"
                                                    >
                                                        {industry}
                                                    </td>
                                                )}

                                                <td className="px-6 py-4 text-sm text-gray-800">
                                                    {item.subtype}
                                                </td>

                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="text"
                                                            inputMode="decimal"
                                                            defaultValue={item.consumptionValue.toFixed(2)}
                                                            onChange={(e) => {
                                                                const val = e.target.value;
                                                                // Allow only numbers and one decimal point
                                                                if (val === "" || /^\d*\.?\d*$/.test(val)) {
                                                                    // Do nothing here — just let user type freely
                                                                } else {
                                                                    e.preventDefault();
                                                                }
                                                            }}
                                                            onBlur={(e) => {
                                                                const val = e.target.value.trim();
                                                                const num = parseFloat(val);
                                                                if (!isNaN(num) && num > 0) {
                                                                    updateIndustrialConsumption(item.industry, item.subtype, num);
                                                                } else {
                                                                    // Revert to original value if invalid
                                                                    e.target.value = item.consumptionValue.toFixed(2);
                                                                }
                                                            }}
                                                            onKeyDown={(e) => {
                                                                if (e.key === "Enter") {
                                                                    e.currentTarget.blur(); // Trigger blur → save
                                                                }
                                                                if (e.key === "Escape") {
                                                                    e.currentTarget.value = item.consumptionValue.toFixed(2);
                                                                    e.currentTarget.blur();
                                                                }
                                                            }}
                                                            className="w-24 px-2 py-1 text-sm font-medium text-gray-800 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all"
                                                            placeholder="0.0"
                                                        />
                                                        <span className="text-xs text-gray-500 font-medium">
                                                            m³/{item.industry === "Thermal Power Plants" ? "MW" : "MT"}
                                                        </span>
                                                    </div>
                                                </td>

                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="text"
                                                            inputMode="decimal"
                                                            value={localInputs[key] || ""}
                                                            onChange={(e) => handleInputChange(item.industry, item.subtype, e.target.value)}
                                                            onBlur={() => handleInputBlur(item.industry, item.subtype)}
                                                            onKeyPress={(e) => handleKeyPress(e, item.industry, item.subtype)}
                                                            className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm text focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                                                            placeholder="0"
                                                            autoComplete="off"
                                                        />
                                                        <span className="text-sm text-gray-500 font-medium whitespace-nowrap">
                                                            {getInputLabel(item)}
                                                        </span>
                                                    </div>
                                                </td>

                                                <td className="px-6 py-4 text-sm font-semibold text-blue-700 text">
                                                    {(item.production * item.consumptionValue).toLocaleString(undefined, {
                                                        minimumFractionDigits: 0,
                                                        maximumFractionDigits: 2,
                                                    })}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="p-5 bg-blue-50 border border-blue-200 rounded-lg">
                            <p className="text-sm font-medium text-blue-800">
                                Total Industrial Water Demand
                            </p>
                            <p className="text-2xl font-bold text-blue-900 mt-1">
                                {totalAnnualDemand.toLocaleString(undefined, {
                                    maximumFractionDigits: 0,
                                })}{" "}
                                m³
                            </p>
                        </div>

                        <div className="p-5 bg-green-50 border border-green-200 rounded-lg space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Share of Groundwater in Industrial Use (%)
                                </label>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="text"
                                        inputMode="decimal"
                                        value={localGWShare}
                                        onChange={(e) => handleGWShareChange(e.target.value)}
                                        onBlur={handleGWShareBlur}
                                        onKeyPress={handleGWShareKeyPress}
                                        className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm text font-medium focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                                        placeholder="0"
                                        autoComplete="off"
                                    />
                                    <span className="text-lg font-semibold text-gray-700">%</span>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">Default: 50% (Range: 0-100)</p>
                            </div>

                            <div className="pt-3 border-t border-green-200">
                                <p className="text-sm font-medium text-green-800">
                                    Groundwater Industrial Demand
                                </p>
                                <p className="text-2xl font-bold text-green-900 mt-1">
                                    {totalGWIndustrialDemand.toLocaleString(undefined, {
                                        maximumFractionDigits: 0,
                                    })}{" "}
                                    m³
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 text-center text-sm text-gray-600">
                        This groundwater demand will be used in the final assessment.
                    </div>
                </form>
            </div>
        );
    };

    // Combined Demand Table Component (Same as Admin Case)
    type CombinedDemandTableProps = {
        domesticData: any[];
        agriculturalData: any[];
        industrialData: any[];
        title: string;
    };

    const CombinedDemandTable = ({
        domesticData,
        agriculturalData,
        industrialData,
        title
    }: CombinedDemandTableProps) => {
        // Aggregate data by village_code (or fallback to village_name if code is missing, though preferably use code)
        const combinedData = React.useMemo(() => {
            const villageMap = new Map<string | number, any>();

            const standardizeKey = (row: any) => row.village_code || row.Village_code || row.village_name || 'Unknown_Code';

            // Add domestic data
            domesticData.forEach(row => {
                const key = standardizeKey(row);
                const villageName = row.village_name || 'Unknown';
                if (!villageMap.has(key)) {
                    villageMap.set(key, {
                        village_code: key,
                        village_name: villageName,
                        domestic_demand: 0,
                        agricultural_demand: 0,
                        industrial_demand: 0,
                    });
                }
                const village = villageMap.get(key);
                if (village) {
                    village.domestic_demand = row.demand_mld || 0;
                }
            });

            // Add agricultural data
            agriculturalData.forEach(row => {
                const key = standardizeKey(row);
                const villageName = row.village || row.village_name || 'Unknown';
                if (!villageMap.has(key)) {
                    villageMap.set(key, {
                        village_code: key,
                        village_name: villageName,
                        domestic_demand: 0,
                        agricultural_demand: 0,
                        industrial_demand: 0,
                    });
                }
                const village = villageMap.get(key);
                if (village) {
                    village.agricultural_demand = row.village_demand || 0;
                }
            });

            // Add industrial data (assuming a single aggregated row for Industrial table in Drain case, but structuring for per-village if data exists)
            // Note: Industrial data structure may vary. Assuming it needs aggregation if per-village data isn't directly available.
            // In the admin case, industrialTableData had a village_code, so we adapt for that structure here.
            industrialData.forEach(row => {
                const key = standardizeKey(row);
                const villageName = row.Village_name || row.village_name || 'Unknown';
                if (!villageMap.has(key)) {
                    villageMap.set(key, {
                        village_code: key,
                        village_name: villageName,
                        domestic_demand: 0,
                        agricultural_demand: 0,
                        industrial_demand: 0,
                    });
                }
                const village = villageMap.get(key);
                // Assuming industrial demand is in a column like 'Industrial_demand_(Million litres/Year)'
                if (village && row['Industrial_demand_(Million litres/Year)'] !== undefined) {
                    village.industrial_demand = row['Industrial_demand_(Million litres/Year)'] || 0;
                }
            });


            // Convert map to array and calculate totals
            const result = Array.from(villageMap.values()).map(village => ({
                ...village,
                total_demand: Number(village.domestic_demand) + Number(village.agricultural_demand) + Number(village.industrial_demand),
            }));

            return {
                villages: result,
            };
        }, [domesticData, agriculturalData, industrialData]);

        const grandTotal = combinedData.villages.reduce((sum, row) => sum + row.total_demand, 0);


        // Combined Table States for Search & Sort
        const [combinedSearchInput, setCombinedSearchInput] = React.useState("");
        const [combinedAppliedSearch, setCombinedAppliedSearch] = React.useState("");
        const [combinedAppliedSort, setCombinedAppliedSort] = React.useState<{
            key: string;
            direction: "asc" | "desc";
        } | null>(null);

        // Processed Combined Data (search + sort)
        const processedCombinedVillages = React.useMemo(() => {
            let data = [...combinedData.villages];

            // Search on village_code + village_name
            if (combinedAppliedSearch) {
                const search = combinedAppliedSearch.toLowerCase();
                data = data.filter((row) => {
                    const name = String(row.village_name ?? "").toLowerCase();
                    const code = String(row.village_code ?? "").toLowerCase();
                    return name.includes(search) || code.includes(search);
                });
            }

            // Sort on selected column
            if (combinedAppliedSort) {
                const { key, direction } = combinedAppliedSort;
                data.sort((a: any, b: any) => {
                    const aValue = a[key];
                    const bValue = b[key];

                    if (aValue == null) return direction === "asc" ? -1 : 1;
                    if (bValue == null) return direction === "asc" ? 1 : -1;

                    if (typeof aValue === "string" && typeof bValue === "string") {
                        return direction === "asc"
                            ? aValue.localeCompare(bValue)
                            : bValue.localeCompare(aValue);
                    }

                    if (typeof aValue === "number" && typeof bValue === "number") {
                        return direction === "asc" ? aValue - bValue : bValue - aValue;
                    }

                    const numA = parseFloat(String(aValue));
                    const numB = parseFloat(String(bValue));
                    if (!isNaN(numA) && !isNaN(numB)) {
                        return direction === "asc" ? numA - numB : numB - numA;
                    }

                    return 0;
                });
            }

            return data;
        }, [combinedData.villages, combinedAppliedSearch, combinedAppliedSort]);

        const handleCombinedApplySearch = () => {
            setCombinedAppliedSearch(combinedSearchInput.trim());
        };

        const handleCombinedResetSort = () => {
            setCombinedAppliedSort(null);
        };

        const handleCombinedSort = (field: string) => {
            setCombinedAppliedSort((prev) => {
                if (prev?.key === field) {
                    return {
                        key: field,
                        direction: prev.direction === "asc" ? "desc" : "asc",
                    };
                }
                return { key: field, direction: "asc" };
            });
        };

        const getCombinedSortIcon = (field: string) => {
            if (combinedAppliedSort?.key !== field) return null;
            return combinedAppliedSort.direction === "asc" ? (
                <span className="ml-1 text-blue-600">▲</span>
            ) : (
                <span className="ml-1 text-blue-600">▼</span>
            );
        };


        return (
            <div className="mt-6">
                <h4 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <svg
                        className="w-5 h-5 text-green-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                    </svg>
                    {title}
                </h4>

                {/* Search controls */}
                <div className="mb-3 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                    <div className="flex gap-2 ml-auto">
                        <input
                            type="text"
                            placeholder="Search village code / name..."
                            value={combinedSearchInput}
                            onChange={(e) => setCombinedSearchInput(e.target.value)}
                            onKeyPress={(e) =>
                                e.key === "Enter" && handleCombinedApplySearch()
                            }
                            className="px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <button
                            onClick={handleCombinedApplySearch}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1"
                        >
                            <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                                />
                            </svg>
                            Search
                        </button>

                        <button
                            onClick={toggleCombinedTable}
                            className="p-2 rounded-full hover:bg-gray-200 transition-colors"
                            title={showCombinedTable ? "Hide Table" : "Show Table"}
                        >
                            <EyeIcon isVisible={showCombinedTable} />
                        </button>


                    </div>
                </div>

                {/* Active filters */}
                {(combinedAppliedSearch || combinedAppliedSort) && (
                    <div className="mb-3 flex flex-wrap gap-2 text-sm">
                        {combinedAppliedSearch && (
                            <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full">
                                Search: "{combinedAppliedSearch}"
                                <button
                                    onClick={() => {
                                        setCombinedAppliedSearch("");
                                        setCombinedSearchInput("");
                                    }}
                                    className="ml-1 hover:text-blue-900"
                                >
                                    <svg
                                        className="w-3 h-3"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={3}
                                            d="M6 18L18 6M6 6l12 12"
                                        />
                                    </svg>
                                </button>
                            </span>
                        )}
                        {combinedAppliedSort && (
                            <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full">
                                Sort: {combinedAppliedSort.key.replace(/_/g, " ")} (
                                {combinedAppliedSort.direction === "asc"
                                    ? "Ascending"
                                    : "Descending"}
                                )
                                <button
                                    onClick={handleCombinedResetSort}
                                    className="ml-1 hover:text-green-900"
                                >
                                    <svg
                                        className="w-3 h-3"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={3}
                                            d="M6 18L18 6M6 6l12 12"
                                        />
                                    </svg>
                                </button>
                            </span>
                        )}
                    </div>
                )}
                {showCombinedTable && (
                    <div className="overflow-x-auto overflow-y-auto max-h-96 bg-white border border-gray-200 rounded-lg shadow-sm">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50 sticky top-0 z-10">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-wider bg-gray-50 border-b-2 border-gray-200">
                                        S.No.
                                    </th>
                                    <th
                                        onClick={() => handleCombinedSort("village_code")}
                                        className="px-4 py-3 text-left text-xs font-medium text-gray-600 tracking-wider bg-gray-50 border-b-2 border-gray-200 cursor-pointer hover:bg-gray-100 select-none"
                                    >
                                        <div className="flex items-center">
                                            Village Code
                                            {getCombinedSortIcon("village_code")}
                                        </div>
                                    </th>
                                    <th
                                        onClick={() => handleCombinedSort("village_name")}
                                        className="px-4 py-3 text-left text-xs font-medium text-gray-600 tracking-wider bg-gray-50 border-b-2 border-gray-200 cursor-pointer hover:bg-gray-100 select-none"
                                    >
                                        <div className="flex items-center">
                                            Village Name
                                            {getCombinedSortIcon("village_name")}
                                        </div>
                                    </th>
                                    <th
                                        onClick={() => handleCombinedSort("domestic_demand")}
                                        className="px-4 py-3 text-left text-xs font-medium text-gray-600 tracking-wider bg-gray-50 border-b-2 border-gray-200 cursor-pointer hover:bg-gray-100 select-none"
                                    >
                                        <div className="flex items-center">
                                            Domestic Demand (Million litres/Year)
                                            {getCombinedSortIcon("domestic_demand")}
                                        </div>
                                    </th>
                                    <th
                                        onClick={() => handleCombinedSort("agricultural_demand")}
                                        className="px-4 py-3 text-left text-xs font-medium text-gray-600 tracking-wider bg-gray-50 border-b-2 border-gray-200 cursor-pointer hover:bg-gray-100 select-none"
                                    >
                                        <div className="flex items-center">
                                            Agricultural Demand (Million litres/Year)
                                            {getCombinedSortIcon("agricultural_demand")}
                                        </div>
                                    </th>
                                    <th
                                        onClick={() => handleCombinedSort("industrial_demand")}
                                        className="px-4 py-3 text-left text-xs font-medium text-gray-600 tracking-wider bg-gray-50 border-b-2 border-gray-200 cursor-pointer hover:bg-gray-100 select-none"
                                    >
                                        <div className="flex items-center">
                                            Industrial Demand (Million litres/Year)
                                            {getCombinedSortIcon("industrial_demand")}
                                        </div>
                                    </th>
                                    <th
                                        onClick={() => handleCombinedSort("total_demand")}
                                        className="px-4 py-3 text-left text-xs font-medium text-gray-600 tracking-wider bg-gray-50 border-b-2 border-gray-200 cursor-pointer hover:bg-gray-100 select-none"
                                    >
                                        <div className="flex items-center">
                                            Total Village Demand (Million litres/Year)
                                            {getCombinedSortIcon("total_demand")}
                                        </div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {processedCombinedVillages.map((row, index) => (
                                    <tr
                                        key={row.village_code}
                                        className={`${index % 2 === 0 ? "bg-white" : "bg-gray-50"
                                            } hover:bg-blue-50 transition-colors`}
                                    >
                                        <td className="px-4 py-3 text-sm text-gray-900 font-medium whitespace-nowrap">
                                            {index + 1}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-900 font-semibold whitespace-nowrap">
                                            {row.village_code}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                                            {row.village_name}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-blue-700 font-semibold whitespace-nowrap">
                                            {Number(row.domestic_demand).toFixed(3)}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-green-700 font-semibold whitespace-nowrap">
                                            {Number(row.agricultural_demand).toFixed(3)}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-purple-700 font-semibold whitespace-nowrap">
                                            {Number(row.industrial_demand).toFixed(3)}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-indigo-900 font-bold whitespace-nowrap">
                                            {Number(row.total_demand).toFixed(3)}
                                        </td>
                                    </tr>
                                ))}
                                {/* Grand Total Row */}
                                <tr className="bg-gray-100 border-t-2 border-gray-300">
                                    <td
                                        className="px-4 py-3 text-sm font-bold text-gray-900 whitespace-nowrap"
                                        colSpan={6}
                                    >
                                        Grand Total Demand
                                    </td>
                                    <td className="px-4 py-3 text-sm text-indigo-900 font-bold whitespace-nowrap">
                                        {grandTotal.toFixed(3)}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                )}

                <div className="mt-3 text-sm text-gray-600 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <span>
                        Showing <strong>{processedCombinedVillages.length}</strong> village
                        {processedCombinedVillages.length !== 1 ? "s" : ""}
                        {(combinedAppliedSearch || combinedAppliedSort) ? " (filtered)" : ""}
                    </span>
                    <span className="font-semibold text-indigo-700">
                        Total Demand: {grandTotal.toFixed(3)} Million litres/Year
                    </span>
                </div>
            </div>
        );

    };

    // Chart Display Component (same as admin case)
    const ChartDisplay = () => {
        if (!chartData) return null;

        const colors = [
            '#8884d8', '#82ca9d', '#ffc658', '#ff7300',
            '#00ff00', '#ff00ff', '#00ffff', '#ff0000',
            '#a855f7', '#ec4899', '#14b8a6', '#f59e0b'
        ];

        const cropNames = Object.keys(chartData.individual_crops.crops_data);

        // Individual Crops Chart Data
        const individualTraces = cropNames.map((crop, index) => ({
            x: chartData.individual_crops.months,
            y: chartData.individual_crops.crops_data[crop],
            type: 'scatter' as const,
            mode: 'markers' as const,
            name: crop,
            marker: {
                size: 8,
                color: colors[index % colors.length],
                line: {
                    color: colors[index % colors.length],
                    width: 2
                }
            },
            hovertemplate: `<b>${crop}</b><br>Month: %{x}<br>Demand: %{y:.2f} mm<extra></extra>`
        }));

        // Cumulative Demand Chart Data
        const cumulativeTrace = [{
            x: chartData.cumulative_demand.months,
            y: chartData.cumulative_demand.values,
            type: 'scatter' as const,
            mode: 'lines' as const,
            name: 'Total Demand',
            fill: 'tozeroy' as const,
            fillcolor: 'rgba(136, 132, 216, 0.3)',
            line: {
                color: '#8884d8',
                width: 3
            },
            hovertemplate: '<b>Total Demand</b><br>Month: %{x}<br>Demand: %{y:.2f} mm<extra></extra>'
        }];

        // Common layout configuration
        const commonLayout = {
            font: { family: 'Inter, system-ui, sans-serif' },
            hovermode: 'closest' as const,
            dragmode: 'zoom' as const,
            showlegend: true,
            legend: {
                orientation: 'h' as const,
                yanchor: 'bottom' as const,
                y: -0.3,
                xanchor: 'center' as const,
                x: 0.5
            },
            margin: { l: 60, r: 40, t: 40, b: 80 }
        };

        const individualLayout = {
            ...commonLayout,
            title: {
                text: chartData.individual_crops.title,
                font: { size: 16, color: '#374151' }
            },
            xaxis: {
                title: { text: chartData.individual_crops.x_label },
                gridcolor: '#e5e7eb'
            },
            yaxis: {
                title: { text: chartData.individual_crops.y_label },
                gridcolor: '#e5e7eb'
            }
        };

        const cumulativeLayout = {
            ...commonLayout,
            title: {
                text: chartData.cumulative_demand.title,
                font: { size: 16, color: '#374151' }
            },
            xaxis: {
                title: { text: chartData.cumulative_demand.x_label },
                gridcolor: '#e5e7eb'
            },
            yaxis: {
                title: { text: chartData.cumulative_demand.y_label },
                gridcolor: '#e5e7eb'
            }
        };

        // Plotly config with modebar buttons
        const config = {
            displayModeBar: true,
            displaylogo: false,
            modeBarButtonsToAdd: ['toggleSpikelines' as const],
            modeBarButtonsToRemove: ['lasso2d' as const, 'select2d' as const],
            toImageButtonOptions: {
                format: 'png' as const,
                filename: selectedChart === 'individual'
                    ? 'individual_crops_demand'
                    : 'cumulative_demand',
                height: 800,
                width: 1200,
                scale: 2
            },
            responsive: true
        };

        return (
            <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <h4 className="text-lg font-semibold text-gray-800 mb-1 flex items-center gap-2">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                        />
                    </svg>
                    Agricultural Water Demand Analysis
                </h4>

                {/* Tab Navigation */}
                <div className="mb-6">
                    <div className="border-b border-gray-200">
                        <nav className="-mb-px flex space-x-8">
                            <button
                                onClick={() => setSelectedChart('individual')}
                                className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${selectedChart === 'individual'
                                    ? 'border-blue-500 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                            >
                                Individual Crops
                            </button>

                            <button
                                onClick={() => setSelectedChart('cumulative')}
                                className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${selectedChart === 'cumulative'
                                    ? 'border-blue-500 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                            >
                                Total Demand
                            </button>
                        </nav>
                    </div>
                </div>

                {/* Chart */}
                <div className="chart-display bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                    {selectedChart === 'individual' ? (
                        <Plot
                            data={individualTraces as any}
                            layout={{
                                ...individualLayout,
                                legend: {
                                    orientation: 'h',
                                    yanchor: 'top',
                                    y: -0.35,
                                    xanchor: 'center',
                                    x: 0.5,
                                },
                                margin: {
                                    l: 60,
                                    r: 30,
                                    t: 50,
                                    b: 150,
                                },
                            }}
                            config={config as any}
                            style={{ width: '100%', height: '500px' }}
                            useResizeHandler
                        />
                    ) : (
                        <Plot
                            data={cumulativeTrace as any}
                            layout={{
                                ...cumulativeLayout,
                                legend: {
                                    orientation: 'h',
                                    yanchor: 'top',
                                    y: -0.35,
                                    xanchor: 'center',
                                    x: 0.5,
                                },
                                margin: {
                                    l: 60,
                                    r: 30,
                                    t: 50,
                                    b: 150,
                                },
                            }}
                            config={config as any}
                            style={{ width: '100%', height: '500px' }}
                            useResizeHandler
                        />
                    )}
                </div>
            </div>
        );
    };


    return (
        <div className="p-4 bg-green-50 border border-green-200 rounded-md">
            <h3 className="text-lg font-semibold text-green-800 mb-3">Groundwater Demand Assessment</h3>

            {/* Demand Type Checkboxes */}
            <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Demand Types:</label>
                <div className="grid grid-cols-3 gap-4 max-w-md">
                    <label className="flex items-center p-2 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer">
                        <input type="checkbox" checked={domesticChecked} onChange={(e) => setDomesticChecked(e.target.checked)} className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                        <span className="ml-2 text-sm text-gray-700">Domestic</span>
                    </label>
                    <label className="flex items-center p-2 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer">
                        <input type="checkbox" checked={agriculturalChecked} onChange={(e) => setAgriculturalChecked(e.target.checked)} className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded" />
                        <span className="ml-2 text-sm text-gray-700">Agricultural</span>
                    </label>
                    <label className="flex items-center p-2 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer">
                        <input type="checkbox" checked={industrialChecked} onChange={(e) => setIndustrialChecked(e.target.checked)} className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded" />
                        <span className="ml-2 text-sm text-gray-700">Industrial</span>
                    </label>
                </div>
            </div>

            {/* 1. DOMESTIC DEMAND SECTION */}
            {domesticChecked && (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
                    {/* Loading overlay */}
                    {domesticLoading && (
                        <div className="fixed inset-0 backdrop-blur-sm z-50 flex items-center justify-center">
                            <div className="text-center bg-white rounded-xl shadow-2xl p-8">
                                <p className="text-xl font-semibold mt-6 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
                                    Computing Domestic Demand...
                                </p>
                                <p className="text-sm text-gray-500 mt-2">Please wait...</p>
                            </div>
                        </div>
                    )}

                    <h4 className="text-md font-semibold text-blue-800 mb-3">Domestic Demand Parameters</h4>

                    {/* Per Capita Input */}
                    <div className="mb-4 max-w-sm">
                        <div className="flex items-center gap-2 mb-1">
                            <label className="block text-sm font-medium text-gray-700">
                                Per Capita Consumption (LPCD)
                            </label>
                            <div className="group relative inline-block">
                                <span className="cursor-help text-blue-500">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </span>
                                <div className={`
                        absolute left-1/2 -translate-x-1/2 mt-1 w-64
                        bg-gray-800 text-white text-xs rounded-lg p-3
                        opacity-0 group-hover:opacity-100
                        transition-opacity duration-200 shadow-lg z-50 pointer-events-none
                    `}>
                                    Per Capita Consumption 60 liters according to Central Public Health and Environmental Engineering Organization (CPHEEO) standards.
                                </div>
                            </div>
                        </div>
                        <input
                            type="number"
                            value={perCapitaConsumption}
                            onChange={e => setPerCapitaConsumption(Number(e.target.value))}
                            className="w-full p-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Enter LPCD value (e.g., 70)"
                            min="1"
                        />
                    </div>

                    {/* Error message */}
                    {domesticError && (
                        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md">
                            <p className="font-medium">Computation Failed</p>
                            <p className="text-sm mt-1">{domesticError}</p>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="mb-4 flex flex-col sm:flex-row gap-4 items-start">
                        <button
                            onClick={computeDomesticDemand}
                            disabled={domesticLoading || !canComputeDomesticDemand()}
                            className={[
                                "inline-flex items-center justify-center gap-2 text-white font-medium transition-colors duration-200 rounded-full py-3 px-5",
                                domesticLoading || !canComputeDomesticDemand()
                                    ? "bg-gray-400 cursor-not-allowed"
                                    : "bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-md focus:outline-none focus:ring-4 focus:ring-blue-400 focus:ring-opacity-50",
                            ].join(" ")}
                        >
                            {domesticLoading ? "Computing..." : "Compute Domestic Demand"}
                        </button>

                        {/* Search & Toggle */}
                        {domesticTableData.length > 0 && (
                            <div className="flex flex-col sm:flex-row gap-3 ml-auto">
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="Search village..."
                                        value={domesticSearchInput}
                                        onChange={e => setDomesticSearchInput(e.target.value)}
                                        onKeyPress={e => e.key === "Enter" && handleDomesticApplySearch()}
                                        className="px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                    <button
                                        onClick={handleDomesticApplySearch}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                        </svg>
                                        Search
                                    </button>
                                </div>
                                <button
                                    onClick={toggleDomesticTable}
                                    className="p-2 rounded-full hover:bg-gray-200 transition-colors"
                                    title={showDomesticTable ? "Hide Table" : "Show Table"}
                                    aria-label={showDomesticTable ? "Hide Domestic Table" : "Show Domestic Table"}
                                >
                                    {showDomesticTable ? (
                                        // 👁️ Eye Open (Visible)
                                        <svg
                                            className="w-6 h-6 text-blue-600"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                            />
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                            />
                                        </svg>
                                    ) : (
                                        // 🚫 Eye Off (Hidden)
                                        <svg
                                            className="w-6 h-6 text-gray-400"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M17.94 17.94A10.016 10.016 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.953 9.953 0 012.174-3.412M6.676 6.676A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.542 7a9.952 9.952 0 01-1.378 3.38"
                                            />
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                            />
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M3 3l18 18"
                                            />
                                        </svg>
                                    )}
                                </button>

                            </div>
                        )}
                    </div>

                    {/* Active filters */}
                    {(domesticAppliedSearch || domesticAppliedSort) && (
                        <div className="mb-3 flex flex-wrap gap-2 text-sm">
                            {domesticAppliedSearch && (
                                <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full">
                                    Search: "{domesticAppliedSearch}"
                                    <button onClick={() => { setDomesticAppliedSearch(""); setDomesticSearchInput(""); }} className="ml-1 hover:text-blue-900">
                                        {/* X icon */}
                                    </button>
                                </span>
                            )}
                            {domesticAppliedSort && (
                                <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full">
                                    Sort: {formatLabel(domesticAppliedSort.key, DOMESTIC_LABEL_MAP)} ({domesticAppliedSort.direction === "asc" ? "Ascending" : "Descending"})
                                    <button onClick={handleDomesticResetSort} className="ml-1 hover:text-green-900">
                                        {/* X icon */}
                                    </button>
                                </span>
                            )}
                        </div>
                    )}

                    {/* Domestic Table */}
                    {showDomesticTable && domesticTableData.length > 0 && (
                        <DomesticTable
                            tableData={processedDomesticData}
                            title="Groundwater Consumption for Domestic Need"
                            sortConfig={domesticAppliedSort || undefined}
                            onSort={(field: string) => {
                                const direction =
                                    domesticAppliedSort?.key === field && domesticAppliedSort?.direction === "asc"
                                        ? "desc"
                                        : "asc";
                                setDomesticAppliedSort({ key: field, direction });
                            }}
                            isSearched={!!domesticAppliedSearch}
                        />
                    )}
                </div>
            )}

            {/* 2. AGRICULTURAL DEMAND SECTION */}
            {agriculturalChecked && (
                <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                    {/* Loading overlay */}
                    {agriculturalLoading && (
                        <div className="fixed inset-0 backdrop-blur-sm z-50 flex items-center justify-center">
                            <div className="text-center bg-white rounded-xl shadow-2xl p-8">
                                <p className="text-xl font-semibold mt-6 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
                                    Computing Agricultural Demand...
                                </p>
                                <p className="text-sm text-gray-500 mt-2">Please wait...</p>
                            </div>
                        </div>
                    )}
                    <div className="flex items-center space-x-2 mb-3">
                        <h4 className="text-md font-semibold text-yellow-800">Agricultural Demand Parameters</h4>
                        {/* Tooltip */}
                    </div>
                    {/* Season Selection */}
                    {/* ... (Kharif, Rabi, Zaid Checkboxes & Crop Selection Logic) ... */}

                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Select Seasons:</label>
                        <div className="grid grid-cols-3 gap-4">
                            <label className="flex items-center">
                                <input type="checkbox" checked={kharifChecked} onChange={(e) => setKharifChecked(e.target.checked)} className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded" />
                                <span className="ml-2 text-sm text-gray-700 font-medium">Kharif</span>
                            </label>
                            <label className="flex items-center">
                                <input type="checkbox" checked={rabiChecked} onChange={(e) => setRabiChecked(e.target.checked)} className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded" />
                                <span className="ml-2 text-sm text-gray-700 font-medium">Rabi</span>
                            </label>
                            <label className="flex items-center">
                                <input type="checkbox" checked={zaidChecked} onChange={(e) => setZaidChecked(e.target.checked)} className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded" />
                                <span className="ml-2 text-sm text-gray-700 font-medium">Zaid</span>
                            </label>
                        </div>
                    </div>
                    {/* 3-Column Grid for Season Crops */}
                    {(kharifChecked || rabiChecked || zaidChecked) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                            {/* Kharif block */}
                            {kharifChecked && (
                                <div className="p-4 bg-green-50 border border-green-200 rounded-lg shadow-sm">
                                    <div className="flex items-center justify-between mb-3">
                                        <h5 className="text-sm font-semibold text-green-800">Kharif Season Crops</h5>
                                        {availableCrops.Kharif?.length > 0 && (
                                            <label className="flex items-center text-xs cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedCrops.Kharif?.length === availableCrops.Kharif.length}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            availableCrops.Kharif.forEach(crop => !selectedCrops.Kharif?.includes(crop) && toggleCropSelection("Kharif", crop));
                                                        } else {
                                                            availableCrops.Kharif.forEach(crop => selectedCrops.Kharif?.includes(crop) && toggleCropSelection("Kharif", crop));
                                                        }
                                                    }}
                                                    className="h-3 w-3 text-green-600 focus:ring-green-500 border-gray-300 rounded mr-1"
                                                />
                                                Select All
                                            </label>
                                        )}
                                    </div>
                                    {cropsLoading.Kharif ? (
                                        <div className="flex items-center gap-2 text-sm text-gray-600">Loading crops...</div>
                                    ) : cropsError.Kharif ? (
                                        <p className="text-sm text-red-600">Error: {cropsError.Kharif}</p>
                                    ) : availableCrops.Kharif && availableCrops.Kharif.length > 0 ? (
                                        <div className="space-y-2">
                                            {availableCrops.Kharif.map(crop => (
                                                <label key={crop} className="flex items-center text-sm">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedCrops.Kharif?.includes(crop) || false}
                                                        onChange={() => toggleCropSelection("Kharif", crop)}
                                                        className="h-3 w-3 text-green-600 focus:ring-green-500 border-gray-300 rounded mr-2"
                                                    />
                                                    <span className="text-gray-700">{crop}</span>
                                                </label>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-gray-500">No crops available for Kharif season.</p>
                                    )}
                                </div>
                            )}
                            {/* Rabi block */}
                            {rabiChecked && (
                                <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg shadow-sm">
                                    <div className="flex items-center justify-between mb-3">
                                        <h5 className="text-sm font-semibold text-orange-800">Rabi Season Crops</h5>
                                        {availableCrops.Rabi?.length > 0 && (
                                            <label className="flex items-center text-xs cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedCrops.Rabi?.length === availableCrops.Rabi.length}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            availableCrops.Rabi.forEach(crop => !selectedCrops.Rabi?.includes(crop) && toggleCropSelection("Rabi", crop));
                                                        } else {
                                                            availableCrops.Rabi.forEach(crop => selectedCrops.Rabi?.includes(crop) && toggleCropSelection("Rabi", crop));
                                                        }
                                                    }}
                                                    className="h-3 w-3 text-orange-600 focus:ring-orange-500 border-gray-300 rounded mr-1"
                                                />
                                                Select All
                                            </label>
                                        )}
                                    </div>
                                    {cropsLoading.Rabi ? (
                                        <div className="flex items-center gap-2 text-sm text-gray-600">Loading crops...</div>
                                    ) : cropsError.Rabi ? (
                                        <p className="text-sm text-red-600">Error: {cropsError.Rabi}</p>
                                    ) : availableCrops.Rabi && availableCrops.Rabi.length > 0 ? (
                                        <div className="space-y-2">
                                            {availableCrops.Rabi.map(crop => (
                                                <label key={crop} className="flex items-center text-sm">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedCrops.Rabi?.includes(crop) || false}
                                                        onChange={() => toggleCropSelection("Rabi", crop)}
                                                        className="h-3 w-3 text-orange-600 focus:ring-orange-500 border-gray-300 rounded mr-2"
                                                    />
                                                    <span className="text-gray-700">{crop}</span>
                                                </label>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-gray-500">No crops available for Rabi season.</p>
                                    )}
                                </div>
                            )}
                            {/* Zaid block */}
                            {zaidChecked && (
                                <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg shadow-sm">
                                    <div className="flex items-center justify-between mb-3">
                                        <h5 className="text-sm font-semibold text-purple-800">Zaid Season Crops</h5>
                                        {availableCrops.Zaid?.length > 0 && (
                                            <label className="flex items-center text-xs cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedCrops.Zaid?.length === availableCrops.Zaid.length}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            availableCrops.Zaid.forEach(crop => !selectedCrops.Zaid?.includes(crop) && toggleCropSelection("Zaid", crop));
                                                        } else {
                                                            availableCrops.Zaid.forEach(crop => selectedCrops.Zaid?.includes(crop) && toggleCropSelection("Zaid", crop));
                                                        }
                                                    }}
                                                    className="h-3 w-3 text-purple-600 focus:ring-purple-500 border-gray-300 rounded mr-1"
                                                />
                                                Select All
                                            </label>
                                        )}
                                    </div>
                                    {cropsLoading.Zaid ? (
                                        <div className="flex items-center gap-2 text-sm text-gray-600">Loading crops...</div>
                                    ) : cropsError.Zaid ? (
                                        <p className="text-sm text-red-600">Error: {cropsError.Zaid}</p>
                                    ) : availableCrops.Zaid && availableCrops.Zaid.length > 0 ? (
                                        <div className="space-y-2">
                                            {availableCrops.Zaid.map(crop => (
                                                <label key={crop} className="flex items-center text-sm">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedCrops.Zaid?.includes(crop) || false}
                                                        onChange={() => toggleCropSelection("Zaid", crop)}
                                                        className="h-3 w-3 text-purple-600 focus:ring-purple-500 border-gray-300 rounded mr-2"
                                                    />
                                                    <span className="text-gray-700">{crop}</span>
                                                </label>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-gray-500">No crops available for Zaid season.</p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Groundwater Factor Input with Info Icon */}
                    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md max-w-sm">
                        <div className="flex items-center gap-2 mb-1">
                            <label className="block text-sm font-medium text-gray-700">
                                Groundwater Irrigation Factor
                            </label>
                            {/* Tooltip */}
                        </div>
                        <input
                            type="number"
                            value={groundwaterFactor}
                            onChange={(e) => setGroundwaterFactor(Number(e.target.value))}
                            className="w-full p-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Enter value between 0 and 1"
                            min="0"
                            max="1"
                            step="0.1"
                        />
                    </div>
                    {/* Error / Warning Messages */}
                    {agriculturalError && (
                        <div className="my-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md">
                            {/* ... error message content ... */}
                        </div>
                    )}
                    {chartsError && (
                        <div className="my-4 p-3 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded-md">
                            {/* ... chart error message content ... */}
                        </div>
                    )}
                    {showSelectionWarning && (
                        <div className="my-4 p-3 bg-yellow-100 border border-yellow-400 text-yellow-800 rounded-md flex items-center gap-2">
                            {/* ... warning icon ... */}
                            <span className="text-sm font-medium">Please select at least one season and one crop.</span>
                        </div>
                    )}

                    {/* --- Action Buttons (Compute, Search, Toggle) --- */}
                    <div className="mt-4 mb-4 flex flex-col sm:flex-row gap-4 items-start">
                        <button
                            onClick={handleAgriculturalClick}
                            disabled={agriculturalLoading || !canComputeAgriculturalDemand()}
                            className={[
                                "inline-flex items-center justify-center gap-2 text-white font-medium transition-colors duration-200 rounded-full py-3 px-5 shadow-md focus:outline-none focus:ring-4",
                                agriculturalLoading || !canComputeAgriculturalDemand()
                                    ? "bg-gray-400 cursor-not-allowed"
                                    : "bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-md focus:outline-none focus:ring-4 focus:ring-blue-400 focus:ring-opacity-50",
                            ].join(" ")}
                        >
                            {agriculturalLoading ? "Computing..." : "Compute Agricultural Demand"}
                        </button>


                        {/* Search & Toggle Controls */}
                        {agriculturalTableData.length > 0 && (
                            <div className="flex flex-col sm:flex-row gap-3 ml-auto">
                                {/* Search */}
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="Search village..."
                                        value={agriculturalSearchInput}
                                        onChange={(e) => setAgriculturalSearchInput(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && handleAgriculturalApplySearch()}
                                        className="px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                    <button
                                        onClick={handleAgriculturalApplySearch}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                        </svg>
                                        Search
                                    </button>
                                </div>
                                {/* Toggle Table */}
                                <button
                                    onClick={toggleAgriculturalTable}
                                    className="p-2 rounded-full hover:bg-gray-200 transition-colors"
                                    title={showAgriculturalTable ? "Hide Table" : "Show Table"}
                                >
                                    <EyeIcon isVisible={showAgriculturalTable} />
                                </button>
                            </div>
                        )}
                    </div>
                    {/* Active Filters Indicator */}
                    {(agriculturalAppliedSearch || agriculturalAppliedSort) && (
                        <div className="mb-3 flex flex-wrap gap-2 text-sm">
                            {/* Filter tags */}
                        </div>
                    )}

                    {/* Agricultural Table + Charts Container */}
                    {agriculturalTableData.length > 0 && (
                        <div className="mt-6 grid grid-cols-1 gap-6">
                            {showAgriculturalTable && (
                                <div className="overflow-auto">
                                    <AgriculturalTable
                                        tableData={processedAgriculturalData}
                                        title="Groundwater Consumption for Agricultural Need"
                                        sortConfig={agriculturalAppliedSort || undefined}
                                        onSort={(field: string) => {
                                            const direction =
                                                agriculturalAppliedSort?.key === field && agriculturalAppliedSort?.direction === "asc"
                                                    ? "desc"
                                                    : "asc";
                                            setAgriculturalAppliedSort({ key: field, direction });
                                        }}
                                        isSearched={!!agriculturalAppliedSearch}
                                    />
                                </div>
                            )}
                            <div>
                                <ChartDisplay />
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* 3. INDUSTRIAL DEMAND SECTION */}
            {industrialChecked && (
                <div className="mb-6 p-4 bg-purple-50 border border-purple-200 rounded-md">

                    {/* Loading overlay */}
                    {industrialLoading && (
                        <div className="fixed inset-0 backdrop-blur-sm z-50 flex items-center justify-center">
                            <div className="text-center bg-white rounded-xl shadow-2xl p-8">
                                <p className="text-xl font-semibold mt-6 bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-pink-600">
                                    Computing Industrial Demand...
                                </p>
                                <p className="text-sm text-gray-500 mt-2">Please wait...</p>
                            </div>
                        </div>
                    )}

                    <h4 className="text-md font-semibold text-purple-800 mb-3">
                        Industrial Demand Parameters
                    </h4>

                    {industrialError && (
                        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md">
                            <div className="flex items-start gap-2">
                                <div>
                                    <p className="font-medium">Computation Failed</p>
                                    <p className="text-sm mt-1">{industrialError}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Industrial Input Table */}
                    <IndustrialDemandInputTable />

                    {/* ✅ Compute + Search + Eye in ONE ROW */}
                    <div className="mt-4 mb-3 flex flex-col lg:flex-row gap-3 items-stretch lg:items-center">

                        {/* ✅ Compute Button */}
                        <button
                            onClick={computeIndustrialDemand}
                            disabled={industrialLoading || !canComputeIndustrialDemand()}
                            className={`${industrialLoading || !canComputeIndustrialDemand()
                                ? "bg-gray-400 cursor-not-allowed"
                                : "bg-purple-600 hover:bg-purple-700 focus:ring-4 focus:ring-purple-300"
                                } text-white font-medium py-3 px-6 rounded-md flex items-center justify-center transition-colors duration-200`}
                        >
                            {industrialLoading ? "Computing Industrial Demand..." : "Compute Industrial Demand"}
                        </button>

                        {/* ✅ Right Side Controls */}
                        <div className="flex gap-2 items-center ml-auto w-full lg:w-auto">

                            {/* Search Input */}
                            <input
                                type="text"
                                placeholder="Search industrial table..."
                                value={industrialSearchInput}
                                onChange={(e) => setIndustrialSearchInput(e.target.value)}
                                onKeyPress={(e) => e.key === "Enter" && handleIndustrialApplySearch()}
                                className="px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full lg:w-64"
                            />

                            {/* Search Button */}
                            <button
                                onClick={handleIndustrialApplySearch}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                Search
                            </button>

                            {/* Eye Toggle Button */}
                            <button
                                onClick={toggleIndustrialTable}
                                className="p-2 rounded-full hover:bg-gray-200 transition-colors"
                                title={showIndustrialTable ? "Hide Table" : "Show Table"}
                            >
                                <EyeIcon isVisible={showIndustrialTable} />
                            </button>

                        </div>
                    </div>

                    {/* Active filters */}
                    {(industrialAppliedSearch || industrialAppliedSort) && (
                        <div className="mb-3 flex flex-wrap gap-2 text-sm">
                            {industrialAppliedSearch && (
                                <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full">
                                    Search: "{industrialAppliedSearch}"
                                    <button
                                        onClick={() => {
                                            setIndustrialAppliedSearch("");
                                            setIndustrialSearchInput("");
                                        }}
                                        className="ml-1 hover:text-blue-900"
                                    >
                                        {/* X icon */}
                                    </button>
                                </span>
                            )}
                            {industrialAppliedSort && (
                                <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full">
                                    Sort: {industrialAppliedSort.key.replace(/_/g, " ")} (
                                    {industrialAppliedSort.direction === "asc" ? "Ascending" : "Descending"})
                                    <button
                                        onClick={handleIndustrialResetSort}
                                        className="ml-1 hover:text-green-900"
                                    >
                                        {/* X icon */}
                                    </button>
                                </span>
                            )}
                        </div>
                    )}

                    {/* Industrial Results Table */}
                    {showIndustrialTable && industrialTableData.length > 0 && (
                        <TableDisplay
                            tableData={processedIndustrialData}
                            title="Industrial Demand Results"
                            sortConfig={industrialAppliedSort || undefined}
                            onSort={(field) => {
                                setIndustrialAppliedSort((prev) => {
                                    if (prev?.key === field) {
                                        return {
                                            key: field,
                                            direction: prev.direction === "asc" ? "desc" : "asc",
                                        };
                                    }
                                    return { key: field, direction: "asc" };
                                });
                            }}
                            isSearched={!!industrialAppliedSearch}
                        />
                    )}

                </div>
            )}


            {/* Combined Demand Summary Table */}
            {(domesticTableData.length > 0 || agriculturalTableData.length > 0 || industrialTableData.length > 0) && (
                <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 border border-gray-300 rounded-lg">
                    <CombinedDemandTable
                        domesticData={domesticTableData}
                        agriculturalData={agriculturalTableData}
                        industrialData={industrialTableData}
                        title="Combined Groundwater Demand Summary"
                    />
                </div>
            )}
        </div>
    );
};

export default Demand;