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
  selectedYear?: string;
}

interface WellContextType {
  // Year selection state
  selectedYear: string | null;
  availableYears: string[];
  yearSelected: boolean;
  setSelectedYear: (year: string | null) => void;
  
  // Well selection state
  wellSelectionMode: 'existing_and_new' | 'upload_csv' | null;
  wellsData: WellData[];
  wellsLoading: boolean;
  wellsError: string | null;
  isWellTableSaved: boolean;
  isSavingWells: boolean;
  
  // NEW: Modification tracking
  existingWellsModified: boolean;
  
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
  
  // State setters for CSV change functionality
  setWellsData: (data: WellData[]) => void;
  setSelectedFile: (file: File | null) => void;
  setCsvUploadSuccess: (success: boolean) => void;
  setCsvUploadMessage: (message: string) => void;
  
  // Well functions
  handleWellsModeChange: (mode: 'existing_and_new' | 'upload_csv', _forceRemoveWells?: () => void) => void;
  handleCellChange: (rowIndex: number, column: string, value: string) => void;
  addNewRow: (wellData?: WellData, onSuccess?: (newCount: number) => void) => void;
  removeRow: (index: number) => void;
  addNewColumn: () => void;
  removeColumn: (columnName: string) => void;
  saveWellTable: () => boolean;
  exportToCSV: () => void;
  setNewColumnName: (name: string) => void;
  getDisplayColumns: () => string[];
  getColumnDisplayName: (column: string) => string;
  
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
  fetchWellsData: (selectedSubDistricts: number[], year: string) => Promise<void>;
}

interface WellProviderProps {
  children: ReactNode;
}

const WellContext = createContext<WellContextType>({
  selectedYear: null,
  availableYears: [],
  yearSelected: false,
  setSelectedYear: () => {},
  
  wellSelectionMode: null,
  wellsData: [],
  wellsLoading: false,
  wellsError: null,
  isWellTableSaved: false,
  isSavingWells: false,
  existingWellsModified: false,
  customColumns: [],
  newColumnName: '',
  isDragging: false,
  csvUploading: false,
  csvUploadSuccess: false,
  csvUploadMessage: '',
  selectedFile: null,
  csvFilename: null,
  
  setWellsData: () => {},
  setSelectedFile: () => {},
  setCsvUploadSuccess: () => {},
  setCsvUploadMessage: () => {},
  
  handleWellsModeChange: () => {},
  handleCellChange: () => {},
  addNewRow: () => {},
  removeRow: () => {},
  addNewColumn: () => {},
  removeColumn: () => {},
  saveWellTable: () => false,
  exportToCSV: () => {},
  setNewColumnName: () => {},
  getDisplayColumns: () => [],
  getColumnDisplayName: () => '',
  handleFileSelect: () => {},
  handleDragOver: () => {},
  handleDragLeave: () => {},
  handleDrop: () => {},
  handleCSVUpload: async () => {},
  confirmWellSelections: async () => null,
  resetWellSelections: () => {},
  validateAndProcessCSV: async () => ({ success: false, message: 'Not implemented' }),
  fetchWellsData: async () => {},
});

export const WellProvider: React.FC<WellProviderProps> = ({
  children,
}) => {
  // Year selection state
  const [selectedYear, setSelectedYearState] = useState<string | null>(null);
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [yearSelected, setYearSelected] = useState<boolean>(false);
  
  // Well selection state
  const [wellSelectionMode, setWellSelectionMode] = useState<'existing_and_new' | 'upload_csv' | null>(null);
  const [wellsData, setWellsData] = useState<WellData[]>([]);
  const [wellsLoading, setWellsLoading] = useState(false);
  const [wellsError, setWellsError] = useState<string | null>(null);
  const [isWellTableSaved, setIsWellTableSaved] = useState(false);
  const [isSavingWells, setIsSavingWells] = useState(false);
  
  // NEW: Modification tracking
  const [existingWellsModified, setExistingWellsModified] = useState(false);
  const [initialWellsCount, setInitialWellsCount] = useState(0);
  
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

  // Fetch available years from backend on mount
  useEffect(() => {
    const fetchAvailableYears = async () => {
      try {
        console.log("Fetching available years from backend");
        const response = await fetch('django/wqa/available-years');
        
        if (!response.ok) {
          throw new Error(`Failed to fetch years: ${response.status}`);
        }
        
        const data = await response.json();
        console.log("Available years received:", data);
        
        if (data.available_years && Array.isArray(data.available_years)) {
          setAvailableYears(data.available_years.map((y: number) => y.toString()));
        } else {
          const currentYear = new Date().getFullYear();
          const fallbackYears: string[] = [];
          for (let year = 2019; year <= currentYear; year++) {
            fallbackYears.push(year.toString());
          }
          fallbackYears.reverse();
          setAvailableYears(fallbackYears);
        }
      } catch (error) {
       console.log('Error fetching available years:', error);
        
        const currentYear = new Date().getFullYear();
        const fallbackYears: string[] = [];
        for (let year = 2019; year <= currentYear; year++) {
          fallbackYears.push(year.toString());
        }
        fallbackYears.reverse();
        setAvailableYears(fallbackYears);
      }
    };
    
    fetchAvailableYears();
  }, []);

  // Handle year selection
  const setSelectedYear = (year: string | null) => {
    console.log("=== Year Selection ===");
    console.log("Selected year:", year);
    
    if (year) {
      const currentYear = new Date().getFullYear();
      const yearInt = parseInt(year);
      if (yearInt < 2019 || yearInt > currentYear) {
       console.log(`Invalid year ${year}. Must be between 2019 and ${currentYear}`);
        alert(`Invalid year. Please select a year between 2019 and ${currentYear}.`);
        return;
      }
    }
    
    setSelectedYearState(year);
    setYearSelected(!!year);
    
    if (year !== selectedYear) {
      console.log("Year changed, resetting well selections");
      setWellSelectionMode(null);
      setWellsData([]);
      setWellsError(null);
      setIsWellTableSaved(false);
      setCsvUploadSuccess(false);
      setCsvUploadMessage('');
      setSelectedFile(null);
      setCustomColumns([]);
      setNewColumnName('');
      setExistingWellsModified(false);
      setInitialWellsCount(0);
    }
  };

  // Helper function to get display name for columns
  const getColumnDisplayName = (column: string): string => {
    const displayNames: Record<string, string> = {
      'Location': 'LOCATION',
      'Latitude': 'LATITUDE',
      'Longitude': 'LONGITUDE',
      'ph_level': 'PH LEVEL',
      'electrical_conductivity': 'ELECTRICAL CONDUCTIVITY',
      'carbonate': 'CARBONATE (CO₃²⁻)',
      'bicarbonate': 'BICARBONATE (HCO₃⁻)',
      'chloride': 'CHLORIDE (Cl⁻)',
      'fluoride': 'FLUORIDE (F⁻)',
      'sulfate': 'SULFATE (SO₄²⁻)',
      'nitrate': 'NITRATE (NO₃⁻)',
      'Hardness': 'HARDNESS',
      'calcium': 'CALCIUM (Ca²⁺)',
      'magnesium': 'MAGNESIUM (Mg²⁺)',
      'sodium': 'SODIUM (Na⁺)',
      'potassium': 'POTASSIUM (K⁺)',
      'iron': 'IRON (Fe)',
      'YEAR': 'YEAR'
    };
    
    return displayNames[column] || column.toUpperCase();
  };

  // Fetch wells data with year parameter
  const fetchWellsData = async (selectedSubDistricts: number[], year: string) => {
    if (!year) {
      setWellsError("Please select a year first");
      return;
    }

    const currentYear = new Date().getFullYear();
    const yearInt = parseInt(year);
    if (yearInt < 2019 || yearInt > currentYear) {
      setWellsError(`Year must be between 2019 and ${currentYear}`);
      return;
    }

    setWellsLoading(true);
    setWellsError(null);
    try {
      console.log("Fetching wells data for year:", year, "subdistricts:", selectedSubDistricts);
      
      const response = await fetch('/django/wqa/wells', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subdis_cod: selectedSubDistricts,
          year: year
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      console.log("Wells data received for year", year, ":", data.length, "wells");
      setWellsData(data);
      
      // Store initial count for modification detection
      setInitialWellsCount(data.length);
      setExistingWellsModified(false);
      
    } catch (error: any) {
     console.log('Error fetching wells data:', error);
      setWellsError(`Failed to fetch wells data: ${error.message}`);
    } finally {
      setWellsLoading(false);
    }
  };

  // handleWellsModeChange
  const handleWellsModeChange = (mode: 'existing_and_new' | 'upload_csv', forceRemoveWells?: () => void) => {
    console.log("=== handleWellsModeChange called ===");
    console.log("Attempting to change well mode to:", mode);
    console.log("Year selected:", yearSelected, "Selected year:", selectedYear);
    
    if (!yearSelected) {
      console.log("Cannot select any mode: No year selected");
      alert("Please select a year first before choosing well selection option.");
      return;
    }
    
    if (isWellTableSaved) {
      console.log("Cannot change mode: wells are already saved");
      alert("Cannot change well selection mode: wells are already saved. Please reset wells first.");
      return;
    }
    
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
    setExistingWellsModified(false);
    setInitialWellsCount(0);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    
    console.log("Mode change completed successfully");
  };

  // Get display columns
  const getDisplayColumns = () => {
    if (wellSelectionMode === 'upload_csv' && wellsData.length > 0) {
      const csvColumns = Object.keys(wellsData[0]);
      console.log("CSV mode - using uploaded columns:", csvColumns);
      return [...csvColumns, ...customColumns];
    } else {
      const predefinedColumns = [
        'Location',           
        'Latitude',           
        'Longitude',          
        'ph_level',
        'electrical_conductivity',
        'carbonate',
        'bicarbonate',
        'chloride',
        'fluoride',
        'sulfate',
        'nitrate',
        'Hardness',
        'calcium',
        'magnesium',
        'sodium',
        'potassium',
        'iron',
        'YEAR',
        ...customColumns
      ];
      
      console.log("Existing wells mode - using predefined columns:", predefinedColumns);
      return predefinedColumns;
    }
  };

  // UPDATED: handleCellChange - Track modifications
  const handleCellChange = (rowIndex: number, column: string, value: string) => {
    if (!isWellTableSaved) {
      const updatedData = [...wellsData];
      const oldValue = updatedData[rowIndex][column];
      updatedData[rowIndex] = { ...updatedData[rowIndex], [column]: value };
      setWellsData(updatedData);

      // Mark as modified if value changed and we're in existing_and_new mode
      if (wellSelectionMode === 'existing_and_new' && oldValue !== value) {
        console.log(`Cell edited in existing wells - marking as modified`);
        setExistingWellsModified(true);
      }

      if (column === 'Latitude' || column === 'Longitude') {
        console.log(`Coordinate updated for well ${rowIndex}: ${column} = ${value}`);
      }
    }
  };

  // UPDATED: addNewRow - Track modifications
  const addNewRow = (wellData?: WellData) => {
    if (!isWellTableSaved) {
      const columnsToUse = getDisplayColumns();

      const newRow: WellData = {};
      
      columnsToUse.forEach(column => {
        newRow[column] = '';
      });
      
      if (selectedYear) {
        newRow['YEAR'] = selectedYear;
      }
      
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
        
        // Mark as modified if we're in existing_and_new mode
        if (wellSelectionMode === 'existing_and_new') {
          console.log("New row added to existing wells - marking as modified");
          setExistingWellsModified(true);
        }
        
        return updatedWells;
      });
    }
  };

  // UPDATED: removeRow - Track modifications
  const removeRow = (index: number) => {
    if (!isWellTableSaved && wellsData.length > 1) {
      const updatedData = wellsData.filter((_, i) => i !== index);
      setWellsData(updatedData);
      
      // Mark as modified if we're in existing_and_new mode
      if (wellSelectionMode === 'existing_and_new') {
        console.log("Row removed from existing wells - marking as modified");
        setExistingWellsModified(true);
      }
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
      
      // Mark as modified if we're in existing_and_new mode
      if (wellSelectionMode === 'existing_and_new') {
        console.log("Column added to existing wells - marking as modified");
        setExistingWellsModified(true);
      }
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
      
      // Mark as modified if we're in existing_and_new mode
      if (wellSelectionMode === 'existing_and_new') {
        console.log("Column removed from existing wells - marking as modified");
        setExistingWellsModified(true);
      }
    }
  };

  const saveWellTable = (): boolean => {
    if (wellsData.length === 0) {
      console.log("Cannot save: no wells data");
      return false;
    }

    setIsSavingWells(true);
    try {
      setIsWellTableSaved(true);
      console.log("Well table saved successfully");
      console.log("Modification status at save:", existingWellsModified);
      setIsSavingWells(false);
      return true;
    } catch (error) {
     console.log('Error saving well table:', error);
      setIsSavingWells(false);
      return false;
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
    a.download = `wells_data_${selectedYear || 'unknown'}.csv`;
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

    if (!selectedYear) {
      setCsvUploadMessage('Please select a year first');
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
          const dataWithYear = result.data.map(row => ({
            ...row,
            YEAR: selectedYear || 'Unknown'
          }));
          setWellsData(dataWithYear);
          setIsWellTableSaved(false);
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

  const validateAndProcessCSV = async (file: File): Promise<{ success: boolean; message: string; data?: WellData[] }> => {
    try {
      console.log("Validating CSV file...");
      
      const formData = new FormData();
      formData.append('csv_file', file);
      
      const validateResponse = await fetch("/django/wqa/validate-csv", {
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

      const csvText = await file.text();
      const lines = csvText.split('\n').filter(line => line.trim() !== '');
      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
      
      console.log("Original CSV headers:", headers);
      
      const parsedData: WellData[] = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        const row: WellData = {};
        
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        
        row['YEAR'] = selectedYear || 'Unknown';
        
        parsedData.push(row);
      }

      console.log("Parsed CSV data with original structure:", parsedData);
      console.log("CSV columns detected:", Object.keys(parsedData[0] || {}));

      return {
        success: true,
        message: `CSV validated successfully! Detected ${headers.length} columns and ${parsedData.length} rows. Year ${selectedYear} added to all records.`,
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

  const postCSVToBackend = async (csvData: string, filename: string): Promise<boolean> => {
    try {
      console.log("Posting CSV data to backend...");
      
      const blob = new Blob([csvData], { type: 'text/csv' });
      const formData = new FormData();
      formData.append('csv_file', blob, filename);
      
      const response = await fetch("/django/wqa/upload-csv", {
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

  const confirmWellSelections = async (
    selectedSubDistricts: number[],
    subDistricts: any[],
    totalPopulation: number
  ): Promise<SelectionsData | null> => {
    if (selectedSubDistricts.length === 0) {
      console.log("Cannot confirm: No sub-districts selected");
      return null;
    }

    if (!selectedYear) {
      console.log("Cannot confirm: No year selected");
      return null;
    }

    const currentYear = new Date().getFullYear();
    const yearInt = parseInt(selectedYear);
    if (yearInt < 2019 || yearInt > currentYear) {
      alert(`Invalid year. Please select a year between 2019 and ${currentYear}.`);
      return null;
    }

    const selectedSubDistrictObjects = subDistricts.filter((subDistrict) =>
      selectedSubDistricts.includes(Number(subDistrict.id))
    );

    if (wellsData && wellsData.length > 0) {
      try {
        const actualColumns = getDisplayColumns();
        
        const csvContent = [
          actualColumns.join(','),
          ...wellsData.map(row => 
            actualColumns.map(col => `"${row[col] || ''}"`).join(',')
          )
        ].join('\n');

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const modePrefix = wellSelectionMode === 'existing_and_new' ? 
          (existingWellsModified ? 'modified_existing_wells' : 'existing_wells') : 
          wellSelectionMode === 'upload_csv' ? 'uploaded_csv' : 'wells';
        const filename = `${modePrefix}_data_${selectedYear}_${timestamp}.csv`;

        console.log(`Posting ${modePrefix} CSV to backend - Modified: ${existingWellsModified}`);

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
      selectedYear,
      existingWellsModified
    });
    
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
      selectedYear,
    };
  };

  const resetWellSelections = (): void => {
    console.log("Resetting well selections");
    setSelectedYear(null);
    setYearSelected(false);
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
    setExistingWellsModified(false);
    setInitialWellsCount(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const contextValue: WellContextType = {
    selectedYear,
    availableYears,
    yearSelected,
    setSelectedYear,
    
    wellSelectionMode,
    wellsData,
    wellsLoading,
    wellsError,
    isWellTableSaved,
    isSavingWells,
    existingWellsModified, // NEW
    
    customColumns,
    newColumnName,
    
    isDragging,
    csvUploading,
    csvUploadSuccess,
    csvUploadMessage,
    selectedFile,
    csvFilename,
    
    setWellsData,
    setSelectedFile,
    setCsvUploadSuccess,
    setCsvUploadMessage,
    
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
    getColumnDisplayName,
    
    handleFileSelect,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleCSVUpload,
    
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