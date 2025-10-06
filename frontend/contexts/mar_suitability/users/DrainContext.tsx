"use client";
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { LAYER_NAMES } from "./DrainMapContext";
import { DataRow } from "@/interface/table";

// Define types for the river system data
export interface River {
  River_Name: string;
  River_Code: number;
}

export interface Stretch {
  id: number;
  Stretch_ID: number;
  river_code: number;
  name?: string; // Optional name field
}

export interface Drain {
  id: number;
  Drain_No: number;
  stretch_id: number;
  name?: string; // Optional name field
}

export interface Catchment {
  id: number;
  village_name: string
  area: number
  name?: string;
}

// Interface for selections return data
export interface RiverSelectionsData {
  rivers: River[];
  stretches: Stretch[];
  drains: Drain[];
  catchments: Catchment[];
  totalArea: number;
}

interface ClipRasters {
  file_name: string;
  layer_name: string;
  workspace: string;
}

// Define the context type
interface RiverSystemContextType {
  rivers: River[];
  stretches: Stretch[];
  drains: Drain[];
  catchments: Catchment[];
  selectedRiver: number | null;
  selectedStretches: number[];
  selectedDrains: number[];
  selectedCatchments: number[];
  totalArea: number;
  totalCatchments: number;
  selectionsLocked: boolean;
  displayRaster: ClipRasters[];
  showCatchment: boolean
  setShowCatchment: (value: boolean) => void
  setDisplayRaster: (layer: ClipRasters[]) => void;
  isLoading: boolean;
  handleRiverChange: (riverCode: number) => void;
  setSelectedStretches: (stretchIds: number[]) => void;
  setSelectedDrains: (drainIds: number[]) => void;
  setSelectedCatchments: (catchmentIds: number[]) => void;
  confirmSelections: () => RiverSelectionsData | null;
  resetSelections: () => void;
  showTable: boolean;
  setShowTable: (value: boolean) => void;
  tableData:  DataRow[];
  setTableData: (value:  DataRow[]) => void;
}

// Props for the RiverSystemProvider component
interface RiverSystemProviderProps {
  children: ReactNode;
}

// Create the river system context with default values
const RiverSystemContext = createContext<RiverSystemContextType>({
  rivers: [],
  stretches: [],
  drains: [],
  catchments: [],
  selectedRiver: null,
  selectedStretches: [],
  selectedDrains: [],
  selectedCatchments: [],
  totalArea: 0,
  totalCatchments: 0,
  setShowCatchment: () => {},
  selectionsLocked: false,
  displayRaster: [],
  setDisplayRaster: () => {},
  isLoading: false,
  showCatchment: false,
  handleRiverChange: () => {},
  setSelectedStretches: () => {},
  setSelectedDrains: () => {},
  setSelectedCatchments: () => {},
  confirmSelections: () => null,
  resetSelections: () => {},
  showTable: false,
  setShowTable: () => {},
  tableData: [],
  setTableData: () => {},
});

// Create the provider component
export const RiverSystemProvider: React.FC<RiverSystemProviderProps> = ({
  children,
}) => {
  // State for river system data
  const [rivers, setRivers] = useState<River[]>([]);
  const [stretches, setStretches] = useState<Stretch[]>([]);
  const [drains, setDrains] = useState<Drain[]>([]);
  const [catchments, setCatchments] = useState<Catchment[]>([]);

  // State for selected items
  const [selectedRiver, setSelectedRiver] = useState<number | null>(null);
  const [selectedStretches, setSelectedStretches] = useState<number[]>([]);
  const [selectedDrains, setSelectedDrains] = useState<number[]>([]);
  const [selectedCatchments, setSelectedCatchments] = useState<number[]>([]);
  const [showCatchment, setShowCatchment] = useState<boolean>(false);

  // State for additional information
  const [totalArea, setTotalArea] = useState<number>(0);
  const [totalCatchments, setTotalCatchments] = useState<number>(0);
  const [selectionsLocked, setSelectionsLocked] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [displayRaster, setDisplayRaster] = useState<ClipRasters[]>([]);
  const [tableData, setTableData] = useState< DataRow[]>([]);
  const [showTable, setShowTable] = useState<boolean>(false);
  // Load rivers on component mount
  useEffect(() => {
    const fetchRivers = async () => {
      setIsLoading(true);
      try {
        const response = await fetch("/api/location/get_river");
       
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();
        const riverData: River[] = data.map((river: any) => ({
          River_Name: river.River_Name,
          River_Code: river.River_Code,
        }));

        setRivers(riverData);
      } catch (error) {
        console.log("Error fetching rivers:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRivers();
  }, []);

  // Load stretches when river is selected
  useEffect(() => {
    if (!selectedRiver) {
      setStretches([]);
      return;
    }

    const fetchStretches = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          "/api/location/get_stretch",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              river_code: selectedRiver,
              all_data: true,
            }),
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();
        const stretchData: Stretch[] = data.map((stretch: any) => ({
          id: stretch.Stretch_ID,
          Stretch_ID: stretch.Stretch_ID,
          river_code: stretch.river_code,
        }));

        setStretches(stretchData);
      } catch (error) {
        console.log("Error fetching stretches:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStretches();

    // Reset dependent selections
    setSelectedStretches([]);
    setSelectedDrains([]);
    setSelectedCatchments([]);
    setTotalArea(0);
    setTotalCatchments(0);
    setDisplayRaster([]);
    setShowTable(false);
  }, [selectedRiver]);

  // Load drains when stretches are selected
  useEffect(() => {
    if (selectedStretches.length === 0) {
      setDrains([]);
      return;
    }

    setIsLoading(true);

    const fetchDrains = async () => {
      try {
        const response = await fetch(
          "/api/location/get_suitability_drain",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              stretch_ids: selectedStretches,
              all_data: true,
            }),
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();
        const drainData: Drain[] = data.map((drain: any) => ({
          id: drain.Drain_No,
          Drain_No: drain.Drain_No,
          stretch_id: drain.stretch_id,
          name: drain.Name,
        }));

        setDrains(drainData);
      } catch (error) {
        console.log("Error fetching drains:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDrains();

    // Reset dependent selections
    setSelectedDrains([]);
    setSelectedCatchments([]);
    setTotalArea(0);
    setTotalCatchments(0);
  }, [selectedStretches]);

  // Load catchments when drains are selected
  useEffect(() => {
    if (selectedDrains.length === 0) {
      setCatchments([]);
      return;
    }

    setIsLoading(true);

    const fetchCatchments = async () => {
      try {
        const response = await fetch(
          "/api/location/get_suitability_cachement",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              drain_nos: selectedDrains,
              all_data: true,
            }),
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();
        const layer_name=data.layer_name
        LAYER_NAMES.CATCHMENT=layer_name
        const new_data=data.data
        const catchmentData: Catchment[] = new_data.map((catchment: any) => ({
          id: catchment.id,
          village_name: catchment.village_name,
          area: catchment.area,
        }));
        setCatchments(catchmentData);
        setSelectedCatchments(catchmentData.map((catchment) => catchment.id));
      } catch (error) {
        console.log("Error fetching catchments:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    if (showCatchment === true) {
      fetchCatchments();
    }

    // Reset dependent selections
    setSelectedCatchments([]);
    setTotalArea(0);
    setTotalCatchments(0);
  
  }, [showCatchment]);

  // Handle display raster when selections are locked
  useEffect(() => {
    const fetchDisplayRaster = async () => {
      if (selectionsLocked === true && selectedCatchments.length > 0) {
        setIsLoading(true);
        try {
          const response = await fetch(
            "/api/stp_operation/stp_suitability_visual_display",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ 
                clip: selectedCatchments,
                place:"Drain",
               }),
            }
          );

          const data = await response.json();
          setDisplayRaster(data);
        } catch (error) {
          console.log("Error fetching display raster:", error);
        }setIsLoading(false);
      }
    };

    fetchDisplayRaster();
  }, [selectionsLocked, selectedCatchments]);

  // Calculate total area and count based on selected catchments
  useEffect(() => {
    if (selectedCatchments.length > 0) {
      // Filter to get only selected catchments
      const selectedCatchmentObjects = catchments.filter((catchment) =>
        selectedCatchments.includes(Number(catchment.id))
      );

      // Calculate total area
      const totalAreaSum = selectedCatchmentObjects.reduce(
        (sum, catchment) => sum + (catchment.area || 0),
        0
      );

      setTotalArea(totalAreaSum/1000000);
      setTotalCatchments(selectedCatchmentObjects.length);
    } else {
      setTotalArea(0);
      setTotalCatchments(0);
    }
  }, [selectedCatchments, catchments]);



  // Handle river selection
  const handleRiverChange = (riverCode: number): void => {
    setSelectedRiver(riverCode);
    setSelectedStretches([]);
    setSelectedDrains([]);
    setSelectedCatchments([]);
    setSelectionsLocked(false);
  };

  // Lock selections and return selected data
  const confirmSelections = (): RiverSelectionsData | null => {
    if (selectedCatchments.length === 0) {
      return null;
    }

    const selectedRiverObject = rivers.find(
      (r) => r.River_Code === selectedRiver
    );
    const selectedStretchObjects = stretches.filter((stretch) =>
      selectedStretches.includes(Number(stretch.id))
    );
    const selectedDrainObjects = drains.filter((drain) =>
      selectedDrains.includes(Number(drain.id))
    );
    const selectedCatchmentObjects = catchments.filter((catchment) =>
      selectedCatchments.includes(Number(catchment.id))
    );

    setSelectionsLocked(true);

    return {
      rivers: selectedRiverObject ? [selectedRiverObject] : [],
      stretches: selectedStretchObjects,
      drains: selectedDrainObjects,
      catchments: selectedCatchmentObjects,
      totalArea,
    };
  };

  // Reset all selections
  const resetSelections = (): void => {
    setSelectedRiver(null);
    setSelectedStretches([]);
    setSelectedDrains([]);
    setSelectedCatchments([]);
    setTotalArea(0);
    setTotalCatchments(0);
    setSelectionsLocked(false);
    setDisplayRaster([]);
  };

  // Context value
  const contextValue: RiverSystemContextType = {
    rivers,
    stretches,
    drains,
    catchments,
    selectedRiver,
    selectedStretches,
    selectedDrains,
    selectedCatchments,
    totalArea,
    totalCatchments,
    selectionsLocked,
    isLoading,
    displayRaster,
    setDisplayRaster,
    handleRiverChange,
    setSelectedStretches,
    setSelectedDrains,
    setSelectedCatchments,
    confirmSelections,
    resetSelections,
    showCatchment,
    setShowCatchment,
    showTable,
    setShowTable,
    tableData,
    setTableData

  };

  return (
    <RiverSystemContext.Provider value={contextValue}>
      {children}
    </RiverSystemContext.Provider>
  );
};

// Custom hook to use the river system context
export const useRiverSystem = (): RiverSystemContextType => {
  const context = useContext(RiverSystemContext);
  if (context === undefined) {
    throw new Error("useRiverSystem must be used within a RiverSystemProvider");
  }
  return context;
};
