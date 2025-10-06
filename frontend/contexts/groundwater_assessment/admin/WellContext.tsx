"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  ReactNode,
} from "react";

export interface WellData {
  [key: string]: string | number;
}

export interface SelectionsData {
  subDistricts: any[];
  totalPopulation: number;
  wellsData?: WellData[];
  useNewWells?: boolean;
  newWellsMode?: 'existing_and_new' | 'only_new' | 'upload_csv';
}

interface WellContextType {
  // Well selection state
  wellSelectionMode: 'existing_and_new' | 'upload_csv' | null;
  wellsData: WellData[];
  wellsLoading: boolean;
  wellsError: string | null;
  isWellTableSaved: boolean;
  isSavingWells: boolean;
  
  // Table editing state
  customColumns: string[];
  newColumnName: string;
  
  // CSV Upload states
  isDragging: boolean;
  csvUploading: boolean;
  csvUploadSuccess: boolean;
  csvUploadMessage: string;
  selectedFile: File | null;
  csvFilename: string | null;
  
  // Well functions
  handleWellsModeChange: (mode: 'existing_and_new' | 'upload_csv', _forceRemoveWells?: () => void) => void;
  handleCellChange: (rowIndex: number, column: string, value: string) => void;
  addNewRow: (wellData?: WellData, onSuccess?: (newCount: number) => void) => void;
  removeRow: (index: number) => void;
  addNewColumn: () => void;
  removeColumn: (columnName: string) => void;
  saveWellTable: () => Promise<boolean>; // Updated to return Promise<boolean>
  exportToCSV: () => void;
  setNewColumnName: (name: string) => void;
  getDisplayColumns: () => string[];
  
  // CSV functions
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  handleDragLeave: () => void;
  handleDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  handleCSVUpload: () => Promise<void>;
  
  // Final actions
  confirmWellSelections: (
    selectedSubDistricts: number[],
    subDistricts: any[],
    totalPopulation: number
  ) => Promise<SelectionsData | null>;
  resetWellSelections: () => void;
  validateAndProcessCSV: (file: File) => Promise<{ success: boolean; message: string; data?: WellData[] }>;
  
  // Fetch wells data
  fetchWellsData: (selectedSubDistricts: number[]) => Promise<void>;
}

interface WellProviderProps {
  children: ReactNode;
}

const WellContext = createContext<WellContextType>({
  wellSelectionMode: null,
  wellsData: [],
  wellsLoading: false,
  wellsError: null,
  isWellTableSaved: false,
  isSavingWells: false,
  customColumns: [],
  newColumnName: '',
  isDragging: false,
  csvUploading: false,
  csvUploadSuccess: false,
  csvUploadMessage: '',
  selectedFile: null,
  handleWellsModeChange: () => {},
  handleCellChange: () => {},
  addNewRow: () => {},
  removeRow: () => {},
  addNewColumn: () => {},
  removeColumn: () => {},
  saveWellTable: async () => false, // Updated default
  exportToCSV: () => {},
  setNewColumnName: () => {},
  getDisplayColumns: () => [],
  handleFileSelect: () => {},
  handleDragOver: () => {},
  handleDragLeave: () => {},
  handleDrop: () => {},
  handleCSVUpload: async () => {},
  confirmWellSelections: async () => null,
  resetWellSelections: () => {},
  validateAndProcessCSV: async () => ({ success: false, message: 'Not implemented' }),
  fetchWellsData: async () => {},
  csvFilename: null
});

export const WellProvider: React.FC<WellProviderProps> = ({
  children,
}) => {
  // Well selection state
  const [wellSelectionMode, setWellSelectionMode] = useState<'existing_and_new' | 'upload_csv' | null>(null);
  const [wellsData, setWellsData] = useState<WellData[]>([]);
  const [wellsLoading, setWellsLoading] = useState(false);
  const [wellsError, setWellsError] = useState<string | null>(null);
  const [isWellTableSaved, setIsWellTableSaved] = useState(false);
  const [isSavingWells, setIsSavingWells] = useState(false);
  
  // Table editing state
  const [customColumns, setCustomColumns] = useState<string[]>([]);
  const [newColumnName, setNewColumnName] = useState('');
  
  // CSV Upload states
  const [isDragging, setIsDragging] = useState(false);
  const [csvUploading, setCsvUploading] = useState(false);
  const [csvUploadSuccess, setCsvUploadSuccess] = useState(false);
  const [csvUploadMessage, setCsvUploadMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [csvFilename, setCsvFilename] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchWellsData = async (selectedSubDistricts: number[]) => {
    setWellsLoading(true);
    setWellsError(null);
    try {
      const response = await fetch('/django/gwa/wells', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subdis_cod: selectedSubDistricts
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      setWellsData(data);
    } catch (error: any) {
      console.log('Error fetching wells data:', error);
      setWellsError(`Failed to fetch wells data: ${error.message}`);
    } finally {
      setWellsLoading(false);
    }
  };

  // Fixed handleWellsModeChange function
  const handleWellsModeChange = (mode: 'existing_and_new' | 'upload_csv', forceRemoveWells?: () => void) => {
    console.log("=== handleWellsModeChange called ===");
    console.log("Attempting to change well mode to:", mode);
    
    // Only prevent mode change if wells are already saved
    if (isWellTableSaved) {
      console.log("Cannot change mode: wells are already saved");
      alert("Cannot change well selection mode: wells are already saved. Please reset wells first.");
      return;
    }
    
    // Force remove wells from map when switching modes
    if (forceRemoveWells) {
      console.log("Force removing wells from map due to mode change");
      forceRemoveWells();
    }
      
    console.log("Changing well mode to:", mode);
    setWellSelectionMode(mode);
    setWellsData([]);
    setWellsError(null);
    setIsWellTableSaved(false);
    setCsvUploadSuccess(false);
    setCsvUploadMessage('');
    setSelectedFile(null);
    setCustomColumns([]);
    setNewColumnName('');

    // Clear file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    
    console.log("Mode change completed successfully");
  };

  // Mandatory columns to display
  // Updated getDisplayColumns function to handle CSV mode
  const getDisplayColumns = () => {
    if (wellSelectionMode === 'upload_csv' && wellsData.length > 0) {
      // For CSV mode, use the actual columns from the uploaded data
      const csvColumns = Object.keys(wellsData[0]);
      console.log("CSV mode - using uploaded columns:", csvColumns);
      return [...csvColumns, ...customColumns];
    } else {
      // For existing wells mode, use predefined columns
      const predefinedColumns = [
        'BLOCK',
        'HYDROGRAPH',
        'LATITUDE',
        'LONGITUDE',
        'RL',
        'PRE_2011', 'POST_2011',
        'PRE_2012', 'POST_2012',
        'PRE_2013', 'POST_2013',
        'PRE_2014', 'POST_2014',
        'PRE_2015', 'POST_2015',
        'PRE_2016', 'POST_2016',
        'PRE_2017', 'POST_2017',
        'PRE_2018', 'POST_2018',
        'PRE_2019', 'POST_2019',
        'PRE_2020', 'POST_2020',
        ...customColumns
      ];
      
      console.log("Existing wells mode - using predefined columns:", predefinedColumns);
      return predefinedColumns;
    }
  };

  const handleCellChange = (rowIndex: number, column: string, value: string) => {
    if (!isWellTableSaved) {
      const updatedData = [...wellsData];
      updatedData[rowIndex] = { ...updatedData[rowIndex], [column]: value };
      setWellsData(updatedData);

      // If latitude or longitude changed, trigger map update
      if (column === 'LATITUDE' || column === 'LONGITUDE') {
        console.log(`Coordinate updated for well ${rowIndex}: ${column} = ${value}`);
      }
    }
  };

  const addNewRow = (wellData?: WellData) => {
    if (!isWellTableSaved) {
      const columnsToUse = getDisplayColumns();

      // Always create a completely new row object
      const newRow: WellData = {};
      
      // Initialize all columns first
      columnsToUse.forEach(column => {
        newRow[column] = '';
      });
      
      // Then populate with provided data if any
      if (wellData) {
        Object.keys(wellData).forEach(key => {
          newRow[key] = wellData[key];
        });
      }

      console.log("Adding new row to wells data:", newRow);
      console.log("Current wells count:", wellsData.length);
      
      setWellsData(prevWells => {
        const updatedWells = [...prevWells, newRow];
        console.log("Updated wells count:", updatedWells.length);
        return updatedWells;
      });
    }
  };

  const removeRow = (index: number) => {
    if (!isWellTableSaved && wellsData.length > 1) {
      const updatedData = wellsData.filter((_, i) => i !== index);
      setWellsData(updatedData);
    }
  };

  const addNewColumn = () => {
    if (newColumnName.trim() && !customColumns.includes(newColumnName.trim()) && !isWellTableSaved) {
      const columnName = newColumnName.trim();
      setCustomColumns([...customColumns, columnName]);

      const updatedData = wellsData.map(row => ({
        ...row,
        [columnName]: ''
      }));
      setWellsData(updatedData);
      setNewColumnName('');
    }
  };

  const removeColumn = (columnName: string) => {
    if (customColumns.includes(columnName) && !isWellTableSaved) {
      setCustomColumns(customColumns.filter(col => col !== columnName));

      const updatedData = wellsData.map(row => {
        const { [columnName]: removed, ...rest } = row;
        return rest;
      });
      setWellsData(updatedData);
    }
  };

  // Updated saveWellTable to return Promise<boolean>
  const saveWellTable = async (): Promise<boolean> => {
    if (wellsData.length === 0) return false;

    setIsSavingWells(true);
    try {
      setIsWellTableSaved(true);
      console.log("Well table saved successfully");
      return true;
    } catch (error) {
      console.log('Error saving well table:', error);
      return false;
    } finally {
      setIsSavingWells(false);
    }
  };

  const exportToCSV = () => {
    if (wellsData.length === 0) return;

    const columns = getDisplayColumns();
    const csvContent = [
      columns.join(','),
      ...wellsData.map(row =>
        columns.map(col => `"${row[col] || ''}"`).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'wells_data.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // CSV Upload functions
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.name.endsWith('.csv')) {
        setSelectedFile(file);
        setCsvUploadMessage('');
        setCsvUploadSuccess(false);
      } else {
        setCsvUploadMessage('Please select a valid CSV file');
        setCsvUploadSuccess(false);
        setSelectedFile(null);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      if (file.name.endsWith('.csv')) {
        setSelectedFile(file);
        setCsvUploadMessage('');
        setCsvUploadSuccess(false);
      } else {
        setCsvUploadMessage('Please select a valid CSV file');
        setCsvUploadSuccess(false);
        setSelectedFile(null);
      }
    }
  };

  const handleCSVUpload = async () => {
    if (!selectedFile) {
      setCsvUploadMessage('Please select a CSV file first');
      setCsvUploadSuccess(false);
      return;
    }

    setCsvUploading(true);
    setCsvUploadMessage('');
    setCsvUploadSuccess(false);

    try {
      const result = await validateAndProcessCSV(selectedFile);

      if (result.success) {
        setCsvUploadSuccess(true);
        setCsvUploadMessage(result.message);
        if (result.data) {
          setWellsData(result.data);
          setIsWellTableSaved(true);
        }
      } else {
        setCsvUploadSuccess(false);
        setCsvUploadMessage(result.message);
      }
    } catch (error: any) {
      setCsvUploadSuccess(false);
      setCsvUploadMessage(`Failed to upload CSV: ${error.message}`);
    } finally {
      setCsvUploading(false);
    }
  };

  // Function to validate and upload CSV - FIXED VERSION
  const validateAndProcessCSV = async (file: File): Promise<{ success: boolean; message: string; data?: WellData[] }> => {
    try {
      console.log("Validating CSV file...");
      
      // Validate the CSV
      const formData = new FormData();
      formData.append('csv_file', file);
      
      const validateResponse = await fetch("/django/gwa/validate-csv", {
        method: "POST",
        body: formData,
      });

      if (!validateResponse.ok) {
        const errorText = await validateResponse.text();
        throw new Error(`Validation failed: ${errorText}`);
      }

      const validationResult = await validateResponse.json();
      
      if (!validationResult.valid) {
        return {
          success: false,
          message: validationResult.message || 'Please upload correct CSV format'
        };
      }

      console.log("CSV validation successful:", validationResult);

      // Parse CSV data EXACTLY as uploaded - preserve original structure
      const csvText = await file.text();
      const lines = csvText.split('\n').filter(line => line.trim() !== '');
      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
      
      console.log("Original CSV headers:", headers);
      
      const parsedData: WellData[] = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        const row: WellData = {};
        
        // Use ONLY the headers from the CSV file - don't add predefined columns
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        
        parsedData.push(row);
      }

      console.log("Parsed CSV data with original structure:", parsedData);
      console.log("CSV columns detected:", Object.keys(parsedData[0] || {}));

      return {
        success: true,
        message: `CSV validated successfully! Detected ${headers.length} columns and ${parsedData.length} rows.`,
        data: parsedData
      };
      
    } catch (error: any) {
      console.log("Error processing CSV:", error);
      return {
        success: false,
        message: `Failed to process CSV: ${error.message}`
      };
    }
  };

  // Function to post CSV data to backend with only required columns
  const postCSVToBackend = async (csvData: string, filename: string): Promise<boolean> => {
    try {
      console.log("Posting CSV data to backend...");
      
      // Create a Blob from the CSV string
      const blob = new Blob([csvData], { type: 'text/csv' });
      
      // Create FormData and append the file
      const formData = new FormData();
      formData.append('csv_file', blob, filename);
      
      // Send to the correct endpoint that expects file upload
      const response = await fetch("/django/gwa/upload-csv", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.log("Server response:", errorText);
        throw new Error(`HTTP error! Status: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log("CSV posted successfully:", result);

      setCsvFilename(result.data.filename);
      console.log("Stored csvFilename in WellContext:", result.data.filename);
      
      return true;
    } catch (error: any) {
      console.log("Error posting CSV to backend:", error);
      return false;
    }
  };

  // Lock selections and return selected data with proper type handling
  const confirmWellSelections = async (
    selectedSubDistricts: number[],
    subDistricts: any[],
    totalPopulation: number
  ): Promise<SelectionsData | null> => {
    if (selectedSubDistricts.length === 0) {
      console.log("Cannot confirm: No sub-districts selected");
      return null;
    }

    const selectedSubDistrictObjects = subDistricts.filter((subDistrict) =>
      selectedSubDistricts.includes(Number(subDistrict.id))
    );

    // If wells data is provided, post it to backend as CSV
    if (wellsData && wellsData.length > 0) {
      try {
        // Use the actual columns displayed in the table instead of predefined ones
        const actualColumns = getDisplayColumns();
        
        // Create CSV content with the actual table columns
        const csvContent = [
          actualColumns.join(','),
          ...wellsData.map(row => 
            actualColumns.map(col => `"${row[col] || ''}"`).join(',')
          )
        ].join('\n');

        // Create filename with timestamp and mode
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const modePrefix = wellSelectionMode === 'existing_and_new' ? 'existing_wells' : 
                          wellSelectionMode === 'upload_csv' ? 'uploaded_csv' : 'wells';
        const filename = `${modePrefix}_data_${timestamp}.csv`;

        // Post to backend
        const success = await postCSVToBackend(csvContent, filename);
        
        if (!success) {
          return null;
        }

        console.log(`${wellSelectionMode} wells data CSV posted to backend successfully`);
      } catch (error: any) {
        console.log("Error processing wells data:", error);
        return null;
      }
    }

    console.log("Confirming well selections:", {
      subDistricts: selectedSubDistrictObjects,
      totalPopulation,
      wellsData,
      useNewWells: wellSelectionMode !== null,
      newWellsMode: wellSelectionMode,
    });
    
    // Fixed type issue: ensure wellSelectionMode is properly typed
    const newWellsMode: 'existing_and_new' | 'only_new' | 'upload_csv' | undefined = 
      wellSelectionMode === 'existing_and_new' ? 'existing_and_new' :
      wellSelectionMode === 'upload_csv' ? 'upload_csv' :
      undefined;
    
    return {
      subDistricts: selectedSubDistrictObjects,
      totalPopulation,
      wellsData,
      useNewWells: wellSelectionMode !== null,
      newWellsMode,
    };
  };

  // Reset well selections
  const resetWellSelections = (): void => {
    console.log("Resetting well selections");
    setWellSelectionMode(null);
    setWellsData([]);
    setWellsError(null);
    setIsWellTableSaved(false);
    setCsvUploadSuccess(false);
    setCsvUploadMessage('');
    setSelectedFile(null);
    setCsvFilename(null);
    setCustomColumns([]);
    setNewColumnName('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const contextValue: WellContextType = {
    // Well selection state
    wellSelectionMode,
    wellsData,
    wellsLoading,
    wellsError,
    isWellTableSaved,
    isSavingWells,
    
    // Table editing state
    customColumns,
    newColumnName,
    
    // CSV Upload states
    isDragging,
    csvUploading,
    csvUploadSuccess,
    csvUploadMessage,
    selectedFile,
    csvFilename,
    
    // Well functions
    handleWellsModeChange,
    handleCellChange,
    addNewRow,
    removeRow,
    addNewColumn,
    removeColumn,
    saveWellTable,
    exportToCSV,
    setNewColumnName,
    getDisplayColumns,
    
    // CSV functions
    handleFileSelect,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleCSVUpload,
    
    // Final actions
    confirmWellSelections,
    resetWellSelections,
    validateAndProcessCSV,
    fetchWellsData,
  };

  return (
    <WellContext.Provider value={contextValue}>
      {children}
    </WellContext.Provider>
  );
};

export const useWell = (): WellContextType => {
  const context = useContext(WellContext);
  if (context === undefined) {
    throw new Error("useWell must be used within a WellProvider");
  }
  return context;
};
