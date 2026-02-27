import React from 'react';
import { X, Droplets, TrendingDown, Database, MapPin, Info } from 'lucide-react';

interface InfoModalProps {
  onClose: () => void;
}

const InfoModal: React.FC<InfoModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-cyan-600 p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
                <Info className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Global Watersheds</h2>
                <p className="text-blue-100 text-sm">Advanced Hydrological Analysis Platform</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* Introduction */}
          <section className="mb-6">
            <h3 className="text-xl font-bold text-slate-800 mb-3">Welcome</h3>
            <p className="text-slate-600 leading-relaxed">
              This platform provides advanced watershed analysis tools powered by MERIT-Hydro, 
              a high-resolution global hydrography dataset. Whether you're a researcher, 
              environmental consultant, or water resource manager, our tools help you understand 
              drainage patterns and water flow dynamics anywhere in the world.
            </p>
          </section>

          {/* Analysis Modes */}
          <section className="mb-6">
            <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center space-x-2">
              <span>Analysis Modes</span>
            </h3>
            
            <div className="space-y-4">
              {/* Upstream */}
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <div className="flex items-start space-x-3">
                  <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Droplets className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-slate-800 mb-2">Upstream Analysis</h4>
                    <p className="text-sm text-slate-600 mb-3">
                      Delineates the complete watershed (drainage basin) contributing flow to your 
                      selected point. This mode identifies all upstream areas and river networks that 
                      drain to the outlet point.
                    </p>
                    <div className="bg-white rounded-md p-3 border border-blue-200">
                      <h5 className="font-semibold text-sm text-slate-700 mb-2">How it works:</h5>
                      <ol className="text-sm text-slate-600 space-y-1 list-decimal list-inside">
                        <li>Click any point on the map or enter coordinates</li>
                        <li>The algorithm traces uphill from your point</li>
                        <li>All cells that flow to your point are identified</li>
                        <li>Watershed boundary and river network are displayed</li>
                        <li>Drainage area is calculated in square kilometers</li>
                      </ol>
                    </div>
                    <div className="mt-3 bg-blue-100 rounded-md p-2">
                      <p className="text-xs text-blue-800">
                        <strong>Use cases:</strong> Water supply planning, flood risk assessment, 
                        pollution source tracking, conservation area delineation
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Downstream */}
              <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                <div className="flex items-start space-x-3">
                  <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <TrendingDown className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-slate-800 mb-2">Downstream Analysis</h4>
                    <p className="text-sm text-slate-600 mb-3">
                      Traces the flow path from your selected point downstream to the outlet 
                      (ocean, lake, or basin endpoint). Shows the complete path water would 
                      take from your location.
                    </p>
                    <div className="bg-white rounded-md p-3 border border-green-200">
                      <h5 className="font-semibold text-sm text-slate-700 mb-2">How it works:</h5>
                      <ol className="text-sm text-slate-600 space-y-1 list-decimal list-inside">
                        <li>Click any point on the map or enter coordinates</li>
                        <li>The algorithm follows the steepest descent path</li>
                        <li>Each downstream cell is identified sequentially</li>
                        <li>The flow path is traced to the final outlet</li>
                        <li>Total flow length is calculated</li>
                      </ol>
                    </div>
                    <div className="mt-3 bg-green-100 rounded-md p-2">
                      <p className="text-xs text-green-800">
                        <strong>Use cases:</strong> Pollution transport modeling, downstream 
                        impact assessment, river connectivity analysis, navigation planning
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Features */}
          <section className="mb-6">
            <h3 className="text-xl font-bold text-slate-800 mb-4">Key Features</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <MapPin className="w-8 h-8 text-purple-600 mb-2" />
                <h4 className="font-semibold text-slate-800 mb-1">Coordinate Input</h4>
                <p className="text-sm text-slate-600">
                  Click the map, use your current location, or manually enter coordinates
                </p>
              </div>
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <Database className="w-8 h-8 text-orange-600 mb-2" />
                <h4 className="font-semibold text-slate-800 mb-1">Multiple Exports</h4>
                <p className="text-sm text-slate-600">
                  Export results as PNG, PDF, or GeoJSON for GIS software
                </p>
              </div>
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <svg className="w-8 h-8 text-blue-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>
                <h4 className="font-semibold text-slate-800 mb-1">Drawing Tools</h4>
                <p className="text-sm text-slate-600">
                  Add markers, lines, polygons, and annotations to your analysis
                </p>
              </div>
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <svg className="w-8 h-8 text-green-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                </svg>
                <h4 className="font-semibold text-slate-800 mb-1">Custom Layers</h4>
                <p className="text-sm text-slate-600">
                  Import and overlay your own GeoJSON data layers
                </p>
              </div>
            </div>
          </section>

          {/* Data Source */}
          <section className="mb-6">
            <h3 className="text-xl font-bold text-slate-800 mb-3">Data Source</h3>
            <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg p-4 border border-blue-200">
              <h4 className="font-semibold text-slate-800 mb-2">MERIT-Hydro</h4>
              <p className="text-sm text-slate-600 mb-2">
                Multi-Error-Removed Improved-Terrain (MERIT) Hydro is a high-resolution global 
                hydrography dataset developed from MERIT DEM. It provides:
              </p>
              <ul className="text-sm text-slate-600 space-y-1 list-disc list-inside">
                <li>~90m resolution globally</li>
                <li>Hydrologically conditioned elevation data</li>
                <li>River network topology and flow directions</li>
                <li>Upstream drainage areas</li>
                <li>Flow accumulation and stream orders</li>
              </ul>
            </div>
          </section>

          {/* Tips */}
          <section>
            <h3 className="text-xl font-bold text-slate-800 mb-3">Tips for Best Results</h3>
            <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
              <ul className="text-sm text-slate-700 space-y-2">
                <li className="flex items-start space-x-2">
                  <span className="text-yellow-600 font-bold">•</span>
                  <span>Click directly on stream channels for most accurate watershed delineation</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-yellow-600 font-bold">•</span>
                  <span>Points in oceans or flat terrain may not produce results</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-yellow-600 font-bold">•</span>
                  <span>Customize river colors and thickness in the settings for better visualization</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-yellow-600 font-bold">•</span>
                  <span>Use drawing tools to mark areas of interest before exporting</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-yellow-600 font-bold">•</span>
                  <span>Export GeoJSON for further analysis in QGIS, ArcGIS, or other GIS software</span>
                </li>
              </ul>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200">
          <button
            onClick={onClose}
            className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg hover:from-blue-700 hover:to-cyan-700 transition-all duration-200 font-semibold shadow-md hover:shadow-lg"
          >
            Get Started
          </button>
        </div>
      </div>
    </div>
  );
};

export default InfoModal;