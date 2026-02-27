//  // frontend/app/dss/visualizations/vector/components/BufferTool.tsx
// Buffer tool component

import React from 'react';

interface BufferToolProps {
  visible: boolean;
  distance: number;
  onDistanceChange: (distance: number) => void;
  onCreateBuffer: () => void;
}

export default function BufferTool({
  visible,
  distance,
  onDistanceChange,
  onCreateBuffer,
}: BufferToolProps) {
  if (!visible) return null;

  return (
    <div className="absolute top-32 right-4 bg-white rounded-xl shadow-md p-4 w-64 pointer-events-auto">
      <h3 className="font-medium mb-2">Buffer Tool</h3>
      
      <div className="mb-3">
        <label className="block text-sm mb-1">Distance (m)</label>
        <input
          type="range"
          min="10"
          max="1000"
          step="10"
          value={distance}
          onChange={(e) => onDistanceChange(parseInt(e.target.value, 10))}
          className="w-full"
        />
        <div className="text-center text-sm font-medium text-blue-600">
          {distance}m
        </div>
      </div>
      
      <button
        onClick={onCreateBuffer}
        className="w-full bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 transition-colors"
      >
        Create Buffer
      </button>
    </div>
  );
}