'use client';
import React, { useEffect, useState } from 'react';
import { LayerStyle, useMap, getColorForShapefile } from '@/contexts/datahub/MapContext';
import { useShapefile } from '@/contexts/datahub/Section1Context';
import StyleEditor from './StyleEditor';
import { Pencil, Target, Trash2 } from 'lucide-react';

const EditablePopupContent = ({ featureInfo, onSave, onCancel }: any) => {
    const [name, setName] = useState(featureInfo.properties.name || '');
    const [description, setDescription] = useState(featureInfo.properties.description || '');

    const handleSave = () => {
        onSave({
            ...featureInfo.properties,
            name,
            description,
        });
    };

    return (
        <div className="space-y-2 p-1">
            <div className="flex items-center justify-between pb-1.5 border-b border-gray-200">
                <h3 className="font-bold text-gray-900 text-xs">Edit Point</h3>
                <button
                    onClick={onCancel}
                    className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full w-5 h-5 flex items-center justify-center transition-all duration-200 text-xs"
                    title="Close"
                >
                    ✕
                </button>
            </div>
            <div>
                <label className="text-[8px] font-bold text-gray-500 uppercase tracking-wide block">Name</label>
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full text-xs border border-gray-300 rounded p-1"
                />
            </div>
            <div>
                <label className="text-[8px] font-bold text-gray-500 uppercase tracking-wide block">Description</label>
                <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full text-xs border border-gray-300 rounded p-1 h-16"
                />
            </div>
            <button
                onClick={handleSave}
                className="w-full bg-blue-500 text-white rounded py-1 text-xs font-semibold hover:bg-blue-600 transition-colors"
            >
                Save
            </button>
        </div>
    );
}

const MapComponent = () => {
    const {
        mapInstance,
        mapContainerRef,
        popupRef,
        isLoading,
        error,
        featureInfo,
        setFeatureInfo,
        changeBaseMap,
        selectedBaseMap,
        baseMaps,
        layerStyles,
        updateLayerStyle,
        geometryType,
        basinBoundaryVisible,
        toggleBasinBoundary,
        basinLayerStyle,
        updateBasinLayerStyle,
        mouseCoordinates,
        isFullscreen,
        toggleFullscreen,
        drawingType,
        setDrawingType,
        exportGeoJSON,
        createBuffer,
        resetBuffer,
        clearDrawings,
        drawingLayerVisible,
        toggleDrawingLayer,
        updateFeatureProperties,
    } = useMap();

    const { selectedShapefiles } = useShapefile();
    const [isBasemapOpen, setIsBasemapOpen] = useState(false);
    const [isLayersPanelOpen, setIsLayersPanelOpen] = useState(false);
    const [activeStyleEditor, setActiveStyleEditor] = useState<'main' | 'basin' | null>(null);
    const [isDrawingToolsOpen, setIsDrawingToolsOpen] = useState(false);
    const [isBufferPanelOpen, setIsBufferPanelOpen] = useState(false);
    const [bufferDistance, setBufferDistance] = useState<number>(100);
    const [bufferUnit, setBufferUnit] = useState<'meters' | 'kilometers'>('meters');
    const [activeLayerFid, setActiveLayerFid] = useState<number | null>(null);
    useEffect(() => {
        if (mapInstance) {
            const timer = setTimeout(() => {
                mapInstance.updateSize();
                mapInstance.renderSync();
            }, 150);
            return () => clearTimeout(timer);
        }
    }, [mapInstance]);

    const closePopup = () => {
        setFeatureInfo(null);
    };

    const handleStyleChange = (newStyle: LayerStyle) => {
        if (activeStyleEditor === 'main' && activeLayerFid !== null) {
            updateLayerStyle(newStyle, activeLayerFid);
        } else if (activeStyleEditor === 'basin') {
            updateBasinLayerStyle(newStyle);
        }
    };

    const closeStyleEditor = () => {
        setActiveStyleEditor(null);
    };

    const getActiveLayers = () => {
        const layers: Array<{
            id: string;
            name: string;
            geometryType: string;
            style: LayerStyle;
            visible: boolean;
            fid?: number; // Make fid optional
        }> = [];

        // Basin boundary layer
        layers.push({
            id: 'basin',
            name: 'Basin Boundary',
            geometryType: 'Polygon',
            style: basinLayerStyle,
            visible: basinBoundaryVisible
        });

        // Add all selected shapefiles as separate layers
        if (selectedShapefiles && selectedShapefiles.length > 0) {
            selectedShapefiles.forEach((shapefile) => {
                layers.push({
                    id: `shapefile-${shapefile.fid}`,
                    name: shapefile.shapefile_name,
                    geometryType: geometryType || 'Unknown',
                    style: layerStyles[shapefile.fid] || { color: '#3B82F6', opacity: 0.6, strokeColor: '#3B82F6', strokeWidth: 2 },
                    visible: true,
                    fid: shapefile.fid // Include fid here
                });
            });
        }

        return layers;
    };

    const activeLayers = getActiveLayers();



    
    const handleBufferCreate = () => {
        const distanceInMeters = bufferUnit === 'kilometers' ? bufferDistance * 1000 : bufferDistance;
        createBuffer(distanceInMeters);
    };

    const handleSavePopup = (newProperties: Record<string, any>) => {
        if (featureInfo) {
            updateFeatureProperties(featureInfo.feature, newProperties);
            closePopup();
        }
    };

  
    return (
        <div className="h-full relative">
            {/* Map Container */}
            <div className="h-full relative bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl overflow-hidden shadow-2xl">
                <div
                    ref={mapContainerRef}
                    className="w-full h-full absolute inset-0 rounded-xl"
                />

                {/* Feature Info Popup */}
                <div
                    ref={popupRef}
                    className={`bg-white rounded-md shadow-2xl border border-gray-200 p-2 min-w-[200px] max-w-[280px] backdrop-blur-sm bg-white/95 ${featureInfo ? 'block' : 'hidden'}`}
                >
                    {featureInfo && (
                        <>
                            {featureInfo.properties.isEditable ? (
                                <EditablePopupContent
                                    featureInfo={featureInfo}
                                    onSave={handleSavePopup}
                                    onCancel={closePopup}
                                />
                            ) : (
                                <>
                                    <div className="flex items-center justify-between mb-1.5 pb-1.5 border-b border-gray-200">
                                        <h3 className="font-bold text-gray-900 text-xs flex items-center gap-1.5">
                                            <span className="w-1 h-1 bg-yellow-500 rounded-full animate-pulse"></span>
                                            {featureInfo.layerName}
                                        </h3>
                                        <button
                                            onClick={closePopup}
                                            className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full w-5 h-5 flex items-center justify-center transition-all duration-200 text-xs"
                                            title="Close"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                    <div className="space-y-1 max-h-[180px] overflow-y-auto custom-scrollbar">
                                        {Object.entries(featureInfo.properties)
                                            .filter(([key]) => key !== 'isEditable')
                                            .map(([key, value]) => (
                                                <div key={key} className="bg-gradient-to-r from-gray-50 to-white rounded px-1.5 py-1 hover:shadow-sm transition-shadow duration-200">
                                                    <span className="text-[8px] font-bold text-gray-500 uppercase tracking-wide block">
                                                        {key}
                                                    </span>
                                                    <span className="text-[9px] text-gray-900 font-medium break-words leading-tight">
                                                        {value !== null && value !== undefined ? String(value) : 'N/A'}
                                                    </span>
                                                </div>
                                            ))}
                                    </div>
                                </>
                            )}
                            <div className="absolute bottom-[-6px] left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-[8px] border-r-[8px] border-t-[8px] border-transparent border-t-white"></div>
                            <div className="absolute bottom-[-7px] left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-[9px] border-r-[9px] border-t-[9px] border-transparent border-t-gray-200"></div>
                        </>
                    )}
                </div>
                 {activeStyleEditor && mapInstance && (
                <div className="absolute top-20 left-6 z-50" style={{ pointerEvents: 'auto' }}>
                    <StyleEditor
                        onStyleChange={handleStyleChange}
                        currentStyle={
                            activeStyleEditor === 'basin'
                                ? basinLayerStyle
                                : (activeLayerFid !== null && layerStyles[activeLayerFid])
                                    ? layerStyles[activeLayerFid]
                                    : getColorForShapefile(activeLayerFid || 0)
                        }
                        layerName={
                            activeStyleEditor === 'basin'
                                ? 'Basin Boundary'
                                : selectedShapefiles.find(sf => sf.fid === activeLayerFid)?.shapefile_name || 'Layer'
                        }
                        geometryType={activeStyleEditor === 'basin' ? 'Polygon' : geometryType}
                        onClose={closeStyleEditor}
                    />
                </div>
            )}
                {/* Loading State */}
                {!mapInstance && isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 z-50 rounded-xl">
                        <div className="text-center">
                            <div className="relative w-20 h-20 mx-auto mb-6">
                                <div className="absolute inset-0 border-4 border-blue-200 rounded-full"></div>
                                <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
                            </div>
                            <p className="text-gray-800 font-bold text-xl">Loading Map...</p>
                            <p className="text-gray-600 text-sm mt-2">Please wait</p>
                        </div>
                    </div>
                )}

                {/* Error State */}
                {error && (
                    <div className="absolute top-6 left-1/2 transform -translate-x-1/2 z-50 bg-red-50 border-2 border-red-300 text-red-800 px-6 py-4 rounded-xl shadow-2xl max-w-md animate-slide-down">
                        <div className="flex items-start gap-3">
                            <span className="text-2xl">⚠️</span>
                            <div>
                                <strong className="font-bold block mb-1">Error</strong>
                                <span className="text-sm">{error}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Fullscreen & Zoom Controls */}
                {mapInstance && (
                    <div className="absolute top-6 right-6 z-20 flex flex-col gap-2">
                        {/* Fullscreen Button */}
                        <button
                            onClick={toggleFullscreen}
                            className="w-12 h-12 bg-white/90 backdrop-blur-sm hover:bg-white rounded-xl shadow-2xl border border-gray-200 flex items-center justify-center transition-all duration-200 hover:scale-105"
                            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                        >
                            <span className="text-xl">{isFullscreen ? '⛶' : '⛶'}</span>
                        </button>

                        {/* Zoom Controls */}
                        <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-2xl overflow-hidden border border-gray-200">
                            <button
                                onClick={() => {
                                    const view = mapInstance.getView();
                                    view.animate({
                                        center: view.getCenter(),
                                        zoom: view.getZoom()! + 1,
                                        duration: 250,
                                    });
                                }}
                                className="block w-12 h-12 bg-white hover:bg-blue-500 hover:text-white transition-all duration-200 flex items-center justify-center font-bold text-2xl border-b border-gray-200 group"
                                title="Zoom In"
                            >
                                <span className="group-hover:scale-110 transition-transform duration-200">+</span>
                            </button>
                            <button
                                onClick={() => {
                                    const view = mapInstance.getView();
                                    view.animate({
                                        center: view.getCenter(),
                                        zoom: view.getZoom()! - 1,
                                        duration: 250,
                                    });
                                }}
                                className="block w-12 h-12 bg-white hover:bg-blue-500 hover:text-white transition-all duration-200 flex items-center justify-center font-bold text-2xl group"
                                title="Zoom Out"
                            >
                                <span className="group-hover:scale-110 transition-transform duration-200">−</span>
                            </button>
                        </div>

                        {/* Buffer Tool */}
                        <div className="relative">
                            <button
                                onClick={() => setIsBufferPanelOpen(!isBufferPanelOpen)}
                                className={`w-12 h-12 backdrop-blur-sm rounded-xl shadow-2xl border transition-all duration-200 flex items-center justify-center hover:scale-105
                                ${isBufferPanelOpen ? 'bg-blue-600 text-white border-blue-700' : 'bg-white/90 text-gray-600 border-gray-200 hover:bg-white'}`}
                                title="Buffer Tool"
                            >
                                <Target className="w-6 h-6" />
                            </button>
                            {isBufferPanelOpen && (
                                <div className="absolute right-14 top-0 w-64 bg-white/95 backdrop-blur-sm rounded-xl shadow-2xl border border-gray-200 overflow-hidden animate-scale-in p-2 space-y-3">
                                    <h3 className="font-bold text-gray-800 text-sm">Buffer Selected Feature(s)</h3>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-1">Distance</label>
                                        <input
                                            type="number"
                                            value={bufferDistance}
                                            onChange={(e) => setBufferDistance(Number(e.target.value))}
                                            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                            min="1"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-1">Unit</label>
                                        <select
                                            value={bufferUnit}
                                            onChange={(e) => setBufferUnit(e.target.value as 'meters' | 'kilometers')}
                                            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
                                        >
                                            <option value="meters">Meters</option>
                                            <option value="kilometers">Kilometers</option>
                                        </select>
                                    </div>
                                    <div className="flex gap-2 pt-1">
                                        <button
                                            onClick={handleBufferCreate}
                                            className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-3 rounded-lg text-xs transition-all duration-200"
                                        >
                                            Create
                                        </button>
                                        <button
                                            onClick={resetBuffer}
                                            title="Reset Buffers"
                                            className="bg-red-100 hover:bg-red-200 text-red-700 font-bold p-2 rounded-lg transition-all duration-200"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Drawing Tools */}
                        <div className="relative">
                            <button
                                onClick={() => setIsDrawingToolsOpen(!isDrawingToolsOpen)}
                                className={`w-12 h-12 backdrop-blur-sm rounded-xl shadow-2xl border transition-all duration-200 flex items-center justify-center hover:scale-105
                                ${isDrawingToolsOpen || drawingType ? 'bg-orange-500 text-white border-orange-600' : 'bg-white/90 text-gray-600 border-gray-200 hover:bg-white'}`}
                                title="Drawing Tools"
                            >
                                <Pencil className="w-6 h-6" />
                            </button>
                            {isDrawingToolsOpen && (
                                <div className="absolute right-14 top-0 w-48 bg-white/95 backdrop-blur-sm rounded-xl shadow-2xl border border-gray-200 overflow-hidden animate-scale-in">
                                    <div className="p-2 border-b border-gray-200 bg-gradient-to-r from-orange-50 to-amber-50 flex items-center justify-between">
                                        <h3 className="font-bold text-gray-800 text-xs">Drawing Tools</h3>
                                        <button
                                            onClick={() => toggleDrawingLayer()}
                                            className="text-lg"
                                            title={drawingLayerVisible ? "Hide Drawings" : "Show Drawings"}
                                        >
                                            {drawingLayerVisible ? '👁️' : '👁️‍🗨️'}
                                        </button>
                                    </div>
                                    <div className="p-2 space-y-1">
                                        {['Point', 'LineString', 'Polygon', 'Circle'].map((type) => (
                                            <button
                                                key={type}
                                                onClick={() => {
                                                    setDrawingType(type);
                                                    setIsDrawingToolsOpen(false);
                                                }}
                                                className={`w-full px-3 py-2 rounded-lg text-xs font-semibold text-left flex items-center gap-2 transition-all duration-200 ${drawingType === type ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                                            >
                                                <span>{type === 'LineString' ? 'Line' : type}</span>
                                            </button>
                                        ))}
                                        <div className="border-t border-gray-200 my-2"></div>
                                        <button
                                            onClick={() => clearDrawings()}
                                            className="w-full px-3 py-2 rounded-lg text-xs font-semibold text-left flex items-center gap-2 bg-red-100 text-red-700 hover:bg-red-200 transition-all duration-200"
                                        >
                                            <span>Clear All</span>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Layers Panel Button */}
                {mapInstance && (
                    <div className="absolute top-6 left-6 z-20">
                        <button
                            onClick={() => setIsLayersPanelOpen(!isLayersPanelOpen)}
                            className={`bg-white/90 backdrop-blur-sm hover:bg-white font-bold py-2 px-5 rounded-xl shadow-2xl border transition-all duration-200 text-sm flex items-center gap-2 hover:scale-105 ${isLayersPanelOpen ? 'border-blue-500 text-blue-700' : 'border-gray-200 text-gray-800'}`}
                            title="Layers"
                        >
                           
                            <span>Layers ({activeLayers.length})</span>
                        </button>
                        {isLayersPanelOpen && (
                            <div className="absolute top-full left-0 mt-2 w-80 bg-white/95 backdrop-blur-sm rounded-xl shadow-2xl border border-gray-200 overflow-hidden animate-scale-in">
                                <div className="p-3 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
                                    <h3 className="font-bold text-gray-800 text-sm">Active Layers ({activeLayers.length})</h3>
                                    <p className="text-xs text-gray-600 mt-1">
                                        {selectedShapefiles.length} shapefile{selectedShapefiles.length !== 1 ? 's' : ''} selected
                                    </p>
                                </div>
                                <div className="max-h-96 overflow-y-auto custom-scrollbar">
                                    {activeLayers.length === 1 ? (
                                        <div className="p-8 text-center text-gray-500">
                                            <p className="text-sm">No shapefiles selected</p>
                                            <p className="text-xs mt-2">Select shapefiles from the left panel</p>
                                        </div>
                                    ) : (
                                        activeLayers.map((layer) => (
                                            <div
                                                key={layer.id}
                                                className={`p-3 border-b border-gray-100 hover:bg-gray-50 transition-colors duration-200 ${!layer.visible ? 'opacity-60' : ''}`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex-1">
                                                        <p className="font-semibold text-gray-800 text-sm flex items-center gap-2">
                                                            {layer.id === 'basin' ? '' : ''}
                                                            {layer.name}
                                                        </p>
                                                        <p className="text-xs text-gray-500 mt-1">
                                                            Type: {layer.geometryType}
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {layer.id === 'basin' && (
                                                            <button
                                                                onClick={() => toggleBasinBoundary()}
                                                                className="p-2 rounded-lg hover:bg-gray-200 transition-all duration-200"
                                                                title={layer.visible ? "Hide Layer" : "Show Layer"}
                                                            >
                                                                <span className="text-lg">
                                                                    {layer.visible ? '👁️' : '👁️‍🗨️'}
                                                                </span>
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => {
                                                                if (layer.id === 'basin') {
                                                                    setActiveStyleEditor('basin');
                                                                    setActiveLayerFid(null);
                                                                } else {
                                                                    setActiveStyleEditor('main');
                                                                    setActiveLayerFid(layer.fid || null); // Handle optional fid
                                                                }
                                                            }}
                                                            className={`px-3 py-2 rounded-lg font-semibold text-xs transition-all duration-200 flex items-center gap-1 ${activeStyleEditor === (layer.id === 'basin' ? 'basin' : 'main')
                                                                ? 'bg-purple-600 text-white shadow-md'
                                                                : 'bg-gray-200 text-gray-700 hover:bg-purple-100'
                                                                }`}
                                                            title="Edit Style"
                                                        >
                                                            
                                                            <span>Style</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Export GeoJSON & Basemap Selector */}
                {mapInstance && (
                    <div className="absolute bottom-6 right-6 z-20 flex flex-col gap-2 items-end">
                        <button
                            onClick={exportGeoJSON}
                            className="bg-white/90 backdrop-blur-sm hover:bg-white text-gray-800 font-bold py-2 px-4 rounded-xl shadow-2xl border border-gray-200 transition-all duration-200 text-xs flex items-center gap-2 hover:scale-105"
                            title="Export All Layers as GeoJSON"
                        >
                            <span>💾</span>
                            <span>Export GeoJSON</span>
                        </button>
                        <div className="relative">
                            <button
                                onClick={() => setIsBasemapOpen(!isBasemapOpen)}
                                className="bg-white/90 backdrop-blur-sm hover:bg-white text-gray-800 font-bold py-3 px-5 rounded-xl shadow-2xl border border-gray-200 transition-all duration-200 text-sm flex items-center gap-2 hover:scale-105"
                                title="Select Basemap"
                            >
                                <span className="text-lg">{baseMaps[selectedBaseMap].icon}</span>
                                <span>Base Map</span>
                                <span className={`text-xs transform transition-transform duration-200 ${isBasemapOpen ? 'rotate-180' : ''}`}>▼</span>
                            </button>
                            {isBasemapOpen && (
                                <div className="absolute bottom-full right-0 mb-3 w-40 bg-white/95 backdrop-blur-sm rounded-xl shadow-2xl border border-gray-200 overflow-hidden animate-scale-in">
                                    {Object.entries(baseMaps).map(([key, { icon, label, name }]) => (
                                        <button
                                            key={key}
                                            onClick={() => {
                                                changeBaseMap(key);
                                                setIsBasemapOpen(false);
                                            }}
                                            className={`w-full hover:bg-blue-50 text-gray-800 font-semibold py-3 px-4 transition-all duration-200 text-sm text-left flex items-center gap-3 ${selectedBaseMap === key ? 'bg-blue-100 text-blue-700' : ''}`}
                                            title={name}
                                        >
                                            <span className="text-lg">{icon}</span>
                                            <span>{label}</span>
                                            {selectedBaseMap === key && <span className="ml-auto text-blue-600">✓</span>}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Coordinates */}
                {mapInstance && (
                    <div className="absolute bottom-2 left-2 z-20 flex flex-col">
                        <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-2xl border border-gray-200 px-4 py-2">
                            <div className="text-xs text-gray-800 flex items-center space-x-3">
                                <span className="text-black-600">
                                    <strong>Lat:</strong> {mouseCoordinates.lat}
                                </span>
                                <span className="text-black-600">
                                    <strong>Lon:</strong> {mouseCoordinates.lon}
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                <style jsx global>{`
                    @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
                    @keyframes slide-down { from { transform: translate(-50%, -20px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
                    @keyframes scale-in { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
                    .animate-fade-in { animation: fade-in 0.3s ease-out; }
                    .animate-slide-down { animation: slide-down 0.3s ease-out; }
                    .animate-scale-in { animation: scale-in 0.2s ease-out; }
                    .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                    .custom-scrollbar::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 10px; }
                    .custom-scrollbar::-webkit-scrollbar-thumb { background: #888; border-radius: 10px; }
                    .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #555; }
                `}</style>
            </div>

            {/* Style Editor */}
           
        </div>
    );
};

export default MapComponent;