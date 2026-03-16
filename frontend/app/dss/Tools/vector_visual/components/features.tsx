'use client';

import React, { useEffect, useState } from 'react';

interface FeaturesProps {
  properties: Record<string, any> | null;
  onClose: () => void;
  onSave?: (updatedProperties: Record<string, any>) => void;
}

export default function Features({ properties, onClose, onSave }: FeaturesProps) {
  const [editableProps, setEditableProps] = useState<Record<string, any>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [isAddingField, setIsAddingField] = useState(false);
  const [newFieldKey, setNewFieldKey] = useState('');
  const [newFieldValue, setNewFieldValue] = useState('');

  useEffect(() => {
    if (properties) {
      setEditableProps(properties);
      setIsDirty(false);
    }
  }, [properties]);

  const handleChange = (key: string, value: string) => {
    setEditableProps((prev) => ({
      ...prev,
      [key]: value,
    }));
    setIsDirty(true);
  };

  const handleDeleteField = (key: string) => {
    setEditableProps((prev) => {
      const updated = { ...prev };
      delete updated[key];
      return updated;
    });
    setIsDirty(true);
  };

  const handleAddField = () => {
    if (!newFieldKey.trim()) {
      alert('Field name cannot be empty');
      return;
    }

    // Check if field already exists
    if (editableProps.hasOwnProperty(newFieldKey)) {
      alert('Field already exists');
      return;
    }

    setEditableProps((prev) => ({
      ...prev,
      [newFieldKey]: newFieldValue,
    }));
    
    setIsDirty(true);
    setIsAddingField(false);
    setNewFieldKey('');
    setNewFieldValue('');
  };

  const handleCancelAddField = () => {
    setIsAddingField(false);
    setNewFieldKey('');
    setNewFieldValue('');
  };

  const handleSave = () => {
    if (onSave) {
      onSave(editableProps);
    }
    setIsDirty(false);
  };

  const handleCancel = () => {
    setEditableProps(properties || {});
    setIsDirty(false);
    setIsAddingField(false);
    setNewFieldKey('');
    setNewFieldValue('');
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gradient-to-r from-blue-500 to-blue-600">
        <h5 className="font-semibold text-white m-0">Feature Information</h5>
        <button
          onClick={onClose}
          className="text-white hover:text-gray-200 transition-colors"
          aria-label="Close"
        >
          <i className="fas fa-times text-lg"></i>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {properties ? (
          <div className="space-y-3">
            {/* Existing Fields */}
            {Object.entries(editableProps).map(([key, value]) => (
              <div
                key={key}
                className="bg-gray-50 rounded-lg p-3 hover:bg-gray-100 transition-colors"
              >
                <div className="flex justify-between items-start mb-1">
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {key.replace(/_/g, ' ')}
                  </label>
                  <button
                    onClick={() => handleDeleteField(key)}
                    className="text-red-500 hover:text-red-700 text-xs"
                    title="Delete field"
                  >
                    <i className="fas fa-trash-alt"></i>
                  </button>
                </div>

                <input
                  type="text"
                  value={value ?? ''}
                  onChange={(e) => handleChange(key, e.target.value)}
                  className="w-full text-sm text-gray-800 font-medium bg-white border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            ))}

            {/* Add New Field Form */}
            {isAddingField && (
              <div className="bg-blue-50 rounded-lg p-3 border-2 border-blue-300">
                <label className="block text-xs font-medium text-blue-700 uppercase tracking-wide mb-1">
                  New Field
                </label>
                
                <input
                  type="text"
                  placeholder="Field name (e.g., population)"
                  value={newFieldKey}
                  onChange={(e) => setNewFieldKey(e.target.value)}
                  className="w-full text-sm text-gray-800 bg-white border border-blue-300 rounded px-2 py-1 mb-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  autoFocus
                />

                <input
                  type="text"
                  placeholder="Field value"
                  value={newFieldValue}
                  onChange={(e) => setNewFieldValue(e.target.value)}
                  className="w-full text-sm text-gray-800 bg-white border border-blue-300 rounded px-2 py-1 mb-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />

                <div className="flex gap-2">
                  <button
                    onClick={handleAddField}
                    className="flex-1 px-3 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-700"
                  >
                    <i className="fas fa-check mr-1"></i> Add
                  </button>
                  <button
                    onClick={handleCancelAddField}
                    className="flex-1 px-3 py-1 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-100"
                  >
                    <i className="fas fa-times mr-1"></i> Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Add Field Button */}
            {!isAddingField && (
              <button
                onClick={() => setIsAddingField(true)}
                className="w-full py-2 px-3 text-sm rounded-lg border-2 border-dashed border-gray-300 text-gray-600 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
              >
                <i className="fas fa-plus mr-2"></i>
                Add New Field
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <i className="fas fa-mouse-pointer text-5xl mb-4"></i>
            <p className="text-center text-sm">
              Click on a feature on the map to see its information here
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      {properties && (
        <div className="p-3 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
          <div className="text-xs text-gray-500">
            {Object.keys(editableProps).length}{' '}
            {Object.keys(editableProps).length === 1 ? 'property' : 'properties'}
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              disabled={!isDirty && !isAddingField}
              className="px-3 py-1 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              onClick={handleSave}
              disabled={!isDirty}
              className="px-3 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <i className="fas fa-save mr-1"></i>
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}