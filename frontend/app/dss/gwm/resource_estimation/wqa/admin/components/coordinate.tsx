import React from 'react';

interface AddPointModalProps {
  isOpen: boolean;
  pendingPoint: {
    id: number;
    longitude: number;
    latitude: number;
    coordinate: [number, number];
    timestamp: string;
  } | null;
  pointName: string;
  pointDescription: string;
  onPointNameChange: (name: string) => void;
  onPointDescriptionChange: (description: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

const AddPointModal: React.FC<AddPointModalProps> = ({
  isOpen,
  pendingPoint,
  pointName,
  pointDescription,
  onPointNameChange,
  onPointDescriptionChange,
  onSave,
  onCancel,
}) => {
  if (!isOpen || !pendingPoint) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-800 flex items-center">
            <svg className="w-6 h-6 mr-2 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Add Point Details
          </h3>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          {/* Location Info */}
          <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
            <div className="text-xs font-semibold text-blue-800 mb-1">Location Coordinates</div>
            <div className="text-sm text-blue-700 font-mono">
              {pendingPoint.latitude.toFixed(6)}°N, {pendingPoint.longitude.toFixed(6)}°E
            </div>
          </div>

          {/* Point Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Point Name *
            </label>
            <input
              type="text"
              value={pointName}
              onChange={(e) => onPointNameChange(e.target.value)}
              placeholder={`Point ${pendingPoint.id}`}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              autoFocus
            />
          </div>

          {/* Point Description */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Description (Optional)
            </label>
            <textarea
              value={pointDescription}
              onChange={(e) => onPointDescriptionChange(e.target.value)}
              placeholder="Add any notes or description..."
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3 pt-2">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onSave}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center justify-center"
            >
              <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Save Point
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddPointModal;