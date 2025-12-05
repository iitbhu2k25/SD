import React from 'react';

interface SimpleLegendProps {
  min: number;
  max: number;
  mean: number;
  parameter: string;
  isVisible: boolean;
  colors?: Array<{value: number, color: string, label: string}>;  // ADD THIS
}

const SimpleLegend: React.FC<SimpleLegendProps> = ({
  min,
  max,
  mean,
  parameter,
  isVisible,
  colors = []  // ADD THIS with default
}) => {
  if (!isVisible) return null;

  // Generate gradient string from colors array
  const generateGradient = () => {
    if (colors.length === 0) {
      // Fallback to default colors if no colors provided
      return 'linear-gradient(to right, #4169E1, #FFD700, #FF1493)';
    }
    
    // Create gradient stops from color_stops array
    const gradientStops = colors.map((stop, index) => {
      const position = (index / (colors.length - 1)) * 100;
      return `${stop.color} ${position}%`;
    }).join(', ');
    
    return `linear-gradient(to right, ${gradientStops})`;
  };

  // Get colors for value text (first, middle, last from colors array)
  const getValueColor = (position: 'min' | 'mean' | 'max') => {
    if (colors.length === 0) {
      // Fallback colors
      if (position === 'min') return '#4169E1';
      if (position === 'mean') return '#FFD700';
      return '#FF1493';
    }
    
    if (position === 'min') return colors[0]?.color || '#4169E1';
    if (position === 'max') return colors[colors.length - 1]?.color || '#FF1493';
    // For mean, use middle color
    const midIndex = Math.floor(colors.length / 2);
    return colors[midIndex]?.color || '#FFD700';
  };

  return (
    <div className="absolute bottom-10 right-20 bg-white rounded-lg shadow-xl border border-gray-200 p-4 z-10">
      {/* Header */}
      <div className="text-sm font-semibold mb-2 text-gray-800 border-b pb-1">
        {parameter} Values
      </div>
      
      {/* Color Bar - Dynamic gradient */}
      <div className="mb-2">
        <div 
          className="h-4 w-80 rounded border"
          style={{
            background: generateGradient()
          }}
        ></div>
      </div>
      
      {/* Labels */}
      <div className="flex justify-between text-xs text-gray-600 mb-1">
        <span>Low</span>
        <span>Med</span>
        <span>High</span>
      </div>
      
      {/* Values with dynamic colors */}
      <div className="flex justify-between text-xs font-medium">
        <span style={{ color: getValueColor('min') }}>{min.toFixed(2)}</span>
        <span style={{ color: getValueColor('mean') }}>{mean.toFixed(2)}</span>
        <span style={{ color: getValueColor('max') }}>{max.toFixed(2)}</span>
      </div>
    </div>
  );
};

export default SimpleLegend;
