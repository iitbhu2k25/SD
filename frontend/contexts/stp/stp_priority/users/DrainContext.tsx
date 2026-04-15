"use client";
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useMemo,
} from "react";
import {
  DRAIN_LAYER_NAMES,
  RiverSelectionsData,
  ClipRasters,
} from "@/interface/raster_context";
import { DataRow } from "@/interface/table";
import { api } from "@/services/api";
import {
  River,
  Stretch,
  Catchment,
  Drain,
  Layer_name,
} from "@/interface/raster_context";

interface RiverSystemContextType {
  rivers: River[];
  stretches: Stretch[];
  drains: Drain[];
  catchments: Catchment[];
  selectedRiver: number | null;
  setSelectedRiver: (riverCode: number | null) => void;
  selectedStretches: number[];
  selectedDrains: number[];
  selectedCatchments: number[];
  selectedStreachNames: number[];
  selectedDrainsNames: number[];
  selectedCatchmentsNames: string[];
  selectedRiverName: string;
  totalArea: number;
  totalCatchments: number;
  selectionsLocked: boolean;
  displayRaster: ClipRasters[];
  showCatchment: boolean;
  setShowCatchment: (value: boolean) => void;
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
  tableData: DataRow[];
  setTableData: (value: DataRow[]) => void;
  AnalysisCachement: boolean;
  setAnalysisCachement: (value: boolean) => void;
  setShowCatchmentLayer: (value: boolean) => void;
  showCatchmentLayer: boolean;
}

interface RiverSystemProviderProps {
  children: ReactNode;
}

const RiverSystemContext = createContext<RiverSystemContextType>({
  rivers: [],
  stretches: [],
  drains: [],
  catchments: [],
  selectedRiver: null,
  setSelectedRiver: () => {},
  selectedStretches: [],
  setSelectedStretches: () => {},
  selectedDrains: [],
  setSelectedDrains: () => {},
  selectedCatchments: [],
  selectedRiverName: "",
  selectedStreachNames: [],
  selectedDrainsNames: [],
  selectedCatchmentsNames: [],
  totalArea: 0,
  totalCatchments: 0,
  setShowCatchment: () => {},
  selectionsLocked: false,
  displayRaster: [],
  setDisplayRaster: () => {},
  isLoading: false,
  showCatchment: false,
  handleRiverChange: () => {},
  setSelectedCatchments: () => {},
  confirmSelections: () => null,
  resetSelections: () => {},
  showTable: false,
  setShowTable: () => {},
  tableData: [],
  setTableData: () => {},
  AnalysisCachement: false,
  setAnalysisCachement: () => {},
  setShowCatchmentLayer: () => {},
  showCatchmentLayer: true,
});

export const RiverSystemProvider: React.FC<RiverSystemProviderProps> = ({
  children,
}) => {
  // All data loaded once
  const [allRivers, setAllRivers] = useState<River[]>([]);
  const [allStretches, setAllStretches] = useState<Stretch[]>([]);
  const [allDrains, setAllDrains] = useState<Drain[]>([]);

  // Selected items
  const [selectedRiver, setSelectedRiver] = useState<number | null>(null);
  const [selectedStretches, setSelectedStretches] = useState<number[]>([]);
  const [selectedDrains, setSelectedDrains] = useState<number[]>([]);
  const [selectedCatchments, setSelectedCatchments] = useState<number[]>([]);

  // Catchments loaded on demand (as per requirement)
  const [catchments, setCatchments] = useState<Catchment[]>([]);
  const [showCatchment, setShowCatchment] = useState<boolean>(false);
  const [AnalysisCachement, setAnalysisCachement] = useState(false);
  const [showCatchmentLayer, setShowCatchmentLayer] = useState<boolean>(true);
  // Additional state
  const [selectionsLocked, setSelectionsLocked] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [displayRaster, setDisplayRaster] = useState<ClipRasters[]>([]);
  const [tableData, setTableData] = useState<DataRow[]>([]);
  const [showTable, setShowTable] = useState<boolean>(false);

  // ✅ Load ALL rivers, stretches, and drains once on mount
  useEffect(() => {
    const fetchAllData = async () => {
      setIsLoading(true);
      try {
        // Fetch all rivers
        const riversResponse = await api.get("/location/get_river");
        if (riversResponse.status === 201) {
          const riversData = riversResponse.message as River[];
          const riverData: River[] = riversData.map((river: any) => ({
            River_Name: river.River_Name,
            River_Code: river.River_Code,
          }));
          setAllRivers(riverData);
        }

        // Fetch all stretches
        const stretchesResponse = await api.get("/location/all_stretch");
        if (stretchesResponse.status === 201) {
          const stretchesData = stretchesResponse.message as Stretch[];
          const stretchData: Stretch[] = stretchesData.map((stretch: any) => ({
            id: stretch.Stretch_ID,
            Stretch_ID: stretch.Stretch_ID,
            river_code: stretch.river_Code,
          }));
          setAllStretches(stretchData);
        }

        const drainsResponse = await api.get("/location/all_drain");
        if (drainsResponse.status === 201) {
          const drainsData = drainsResponse.message as Drain[];
          const drainData: Drain[] = drainsData.map((drain: any) => ({
            id: drain.Drain_No,
            Drain_No: drain.Drain_No,
            stretch_id: drain.stretch_id,
            name: drain.name,
            latitude: drain.latitude,
            longitude: drain.longitude,
          }));
          setAllDrains(drainData);
        }
      } catch (error) {
        console.log("Error fetching river system data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllData();
  }, []);

  const stretches = useMemo(() => {
    console.log("Selected river:", selectedRiver);
    console.log("All stretches:", allStretches);
    return allStretches.filter((s) => s.river_code === selectedRiver);
  }, [allStretches, selectedRiver]);

  // ✅ Filter drains based on selected stretches (computed, not fetched)
  const drains = useMemo(() => {
    if (selectedStretches.length === 0) return [];
    return allDrains.filter((d) =>
      selectedStretches.includes(Number(d.stretch_id)),
    );
  }, [allDrains, selectedStretches]);

  // ✅ Computed names
  const selectedRiverName = useMemo(() => {
    return (
      allRivers.find((r) => r.River_Code === selectedRiver)?.River_Name || ""
    );
  }, [allRivers, selectedRiver]);

  const selectedStreachNames = useMemo(() => {
    return allStretches
      .filter((s) => selectedStretches.includes(s.id))
      .map((s) => s.id);
  }, [allStretches, selectedStretches]);

  const selectedDrainsNames = useMemo(() => {
    return allDrains
      .filter((d) => selectedDrains.includes(d.id))
      .map((d) => d.id);
  }, [allDrains, selectedDrains]);

  const selectedCatchmentsNames = useMemo(() => {
    return catchments
      .filter((c) => selectedCatchments.includes(c.id))
      .map((c) => c.village_name || "");
  }, [catchments, selectedCatchments]);

  // ✅ Calculate total area and count based on selected catchments
  const totalArea = useMemo(() => {
    if (selectedCatchments.length === 0) return 0;
    const selectedCatchmentObjects = catchments.filter((c) =>
      selectedCatchments.includes(Number(c.id)),
    );
    const totalAreaSum = selectedCatchmentObjects.reduce(
      (sum, catchment) => sum + (catchment.area || 0),
      0,
    );
    return totalAreaSum / 1000000;
  }, [selectedCatchments, catchments]);

  const totalCatchments = useMemo(() => {
    return selectedCatchments.length;
  }, [selectedCatchments]);

  // ✅ Handle river selection
  const handleRiverChange = (riverCode: number): void => {
    setSelectedRiver(riverCode);
    setSelectedStretches([]);
    setSelectedDrains([]);
    setSelectedCatchments([]);
    setCatchments([]);
    setSelectionsLocked(false);
    setShowCatchment(false);
  };

  // ✅ Wrapper for setSelectedStretches with auto-cleanup
  const handleSetSelectedStretches = (stretchIds: number[]): void => {
    setSelectedStretches(stretchIds);

    // Auto-cleanup: remove drains whose parent stretch is no longer selected
    setSelectedDrains((prev) => {
      if (stretchIds.length === 0) return [];

      return prev.filter((drainId) => {
        const drain = allDrains.find((d) => d.id === drainId);
        return drain && stretchIds.includes(Number(drain.stretch_id));
      });
    });

    // Reset catchments when stretches change
    setSelectedCatchments([]);
    setCatchments([]);
    setShowCatchment(false);
  };

  // ✅ Wrapper for setSelectedDrains with auto-cleanup
  const handleSetSelectedDrains = (drainIds: number[]): void => {
    setSelectedDrains(drainIds);

    // Reset catchments when drains change
    setSelectedCatchments([]);
    setCatchments([]);
    setShowCatchment(false);
  };

  // ✅ Load catchments when showCatchment is triggered (on demand)
  useEffect(() => {
    if (!showCatchment || selectedDrains.length === 0) {
      setCatchments([]);
      return;
    }

    const fetchCatchments = async () => {
      setIsLoading(true);
      try {
        const response = await api.post(
          "/stp_operation/get_priority_cachement",
          {
            body: {
              drain_nos: selectedDrains,
              all_data: true,
            },
          },
        );

        if (response.status === 201) {
          const data = (await response.message) as Layer_name;
          const layer_name = data.layer_name;
          DRAIN_LAYER_NAMES.CATCHMENT = layer_name;
          const new_data = data.catchments;
          const catchmentData: Catchment[] = new_data.map((catchment: any) => ({
            id: catchment.id,
            village_name: catchment.village_name,
            area: catchment.area,
          }));
          setCatchments(catchmentData);
          setSelectedCatchments(catchmentData.map((catchment) => catchment.id));
        }
      } catch (error) {
        console.log("Error fetching catchments:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCatchments();
  }, [showCatchment, selectedDrains]);

  // ✅ Fetch raster data when selections are locked
  useEffect(() => {
    const fetchDisplayRaster = async () => {
      if (selectionsLocked && selectedCatchments.length > 0) {
        setIsLoading(true);
        try {
          const response = await api.post(
            "/stp_operation/stp_priority_visual_display",
            {
              body: {
                clip: selectedCatchments,
                place: "Drain",
              },
            },
          );
          const data = (await response.message) as ClipRasters[];
          setDisplayRaster(data);
        } catch (error) {
          console.log("Error fetching display raster:", error);
        } finally {
          setIsLoading(false);
        }
      }
    };

    fetchDisplayRaster();
  }, [selectionsLocked, selectedCatchments]);

  // ✅ Confirm selections
  const confirmSelections = (): RiverSelectionsData | null => {
    if (selectedCatchments.length === 0) {
      return null;
    }

    const selectedRiverObject = allRivers.find(
      (r) => r.River_Code === selectedRiver,
    );
    const selectedStretchObjects = allStretches.filter((stretch) =>
      selectedStretches.includes(Number(stretch.id)),
    );
    const selectedDrainObjects = allDrains.filter((drain) =>
      selectedDrains.includes(Number(drain.id)),
    );
    const selectedCatchmentObjects = catchments.filter((catchment) =>
      selectedCatchments.includes(Number(catchment.id)),
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

  const resetSelections = (): void => {
    setSelectionsLocked(false);
    setDisplayRaster([]);
    setCatchments([]);
    setSelectedCatchments([]);
    setShowCatchment(false);
    setShowTable(false);
    setAnalysisCachement(false);
  };

  const contextValue: RiverSystemContextType = {
    rivers: allRivers,
    stretches,
    drains,
    catchments,
    selectedRiver,
    setSelectedRiver,
    selectedStretches,
    selectedDrains,
    selectedCatchments,
    selectedRiverName,
    selectedStreachNames,
    selectedDrainsNames,
    selectedCatchmentsNames,
    totalArea,
    totalCatchments,
    selectionsLocked,
    isLoading,
    displayRaster,
    setDisplayRaster,
    handleRiverChange,
    setSelectedStretches: handleSetSelectedStretches,
    setSelectedDrains: handleSetSelectedDrains,
    setSelectedCatchments,
    confirmSelections,
    resetSelections,
    showCatchment,
    setShowCatchment,
    showTable,
    setShowTable,
    tableData,
    setTableData,
    AnalysisCachement,
    setAnalysisCachement,
    setShowCatchmentLayer,
    showCatchmentLayer,
  };

  return (
    <RiverSystemContext.Provider value={contextValue}>
      {children}
    </RiverSystemContext.Provider>
  );
};

export const useRiverSystem = (): RiverSystemContextType => {
  const context = useContext(RiverSystemContext);
  if (context === undefined) {
    throw new Error("useRiverSystem must be used within a RiverSystemProvider");
  }
  return context;
};
