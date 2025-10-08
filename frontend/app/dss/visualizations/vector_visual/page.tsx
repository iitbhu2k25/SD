// app/vector/page.tsx
'use client';

import React from 'react';

import Sidebar from './components/sidebar';
import Features from './components/features';
import { Metadata } from 'next';
import dynamic from 'next/dynamic';


const Map = dynamic(() => import("./components/map"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[48vh] border-4 border-gray-300  rounded-xl">
      <div className="text-gray-500">Loading map...</div>
    </div>
  )
});


export default function VectorPage() {
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [featureInfoVisible, setFeatureInfoVisible] = React.useState(true);
  const [currentLayer, setCurrentLayer] = React.useState<string | null>(null);
  const [activeFeature, setActiveFeature] = React.useState<string|null>(null);
  const [featureProperties, setFeatureProperties] = React.useState(null);
  const [compassVisible, setCompassVisible] = React.useState(true);
  const [gridVisible, setGridVisible] = React.useState<boolean>(true);
  
  const handleSidebarToggle = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  const handleFeatureClick = (feature:any, layer:string) => {
    setActiveFeature(layer);
    setFeatureProperties(feature.properties);
  };

  const handleFeatureInfoToggle = (visible:boolean) => {
    setFeatureInfoVisible(visible);
  };

  const handleCompassToggle = (visible:boolean) => {
    setCompassVisible(visible);
  };

  const handleGridToggle = (visible:boolean) => {
    setGridVisible(visible);
  };

  // Create a notification system
  const [notification, setNotification] = React.useState({
    show: false,
    title: '',
    message: '',
    type: 'success'
  });

  const showNotification = (title:string, message:string, type = 'success') => {
    setNotification({
      show: true,
      title,
      message,
      type
    });

    // Auto hide after 4 seconds
    setTimeout(() => {
      setNotification(prev => ({ ...prev, show: false }));
    }, 4000);
  };

  // Upload handler to be passed to sidebar
  const handleUploadShapefile = async (files: FileList) => {
    if (window.uploadShapefile) {
      return await window.uploadShapefile(files);
    }
    return null;
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-gradient-to-r from-slate-800 to-blue-600 text-white p-3 shadow-md z-10">
        <div className="container mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <i className="fas fa-globe-asia text-2xl mr-2"></i>
              <h3 className="text-xl font-semibold m-0">(DSS-WRM) IIT BHU Vector Data Viewer Tool</h3>
            </div>
            <div className="text-right">
              <span className="text-light">Advanced Geospatial Analysis Tool</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - Using flex-1 to take remaining height */}
      <div className="flex flex-1 relative overflow-hidden">
        {/* Sidebar with overflow-y-auto to make it scrollable */}
        <div className={`${sidebarCollapsed ? 'w-0' : 'w-74'} transition-all duration-300 h-full overflow-hidden flex-shrink-0`}>
          <div className="h-full overflow-y-auto">
            <Sidebar 
              collapsed={sidebarCollapsed}
              onToggle={handleSidebarToggle}
              onMapLayerChange={setCurrentLayer}
              onFeatureInfoToggle={handleFeatureInfoToggle}
              onCompassToggle={handleCompassToggle}
              onGridToggle={handleGridToggle}
              showNotification={showNotification}
              onUploadShapefile={handleUploadShapefile}
            />
          </div>
        </div>
        
        {/* Map and Features container */}
        <div className="flex-1 flex relative h-full">
          {/* Map takes the remaining width */}
          <div className="flex-1 h-full">
            <Map 
              sidebarCollapsed={sidebarCollapsed}
              onFeatureClick={handleFeatureClick}
              currentLayer={currentLayer}
              activeFeature={activeFeature}
              compassVisible={compassVisible}
              gridVisible={gridVisible}
              showNotification={showNotification}
            />
          </div>
          
          {/* Features panel with overflow-y-auto to make it scrollable */}
          {featureInfoVisible && (
            <div className="w-75 h-full overflow-y-auto flex-shrink-0 bg-white shadow-lg">
              <Features 
                properties={featureProperties}
                onClose={() => handleFeatureInfoToggle(false)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Notification */}
      {notification.show && (
        <div 
          className={`fixed bottom-5 right-5 bg-white border-l-4 p-4 rounded-lg shadow-lg z-50 min-w-[300px] transform transition-transform ${
            notification.show ? 'translate-y-0' : 'translate-y-20'
          } ${
            notification.type === 'success' ? 'border-green-500' : 
            notification.type === 'error' ? 'border-red-500' : 'border-blue-500'
          }`}
        >
          <div className="flex items-center mb-1">
            <i className={`fas fa-${
              notification.type === 'success' ? 'check-circle text-green-500' : 
              notification.type === 'error' ? 'exclamation-circle text-red-500' : 'info-circle text-blue-500'
            } mr-2 text-xl`}></i>
            <div className="font-semibold text-gray-800">{notification.title}</div>
          </div>
          <div className="text-gray-600 text-sm">{notification.message}</div>
        </div>
      )}
    </div>
  );
}