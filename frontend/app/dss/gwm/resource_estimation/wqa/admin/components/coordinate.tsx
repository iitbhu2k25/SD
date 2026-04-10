import React from "react";

interface PendingPoint {
  id: number;
  longitude: number;
  latitude: number;
  coordinate: [number, number];
}

export interface WQIInterface {
  Hardness: number;
  Latitude: number;
  Longitude: number;
  Location: string;
  Arsenic: number;
  Bicarbonate: number;
  Calcium: number;
  Carbonate: number;
  Chloride: number;
  Electrical_Conductivity: number;
  Fluoride: number;
  Iron: number;
  Magnesium: number;
  Nitrate: number;
  pH_Level: number;
  Potassium: number;
  Sodium: number;
  Sulfate: number;
  Uranium: number;
}

interface AddPointModalProps {
  isOpen: boolean;
  pendingPoint: PendingPoint | null;
  formData: WQIInterface;
  onFormChange: (updated: Partial<WQIInterface>) => void;
  onSave: () => void;
  onCancel: () => void;
}
const AddPointModal: React.FC<AddPointModalProps> = ({
  isOpen,
  pendingPoint,
  formData,
  onFormChange,
  onSave,
  onCancel,
}) => {
  if (!isOpen || !pendingPoint) return null;

  const handleNumber = (key: keyof WQIInterface, value: string) => {
    onFormChange({ [key]: Number(value) });
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-3 overflow-y-auto">
     <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-xl max-h-[40vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-800">Add WQI Data Point</h3>
          <button onClick={onCancel} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>

        {/* Coordinates (non-editable) */}
        <div className="bg-blue-50 rounded-lg p-3 border border-blue-200 mb-4">
          <div className="text-xs font-semibold text-blue-800 mb-1">Coordinates</div>
          <div className="text-sm text-blue-700 font-mono">
            {pendingPoint.latitude.toFixed(6)}°N, {pendingPoint.longitude.toFixed(6)}°E
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">

          {/* LOCATION (text field) */}
          <div className="col-span-2">
            <label className="block text-sm font-semibold text-gray-700 mb-1">Location *</label>
            <input
              type="text"
              value={formData.Location}
              onChange={(e) => onFormChange({ Location: e.target.value })}
              placeholder={`Point ${pendingPoint.id}`}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>

          {/* LAT & LONG (non editable? or editable?) */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Latitude</label>
            <input
              type="number"
              value={formData.Latitude}
              disabled
              className="w-full px-3 py-2 border rounded-lg bg-gray-100"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Longitude</label>
            <input
              type="number"
              value={formData.Longitude}
              disabled
              className="w-full px-3 py-2 border rounded-lg bg-gray-100"
            />
          </div>

          {/* ALL NUMERIC FIELDS */}
          {(
            Object.keys(formData) as (keyof WQIInterface)[]
          )
            .filter((key) => !["Location", "Latitude", "Longitude"].includes(key))
            .map((key) => (
              <div key={key}>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  {key.replace(/_/g, " ")}
                </label>
                <input
                  type="number"
                  step="any"
                  value={formData[key]}
                  onChange={(e) => handleNumber(key, e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
            ))}

        </div>

        {/* Buttons */}
        <div className="flex space-x-3 mt-6">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Save Point
          </button>
        </div>

      </div>
    </div>
  );
};

export default AddPointModal;
