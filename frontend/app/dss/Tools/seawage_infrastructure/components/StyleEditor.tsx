'use client';
import React, { useState, useEffect } from 'react';

interface StyleEditorProps {
    onStyleChange: (style: LayerStyle) => void;
    currentStyle: LayerStyle;
    layerName: string;
    geometryType: string | null;
    onClose: () => void;
}

export interface LayerStyle {
    shape?: 'circle' | 'square' | 'triangle' | 'star' | 'cross' | 'flag' | 'diamond';
    color: string;
    size?: number;
    opacity: number;
    strokeColor: string;
    strokeWidth: number;
}

const StyleEditor: React.FC<StyleEditorProps> = ({ onStyleChange, currentStyle, layerName, geometryType, onClose }) => {
    const [activeSection, setActiveSection] = useState<string | null>(null);
    const [style, setStyle] = useState<LayerStyle>(currentStyle);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
        return () => setIsMounted(false);
    }, []);

    useEffect(() => {
        if (isMounted) {
            setStyle(currentStyle);
        }
    }, [currentStyle, isMounted]);

    const updateStyle = (updates: Partial<LayerStyle>) => {
        if (!isMounted) return;
        const newStyle = { ...style, ...updates };
        setStyle(newStyle);
        onStyleChange(newStyle);
    };

    if (!isMounted) {
        return null;
    }

    const isPoint = geometryType === 'Point' || geometryType === 'MultiPoint';
    const isPolygon = geometryType === 'Polygon' || geometryType === 'MultiPolygon';
    const isLine = geometryType === 'LineString' || geometryType === 'MultiLineString';

    const shapes = [
        { value: 'circle', icon: '●', label: 'Circle' },
        { value: 'square', icon: '■', label: 'Square' },
        { value: 'triangle', icon: '▲', label: 'Triangle' },
        { value: 'star', icon: '★', label: 'Star' },
        { value: 'cross', icon: '✚', label: 'Cross' },
        { value: 'flag', icon: '⚑', label: 'Flag' },
        { value: 'diamond', icon: '◆', label: 'Diamond' },
    ];

    const presetColors = [
        '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF',
        '#FFA500', '#800080', '#008000', '#000080', '#808080', '#000000'
    ];

    const toggleSection = (section: string) => {
        setActiveSection(activeSection === section ? null : section);
    };

    const getDefaultStyle = (): LayerStyle => {
        if (isPoint) {
            return {
                shape: 'circle',
                color: '#3B82F6',
                size: 10,
                opacity: 0.8,
                strokeColor: '#1E40AF',
                strokeWidth: 2
            };
        } else if (isPolygon) {
            return {
                color: '#3B82F6',
                opacity: 0.3,
                strokeColor: '#1E40AF',
                strokeWidth: 2
            };
        } else {
            return {
                color: '#3B82F6',
                opacity: 1,
                strokeColor: '#3B82F6',
                strokeWidth: 3
            };
        }
    };

    return (
        <div className="bg-white/95 backdrop-blur-md rounded-lg shadow-xl border border-gray-200 overflow-visible animate-slide-in">
            {/* Header with Layer Name and Close Button */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-blue-50">
                <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                    
                    {layerName}
                </h3>
                <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-full w-6 h-6 flex items-center justify-center transition-all duration-200"
                    title="Close Style Editor"
                >
                    ✕
                </button>
            </div>

            {/* Horizontal Toolbar */}
            <div className="flex items-center gap-1 p-1.5">
                {/* Shape Button - Only for Points */}
                {isPoint && (
                    <button
                        onClick={() => toggleSection('shape')}
                        className={`px-2 py-1 rounded text-xs font-semibold transition-all duration-200 flex items-center gap-1 ${
                            activeSection === 'shape'
                                ? 'bg-purple-600 text-white shadow-md'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                        title="Shape"
                    >
                        <span className="text-sm">{shapes.find(s => s.value === style.shape)?.icon}</span>
                        <span className="text-[10px]">Shape</span>
                    </button>
                )}

                {/* Fill Color Button - For Points and Polygons */}
                {(isPoint || isPolygon) && (
                    <button
                        onClick={() => toggleSection('color')}
                        className={`px-2 py-1 rounded text-xs font-semibold transition-all duration-200 flex items-center gap-1 ${
                            activeSection === 'color'
                                ? 'bg-purple-600 text-white shadow-md'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                        title="Fill Color"
                    >
                        <span 
                            className="w-3 h-3 rounded border border-gray-400" 
                            style={{ backgroundColor: style.color }}
                        ></span>
                        <span className="text-[10px]">Fill</span>
                    </button>
                )}

                {/* Line Color Button - For Lines */}
                {isLine && (
                    <button
                        onClick={() => toggleSection('lineColor')}
                        className={`px-2 py-1 rounded text-xs font-semibold transition-all duration-200 flex items-center gap-1 ${
                            activeSection === 'lineColor'
                                ? 'bg-purple-600 text-white shadow-md'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                        title="Line Color"
                    >
                        <span 
                            className="w-3 h-3 rounded border border-gray-400" 
                            style={{ backgroundColor: style.strokeColor }}
                        ></span>
                        <span className="text-[10px]">Color</span>
                    </button>
                )}

                {/* Stroke Button - For Points and Polygons */}
                {(isPoint || isPolygon) && (
                    <button
                        onClick={() => toggleSection('stroke')}
                        className={`px-2 py-1 rounded text-xs font-semibold transition-all duration-200 flex items-center gap-1 ${
                            activeSection === 'stroke'
                                ? 'bg-purple-600 text-white shadow-md'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                        title="Stroke"
                    >
                        <span 
                            className="w-3 h-3 rounded-full border-2" 
                            style={{ borderColor: style.strokeColor }}
                        ></span>
                        <span className="text-[10px]">Stroke</span>
                    </button>
                )}

                {/* Width Button - For Lines */}
                {isLine && (
                    <button
                        onClick={() => toggleSection('lineWidth')}
                        className={`px-2 py-1 rounded text-xs font-semibold transition-all duration-200 flex items-center gap-1 ${
                            activeSection === 'lineWidth'
                                ? 'bg-purple-600 text-white shadow-md'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                        title="Line Width"
                    >
                        <span className="text-[10px]">Width</span>
                    </button>
                )}

                {/* Size Button - Only for Points */}
                {isPoint && (
                    <button
                        onClick={() => toggleSection('size')}
                        className={`px-2 py-1 rounded text-xs font-semibold transition-all duration-200 flex items-center gap-1 ${
                            activeSection === 'size'
                                ? 'bg-purple-600 text-white shadow-md'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                        title="Size"
                    >
                        <span className="text-[10px]">Size</span>
                    </button>
                )}

                {/* Opacity Button - For all types */}
                <button
                    onClick={() => toggleSection('opacity')}
                    className={`px-2 py-1 rounded text-xs font-semibold transition-all duration-200 flex items-center gap-1 ${
                        activeSection === 'opacity'
                            ? 'bg-purple-600 text-white shadow-md'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                    title="Opacity"
                >
                    <span className="text-[10px]">Opacity</span>
                </button>

                {/* Reset Button */}
                <button
                    onClick={() => {
                        const defaultStyle = getDefaultStyle();
                        setStyle(defaultStyle);
                        onStyleChange(defaultStyle);
                    }}
                    className="ml-auto px-2 py-1 rounded text-[10px] font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all duration-200"
                    title="Reset"
                >
                    🔄
                </button>
            </div>

            {/* Expandable Panels */}
            {activeSection && (
                <div className="border-t border-gray-200 p-2 bg-gray-50 animate-expand">
                    {/* Shape Panel - Points Only */}
                    {activeSection === 'shape' && isPoint && (
                        <div>
                            <p className="text-[9px] font-bold text-gray-600 mb-1.5 uppercase">Select Shape</p>
                            <div className="grid grid-cols-7 gap-1">
                                {shapes.map(({ value, icon, label }) => (
                                    <button
                                        key={value}
                                        onClick={() => updateStyle({ shape: value as any })}
                                        className={`p-1.5 rounded border transition-all duration-200 text-base hover:scale-110 ${
                                            style.shape === value
                                                ? 'border-purple-500 bg-purple-50 shadow-md'
                                                : 'border-gray-300 bg-white hover:border-purple-300'
                                        }`}
                                        title={label}
                                    >
                                        {icon}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Fill Color Panel - Points and Polygons */}
                    {activeSection === 'color' && (isPoint || isPolygon) && (
                        <div>
                            <p className="text-[9px] font-bold text-gray-600 mb-1.5 uppercase">Fill Color</p>
                            <div className="flex items-center gap-1.5 mb-1.5">
                                <input
                                    type="color"
                                    value={style.color}
                                    onChange={(e) => updateStyle({ color: e.target.value })}
                                    className="w-8 h-8 rounded cursor-pointer border border-gray-300"
                                />
                                <input
                                    type="text"
                                    value={style.color}
                                    onChange={(e) => updateStyle({ color: e.target.value })}
                                    className="flex-1 px-2 py-1 border border-gray-300 rounded text-[10px] font-mono uppercase"
                                />
                            </div>
                            <div className="grid grid-cols-12 gap-1">
                                {presetColors.map((color) => (
                                    <button
                                        key={color}
                                        onClick={() => updateStyle({ color })}
                                        className={`w-full h-5 rounded border transition-all hover:scale-110 ${
                                            style.color === color ? 'border-purple-500 ring-1 ring-purple-300' : 'border-gray-300'
                                        }`}
                                        style={{ backgroundColor: color }}
                                        title={color}
                                    >
                                        {style.color === color && (
                                            <span className="text-white text-[10px] font-bold drop-shadow">✓</span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Line Color Panel - Lines Only */}
                    {activeSection === 'lineColor' && isLine && (
                        <div>
                            <p className="text-[9px] font-bold text-gray-600 mb-1.5 uppercase">Line Color</p>
                            <div className="flex items-center gap-1.5 mb-1.5">
                                <input
                                    type="color"
                                    value={style.strokeColor}
                                    onChange={(e) => updateStyle({ strokeColor: e.target.value })}
                                    className="w-8 h-8 rounded cursor-pointer border border-gray-300"
                                />
                                <input
                                    type="text"
                                    value={style.strokeColor}
                                    onChange={(e) => updateStyle({ strokeColor: e.target.value })}
                                    className="flex-1 px-2 py-1 border border-gray-300 rounded text-[10px] font-mono uppercase"
                                />
                            </div>
                            <div className="grid grid-cols-12 gap-1">
                                {presetColors.map((color) => (
                                    <button
                                        key={color}
                                        onClick={() => updateStyle({ strokeColor: color })}
                                        className={`w-full h-5 rounded border transition-all hover:scale-110 ${
                                            style.strokeColor === color ? 'border-purple-500 ring-1 ring-purple-300' : 'border-gray-300'
                                        }`}
                                        style={{ backgroundColor: color }}
                                        title={color}
                                    >
                                        {style.strokeColor === color && (
                                            <span className="text-white text-[10px] font-bold drop-shadow">✓</span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Stroke Panel - Points and Polygons */}
                    {activeSection === 'stroke' && (isPoint || isPolygon) && (
                        <div>
                            <p className="text-[9px] font-bold text-gray-600 mb-1.5 uppercase">Stroke Color & Width</p>
                            <div className="flex items-center gap-2 mb-2">
                                <input
                                    type="color"
                                    value={style.strokeColor}
                                    onChange={(e) => updateStyle({ strokeColor: e.target.value })}
                                    className="w-8 h-8 rounded cursor-pointer border border-gray-300"
                                />
                                <input
                                    type="text"
                                    value={style.strokeColor}
                                    onChange={(e) => updateStyle({ strokeColor: e.target.value })}
                                    className="flex-1 px-2 py-1 border border-gray-300 rounded text-[10px] font-mono uppercase"
                                />
                            </div>
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-[9px] font-semibold text-gray-600">Width</span>
                                    <span className="text-[10px] font-bold text-purple-600">{style.strokeWidth}px</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="8"
                                    step="1"
                                    value={style.strokeWidth}
                                    onChange={(e) => updateStyle({ strokeWidth: parseInt(e.target.value) })}
                                    className="w-full h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer slider-purple"
                                />
                            </div>
                        </div>
                    )}

                    {/* Line Width Panel - Lines Only */}
                    {activeSection === 'lineWidth' && isLine && (
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-[9px] font-bold text-gray-600 uppercase">Line Width</span>
                                <span className="text-[10px] font-bold text-purple-600">{style.strokeWidth}px</span>
                            </div>
                            <input
                                type="range"
                                min="1"
                                max="10"
                                step="1"
                                value={style.strokeWidth}
                                onChange={(e) => updateStyle({ strokeWidth: parseInt(e.target.value) })}
                                className="w-full h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer slider-purple"
                            />
                            <div className="flex justify-between text-[9px] text-gray-500 mt-0.5">
                                <span>1px</span>
                                <span>10px</span>
                            </div>
                        </div>
                    )}

                    {/* Size Panel - Points Only */}
                    {activeSection === 'size' && isPoint && (
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-[9px] font-bold text-gray-600 uppercase">Point Size</span>
                                <span className="text-[10px] font-bold text-purple-600">{style.size}px</span>
                            </div>
                            <input
                                type="range"
                                min="4"
                                max="40"
                                step="2"
                                value={style.size}
                                onChange={(e) => updateStyle({ size: parseInt(e.target.value) })}
                                className="w-full h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer slider-purple"
                            />
                            <div className="flex justify-between text-[9px] text-gray-500 mt-0.5">
                                <span>4px</span>
                                <span>40px</span>
                            </div>
                        </div>
                    )}

                    {/* Opacity Panel - All Types */}
                    {activeSection === 'opacity' && (
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-[9px] font-bold text-gray-600 uppercase">Opacity</span>
                                <span className="text-[10px] font-bold text-purple-600">{Math.round(style.opacity * 100)}%</span>
                            </div>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.1"
                                value={style.opacity}
                                onChange={(e) => updateStyle({ opacity: parseFloat(e.target.value) })}
                                className="w-full h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer slider-purple"
                            />
                            <div className="flex justify-between text-[9px] text-gray-500 mt-0.5">
                                <span>0%</span>
                                <span>100%</span>
                            </div>
                        </div>
                    )}
                </div>
            )}

            <style jsx>{`
                .slider-purple::-webkit-slider-thumb {
                    appearance: none;
                    width: 12px;
                    height: 12px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #9333ea 0%, #6366f1 100%);
                    cursor: pointer;
                    box-shadow: 0 2px 4px rgba(147, 51, 234, 0.3);
                    transition: all 0.2s;
                }
                .slider-purple::-webkit-slider-thumb:hover {
                    transform: scale(1.2);
                }
                .slider-purple::-moz-range-thumb {
                    width: 12px;
                    height: 12px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #9333ea 0%, #6366f1 100%);
                    cursor: pointer;
                    box-shadow: 0 2px 4px rgba(147, 51, 234, 0.3);
                    border: none;
                    transition: all 0.2s;
                }
                .slider-purple::-moz-range-thumb:hover {
                    transform: scale(1.2);
                }
                @keyframes slide-in {
                    from {
                        transform: translateY(-10px);
                        opacity: 0;
                    }
                    to {
                        transform: translateY(0);
                        opacity: 1;
                    }
                }
                @keyframes expand {
                    from {
                        max-height: 0;
                        opacity: 0;
                    }
                    to {
                        max-height: 200px;
                        opacity: 1;
                    }
                }
                .animate-slide-in {
                    animation: slide-in 0.3s ease-out;
                }
                .animate-expand {
                    animation: expand 0.2s ease-out;
                }
            `}</style>
        </div>
    );
};

export default StyleEditor;