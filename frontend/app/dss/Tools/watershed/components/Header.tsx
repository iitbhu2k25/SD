import React from 'react';
import { Info, Layers, Settings, Download } from 'lucide-react';

interface HeaderProps {
  onInfoClick: () => void;
  onLayersClick: () => void;
  onSettingsClick: () => void;
  onExportClick: () => void;
}

const Header: React.FC<HeaderProps> = ({
  onInfoClick,
  onLayersClick,
  onSettingsClick,
  onExportClick,
}) => {
  return (
    <header className="bg-white border-b border-slate-200 shadow-sm">
      <div className="px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-lg flex items-center justify-center shadow-md">
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-700 to-cyan-600 bg-clip-text text-transparent">
                Global Watersheds
              </h1>
              <p className="text-sm text-slate-500 font-medium">
                Advanced Hydrological Analysis Platform
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={onInfoClick}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-all duration-200 shadow-sm hover:shadow group"
            title="Information"
          >
            <Info className="w-5 h-5 group-hover:scale-110 transition-transform" />
            <span className="text-sm font-medium">Info</span>
          </button>

          <button
            onClick={onLayersClick}
            className="flex items-center space-x-2 px-4 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-all duration-200 shadow-sm hover:shadow group"
            title="Layers"
          >
            <Layers className="w-5 h-5 group-hover:scale-110 transition-transform" />
            <span className="text-sm font-medium">Layers</span>
          </button>

          <button
            onClick={onSettingsClick}
            className="flex items-center space-x-2 px-4 py-2 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-all duration-200 shadow-sm hover:shadow group"
            title="Settings"
          >
            <Settings className="w-5 h-5 group-hover:scale-110 transition-transform" />
            <span className="text-sm font-medium">Customize</span>
          </button>

          <button
            onClick={onExportClick}
            className="flex items-center space-x-2 px-4 py-2 bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100 transition-all duration-200 shadow-sm hover:shadow group"
            title="Export"
          >
            <Download className="w-5 h-5 group-hover:scale-110 transition-transform" />
            <span className="text-sm font-medium">Export</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;