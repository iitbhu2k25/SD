import React from 'react';

interface SimpleLegendProps {
  min: number;
  max: number;
  mean: number;
  parameter: string;
  isVisible: boolean;
  colors?: Array<{ value: number; color: string; label: string }>;
  className?: string;
  onClose?: () => void;
}

const SimpleLegend: React.FC<SimpleLegendProps> = ({
  min,
  max,
  mean,
  parameter,
  isVisible,
  colors = [],
  className = "absolute bottom-10 right-20 z-10 w-[380px] max-w-[calc(100vw-1rem)] rounded-xl border border-gray-200 bg-white/95 p-5 shadow-xl backdrop-blur-sm",
  onClose,
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
    <div className={className}>
      <div className="mb-3 flex items-center gap-3 border-b border-gray-200 pb-2">
        <div className="text-base font-semibold text-gray-800">
          {parameter} Values
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="ml-auto flex h-7 w-7 items-center justify-center rounded-full cursor-pointer text-lg leading-none text-gray-400 transition-colors hover:bg-red-100 hover:text-red-600"
            aria-label="Close legend"
          >
            ×
          </button>
        )}
      </div>

      <div className="mb-3">
        <div
          className="h-5 w-full rounded-md border"
          style={{
            background: generateGradient()
          }}
        ></div>
      </div>

      <div className="mb-2 flex justify-between text-sm text-gray-600">
        <span>Low</span>
        <span>Med</span>
        <span>High</span>
      </div>

      <div className="flex justify-between text-sm font-semibold">
        <span style={{ color: getValueColor('min') }}>{min.toFixed(2)}</span>
        <span style={{ color: getValueColor('mean') }}>{mean.toFixed(2)}</span>
        <span style={{ color: getValueColor('max') }}>{max.toFixed(2)}</span>
      </div>
    </div>
  );
};

export default SimpleLegend;
