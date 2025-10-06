"use client";

import React, { createContext, useContext, useState } from 'react';
import { useLocation } from './LocationContext';
import { useWell } from './WellContext'; // use WellContext for CSV

interface TableData { [key: string]: string | number; }

interface RechargeContextType {
  tableData: TableData[];
  isLoading: boolean;
  error: string | null;
  computeRecharge: () => Promise<void>;
  canComputeRecharge: () => boolean;
}

export const RechargeContext = createContext<RechargeContextType | undefined>(undefined);

interface RechargeProviderProps { children: React.ReactNode; }

export const RechargeProvider: React.FC<RechargeProviderProps> = ({ children }) => {
  const [tableData, setTableData] = useState<TableData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const { selectedSubDistricts } = useLocation();
  const { csvFilename } = useWell(); // get wells CSV filename saved by WellContext

  const canComputeRecharge = (): boolean => {
    return !!(csvFilename && selectedSubDistricts.length > 0);
  };

  const computeRecharge = async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (!csvFilename) {
        throw new Error('Wells CSV is required. Upload/confirm wells so the CSV is saved first.');
      }
      if (selectedSubDistricts.length === 0) {
        throw new Error('Sub-district selection is required. Please select areas first.');
      }

      const requestPayload = {
        csvFilename, // use wells CSV from WellContext
        selectedSubDistricts,
      };

      const response = await fetch('/django/gwa/recharge2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();

      // Updated to use village_wise_results from the API response
      if (result.village_wise_results && Array.isArray(result.village_wise_results)) {
        setTableData(result.village_wise_results);
      } else {
        throw new Error('Invalid response format from server');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      console.log('Error computing recharge:', errorMessage);
      setError(errorMessage);
      setTableData([]);
    } finally {
      setIsLoading(false);
    }
  };

  const value: RechargeContextType = {
    tableData,
    isLoading,
    error,
    computeRecharge,
    canComputeRecharge,
  };

  return (
    <RechargeContext.Provider value={value}>
      {children}
    </RechargeContext.Provider>
  );
};

export const useRecharge = (): RechargeContextType => {
  const context = useContext(RechargeContext);
  if (context === undefined) {
    throw new Error('useRecharge must be used within a RechargeProvider');
  }
  return context;
};
