// app/vector/components/sidebar.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import '@fortawesome/fontawesome-free/css/all.min.css';
import UidModal from './analysis';

type SidebarProps = {
  collapsed: boolean;
  onToggle: () => void;
  onMapLayerChange: (layer: string) => void;
  onFeatureInfoToggle: (show: boolean) => void;
  onCompassToggle: (show: boolean) => void;
  onGridToggle: (show: boolean) => void;
  showNotification: (
    title: string,
    message: string,
    type: 'success' | 'error' | 'info'
  ) => void;
  onUploadShapefile: (files: FileList) => Promise<any>;
};

export default function Sidebar({
  collapsed,
  onToggle,
  onMapLayerChange,
  onFeatureInfoToggle,
  onCompassToggle,
  onGridToggle,
  showNotification,
  onUploadShapefile
}: SidebarProps) {
  // Subcategories mapping
  const subcategories = {
    administrative: ["district", "villages"],
    watershed: ["varuna", "basuhi", "morwa", "all"],
    rivers: ["varuna", "basuhi", "morwa"],
    drains: ["varuna", "basuhi", "morwa"],
    canals: ["all"],
    household: ["All", "Bhadohi", "Jaunpur", "Pratapgarh", "Prayajraj", "Varanasi"],
    roads: ["all"],
    railways: ["all"],
    industries: ["all"],
    stps: ["all"],
  };
  type Category = keyof typeof subcategories;
  
  // State for form fields
  const [category, setCategory] = useState<Category | ''>('');
  const [subcategory, setSubcategory] = useState('');
  const [lineColor, setLineColor] = useState('#000000');
  const [fillColor, setFillColor] = useState('#78b4db');
  const [opacity, setOpacity] = useState(0.8);
  const [weight, setWeight] = useState(2);
  const [showLabels, setShowLabels] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [showInfoPanel, setShowInfoPanel] = useState(true);
  const [showCompass, setShowCompass] = useState(true);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [progressText, setProgressText] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTimerRef = useRef<NodeJS.Timeout | null>(null);

  // State for Union modal
  const [unionModalOpen, setUnionModalOpen] = useState(false);

  // Dropdown state
  const [openDropdown, setOpenDropdown] = useState('');

  // Update subcategory dropdown when category changes
  useEffect(() => {
    setSubcategory('');
  }, [category]);

  // Update map options when they change
  useEffect(() => {
    if (onGridToggle) onGridToggle(showGrid);
  }, [showGrid, onGridToggle]);

  useEffect(() => {
    if (onFeatureInfoToggle) onFeatureInfoToggle(showInfoPanel);
  }, [showInfoPanel, onFeatureInfoToggle]);

  useEffect(() => {
    if (onCompassToggle) onCompassToggle(showCompass);
  }, [showCompass, onCompassToggle]);

  // Handle dropdown toggle
  const toggleDropdown = (id: any) => {
    setOpenDropdown(openDropdown === id ? '' : id);
  };

  // Function to handle style changes
  const handleStyleChange = () => {
    if (window.updateMapStyles) {
      window.updateMapStyles();
    }
  };

  // Load shapefile data
  const loadShapefile = async () => {
    if (!category || !subcategory) {
      showNotification('Error', 'Please select both category and subcategory', 'error');
      return;
    }

    try {
      showNotification('Loading', 'Fetching vector data...', 'info');

      // Call the loadGeoJSON function exposed by the map component
      if (window.loadGeoJSON) {
        const layer = await window.loadGeoJSON(category, subcategory);
        if (layer && onMapLayerChange) {
          onMapLayerChange(layer);
        }
      } else {
        showNotification('Error', 'Map interface not available', 'error');
      }
    } catch (error) {
      if (error instanceof Error) {
        showNotification('Error', `Failed to load data: ${error.message}`, 'error');
      } else {
        showNotification('Error', 'Failed to load data: Unknown error', 'error');
      }
    }
  };

  // Handle basemap change
  const selectBasemap = (basemap: string) => {
    // Call the changeBasemap function exposed by the map component
    if (window.changeBasemap) {
      window.changeBasemap(basemap);
    } else {
      showNotification('Error', 'Map interface not available', 'error');
    }
    toggleDropdown('');
  };

  // Handle analysis tool selection
  const selectAnalysisTool = (tool: string) => {
    showNotification('Analysis Tool', `${tool} analysis tool selected`, 'info');
    toggleDropdown('');
    
    // Open the Union modal when Union is selected
    if (tool === 'Union') {
      setUnionModalOpen(true);
    }
  };

  // Upload functions
  const startSimulatedProgress = () => {
    setUploadProgress(0);
    setProgressText('Upload 0% complete');
    if (uploadTimerRef.current) clearInterval(uploadTimerRef.current);
    let p = 0;
    uploadTimerRef.current = setInterval(() => {
      p = Math.min(95, p + Math.max(1, Math.round((95 - p) * 0.08)));
      setUploadProgress(p);
      setProgressText(`Upload ${p}% complete`);
      if (p >= 95) {
        if (uploadTimerRef.current) {
          clearInterval(uploadTimerRef.current);
          uploadTimerRef.current = null;
        }
      }
    }, 200);
  };

  const completeProgress = () => {
    if (uploadTimerRef.current) {
      clearInterval(uploadTimerRef.current);
      uploadTimerRef.current = null;
    }
    setUploadProgress(100);
    setProgressText('Upload 100% complete');
    setTimeout(() => {
      setUploadProgress(0);
      setProgressText('');
    }, 1200);
  };

  const failProgress = () => {
    if (uploadTimerRef.current) {
      clearInterval(uploadTimerRef.current);
      uploadTimerRef.current = null;
    }
    setProgressText('Upload failed');
    setTimeout(() => {
      setUploadProgress(0);
      setProgressText('');
    }, 1500);
  };

  const handleUpload = async () => {
    try {
      const files = fileInputRef.current?.files;
      if (!files || files.length === 0) {
        showNotification('Error', 'No file selected', 'error');
        return;
      }

      setUploading(true);
      startSimulatedProgress();
      showNotification('Uploading', 'Uploading shapefile...', 'info');

      const result = await onUploadShapefile(files);

      if (result) {
        showNotification('Success', 'Shapefile uploaded and plotted', 'success');
        completeProgress();
        if (fileInputRef.current) fileInputRef.current.value = '';
      } else {
        showNotification('Error', 'Upload failed', 'error');
        failProgress();
      }
    } catch (e: any) {
      showNotification('Error', e?.message || 'Upload failed', 'error');
      failProgress();
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <div
        className={`w-[300px] bg-white p-5 overflow-y-auto transition-all duration-300 z-10 border-r border-gray-200 shadow-md flex-shrink-0 ${
          collapsed ? 'w-0 p-0 overflow-hidden' : ''
        }`}
      >
        <div className="flex justify-between items-center mb-5 pb-2.5 border-b-2 border-blue-500">
          <h5 className="font-semibold text-gray-700">Control Panel</h5>
        </div>

        {/* Upload Shapefile Section */}
        <div className="bg-gray-50 rounded-lg p-4 mb-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
          <div className="text-base font-semibold mb-4 text-gray-700 flex items-center">
            <i className="fas fa-upload mr-2 text-emerald-600"></i> Upload Shapefile
          </div>

          <div className="space-y-2">
            <label
              htmlFor="shapefile-upload"
              className="flex flex-col items-center justify-center w-full p-4 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-emerald-500 hover:bg-emerald-50 transition"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-gray-400 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 16v-8m0 0L8 12m4-4l4 4M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1" />
              </svg>
              <span className="text-xs text-gray-600">Choose or drag & drop files</span>
              <input
                id="shapefile-upload"
                ref={fileInputRef}
                type="file"
                multiple
                accept=".zip,.shp,.dbf,.shx,.prj,.cpg"
                className="hidden"
              />
            </label>

            {uploading && (
              <div className="space-y-1">
                <div className="w-full h-2 bg-gray-200 rounded">
                  <div
                    className="h-2 bg-emerald-600 rounded transition-all"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <div className="text-xs text-gray-600">{progressText || `Upload ${uploadProgress}% complete`}</div>
              </div>
            )}

            <button
              disabled={uploading}
              onClick={handleUpload}
              className={`w-full px-3 py-2 rounded-md text-white text-sm font-medium transition ${
                uploading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
              title="Upload and plot"
            >
              {uploading ? 'Uploading…' : 'Upload & Plot'}
            </button>
            
            <p className="text-xs text-gray-500">
             {/* Accepts .zip or .shp + sidecars (.dbf, .shx, .prj). */}
              Accepts  .shp +.dbf, +.shx, +.prj
            </p>
          </div>
        </div>

        {/* Feature Selection */}
        <div className="bg-gray-50 rounded-lg p-4 mb-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
          <div className="text-base font-semibold mb-4 text-gray-700 flex items-center">
            <i className="fas fa-layer-group mr-2 text-blue-500"></i> Feature Selection
          </div>

          <div className="mb-3">
            <select
              id="categorySelect"
              className="w-full p-3 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm cursor-pointer transition-all duration-300 hover:border-blue-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 appearance-none bg-[url('data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2716%27 height=%2716%27 fill=%27%233498db%27 viewBox=%270 0 16 16%27%3E%3Cpath d=%27M7.247 11.14 2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z%27/%3E%3C/svg%3E')] bg-no-repeat bg-[center_right_12px] bg-[length:12px]"
              value={category || ""}
              onChange={(e) => setCategory(e.target.value as Category)}
            >
              <option value="" disabled>Select Category</option>
              <option value="administrative">Administrative</option>
              <option value="watershed">Watershed</option>
              <option value="rivers">Rivers</option>
              <option value="drains">Drains</option>
              <option value="canals">Canals</option>
              <option value="household">Household</option>
              <option value="roads">Roads</option>
              <option value="railways">Railways</option>
              <option value="industries">Industries</option>
              <option value="stps">STPs</option>
            </select>
          </div>

          <div className="mb-3">
            <select
              id="subcategorySelect"
              className="w-full p-3 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm cursor-pointer transition-all duration-300 hover:border-blue-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 appearance-none bg-[url('data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2716%27 height=%2716%27 fill=%27%233498db%27 viewBox=%270 0 16 16%27%3E%3Cpath d=%27M7.247 11.14 2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z%27/%3E%3C/svg%3E')] bg-no-repeat bg-[center_right_12px] bg-[length:12px]"
              value={subcategory}
              onChange={(e) => setSubcategory(e.target.value)}
              disabled={!category}
            >
              <option value="" disabled>Select Subcategory</option>
              {category && subcategories[category]?.map((sub) => (
                <option key={sub} value={sub}>{sub.charAt(0).toUpperCase() + sub.slice(1)}</option>
              ))}
            </select>
          </div>

          <button
            onClick={loadShapefile}
            disabled={!category || !subcategory}
            className={`w-full py-3 px-5 mt-4 rounded-lg border-none text-white font-medium flex justify-center items-center cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-1 relative ${
              !category || !subcategory
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-500 hover:bg-blue-600 after:content-[""] after:absolute after:top-0 after:left-0 after:w-full after:h-full after:rounded-lg after:bg-blue-500 after:z-[-1] after:opacity-50 after:animate-pulse'
            }`}
          >
            <i className="fas fa-map-marked-alt mr-2"></i> Plot Features
          </button>
        </div>

        {/* Map Options */}
        <div className="bg-gray-50 rounded-lg p-4 mb-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
          <div className="text-base font-semibold mb-4 text-gray-700 flex items-center">
            <i className="fas fa-map mr-2 text-blue-500"></i> Map Options
          </div>

          {/* Basemap Dropdown */}
          <div className="relative mb-3">
            <div
              className={`flex justify-between items-center p-3 bg-white rounded-lg border border-gray-300 cursor-pointer transition-all duration-300 hover:border-blue-500 ${
                openDropdown === 'basemap' ? 'border-blue-500 rounded-b-none bg-gray-50 shadow-sm' : ''
              }`}
              onClick={() => toggleDropdown('basemap')}
            >
              <div><i className="fas fa-map mr-2 text-blue-500"></i> Base Map</div>
              <i className={`fas fa-chevron-down transition-transform duration-300 ${openDropdown === 'basemap' ? 'rotate-180' : ''}`}></i>
            </div>

            <div className={`absolute left-0 right-0 bg-white border border-blue-500 border-t-0 rounded-b-lg shadow-md z-[1001] transition-all duration-300 ${
              openDropdown === 'basemap'
                ? 'max-h-[300px] opacity-100 translate-y-0'
                : 'max-h-0 opacity-0 -translate-y-2 overflow-hidden border-none'
            }`}>
              <div className="p-3 cursor-pointer flex items-center hover:bg-gray-50 transition-transform duration-200 hover:translate-x-1 border-b border-gray-100" onClick={() => selectBasemap('streets')}>
                <i className="fas fa-road mr-2.5 w-5 text-center text-blue-500"></i> Streets
              </div>
              <div className="p-3 cursor-pointer flex items-center hover:bg-gray-50 transition-transform duration-200 hover:translate-x-1 border-b border-gray-100" onClick={() => selectBasemap('satellite')}>
                <i className="fas fa-satellite mr-2.5 w-5 text-center text-blue-500"></i> Satellite
              </div>
              <div className="p-3 cursor-pointer flex items-center hover:bg-gray-50 transition-transform duration-200 hover:translate-x-1 border-b border-gray-100" onClick={() => selectBasemap('terrain')}>
                <i className="fas fa-mountain mr-2.5 w-5 text-center text-blue-500"></i> Terrain
              </div>
              <div className="p-3 cursor-pointer flex items-center hover:bg-gray-50 transition-transform duration-200 hover:translate-x-1 border-b border-gray-100" onClick={() => selectBasemap('traffic')}>
                <i className="fas fa-car mr-2.5 w-5 text-center text-blue-500"></i> Traffic
              </div>
              <div className="p-3 cursor-pointer flex items-center hover:bg-gray-50 transition-transform duration-200 hover:translate-x-1 border-b border-gray-100" onClick={() => selectBasemap('hybrid')}>
                <i className="fas fa-globe mr-2.5 w-5 text-center text-blue-500"></i> Hybrid
              </div>
              <div className="p-3 cursor-pointer flex items-center hover:bg-gray-50 transition-transform duration-200 hover:translate-x-1" onClick={() => selectBasemap('none')}>
                <i className="fas fa-ban mr-2.5 w-5 text-center text-blue-500"></i> No Basemap
              </div>
            </div>
          </div>

          {/* Analysis Tools Dropdown */}
          <div className="relative mb-3">
            <div
              className={`flex justify-between items-center p-3 bg-white rounded-lg border border-gray-300 cursor-pointer transition-all duration-300 hover:border-blue-500 ${
                openDropdown === 'analysis' ? 'border-blue-500 rounded-b-none bg-gray-50 shadow-sm' : ''
              }`}
              onClick={() => toggleDropdown('analysis')}
            >
              <div><i className="fas fa-chart-line mr-2 text-blue-500"></i> Analysis Tools</div>
              <i className={`fas fa-chevron-down transition-transform duration-300 ${openDropdown === 'analysis' ? 'rotate-180' : ''}`}></i>
            </div>

            <div className={`absolute left-0 right-0 bg-white border border-blue-500 border-t-0 rounded-b-lg shadow-md z-[1001] transition-all duration-300 ${
              openDropdown === 'analysis'
                ? 'max-h-[300px] opacity-100 translate-y-0'
                : 'max-h-0 opacity-0 -translate-y-2 overflow-hidden border-none'
            }`}>
              <div className="p-3 cursor-pointer flex items-center hover:bg-gray-50 transition-transform duration-200 hover:translate-x-1 border-b border-gray-100" onClick={() => selectAnalysisTool('Intersection')}>
                <i className="fas fa-object-group mr-2.5 w-5 text-center text-blue-500"></i> Intersection
              </div>
              <div className="p-3 cursor-pointer flex items-center hover:bg-gray-50 transition-transform duration-200 hover:translate-x-1 border-b border-gray-100" onClick={() => selectAnalysisTool('Dissolve')}>
                <i className="fas fa-object-ungroup mr-2.5 w-5 text-center text-blue-500"></i> Dissolve
              </div>
              <div className="p-3 cursor-pointer flex items-center hover:bg-gray-50 transition-transform duration-200 hover:translate-x-1 border-b border-gray-100" onClick={() => selectAnalysisTool('Statistics')}>
                <i className="fas fa-calculator mr-2.5 w-5 text-center text-blue-500"></i> Statistics
              </div>
              <div className="p-3 cursor-pointer flex items-center hover:bg-gray-50 transition-transform duration-200 hover:translate-x-1 border-b border-gray-100" onClick={() => selectAnalysisTool('Euclidean Distance')}>
                <i className="fas fa-calculator mr-2.5 w-5 text-center text-blue-500"></i> Euclidean Distance
              </div>
            </div>
          </div>
        </div>

        {/* Style Options */}
        <div className="bg-gray-50 rounded-lg p-4 mb-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
          <div className="text-base font-semibold mb-4 text-gray-700 flex items-center">
            <i className="fas fa-palette mr-2 text-blue-500"></i> Style Options
          </div>

          <div className="flex items-center gap-5 mb-4">
            <div className="flex items-center">
              <label htmlFor="lineColor" className="text-sm text-gray-700 mr-2">Line Color:</label>
              <input
                type="color"
                id="lineColor"
                value={lineColor}
                onChange={(e) => {
                  setLineColor(e.target.value);
                  handleStyleChange();
                }}
                className="h-8 w-8 p-0 border-0 rounded cursor-pointer bg-transparent"
              />
            </div>

            <div className="flex items-center">
              <label htmlFor="fillColor" className="text-sm text-gray-700 mr-2">Fill Color:</label>
              <input
                type="color"
                id="fillColor"
                value={fillColor}
                onChange={(e) => {
                  setFillColor(e.target.value);
                  handleStyleChange();
                }}
                className="h-8 w-8 p-0 border-0 rounded cursor-pointer bg-transparent"
              />
            </div>
          </div>

          <div className="mb-3">
            <label htmlFor="opacity" className="block text-sm text-gray-700 mb-1">
              Opacity: <span id="opacityValue">{opacity}</span>
            </label>
            <input
              type="range"
              id="opacity"
              min="0.1"
              max="1"
              step="0.1"
              value={opacity}
              onChange={(e) => {
                setOpacity(parseFloat(e.target.value));
                handleStyleChange();
              }}
              className="w-full h-1.5 bg-gray-200 rounded-md appearance-none cursor-pointer focus:outline-none"
            />
          </div>

          <div className="mb-3">
            <label htmlFor="weight" className="block text-sm text-gray-700 mb-1">
              Line Weight: <span id="weightValue">{weight}</span>
            </label>
            <input
              type="range"
              id="weight"
              min="1"
              max="10"
              step="1"
              value={weight}
              onChange={(e) => {
                setWeight(parseInt(e.target.value));
                handleStyleChange();
              }}
              className="w-full h-1.5 bg-gray-200 rounded-md appearance-none cursor-pointer focus:outline-none"
            />
          </div>

          <div className="flex items-center mb-2">
            <input
              className="mr-2 rounded text-blue-500 focus:ring-blue-500"
              type="checkbox"
              id="toggleLabels"
              checked={showLabels}
              onChange={(e) => setShowLabels(e.target.checked)}
            />
            <label className="text-sm text-gray-700" htmlFor="toggleLabels">Show Labels</label>
          </div>
        </div>

        {/* Display Settings */}
        <div className="bg-gray-50 rounded-lg p-4 mb-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
          <div className="text-base font-semibold mb-4 text-gray-700 flex items-center">
            <i className="fas fa-sliders-h mr-2 text-blue-500"></i> Display Settings
          </div>

          <div className="flex items-center mb-2">
            <input
              className="mr-2 rounded text-blue-500 focus:ring-blue-500"
              type="checkbox"
              id="info-toggle"
              checked={showInfoPanel}
              onChange={(e) => setShowInfoPanel(e.target.checked)}
            />
            <label className="text-sm text-gray-700" htmlFor="info-toggle">Show Info Panel</label>
          </div>

          <div className="flex items-center">
            <input
              className="mr-2 rounded text-blue-500 focus:ring-blue-500"
              type="checkbox"
              id="compass-toggle"
              checked={showCompass}
              onChange={(e) => setShowCompass(e.target.checked)}
            />
            <label className="text-sm text-gray-700" htmlFor="compass-toggle">Show Compass</label>
          </div>
        </div>
      </div>

      {/* Toggle Sidebar Button */}
      <button
        onClick={onToggle}
        className={`absolute z-[999] flex items-center justify-center w-10 h-10 rounded-full bg-white shadow-md border-none cursor-pointer transition-all duration-300 hover:bg-blue-500 hover:text-white hover:scale-110 ${
          collapsed
            ? 'left-5 top-5'
            : 'left-[300px] top-5'
        }`}
      >
        <i className={`fas ${collapsed ? 'fa-chevron-right' : 'fa-chevron-left'}`}></i>
      </button>

      {/* Union Modal */}
      <UidModal 
        isOpen={unionModalOpen} 
        onOpenChange={(isOpen: any) => setUnionModalOpen(isOpen)} 
      />
    </>
  );
}