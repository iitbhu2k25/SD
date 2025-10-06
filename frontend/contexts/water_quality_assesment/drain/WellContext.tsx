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
  villages: any[];
  totalPopulation: number;
  wellsData?: WellData[];
  useNewWells?: boolean;
  newWellsMode?: 'existing_and_new' | 'only_new' | 'upload_csv';
  selectedYear?: string;
}

interface WellContextType {
  selectedYear: string | null;
  availableYears: string[];
  yearSelected: boolean;
  setSelectedYear: (year: string | null) => void;
  
  wellSelectionMode: 'existing_and_new' | 'upload_csv' | null;
  wellsData: WellData[];
  wellsLoading: boolean;
  wellsError: string | null;
  isWellTableSaved: boolean;
  isSavingWells: boolean;
  existingWellsModified: boolean;
  
  customColumns: string[];
  newColumnName: string;
  
  isDragging: boolean;
  csvUploading: boolean;
  csvUploadSuccess: boolean;
  csvUploadMessage: string;
  selectedFile: File | null;
  csvFilename: string | null;
  
  setWellsData: (data: WellData[]) => void;
  setSelectedFile: (file: File | null) => void;
  setCsvUploadSuccess: (success: boolean) => void;
  setCsvUploadMessage: (message: string) => void;
  
  handleWellsModeChange: (mode: 'existing_and_new' | 'upload_csv', _forceRemoveWells?: () => void) => void;
  handleCellChange: (rowIndex: number, column: string, value: string) => void;
  addNewRow: (wellData?: WellData, onSuccess?: (newCount: number) => void) => void;
  removeRow: (index: number) => void;
  addNewColumn: () => void;
  removeColumn: (columnName: string) => void;
  saveWellTable: () => void;
  exportToCSV: () => void;
  setNewColumnName: (name: string) => void;
  getDisplayColumns: () => string[];
  getColumnDisplayName: (column: string) => string;
  
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  handleDragLeave: () => void;
  handleDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  handleCSVUpload: () => Promise<void>;
  
  confirmWellSelections: (
    selectedVillageCodes: number[],
    villages: any[],
    totalPopulation: number
  ) => Promise<SelectionsData | null>;
  resetWellSelections: () => void;
  validateAndProcessCSV: (file: File) => Promise<{ success: boolean; message: string; data?: WellData[] }>;
  
  fetchWellsData: (selectedVillageCodes: number[], year: string) => Promise<void>;
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
  saveWellTable: () => {},
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

export const WellProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [selectedYear, setSelectedYearState] = useState<string | null>(null);
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [yearSelected, setYearSelected] = useState<boolean>(false);
  
  const [wellSelectionMode, setWellSelectionMode] = useState<'existing_and_new' | 'upload_csv' | null>(null);
  const [wellsData, setWellsDataState] = useState<WellData[]>([]);
  const [wellsLoading, setWellsLoading] = useState(false);
  const [wellsError, setWellsError] = useState<string | null>(null);
  const [isWellTableSaved, setIsWellTableSaved] = useState(false);
  const [isSavingWells, setIsSavingWells] = useState(false);
  
  const [existingWellsModified, setExistingWellsModified] = useState(false);
  const [initialWellsCount, setInitialWellsCount] = useState(0);
  
  const [customColumns, setCustomColumns] = useState<string[]>([]);
  const [newColumnName, setNewColumnName] = useState('');
  
  const [isDragging, setIsDragging] = useState(false);
  const [csvUploading, setCsvUploading] = useState(false);
  const [csvUploadSuccess, setCsvUploadSuccess] = useState(false);
  const [csvUploadMessage, setCsvUploadMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [csvFilename, setCsvFilename] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchAvailableYears = async () => {
      try {
        console.log("[DRAIN] Fetching available years");
        const response = await fetch('/django/wqa/available-years');
        
        if (!response.ok) {
          throw new Error(`Failed to fetch years: ${response.status}`);
        }
        
        const data = await response.json();
        console.log("[DRAIN] Available years:", data);
        
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
       console.log('[DRAIN] Error fetching years:', error);
        
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

  const setSelectedYear = (year: string | null) => {
    console.log("=== Year Selection (Drain) ===");
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
      setWellsDataState([]);
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

  // Helper function for display names
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

  const setWellsData = (data: WellData[]) => {
    console.log("[DRAIN] setWellsData:", data.length, "rows");
    setWellsDataState(data);
  };

  const fetchWellsData = async (selectedVillageCodes: number[], year: string) => {
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

    if (!selectedVillageCodes || selectedVillageCodes.length === 0) {
      setWellsError("No village codes provided");
      return;
    }

    setWellsLoading(true);
    setWellsError(null);
    try {
      console.log("[DRAIN] Fetching wells for year:", year);
      
      const response = await fetch('/django/wqa/wells-by-village', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          village_codes: selectedVillageCodes,
          year: year
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      console.log("[DRAIN] Wells received:", data.length);
      
      // Transform backend data to match standardized format
      const transformedData = data.map((well: any) => ({
        Location: well.LOCATION || well.Location || '',
        Latitude: well.LATITUDE || well.Latitude || '',
        Longitude: well.LONGITUDE || well.Longitude || '',
        ph_level: well.PH_LEVEL || well.ph_level || '',
        electrical_conductivity: well.ELECTRICAL_CONDUCTIVITY || well.electrical_conductivity || '',
        carbonate: well.CARBONATE || well.carbonate || '',
        bicarbonate: well.BICARBONATE || well.bicarbonate || '',
        chloride: well.CHLORIDE || well.chloride || '',
        fluoride: well.FLUORIDE || well.fluoride || '',
        sulfate: well.SULFATE || well.sulfate || '',
        nitrate: well.NITRATE || well.nitrate || '',
        Hardness: well.HARDNESS || well.Hardness || '',
        calcium: well.CALCIUM || well.calcium || '',
        magnesium: well.MAGNESIUM || well.magnesium || '',
        sodium: well.SODIUM || well.sodium || '',
        potassium: well.POTASSIUM || well.potassium || '',
        iron: well.IRON || well.iron || '',
        YEAR: well.YEAR || year
      }));
      
      setWellsDataState(transformedData);
      setInitialWellsCount(transformedData.length);
      setExistingWellsModified(false);
      
      if (transformedData.length === 0) {
        setWellsError(`No wells found for selected villages in year ${year}`);
      }
    } catch (error: any) {
     console.log('[DRAIN] Error fetching wells:', error);
      setWellsError(`Failed to fetch wells: ${error.message}`);
    } finally {
      setWellsLoading(false);
    }
  };

  const handleWellsModeChange = (mode: 'existing_and_new' | 'upload_csv', forceRemoveWells?: () => void) => {
    console.log("=== handleWellsModeChange (Drain) ===");
    console.log("Mode:", mode);
    
    if (!yearSelected) {
      alert("Please select a year first");
      return;
    }
    
    if (isWellTableSaved) {
      alert("Cannot change mode: wells already saved. Reset first.");
      return;
    }
    
    if (forceRemoveWells) {
      forceRemoveWells();
    }
      
    setWellSelectionMode(mode);
    setWellsDataState([]);
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
  };

  // ✅ STANDARDIZED: Using same format as admin
  const getDisplayColumns = () => {
    if (wellSelectionMode === 'upload_csv' && wellsData.length > 0) {
      const csvColumns = Object.keys(wellsData[0]);
      return [...csvColumns, ...customColumns];
    } else {
      return [
        'Location',           // Same as admin
        'Latitude',           // Same as admin
        'Longitude',          // Same as admin
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
    }
  };

  const handleCellChange = (rowIndex: number, column: string, value: string) => {
    if (!isWellTableSaved) {
      const updatedData = [...wellsData];
      const oldValue = updatedData[rowIndex][column];
      updatedData[rowIndex] = { ...updatedData[rowIndex], [column]: value };
      setWellsDataState(updatedData);

      if (wellSelectionMode === 'existing_and_new' && oldValue !== value) {
        console.log(`[DRAIN] Cell edited - marking modified`);
        setExistingWellsModified(true);
      }
    }
  };

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

      setWellsDataState(prevWells => {
        const updatedWells = [...prevWells, newRow];
        
        if (wellSelectionMode === 'existing_and_new') {
          console.log("[DRAIN] Row added - marking modified");
          setExistingWellsModified(true);
        }
        
        return updatedWells;
      });
    }
  };

  const removeRow = (index: number) => {
    if (!isWellTableSaved && wellsData.length > 1) {
      const updatedData = wellsData.filter((_, i) => i !== index);
      setWellsDataState(updatedData);
      
      if (wellSelectionMode === 'existing_and_new') {
        console.log("[DRAIN] Row removed - marking modified");
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
      setWellsDataState(updatedData);
      setNewColumnName('');
      
      if (wellSelectionMode === 'existing_and_new') {
        console.log("[DRAIN] Column added - marking modified");
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
      setWellsDataState(updatedData);
      
      if (wellSelectionMode === 'existing_and_new') {
        console.log("[DRAIN] Column removed - marking modified");
        setExistingWellsModified(true);
      }
    }
  };

  const saveWellTable = () => {
    if (wellsData.length === 0) return;

    setIsSavingWells(true);
    try {
      setIsWellTableSaved(true);
      console.log("[DRAIN] Table saved. Modified:", existingWellsModified);
    } catch (error) {
     console.log('[DRAIN] Error saving:', error);
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
    a.download = `drain_wells_${selectedYear || 'unknown'}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

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

  // ✅ CRITICAL FIX: Reset existingWellsModified on CSV upload
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
          setWellsDataState(dataWithYear);
          setIsWellTableSaved(false);
          
          // ✅ KEY FIX: Reset for CSV upload mode
          console.log("[DRAIN CSV] Resetting existingWellsModified to FALSE");
          setExistingWellsModified(false);
          setInitialWellsCount(dataWithYear.length);
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
      console.log("[DRAIN] Validating CSV...");
      
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
          message: validationResult.message || 'Invalid CSV format'
        };
      }

      const csvText = await file.text();
      const lines = csvText.split('\n').filter(line => line.trim() !== '');
      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
      
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

      console.log("[DRAIN] CSV parsed:", parsedData.length, "rows");

      return {
        success: true,
        message: `CSV validated! ${headers.length} columns, ${parsedData.length} rows. Year ${selectedYear} added.`,
        data: parsedData
      };
      
    } catch (error: any) {
     console.log("[DRAIN] CSV error:", error);
      return {
        success: false,
        message: `Failed to process CSV: ${error.message}`
      };
    }
  };

  const postCSVToBackend = async (csvData: string, filename: string): Promise<boolean> => {
    try {
      console.log("[DRAIN] Posting CSV...");
      
      const blob = new Blob([csvData], { type: 'text/csv' });
      const formData = new FormData();
      formData.append('csv_file', blob, filename);
      
      const response = await fetch("/django/wqa/upload-csv", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const result = await response.json();
      console.log("[DRAIN] CSV posted successfully");

      setCsvFilename(result.data.filename);
      
      return true;
    } catch (error: any) {
     console.log("[DRAIN] CSV post error:", error);
      return false;
    }
  };

  const confirmWellSelections = async (
    selectedVillageCodes: number[],
    villages: any[],
    totalPopulation: number
  ): Promise<SelectionsData | null> => {
    if (selectedVillageCodes.length === 0 || !selectedYear) {
      return null;
    }

    const currentYear = new Date().getFullYear();
    const yearInt = parseInt(selectedYear);
    if (yearInt < 2019 || yearInt > currentYear) {
      alert(`Invalid year. Select between 2019 and ${currentYear}.`);
      return null;
    }

    const selectedVillageObjects = villages.filter((v: any) =>
      selectedVillageCodes.includes(Number(v.village_code ?? v.code ?? v.id))
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
          (existingWellsModified ? 'drain_modified' : 'drain_existing') : 
          'drain_uploaded_csv';
        const filename = `${modePrefix}_${selectedYear}_${timestamp}.csv`;

        console.log(`[DRAIN] Posting ${modePrefix} - Modified: ${existingWellsModified}`);

        const success = await postCSVToBackend(csvContent, filename);
        if (!success) return null;

      } catch (error: any) {
       console.log("[DRAIN] Error:", error);
        return null;
      }
    }

    const newWellsMode: 'existing_and_new' | 'only_new' | 'upload_csv' | undefined = 
      wellSelectionMode === 'existing_and_new' ? 'existing_and_new' :
      wellSelectionMode === 'upload_csv' ? 'upload_csv' :
      undefined;
    
    return {
      villages: selectedVillageObjects,
      totalPopulation,
      wellsData,
      useNewWells: wellSelectionMode !== null,
      newWellsMode,
      selectedYear,
    };
  };

  const resetWellSelections = (): void => {
    console.log("[DRAIN] Resetting...");
    setSelectedYearState(null);
    setYearSelected(false);
    setWellSelectionMode(null);
    setWellsDataState([]);
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

  return (
    <WellContext.Provider value={{
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
      existingWellsModified,
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
    }}>
      {children}
    </WellContext.Provider>
  );
};

export const useWell = (): WellContextType => {
  const context = useContext(WellContext);
  if (!context) {
    throw new Error("useWell must be used within WellProvider");
  }
  return context;
};