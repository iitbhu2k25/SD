'use client';
import React, { useState, useEffect } from 'react';
import { useShapefile } from '@/contexts/datahub/Section1Context';
import { useMap } from '@/contexts/datahub/MapContext';

const Right = () => {
    const { selectedShapefiles } = useShapefile();
    const { mapInstance, applyFilterToWMS } = useMap();

    const [activeShapefile, setActiveShapefile] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [allFeatureAttributes, setAllFeatureAttributes] = useState<any[]>([]);
    const [featureAttributes, setFeatureAttributes] = useState<any[]>([]);
    const [showRows, setShowRows] = useState(10);

    const [filterMode, setFilterMode] = useState(false);
    const [filters, setFilters] = useState<Record<string, string[]>>({});
    const [uniqueColumnValues, setUniqueColumnValues] = useState<Record<string, string[]>>({});
    const [openFilterDropdown, setOpenFilterDropdown] = useState<string | null>(null);

    // Reset when selected shapefiles change
    useEffect(() => {
        if (selectedShapefiles.length === 0) {
            setActiveShapefile(null);
            setFeatureAttributes([]);
            setAllFeatureAttributes([]);
            setUniqueColumnValues({});
            setFilters({});
            setFilterMode(false);
            setOpenFilterDropdown(null);
        } else if (activeShapefile && !selectedShapefiles.find(s => s.fid === activeShapefile.fid)) {
            // If active shapefile was deselected, clear it
            setActiveShapefile(null);
            setFeatureAttributes([]);
            setAllFeatureAttributes([]);
            setUniqueColumnValues({});
            setFilters({});
            setFilterMode(false);
            setOpenFilterDropdown(null);
        }
    }, [selectedShapefiles, activeShapefile]);

    // Fetch attributes when active shapefile changes
    useEffect(() => {
        if (!activeShapefile) {
            setFeatureAttributes([]);
            setAllFeatureAttributes([]);
            setUniqueColumnValues({});
            setFilters({});
            setFilterMode(false);
            setOpenFilterDropdown(null);
            return;
        }

        const fetchAttributes = async () => {
            setIsLoading(true);
            try {
                const baseName =
                    activeShapefile.shapefile_path.split('/').pop()?.replace('.shp', '') ||
                    activeShapefile.shapefile_name;
                const url = `http://localhost:9090/geoserver/wfs?service=WFS&version=1.0.0&request=GetFeature&typeName=myworkspace:${baseName}&outputFormat=application/json`;

                const res = await fetch(url);
                const data = await res.json();

                if (data.features && data.features.length > 0) {
                    const attributes = data.features.map((f: any) => f.properties);
                    setAllFeatureAttributes(attributes);
                    setFeatureAttributes(attributes);
                    setShowRows(10);

                    const uniqueValues: Record<string, string[]> = {};
                    Object.keys(attributes[0]).forEach((key) => {
                        const values = attributes.map((row: any) => {
                            const val = row[key];
                            return val !== null && val !== undefined ? String(val) : 'N/A';
                        });
                        uniqueValues[key] = Array.from(new Set(values)) as string[];
                    });
                    setUniqueColumnValues(uniqueValues);
                } else {
                    setFeatureAttributes([]);
                    setAllFeatureAttributes([]);
                    setUniqueColumnValues({});
                }
            } catch (err) {
                console.error('❌ Error fetching attributes:', err);
                setFeatureAttributes([]);
                setAllFeatureAttributes([]);
                setUniqueColumnValues({});
            }
            setIsLoading(false);
        };

        fetchAttributes();
    }, [activeShapefile]);

    const toggleValue = (key: string, value: string) => {
        setFilters((prev) => {
            const selected = prev[key] || [];
            if (selected.includes(value)) {
                return { ...prev, [key]: selected.filter((v) => v !== value) };
            } else {
                return { ...prev, [key]: [...selected, value] };
            }
        });
    };

    const toggleSelectAll = (key: string) => {
        if (!uniqueColumnValues[key]) return;
        const allSelected = filters[key]?.length === uniqueColumnValues[key].length;
        setFilters((prev) => ({
            ...prev,
            [key]: allSelected ? [] : [...uniqueColumnValues[key]],
        }));
    };


const applyFilters = (filtersToApply = filters) => {
    const filteredData = allFeatureAttributes.filter((row) =>
        Object.keys(filtersToApply).every((key) => {
            const selectedValues = filtersToApply[key];
            if (!selectedValues || selectedValues.length === 0) return true;
            const rowValue = row[key] !== null && row[key] !== undefined ? String(row[key]) : 'N/A';
            return selectedValues.includes(rowValue);
        })
    );

    setFeatureAttributes(filteredData);
    setShowRows(10);

    // Pass the activeShapefile.fid to filter only that layer
    if (mapInstance && activeShapefile) {
        applyFilterToWMS(filtersToApply, activeShapefile.fid);
    }
};

    const resetFilters = () => {
    setFilters({});
    setFilterMode(false);
    setOpenFilterDropdown(null);
    setFeatureAttributes(allFeatureAttributes);
    setShowRows(10);

    // Pass the activeShapefile.fid when resetting
    if (mapInstance && activeShapefile) {
        applyFilterToWMS({}, activeShapefile.fid);
    }
};

    const handleShowShapefile = (shapefile: any) => {
        setActiveShapefile(shapefile);
        setFilters({});
        setFilterMode(false);
        setOpenFilterDropdown(null);
    };

    return (
        <div className="h-full bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-6 overflow-y-auto shadow-2xl">
            <div className="mb-6">
                <h1 className="text-3xl font-black text-gray-900 mb-2 flex items-center gap-3">
  
                    <span>Attribute Table</span>
                </h1>
                {/* {selectedShapefiles.length > 0 && (
                    <p className="text-sm text-gray-600">
                        {selectedShapefiles.length} shapefile{selectedShapefiles.length !== 1 ? 's' : ''} selected
                    </p>
                )} */}
            </div>

            {selectedShapefiles.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                    <svg className="w-20 h-20 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-lg font-semibold">Select shapefiles to view attributes</p>
                    <p className="text-sm mt-2">Use checkboxes on the left to select files</p>
                </div>
            ) : !activeShapefile ? (
                <div className="space-y-3">
                    <h2 className="text-lg font-bold text-gray-800 mb-4">Selected Shapefiles</h2>
                    {selectedShapefiles.map((shapefile) => (
                        <div
                            key={shapefile.fid}
                            className="flex items-center justify-between p-4 bg-white rounded-xl border-2 border-gray-200 hover:border-blue-300 transition-all duration-200 shadow-sm hover:shadow-md"
                        >
                            <div className="flex items-center gap-3 flex-1">
                        
                                <div>
                                    <p className="font-semibold text-gray-800 text-sm">
                                        {shapefile.shapefile_name}
                                    </p>
                                    {/* <p className="text-xs text-gray-500 font-mono truncate max-w-[200px]">
                                        {shapefile.shapefile_path}
                                    </p> */}
                                </div>
                            </div>
                            <button
                                onClick={() => handleShowShapefile(shapefile)}
                                className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold rounded-lg hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 shadow-md hover:shadow-lg text-sm"
                            >
                                Show Table
                            </button>
                        </div>
                    ))}
                </div>
            ) : (
                <>
                    {/* Back Button and Active Shapefile Header */}
                    <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-200">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                            
                                <div>
                                    <p className="font-bold text-gray-900 text-sm">
                                        {activeShapefile.shapefile_name}
                                    </p>
                                   
                                </div>
                            </div>
                            <button
                                onClick={() => setActiveShapefile(null)}
                                className="px-4 py-2 bg-white text-gray-700 font-bold rounded-lg hover:bg-gray-100 transition-all duration-200 border-2 border-gray-300 text-sm flex items-center gap-2"
                            >
                                <span>←</span>
                                <span>Back to List</span>
                            </button>
                        </div>
                    </div>

                    {/* Filter Controls */}
                    {featureAttributes.length > 0 && (
                        <div className="flex flex-wrap gap-3 mb-4">
                            <button
                                onClick={() => setFilterMode(!filterMode)}
                                className={`px-5 py-2.5 rounded-xl font-bold transition-all duration-200 flex items-center gap-2 ${
                                    filterMode 
                                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg' 
                                        : 'bg-white text-gray-800 border-2 border-gray-300 hover:border-blue-400 hover:shadow-lg'
                                }`}
                            >
                                <span>{filterMode ? '' : '🔍'}</span>
                                <span>{filterMode ? 'Filter Active' : 'Enable Filter'}</span>
                            </button>
                            {filterMode && (
                                <>
                                    <button
                                        onClick={() => applyFilters()}
                                        className="px-5 py-2.5 rounded-xl font-bold bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 transition-all duration-200 shadow-lg hover:shadow-xl flex items-center gap-2"
                                    >
                                        <span></span>
                                        <span>Apply Filter</span>
                                    </button>
                                    <button
                                        onClick={resetFilters}
                                        className="px-5 py-2.5 rounded-xl font-bold bg-gray-300 text-gray-800 hover:bg-gray-400 transition-all duration-200 shadow-lg hover:shadow-xl flex items-center gap-2"
                                    >
                                        <span>↺</span>
                                        <span>Reset</span>
                                    </button>
                                </>
                            )}
                        </div>
                    )}

                    {/* Active Filters Display */}
                    {Object.keys(filters).some((key) => filters[key]?.length > 0) && (
                        <div className="mb-4 p-4 bg-blue-50 border-2 border-blue-200 rounded-xl text-sm animate-fade-in">
                            <strong className="text-blue-900 font-bold flex items-center gap-2 mb-2">
                       
                                <span>Active Filters:</span>
                            </strong>
                            <div className="space-y-1">
                                {Object.keys(filters).map((key) => {
                                    const vals = filters[key];
                                    if (!vals || vals.length === 0) return null;
                                    return (
                                        <div key={key} className="ml-4">
                                            <span className="font-bold text-blue-700">{key}:</span>{' '}
                                            <span className="text-blue-900">{vals.join(', ')}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Feature Count */}
                    {allFeatureAttributes.length > 0 && (
                        <div className="mb-3 p-3 bg-gradient-to-r from-gray-100 to-gray-200 rounded-xl border-2 border-gray-300 flex items-center justify-between">
                            <span className="text-sm font-bold text-gray-700">Showing Features:</span>
                            <span className="text-lg font-black text-gray-900">
                                {featureAttributes.length} / {allFeatureAttributes.length}
                            </span>
                        </div>
                    )}

                    {/* Feature Table - FIXED HEIGHT WITH SCROLLING */}
                    <div className="rounded-xl border-2 border-gray-300 shadow-xl bg-white" style={{ height: '500px' }}>
                        {isLoading ? (
                            <div className="p-10 text-center h-full flex flex-col items-center justify-center">
                                <div className="animate-spin w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full mb-4"></div>
                                <p className="text-gray-600 font-semibold">Loading attributes...</p>
                            </div>
                        ) : featureAttributes.length === 0 ? (
                            <div className="p-10 text-center text-gray-500 font-semibold h-full flex items-center justify-center">
                                <span>No attributes found</span>
                            </div>
                        ) : (
                            <div className="h-full overflow-auto custom-scrollbar">
                                <table className="min-w-full bg-white">
                                    <thead className="bg-gradient-to-r from-gray-700 to-gray-800 text-white sticky top-0 z-10">
                                        <tr>
                                            {Object.keys(featureAttributes[0]).map((key) => (
                                                <th key={key} className="text-left px-4 py-4 font-bold relative whitespace-nowrap">
                                                    <div className="flex justify-between items-center gap-2">
                                                        <span>{key}</span>
                                                        {filterMode && (
                                                            <button
                                                                onClick={() =>
                                                                    setOpenFilterDropdown(
                                                                        openFilterDropdown === key ? null : key
                                                                    )
                                                                }
                                                                className="px-2 py-1 text-xs bg-white/20 rounded-lg hover:bg-white/30 transition-all duration-200"
                                                            >
                                                                ▼
                                                            </button>
                                                        )}
                                                    </div>

                                                    {filterMode && openFilterDropdown === key && (
                                                        <div className="absolute bg-white border-2 border-gray-300 shadow-2xl z-50 p-4 max-h-64 overflow-y-auto mt-2 min-w-[240px] rounded-xl animate-scale-in">
                                                            <div className="flex justify-between items-center mb-3 pb-3 border-b-2 border-gray-200">
                                                                <span className="text-sm font-bold text-gray-900">Select Values</span>
                                                                <button
                                                                    className="text-sm text-blue-600 hover:text-blue-800 font-bold"
                                                                    onClick={() => toggleSelectAll(key)}
                                                                >
                                                                    {filters[key]?.length === uniqueColumnValues[key]?.length
                                                                        ? 'Clear All'
                                                                        : 'Select All'}
                                                                </button>
                                                            </div>
                                                            <div className="max-h-48 overflow-y-auto custom-scrollbar">
                                                                {uniqueColumnValues[key]?.map((val) => (
                                                                    <label
                                                                        key={val}
                                                                        className="block text-sm py-2 px-2 hover:bg-blue-50 cursor-pointer rounded-lg transition-all duration-200 font-medium text-gray-800"
                                                                    >
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={filters[key]?.includes(val) || false}
                                                                            onChange={() => toggleValue(key, val)}
                                                                            className="mr-3 w-4 h-4 accent-blue-600"
                                                                        />
                                                                        {val}
                                                                    </label>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {featureAttributes.map((attr, idx) => (
                                            <tr key={idx} className="border-b border-gray-200 hover:bg-blue-50 transition-all duration-200">
                                                {Object.values(attr).map((val, i) => (
                                                    <td key={i} className="px-4 py-3 text-sm text-gray-800 font-medium whitespace-nowrap">
                                                        {val?.toString() || 'N/A'}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}

            <style jsx>{`
                @keyframes scale-in {
                    from { transform: scale(0.95); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }
                @keyframes fade-in {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                .animate-scale-in {
                    animation: scale-in 0.2s ease-out;
                }
                .animate-fade-in {
                    animation: fade-in 0.3s ease-out;
                }
                .custom-scrollbar::-webkit-scrollbar {
                    width: 8px;
                    height: 8px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: #f1f1f1;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #888;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #555;
                }
                .custom-scrollbar::-webkit-scrollbar-corner {
                    background: #f1f1f1;
                }
            `}</style>
        </div>
    );
};

export default Right;