'use client';
import React, { createContext, useContext, useRef, useEffect, ReactNode, useState, useMemo } from 'react';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import Overlay from 'ol/Overlay';
import OSM from 'ol/source/OSM';
import XYZ from 'ol/source/XYZ';
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import { fromLonLat, toLonLat } from 'ol/proj';
import { Style, Fill, Stroke, Circle, RegularShape } from 'ol/style';
import { Draw, Modify, Snap, Select } from 'ol/interaction';
import { useShapefile } from './Section1Context';
import { Feature } from 'ol';
import { click } from 'ol/events/condition';
import { getLength, getArea } from 'ol/sphere';
import { Geometry, LineString, Polygon } from 'ol/geom';
import { unByKey } from 'ol/Observable';
import { Polygon as OLPolygon } from 'ol/geom';



export interface LayerStyle {
    shape?: 'circle' | 'square' | 'triangle' | 'star' | 'cross' | 'flag' | 'diamond';
    color: string;
    size?: number;
    opacity: number;
    strokeColor: string;
    strokeWidth: number;
}

interface BaseMapDefinition {
    name: string;
    source: () => any;
    icon: string;
    label: string;
}

const GEOSERVER_WFS_URL = '/geoserver/api/myworkspace/wfs';
const WORKSPACE = 'myworkspace';
const BASIN_BOUNDARY_LAYER = 'basin_boundary';

const baseMaps: Record<string, BaseMapDefinition> = {
    osm: {
        name: 'OpenStreetMap',
        source: () => new OSM({ crossOrigin: 'anonymous' }),
        icon: '🗺️',
        label: 'Street'
    },
    satellite: {
        name: 'Satellite',
        source: () => new XYZ({
            url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            maxZoom: 19,
            crossOrigin: 'anonymous',
        }),
        icon: '🛰️',
        label: 'Satellite'
    },
    positron: {
        name: 'CartoDB Positron',
        source: () => new XYZ({
            url: 'https://cartodb-basemaps-a.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png',
            maxZoom: 19,
            crossOrigin: 'anonymous',
        }),
        icon: '☀️',
        label: 'Light'
    },
    dark: {
        name: 'CartoDB Dark Matter',
        source: () => new XYZ({
            url: 'https://cartodb-basemaps-a.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png',
            maxZoom: 19,
            crossOrigin: 'anonymous',
        }),
        icon: '🌙',
        label: 'Dark'
    },
};

interface FeatureInfo {
    properties: Record<string, any>;
    layerName: string;
    feature: Feature;
    coordinate: number[];
}

interface MapContextType {
    mapInstance: Map | null;
    selectedBaseMap: string;
    changeBaseMap: (key: string) => void;
    mapContainerRef: React.RefObject<HTMLDivElement | null>;
    popupRef: React.RefObject<HTMLDivElement | null>;
    featureInfo: FeatureInfo | null;
    setFeatureInfo: (info: FeatureInfo | null) => void;
    isLoading: boolean;
    error: string | null;
    showLabels: boolean;
    toggleLabels: () => void;
    filteredFeatures: any[];
    setFilteredFeatures: (features: any[]) => void;
    applyFilterToWMS: (filters: Record<string, string[]>, targetFid?: number) => void;
    baseMaps: Record<string, BaseMapDefinition>;
    layerStyles: Record<number, LayerStyle>;
    updateLayerStyle: (style: LayerStyle, targetFid: number) => void;
    geometryType: string | null;
    hoveredFeature: any;
    basinBoundaryVisible: boolean;
    toggleBasinBoundary: () => void;
    basinLayerStyle: LayerStyle;
    updateBasinLayerStyle: (style: LayerStyle) => void;
    mouseCoordinates: { lat: string; lon: string };
    isFullscreen: boolean;
    toggleFullscreen: () => void;
    drawingType: string | null;
    setDrawingType: (type: string | null) => void;
    exportGeoJSON: () => void;
    clearDrawings: () => void;
    drawingLayerVisible: boolean;
    toggleDrawingLayer: () => void;
    updateFeatureProperties: (feature: Feature, properties: Record<string, any>) => void;
}

interface MapProviderProps {
    children: ReactNode;
}

const MapContext = createContext<MapContextType | undefined>(undefined);

const DEFAULT_POINT_STYLE: LayerStyle = {
    shape: 'circle',
    color: '#3B82F6',
    size: 10,
    opacity: 0.8,
    strokeColor: '#1E40AF',
    strokeWidth: 2
};

const DEFAULT_POLYGON_STYLE: LayerStyle = {
    color: '#3B82F6',
    opacity: 0.3,
    strokeColor: '#1E40AF',
    strokeWidth: 2
};

const DEFAULT_LINE_STYLE: LayerStyle = {
    color: '#3B82F6',
    opacity: 1,
    strokeColor: '#3B82F6',
    strokeWidth: 3
};

const BASIN_DEFAULT_STYLE: LayerStyle = {
    color: '#10B981',
    opacity: 0,
    strokeColor: '#059669',
    strokeWidth: 3
};

const DRAWING_STYLE = new Style({
    fill: new Fill({
        color: 'rgba(255, 165, 0, 0.3)',
    }),
    stroke: new Stroke({
        color: '#FF6B00',
        width: 3,
    }),
    image: new Circle({
        radius: 7,
        fill: new Fill({
            color: '#FF6B00',
        }),
        stroke: new Stroke({
            color: '#fff',
            width: 2,
        }),
    }),
});

const SELECTION_STYLE = new Style({
    fill: new Fill({
        color: 'rgba(255, 255, 0, 0.5)',
    }),
    stroke: new Stroke({
        color: '#FFD700',
        width: 4,
    }),
    image: new Circle({
        radius: 8,
        fill: new Fill({
            color: '#FFD700',
        }),
        stroke: new Stroke({
            color: '#fff',
            width: 2,
        }),
    }),
});

const createOLStyle = (styleConfig: LayerStyle, isHovered: boolean = false): Style => {
    const { shape, color, size, opacity, strokeColor, strokeWidth } = styleConfig;

    const fill = new Fill({
        color: isHovered ? `${color}ff` : `${color}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`
    });

    const stroke = new Stroke({
        color: strokeColor,
        width: isHovered ? strokeWidth + 2 : strokeWidth
    });

    const finalSize = isHovered ? (size || 10) * 1.3 : (size || 10);

    switch (shape) {
        case 'circle':
            return new Style({
                image: new Circle({
                    radius: finalSize / 2,
                    fill: fill,
                    stroke: stroke
                })
            });
        case 'square':
            return new Style({
                image: new RegularShape({
                    fill: fill,
                    stroke: stroke,
                    points: 4,
                    radius: finalSize / 2,
                    angle: Math.PI / 4
                })
            });
        case 'triangle':
            return new Style({
                image: new RegularShape({
                    fill: fill,
                    stroke: stroke,
                    points: 3,
                    radius: finalSize / 2,
                    rotation: 0,
                    angle: 0
                })
            });
        case 'star':
            return new Style({
                image: new RegularShape({
                    fill: fill,
                    stroke: stroke,
                    points: 5,
                    radius: finalSize / 2,
                    radius2: (finalSize / 2) * 0.4,
                    angle: 0
                })
            });
        case 'cross':
            return new Style({
                image: new RegularShape({
                    fill: fill,
                    stroke: stroke,
                    points: 4,
                    radius: finalSize / 2,
                    radius2: 0,
                    angle: 0
                })
            });
        case 'diamond':
            return new Style({
                image: new RegularShape({
                    fill: fill,
                    stroke: stroke,
                    points: 4,
                    radius: finalSize / 2,
                    angle: 0
                })
            });
        case 'flag':
            return new Style({
                image: new RegularShape({
                    fill: fill,
                    stroke: stroke,
                    points: 3,
                    radius: finalSize / 2,
                    rotation: Math.PI / 2,
                    angle: 0
                })
            });
        default:
            return new Style({
                image: new Circle({
                    radius: finalSize / 2,
                    fill: fill,
                    stroke: stroke
                })
            });
    }
};

const createPolygonStyle = (styleConfig: LayerStyle, isHovered: boolean = false): Style => {
    const { color, opacity, strokeColor, strokeWidth } = styleConfig;

    return new Style({
        fill: new Fill({
            color: isHovered
                ? `${color}${Math.round(Math.min(opacity * 1.5, 1) * 255).toString(16).padStart(2, '0')}`
                : `${color}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`
        }),
        stroke: new Stroke({
            color: strokeColor,
            width: isHovered ? strokeWidth + 1 : strokeWidth
        })
    });
};

const createLineStyle = (styleConfig: LayerStyle, isHovered: boolean = false): Style => {
    const { strokeColor, strokeWidth } = styleConfig;

    return new Style({
        stroke: new Stroke({
            color: strokeColor,
            width: isHovered ? strokeWidth + 2 : strokeWidth
        })
    });
};

const getColorForShapefile = (fid: number): LayerStyle => {
    const colors: LayerStyle[] = [
        { color: '#E6194B', opacity: 0.6, strokeColor: '#E6194B', strokeWidth: 2 },
        { color: '#3CB44B', opacity: 0.6, strokeColor: '#3CB44B', strokeWidth: 2 },
        { color: '#0082C8', opacity: 0.6, strokeColor: '#0082C8', strokeWidth: 2 },
        { color: '#F58231', opacity: 0.6, strokeColor: '#F58231', strokeWidth: 2 },
        { color: '#911EB4', opacity: 0.6, strokeColor: '#911EB4', strokeWidth: 2 },
        { color: '#46F0F0', opacity: 0.6, strokeColor: '#46F0F0', strokeWidth: 2 },
        { color: '#F032E6', opacity: 0.6, strokeColor: '#F032E6', strokeWidth: 2 },
        { color: '#D2F53C', opacity: 0.6, strokeColor: '#D2F53C', strokeWidth: 2 },
        { color: '#008080', opacity: 0.6, strokeColor: '#008080', strokeWidth: 2 },
        { color: '#AA6E28', opacity: 0.6, strokeColor: '#AA6E28', strokeWidth: 2 },
        { color: '#800000', opacity: 0.6, strokeColor: '#800000', strokeWidth: 2 },
        { color: '#808000', opacity: 0.6, strokeColor: '#808000', strokeWidth: 2 },
        { color: '#FFD700', opacity: 0.6, strokeColor: '#FFD700', strokeWidth: 2 },
        { color: '#9A6324', opacity: 0.6, strokeColor: '#9A6324', strokeWidth: 2 },
        { color: '#469990', opacity: 0.6, strokeColor: '#469990', strokeWidth: 2 },
        { color: '#DCBEFF', opacity: 0.6, strokeColor: '#DCBEFF', strokeWidth: 2 },
        { color: '#FABEBE', opacity: 0.6, strokeColor: '#FABEBE', strokeWidth: 2 },
        { color: '#A9A9A9', opacity: 0.6, strokeColor: '#A9A9A9', strokeWidth: 2 },
        { color: '#BFEF45', opacity: 0.6, strokeColor: '#BFEF45', strokeWidth: 2 },
        { color: '#000075', opacity: 0.6, strokeColor: '#000075', strokeWidth: 2 },
    ];

    return colors[fid % colors.length];
};

export const MapProvider: React.FC<MapProviderProps> = ({ children }) => {
    const { selectedShapefiles } = useShapefile();

    const mapContainerRef = useRef<HTMLDivElement>(null);
    const popupRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<Map | null>(null);
    const baseLayerRef = useRef<TileLayer<any> | null>(null);
    const vectorLayersRef = useRef<Record<number, any>>({});
    const basinLayerRef = useRef<any>(null);
    const drawingLayerRef = useRef<any>(null);
    const overlayRef = useRef<Overlay | null>(null);
    const hoveredFeatureRef = useRef<any>(null);
    const drawInteractionRef = useRef<Draw | null>(null);
    const modifyInteractionRef = useRef<Modify | null>(null);
    const snapInteractionRef = useRef<Snap | null>(null);
    const selectInteractionRef = useRef<Select | null>(null);
    const basinLoadedRef = useRef<boolean>(false);
    const measurementOverlayRef = useRef<Overlay | null>(null);

    const [mapInstance, setMapInstance] = useState<Map | null>(null);
    const [selectedBaseMap, setSelectedBaseMap] = useState('osm');
    const [featureInfo, setFeatureInfo] = useState<FeatureInfo | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showLabels, setShowLabels] = useState(false);
    const [filteredFeatures, setFilteredFeatures] = useState<any[]>([]);
    const [currentFilters, setCurrentFilters] = useState<Record<string, string[]>>({});
    const [layerStyles, setLayerStyles] = useState<Record<number, LayerStyle>>({});
    const [geometryType, setGeometryType] = useState<string | null>(null);
    const [hoveredFeature, setHoveredFeature] = useState<any>(null);
    const [basinBoundaryVisible, setBasinBoundaryVisible] = useState(true);
    const [basinLayerStyle, setBasinLayerStyle] = useState<LayerStyle>(BASIN_DEFAULT_STYLE);
    const [mouseCoordinates, setMouseCoordinates] = useState({ lat: '0.0000', lon: '0.0000' });
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [drawingType, setDrawingType] = useState<string | null>(null);
    const [drawingLayerVisible, setDrawingLayerVisible] = useState(true);

    const toggleLabels = () => setShowLabels((s) => !s);
    const toggleBasinBoundary = () => setBasinBoundaryVisible((v) => !v);
    const toggleDrawingLayer = () => setDrawingLayerVisible((v) => !v);

    const formatLength = (length: number): string => {
        if (length > 1000) {
            return `${(length / 1000).toFixed(2)} km`;
        }
        return `${length.toFixed(2)} m`;
    };

    const formatArea = (area: number): string => {
        if (area > 1000000) {
            return `${(area / 1000000).toFixed(2)} km²`;
        }
        return `${area.toFixed(2)} m²`;
    };

    const formatCoordinates = (coord: number[]): string => {
        const lonLat = toLonLat(coord);
        return `Lat: ${lonLat[1].toFixed(6)}, Lon: ${lonLat[0].toFixed(6)}`;
    };

    const formatRadius = (radius: number): string => {
        if (radius > 1000) {
            return `Radius: ${(radius / 1000).toFixed(2)} km`;
        }
        return `Radius: ${radius.toFixed(2)} m`;
    };

    // Initialize measurement overlay
    useEffect(() => {
        if (!mapInstance || measurementOverlayRef.current) return;

        if (typeof window !== 'undefined') {
            const measurementDiv = document.createElement('div');
            measurementDiv.style.cssText = `
                background-color: rgba(0, 0, 0, 1);
                color: white;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 15px;
                white-space: nowrap;
                pointer-events: none;
            `;

            const measurementOverlay = new Overlay({
                element: measurementDiv,
                offset: [0, -15],
                positioning: 'bottom-center',
                stopEvent: false,
            });

            mapInstance.addOverlay(measurementOverlay);
            measurementOverlayRef.current = measurementOverlay;
            console.log('✓ Measurement overlay added');
        }
    }, [mapInstance]);

    // Initialize map
    useEffect(() => {
        if (!mapContainerRef.current || mapRef.current) return;
        setIsLoading(true);
        try {
            const baseLayer = new TileLayer({
                source: baseMaps[selectedBaseMap].source(),
                zIndex: 0,
            });
            baseLayer.set('name', 'basemap');
            baseLayerRef.current = baseLayer;

            const map = new Map({
                target: mapContainerRef.current,
                layers: [baseLayer],
                controls: [],
                view: new View({
                    center: fromLonLat([78.9629, 20.5937]),
                    zoom: 5,
                }),
            });

            mapRef.current = map;
            setMapInstance(map);
            setIsLoading(false);
            console.log('✓ Map initialized');
        } catch (err) {
            console.error('Map initialization error:', err);
            setError('Failed to initialize map');
            setIsLoading(false);
        }
    }, [selectedBaseMap]);

    // Initialize popup overlay
    useEffect(() => {
        if (!mapInstance || !popupRef.current || overlayRef.current) return;
        const overlay = new Overlay({
            element: popupRef.current,
            autoPan: false,
            positioning: 'bottom-center',
            stopEvent: false,
            offset: [0, -10],
        });
        mapInstance.addOverlay(overlay);
        overlayRef.current = overlay;
        console.log('✓ Popup overlay added');
    }, [mapInstance]);

    // Track mouse coordinates
    useEffect(() => {
        if (!mapInstance) return;

        const handlePointerMove = (evt: any) => {
            const coordinate = evt.coordinate;
            const lonLat = toLonLat(coordinate);
            setMouseCoordinates({
                lat: lonLat[1].toFixed(4),
                lon: lonLat[0].toFixed(4)
            });
        };

        mapInstance.on('pointermove', handlePointerMove);
        return () => mapInstance.un('pointermove', handlePointerMove);
    }, [mapInstance]);

    // Fullscreen functionality
    const toggleFullscreen = () => {
        if (!mapContainerRef.current) return;

        if (!document.fullscreenElement) {
            mapContainerRef.current.parentElement?.requestFullscreen();
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    };

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    // Load basin_boundary layer
    useEffect(() => {
        if (!mapInstance || basinLoadedRef.current) return;
        basinLoadedRef.current = true;

        try {
            const wfsUrl = `${GEOSERVER_WFS_URL}?service=WFS&version=1.1.0&request=GetFeature&typename=${WORKSPACE}:${BASIN_BOUNDARY_LAYER}&outputFormat=application/json&srsname=EPSG:3857`;

            const basinSource = new VectorSource({
                format: new GeoJSON(),
                url: wfsUrl,
            });

            const basinLayer = new VectorLayer({
                source: basinSource,
                zIndex: 1,
                visible: basinBoundaryVisible,
                style: () => createPolygonStyle(basinLayerStyle, false)
            });

            basinLayer.set('name', 'basin-boundary-layer');
            mapInstance.addLayer(basinLayer);
            basinLayerRef.current = basinLayer;

            basinSource.once('change', () => {
                if (basinSource.getState() === 'ready') {
                    const features = basinSource.getFeatures();
                    if (features.length > 0) {
                        const extent = basinSource.getExtent();
                        mapInstance.getView().fit(extent, {
                            padding: [50, 50, 50, 50],
                            maxZoom: 16,
                            duration: 1000
                        });
                        console.log('✓ Basin boundary layer loaded and zoomed');
                    }
                }
            });

            console.log('✓ Basin boundary layer added');
        } catch (err) {
            console.error('Basin boundary layer error:', err);
        }
    }, [mapInstance]);

    // Toggle basin boundary visibility
    useEffect(() => {
        if (basinLayerRef.current) {
            basinLayerRef.current.setVisible(basinBoundaryVisible);
        }
    }, [basinBoundaryVisible]);

    // Update basin boundary style
    const updateBasinLayerStyle = (newStyle: LayerStyle) => {
        setBasinLayerStyle(newStyle);
        if (basinLayerRef.current) {
            basinLayerRef.current.setStyle(() => createPolygonStyle(newStyle, false));
            basinLayerRef.current.changed();
            console.log('✓ Basin boundary style updated');
        }
    };

    // Initialize Drawing and Selection Layers
    useEffect(() => {
        if (!mapInstance) return;

        // Drawing Layer
        if (!drawingLayerRef.current) {
            const drawingSource = new VectorSource();
            const drawingLayer = new VectorLayer({
                source: drawingSource,
                style: DRAWING_STYLE,
                zIndex: 10,
            });
            drawingLayer.set('name', 'drawing-layer');
            mapInstance.addLayer(drawingLayer);
            drawingLayerRef.current = drawingLayer;
            console.log('✓ Drawing layer initialized');
        }

        // Selection Interaction
        if (!selectInteractionRef.current) {
            const select = new Select({
                condition: click,
                style: SELECTION_STYLE,
                layers: (layer) => {
                    const name = layer.get('name');
                    return name && (
                        name.startsWith('vector-layer-') ||
                        name === 'drawing-layer' ||
                        name === 'basin-boundary-layer'
                    );
                },
                hitTolerance: 25,
            });

            mapInstance.addInteraction(select);
            selectInteractionRef.current = select;

            select.on('select', (e) => {
                const selectedFeatures = e.target.getFeatures().getArray();

                if (selectedFeatures.length > 0) {
                    const feature = selectedFeatures[0];
                    const props = feature.getProperties();
                    delete props.geometry;

                    const layerOfFeature = mapInstance.getLayers().getArray().find(layer => {
                        if (layer instanceof VectorLayer) {
                            const source = layer.getSource();
                            return source?.getFeatures().includes(feature);
                        }
                        return false;
                    });

                    let layerName = 'Unknown Layer';
                    if (layerOfFeature?.get('name') === 'basin-boundary-layer') {
                        layerName = 'Basin Boundary';
                    } else if (layerOfFeature?.get('name')?.startsWith('vector-layer-')) {
                        const fid = layerOfFeature.get('fid');
                        const shapefile = selectedShapefiles.find(sf => sf.fid === fid);
                        layerName = shapefile?.shapefile_name || 'Vector Layer';
                    } else if (layerOfFeature?.get('name') === 'drawing-layer') {
                        layerName = 'Drawn Feature';
                    }

                    const coordinate = e.mapBrowserEvent.coordinate;
                    setFeatureInfo({
                        properties: props,
                        layerName,
                        feature: feature,
                        coordinate,
                    });
                    overlayRef.current?.setPosition(coordinate);
                } else {
                    setFeatureInfo(null);
                    overlayRef.current?.setPosition(undefined);
                }
            });
            console.log('✓ Select interaction added');
        }

        // Modify and Snap Interactions
        const drawingSource = drawingLayerRef.current?.getSource();
        if (drawingSource && !modifyInteractionRef.current) {
            const modify = new Modify({ source: drawingSource });
            mapInstance.addInteraction(modify);
            modifyInteractionRef.current = modify;

            const snap = new Snap({ source: drawingSource });
            mapInstance.addInteraction(snap);
            snapInteractionRef.current = snap;
        }

    }, [mapInstance, selectedShapefiles]);

    // Toggle drawing layer visibility
    useEffect(() => {
        if (drawingLayerRef.current) {
            drawingLayerRef.current.setVisible(drawingLayerVisible);
        }
    }, [drawingLayerVisible]);

    // Handle drawing type changes with measurements
    useEffect(() => {
        if (!mapInstance || !drawingLayerRef.current) return;

        if (selectInteractionRef.current) {
            selectInteractionRef.current.setActive(!drawingType);
        }

        if (drawInteractionRef.current) {
            mapInstance.removeInteraction(drawInteractionRef.current);
            drawInteractionRef.current = null;
        }

        if (!drawingType && measurementOverlayRef.current) {
            measurementOverlayRef.current.setPosition(undefined);
        }

        if (!drawingType) return;

        const source = drawingLayerRef.current.getSource();
        if (!source) return;

        const draw = new Draw({
            source: source,
            type: drawingType as any,
            style: DRAWING_STYLE,
        });

        mapInstance.addInteraction(draw);
        drawInteractionRef.current = draw;

        let measurementListener: any = null;

        draw.on('drawstart', (evt) => {
            const sketch = evt.feature;

            if (!measurementOverlayRef.current) return;

            const geom = sketch.getGeometry();
            if (!geom) return;

            measurementListener = geom.on('change', (evt: any) => {
                const geom = evt.target;
                let tooltipCoord: number[] | undefined;
                let measurementText = '';

                if (drawingType === 'Point') {
                    const coords = geom.getCoordinates();
                    tooltipCoord = coords;
                    measurementText = formatCoordinates(coords);
                } else if (drawingType === 'LineString') {
                    const length = getLength(geom);
                    tooltipCoord = geom.getLastCoordinate();
                    measurementText = formatLength(length);
                } else if (drawingType === 'Polygon') {
                    const area = getArea(geom);
                    tooltipCoord = geom.getInteriorPoint().getCoordinates();
                    measurementText = formatArea(area);
                } else if (drawingType === 'Circle') {
                    const radius = geom.getRadius();
                    tooltipCoord = geom.getCenter();
                    measurementText = formatRadius(radius);
                }

                if (measurementOverlayRef.current && tooltipCoord) {
                    const element = measurementOverlayRef.current.getElement();
                    if (element) {
                        element.innerHTML = measurementText;
                        measurementOverlayRef.current.setPosition(tooltipCoord);
                    }
                }
            });
        });

        draw.on('drawend', (e) => {
            if (measurementListener) {
                unByKey(measurementListener);
                measurementListener = null;
            }

            if (measurementOverlayRef.current) {
                measurementOverlayRef.current.setPosition(undefined);
            }

            const geom = e.feature.getGeometry();
            let properties: Record<string, any> = {
                isEditable: true,
                name: `New ${drawingType}`,
                description: `A user-added ${drawingType.toLowerCase()}.`
            };

            if (drawingType === 'Point' && geom) {
                const coords = (geom as any).getCoordinates();
                properties.coordinates = formatCoordinates(coords);
            } else if (drawingType === 'LineString' && geom) {
                const length = getLength(geom as LineString);
                properties.length = formatLength(length);
            } else if (drawingType === 'Polygon' && geom) {
                const area = getArea(geom as Polygon);
                properties.area = formatArea(area);
            } else if (drawingType === 'Circle' && geom) {
                const radius = (geom as any).getRadius();
                properties.radius = formatRadius(radius);
            }

            e.feature.setProperties(properties);
            setDrawingType(null);
        });

        console.log(`✓ Drawing ${drawingType} with measurements enabled`);

        return () => {
            if (drawInteractionRef.current) {
                mapInstance.removeInteraction(drawInteractionRef.current);
                drawInteractionRef.current = null;
            }
            if (measurementListener) {
                unByKey(measurementListener);
                measurementListener = null;
            }
            if (measurementOverlayRef.current) {
                measurementOverlayRef.current.setPosition(undefined);
            }
        };
    }, [drawingType, mapInstance]);

    // Clear all drawings
    const clearDrawings = () => {
        if (drawingLayerRef.current) {
            drawingLayerRef.current.getSource()?.clear();
            console.log('✓ All drawings cleared');
        }
    };

    const updateFeatureProperties = (feature: Feature, properties: Record<string, any>) => {
        feature.setProperties(properties);
        console.log('✓ Feature properties updated');
    };

    // Export GeoJSON
    const exportGeoJSON = () => {
        const format = new GeoJSON();
        const features: any[] = [];

        if (basinLayerRef.current && basinBoundaryVisible) {
            const basinSource = basinLayerRef.current.getSource();
            if (basinSource) {
                features.push(...basinSource.getFeatures());
            }
        }

        if (vectorLayersRef.current) {
            Object.values(vectorLayersRef.current).forEach((vectorLayer: any) => {
                if (vectorLayer) {
                    const source = vectorLayer.getSource();
                    if (source) {
                        features.push(...source.getFeatures());
                    }
                }
            });
        }

        if (drawingLayerRef.current && drawingLayerVisible) {
            const drawingSource = drawingLayerRef.current.getSource();
            if (drawingSource) {
                features.push(...drawingSource.getFeatures());
            }
        }

        if (features.length === 0) {
            alert('No features to export');
            return;
        }

        const geoJSON = format.writeFeaturesObject(features, {
            featureProjection: 'EPSG:3857',
            dataProjection: 'EPSG:4326'
        });

        const blob = new Blob([JSON.stringify(geoJSON, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `map_export_${new Date().getTime()}.geojson`;
        a.click();
        URL.revokeObjectURL(url);

        console.log('✓ GeoJSON exported');
    };

    const changeBaseMap = (key: string) => {
        if (!mapInstance || key === selectedBaseMap) return;
        if (baseLayerRef.current) {
            mapInstance.removeLayer(baseLayerRef.current);
        }
        const newLayer = new TileLayer({
            source: baseMaps[key].source(),
            zIndex: 0,
        });
        newLayer.set('name', 'basemap');
        baseLayerRef.current = newLayer;
        mapInstance.getLayers().insertAt(0, newLayer);
        setSelectedBaseMap(key);
        console.log(`✓ Basemap changed to: ${key}`);
    };

    const updateLayerStyle = (newStyle: LayerStyle, targetFid: number) => {
        setLayerStyles(prev => ({
            ...prev,
            [targetFid]: newStyle
        }));

        if (vectorLayersRef.current && vectorLayersRef.current[targetFid]) {
            const targetLayer = vectorLayersRef.current[targetFid];

            targetLayer.setStyle((feature: any) => {
                const geomType = feature.getGeometry()?.getType();
                if (geomType === 'Point' || geomType === 'MultiPoint') {
                    return createOLStyle(newStyle, hoveredFeatureRef.current === feature);
                } else if (geomType === 'Polygon' || geomType === 'MultiPolygon') {
                    return createPolygonStyle(newStyle, hoveredFeatureRef.current === feature);
                } else if (geomType === 'LineString' || geomType === 'MultiLineString') {
                    return createLineStyle(newStyle, hoveredFeatureRef.current === feature);
                }
                return createOLStyle(newStyle, false);
            });
            targetLayer.changed();

            console.log(`✓ Layer style updated for fid: ${targetFid}`);
        }
    };

    useEffect(() => {
        if (!mapInstance || !vectorLayersRef.current) return;

        const currentFids = new Set(selectedShapefiles.map(sf => sf.fid));
        const existingFids = new Set(Object.keys(vectorLayersRef.current).map(Number));

        existingFids.forEach(fid => {
            if (!currentFids.has(fid) && vectorLayersRef.current) {
                const layer = vectorLayersRef.current[fid];
                if (layer) {
                    mapInstance.removeLayer(layer);
                    delete vectorLayersRef.current[fid];
                    console.log(`✓ Removed layer for shapefile fid: ${fid}`);
                }
            }
        });

        selectedShapefiles.forEach(shapefile => {
            if (!existingFids.has(shapefile.fid) && vectorLayersRef.current) {
                try {
                    const layerName = shapefile.shapefile_path
                        .split('/')
                        .pop()
                        ?.replace('.shp', '') || shapefile.shapefile_name;

                    console.log(`🗺️ Loading WFS layer: ${WORKSPACE}:${layerName}`);

                    const wfsUrl = `${GEOSERVER_WFS_URL}?service=WFS&version=1.1.0&request=GetFeature&typename=${WORKSPACE}:${layerName}&outputFormat=application/json&srsname=EPSG:3857`;

                    const vectorSource = new VectorSource({
                        format: new GeoJSON(),
                        url: wfsUrl,
                    });

                    const shapefileColor = getColorForShapefile(shapefile.fid);

                    const vectorLayer = new VectorLayer({
                        source: vectorSource,
                        zIndex: 5,
                        style: (feature) => {
                            const currentStyle = layerStyles[shapefile.fid] || shapefileColor;
                            const geomType = feature.getGeometry()?.getType();
                            const isHovered = hoveredFeatureRef.current === feature;

                            if (geomType === 'Point' || geomType === 'MultiPoint') {
                                return createOLStyle(currentStyle, isHovered);
                            } else if (geomType === 'Polygon' || geomType === 'MultiPolygon') {
                                return createPolygonStyle(currentStyle, isHovered);
                            } else if (geomType === 'LineString' || geomType === 'MultiLineString') {
                                return createLineStyle(currentStyle, isHovered);
                            }
                            return createOLStyle(currentStyle, false);
                        }
                    });

                    vectorLayer.set('name', `vector-layer-${shapefile.fid}`);
                    vectorLayer.set('fid', shapefile.fid);
                    mapInstance.addLayer(vectorLayer);
                    if (vectorLayersRef.current) {
                        vectorLayersRef.current[shapefile.fid] = vectorLayer;
                    }

                    vectorSource.once('change', () => {
                        if (vectorSource.getState() === 'ready') {
                            const features = vectorSource.getFeatures();
                            if (features.length > 0) {
                                const geom = features[0].getGeometry();
                                const geomType = geom?.getType();
                                setGeometryType(geomType || null);
                                console.log(`✓ Geometry type detected for ${shapefile.shapefile_name}: ${geomType}`);

                                const allExtents: any[] = [];
                                if (vectorLayersRef.current) {
                                    Object.values(vectorLayersRef.current).forEach((layer: any) => {
                                        const source = layer.getSource();
                                        if (source && source.getFeatures().length > 0) {
                                            allExtents.push(source.getExtent());
                                        }
                                    });
                                }

                                if (allExtents.length > 0) {
                                    const combinedExtent = allExtents.reduce((acc, extent) => {
                                        if (!acc) return extent;
                                        return [
                                            Math.min(acc[0], extent[0]),
                                            Math.min(acc[1], extent[1]),
                                            Math.max(acc[2], extent[2]),
                                            Math.max(acc[3], extent[3])
                                        ];
                                    });

                                    mapInstance.getView().fit(combinedExtent, {
                                        padding: [50, 50, 50, 50],
                                        maxZoom: 16,
                                        duration: 1000
                                    });
                                }
                            }
                        }
                    });

                    console.log(`✓ Vector layer added for: ${shapefile.shapefile_name}`);
                    setError(null);
                } catch (err) {
                    console.error('Vector layer error:', err);
                    setError('Failed to load vector layer');
                }
            }
        });

        if (selectedShapefiles.length === 0) {
            setFeatureInfo(null);
            overlayRef.current?.setPosition(undefined);
            setGeometryType(null);
            hoveredFeatureRef.current = null;
            setHoveredFeature(null);
        }

    }, [mapInstance, selectedShapefiles, layerStyles]);

    // Handle cursor and hover effects (visual only, no tooltip)
    useEffect(() => {
        if (!mapInstance || !vectorLayersRef.current) return;

        const handlePointerMove = (evt: any) => {
            const pixel = mapInstance.getEventPixel(evt.originalEvent);
            const features = mapInstance.getFeaturesAtPixel(pixel, {
                layerFilter: (layer) => layer.get('name') !== 'basemap'
            });

            if (features && features.length > 0) {
                const feature = features[0];

                if (hoveredFeatureRef.current !== feature) {
                    hoveredFeatureRef.current = feature;
                    setHoveredFeature(feature);
                    mapInstance.getTargetElement().style.cursor = 'pointer';

                    if (vectorLayersRef.current) {
                        Object.values(vectorLayersRef.current).forEach((layer: any) => {
                            layer.changed();
                        });
                    }
                }
            } else {
                if (hoveredFeatureRef.current !== null) {
                    hoveredFeatureRef.current = null;
                    setHoveredFeature(null);
                    mapInstance.getTargetElement().style.cursor = '';

                    if (vectorLayersRef.current) {
                        Object.values(vectorLayersRef.current).forEach((layer: any) => {
                            layer.changed();
                        });
                    }
                }
            }
        };

        mapInstance.on('pointermove', handlePointerMove);
        return () => mapInstance.un('pointermove', handlePointerMove);
    }, [mapInstance, layerStyles, selectedShapefiles]);

    const applyFilterToWMS = (filters: Record<string, string[]>, targetFid?: number) => {
        if (!vectorLayersRef.current || Object.keys(vectorLayersRef.current).length === 0) {
            console.warn('⚠️ Cannot apply filter: no vector layers');
            return;
        }

        setCurrentFilters(filters);

        if (targetFid === undefined) {
            console.warn('⚠️ No target shapefile specified for filtering');
            return;
        }

        const targetLayer = vectorLayersRef.current[targetFid];

        if (!targetLayer) {
            console.warn(`⚠️ Layer with fid ${targetFid} not found`);
            return;
        }

        const vectorSource = targetLayer.getSource();
        if (!vectorSource) return;

        const allFeatures = vectorSource.getFeatures();

        if (Object.keys(filters).length === 0) {
            allFeatures.forEach((f: any) => f.setStyle(undefined));
        } else {
            allFeatures.forEach((feature: any) => {
                const props = feature.getProperties();
                let matches = true;

                for (const [key, values] of Object.entries(filters)) {
                    if (values && values.length > 0) {
                        const propValue = String(props[key]);
                        if (!values.includes(propValue)) {
                            matches = false;
                            break;
                        }
                    }
                }

                if (!matches) {
                    feature.setStyle(new Style({}));
                } else {
                    feature.setStyle(undefined);
                }
            });
        }

        targetLayer.changed();
        console.log(`✓ Client-side filter applied to layer with fid: ${targetFid}`);
    };

    const value = useMemo(
        () => ({
            mapInstance,
            selectedBaseMap,
            changeBaseMap,
            mapContainerRef,
            popupRef,
            featureInfo,
            setFeatureInfo,
            isLoading,
            error,
            showLabels,
            toggleLabels,
            filteredFeatures,
            setFilteredFeatures,
            applyFilterToWMS,
            baseMaps,
            layerStyles,
            updateLayerStyle,
            geometryType,
            hoveredFeature,
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
            clearDrawings,
            drawingLayerVisible,
            toggleDrawingLayer,
            updateFeatureProperties
        }),
        [
            mapInstance,
            selectedBaseMap,
            featureInfo,
            isLoading,
            error,
            showLabels,
            filteredFeatures,
            layerStyles,
            geometryType,
            hoveredFeature,
            basinBoundaryVisible,
            basinLayerStyle,
            mouseCoordinates,
            isFullscreen,
            drawingType,
            drawingLayerVisible,
        ]
    );

    return <MapContext.Provider value={value}>{children}</MapContext.Provider>;
};

export const useMap = (): MapContextType => {
    const ctx = useContext(MapContext);
    if (!ctx) throw new Error('useMap must be used within MapProvider');
    return ctx;
};
export { getColorForShapefile };