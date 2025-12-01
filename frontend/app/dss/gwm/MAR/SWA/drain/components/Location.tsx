'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useLocationContext } from '@/contexts/surfacewater_assessment/drain/LocationContext';
import { useStreamFlowContext } from '@/contexts/surfacewater_assessment/drain/StreamFlowContext';
import { SubbasinMultiSelect } from './SubbasinMultiSelect';

export default function LocationPage() {
  const {
    subbasins,
    loading,
    error,
    selectedSubbasins,
    setSelectedSubbasins,
    toggleSubbasinByNumber,
    clearSelection,
    refresh,
    selectionConfirmed,
    confirmSelection,
  } = useLocationContext();

  const { clearData } = useStreamFlowContext();

  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (errorRef.current && error) errorRef.current.focus();
  }, [error]);

  const handleSelectionChange = (
    newSelectedSubbasins: import('@/contexts/surfacewater_assessment/drain/LocationContext').Subbasin[]
  ) => {
    if (selectionConfirmed) return; // lock after confirm
    setSelectedSubbasins(newSelectedSubbasins);
  };

  const handleClearSelection = () => {
    clearSelection();
    clearData(); // also clear stream flow data
  };

  const handleConfirmSelection = async () => {
    if (selectedSubbasins.length === 0) return;
    confirmSelection(); // lock only; do not fetch here
  };

  const handleRefresh = () => {
    clearSelection();
    clearData();
    refresh();
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-gray-900">Location Selection</h1>
        <p className="text-gray-600 text-sm">Choose subbasins and confirm to enable Flow Duration Curves.</p>
      </div>

      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {loading
          ? 'Loading subbasins'
          : error
            ? `Error: ${error}`
            : `${subbasins.length} subbasins available, ${selectedSubbasins.length} selected${selectionConfirmed ? ', selection confirmed' : ''}`}
      </div>

      {error && (
        <div
          ref={errorRef}
          tabIndex={-1}
          className="rounded-lg border border-red-200 bg-red-50 p-4"
          role="alert"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5 text-red-600" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="font-medium text-red-800">{error}</span>
            </div>
            <button
              onClick={handleRefresh}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {!loading && !error && (
        <div className="space-y-6">
          <div>
            <SubbasinMultiSelect
              subbasins={subbasins}
              selectedSubbasins={selectedSubbasins}
              onSelectionChange={handleSelectionChange}
              label="Subbasin"
              placeholder="Select subbasins..."
              displayPattern={(subbasin) => `Subbasin ${subbasin.sub}`}
              disabled={selectionConfirmed}
            />
          </div>

          {/* Selected chips only */}
          {/* Selected chips only – horizontally scrollable row */}
          <div className="min-h-[2.5rem]">
            {selectedSubbasins.length > 0 ? (
              <div
                className="
        relative
        overflow-x-auto overflow-y-hidden
        whitespace-nowrap
        scroll-smooth
        scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent
        ring-1 ring-gray-200 rounded-md bg-gray-50
        px-2 py-2
      "
                role="list"
                aria-label="Selected subbasins"
                aria-live="polite"
              >
                {selectedSubbasins
                  .sort((a, b) => a.sub - b.sub)
                  .map((subbasin, index) => (
                    <div
                      key={`subbasin-${subbasin.sub}-${index}`}
                      role="listitem"
                      className="
              inline-flex items-center gap-2
              mx-1 my-0.5
              rounded-full bg-white px-3 py-1.5
              text-sm ring-1 ring-gray-300
              align-middle
            "
                    >
                      <span className="font-medium text-gray-900">Subbasin {subbasin.sub}</span>
                      <button
                        type="button"
                        className="
                ml-0.5 flex h-4 w-4 items-center justify-center
                rounded-full text-gray-500
                hover:bg-gray-100 hover:text-red-600
                focus:outline-none focus:ring-2 focus:ring-blue-500
              "
                        onClick={() => toggleSubbasinByNumber(subbasin.sub)}
                        aria-label={`Remove subbasin ${subbasin.sub} from selection`}
                        title="Remove"
                        disabled={selectionConfirmed}
                      >
                        <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                        </svg>
                      </button>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-gray-500">
                <div className="h-2 w-2 rounded-full bg-gray-300" />
                <span>No subbasins selected</span>
              </div>
            )}
          </div>


          {/* Actions */}
          <div className="flex gap-3">
            {selectedSubbasins.length > 0 && !selectionConfirmed && (
              <button
                type="button"
                onClick={handleConfirmSelection}
                disabled={loading}
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Confirm selection
              </button>
            )}
            {selectedSubbasins.length > 0 && (
              <button
                type="button"
                onClick={handleClearSelection}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100"
                disabled={loading}
              >
                Reset
              </button>
            )}
            <button
              type="button"
              onClick={handleRefresh}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100"
            >
              Refresh
            </button>
          </div>

        </div>
      )}
    </div>
  );
}
