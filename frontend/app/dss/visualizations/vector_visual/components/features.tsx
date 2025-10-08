// app/vector/components/features.tsx
'use client';

import React from 'react';
type FeaturesProps = {
  properties: Record<string, string | number | boolean> | null;
  onClose: () => void;
};


export default function Features({ properties, onClose }: FeaturesProps) {
  // Format properties for display
  const renderProperties = () => {
    if (!properties) {
      return <div className="text-gray-500 italic">Select a feature to see details</div>;
    }

    
    
    return (
      <div className="mt-2.5">
        {Object.entries(properties).map(([key, value]) => (
          <p key={key} className="mb-2 p-2 border-b border-gray-100 text-sm">
            <strong className="text-blue-800 font-semibold">{key}:</strong> {value}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="w-[300px] bg-white h-full overflow-y-auto shadow-md border-l border-gray-200 flex flex-col flex-shrink-0">
      <div className="py-4 px-4 bg-gradient-to-r from-gray-800 to-blue-600 text-white flex justify-between items-center">
        <div className="flex items-center">
          <i className="fas fa-info-circle mr-2.5 text-lg"></i>
          <h5 className="text-base font-medium m-0">Feature Information</h5>
        </div>
        {/* <button 
          onClick={onClose}
          className="bg-transparent border-none text-white text-base cursor-pointer transition-transform duration-200 hover:scale-125"
        >
          <i className="fas fa-times"></i>
        </button> */}
      </div>
      <div id="feature-content" className="p-4 flex-1 overflow-y-auto">
        {renderProperties()}
      </div>
    </div>
  );
}