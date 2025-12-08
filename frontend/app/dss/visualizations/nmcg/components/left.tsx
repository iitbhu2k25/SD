'use client';
import React from 'react';
import { useShapefile } from '@/contexts/datahub/Section1Context';

const Left = () => {
    const { shapefiles, selectedShapefiles, toggleShapefile, isSelected, isLoading } = useShapefile();

    return (
        <div className="h-full bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-6 overflow-y-auto shadow-2xl">
            <div className="mb-6">
                <h1 className="text-3xl font-black text-gray-900 mb-2 flex items-center gap-3">

                    <span>Data Explorer</span>
                </h1>
             
            </div>

            {/* Selected Count */}
            {selectedShapefiles.length > 0 && (
                <div className="mb-4 p-3 bg-blue-50 border-2 border-blue-200 rounded-xl animate-fade-in">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-blue-900">
                            Selected: {selectedShapefiles.length} file{selectedShapefiles.length !== 1 ? 's' : ''}
                        </span>
                        <button
                            onClick={() => selectedShapefiles.forEach(file => toggleShapefile(file))}
                            className="text-xs font-bold text-blue-600 hover:text-blue-800 underline"
                        >
                            Clear All
                        </button>
                    </div>
                </div>
            )}

            {/* Shapefile List with Checkboxes */}
            <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-700 mb-3 uppercase tracking-wider">
                    Available Files
                </label>

                {isLoading ? (
                    <div className="flex items-center justify-center py-10">
                        <div className="animate-spin w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full"></div>
                    </div>
                ) : shapefiles.length === 0 ? (
                    <div className="text-center py-10 text-gray-500">
                        <p className="text-sm font-semibold">No shapefiles found</p>
                    </div>
                ) : (
                    <div className="space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto custom-scrollbar">
                        {shapefiles.map((file) => (
                            <label
                                key={file.fid}
                                className={`flex items-center gap-3 p-4 bg-white rounded-xl border-2 cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] ${
                                    isSelected(file)
                                        ? 'border-blue-500 bg-blue-50 shadow-md'
                                        : 'border-gray-200 hover:border-blue-300'
                                }`}
                            >
                                <input
                                    type="checkbox"
                                    checked={isSelected(file)}
                                    onChange={() => toggleShapefile(file)}
                                    className="w-5 h-5 accent-blue-600 cursor-pointer"
                                />
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                    
                                        <span className={`font-semibold text-sm ${
                                            isSelected(file) ? 'text-blue-900' : 'text-gray-800'
                                        }`}>
                                            {file.shapefile_name}
                                        </span>
                                    </div>
                                    {/* <p className="text-xs text-gray-500 mt-1 ml-7 font-mono truncate">
                                        {file.shapefile_path}
                                    </p> */}
                                </div>
                                {isSelected(file) && (
                                    <span className="text-blue-600 text-xl">✓</span>
                                )}
                            </label>
                        ))}
                    </div>
                )}
            </div>

            <style jsx>{`
                @keyframes fade-in {
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in {
                    animation: fade-in 0.3s ease-out;
                }
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
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
            `}</style>
        </div>
    );
};

export default Left;