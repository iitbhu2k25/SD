"use client";

import { useMemo } from "react";
import OpenLayersWorkspace, {
  type WorkspaceLayerConfig,
} from "../../shared/map/OpenLayersWorkspace";
import { useUserMapStore } from "../stores/userMapStore";
import { useUserRiverStore } from "../stores/userRiverStore";

export default function UserOpenLayersMap() {
  const displayRaster = useUserRiverStore((state) => state.displayRaster);
  const primaryLayer = useUserMapStore((state) => state.primaryLayer);
  const boundaryLayer = useUserMapStore((state) => state.boundaryLayer);
  const riverLayer = useUserMapStore((state) => state.riverLayer);
  const stretchLayer = useUserMapStore((state) => state.stretchLayer);
  const drainLayer = useUserMapStore((state) => state.drainLayer);
  const catchmentLayer = useUserMapStore((state) => state.catchmentLayer);
  const resultVectorLayer = useUserMapStore((state) => state.resultVectorLayer);
  const riverFilter = useUserMapStore((state) => state.riverFilter);
  const stretchFilter = useUserMapStore((state) => state.stretchFilter);
  const drainFilter = useUserMapStore((state) => state.drainFilter);
  const catchmentFilter = useUserMapStore((state) => state.catchmentFilter);
  const selectedRadioLayer = useUserMapStore((state) => state.selectedRadioLayer);
  const rasterLayerInfo = useUserMapStore((state) => state.rasterLayerInfo);
  const handleLayerSelection = useUserMapStore((state) => state.handleLayerSelection);
  const setRasterLayerInfo = useUserMapStore((state) => state.setRasterLayerInfo);

  const activeFitTarget = useMemo(() => {
    if (resultVectorLayer) {
      return "result";
    }
    if (catchmentLayer && catchmentFilter.filterValue && catchmentFilter.filterValue.length > 0) {
      return "catchment";
    }
    if (drainLayer && drainFilter.filterValue && drainFilter.filterValue.length > 0) {
      return "drain";
    }
    if (stretchLayer && stretchFilter.filterValue && stretchFilter.filterValue.length > 0) {
      return "stretch";
    }
    if (riverLayer && riverFilter.filterValue && riverFilter.filterValue.length > 0) {
      return "river";
    }
    return "primary";
  }, [
    catchmentFilter.filterValue,
    catchmentLayer,
    drainFilter.filterValue,
    drainLayer,
    resultVectorLayer,
    riverFilter.filterValue,
    riverLayer,
    stretchFilter.filterValue,
    stretchLayer,
  ]);

  const layerConfigs = useMemo<WorkspaceLayerConfig[]>(
    () => [
      {
        id: "primary",
        label: "India Layer",
        layerName: primaryLayer,
        color: "#2563eb",
        fillColor: "transparent",
        zIndex: 1,
        visibleByDefault: true,
        toggleable: false,
        interactive: false,
        fitOnLoad: activeFitTarget === "primary",
      },
      {
        id: "boundary",
        label: "Boundary Layer",
        layerName: boundaryLayer,
        color: "#301934",
        fillColor: "rgba(48, 25, 52, 0.08)",
        zIndex: 2,
        visibleByDefault: true,
        toggleable: false,
        interactive: false,
      },
      {
        id: "river",
        label: "Rivers",
        layerName: riverLayer,
        filter: riverFilter,
        color: "#1d4ed8",
        fillColor: "transparent",
        zIndex: 13,
        visibleByDefault: true,
        toggleable: true,
        fitOnLoad: activeFitTarget === "river",
      },
      {
        id: "stretch",
        label: "Stretches",
        layerName: stretchLayer,
        filter: stretchFilter,
        color: "#059669",
        fillColor: "transparent",
        zIndex: 12,
        visibleByDefault: true,
        toggleable: true,
        fitOnLoad: activeFitTarget === "stretch",
      },
      {
        id: "drain",
        label: "Drains",
        layerName: drainLayer,
        filter: drainFilter,
        color: "#dc2626",
        fillColor: "transparent",
        zIndex: 11,
        visibleByDefault: true,
        toggleable: true,
        fitOnLoad: activeFitTarget === "drain",
      },
      {
        id: "catchment",
        label: "Catchments",
        layerName: catchmentLayer,
        filter: catchmentFilter,
        color: "#7c2d12",
        fillColor: "rgba(124, 45, 18, 0.08)",
        zIndex: 10,
        visibleByDefault: true,
        toggleable: true,
        fitOnLoad: activeFitTarget === "catchment",
      },
      {
        id: "result",
        label: "Result Layer",
        layerName: resultVectorLayer,
        color: "#9333ea",
        fillColor: "rgba(147, 51, 234, 0.12)",
        zIndex: 20,
        visibleByDefault: true,
        toggleable: true,
        fitOnLoad: activeFitTarget === "result",
      },
    ],
    [
      activeFitTarget,
      boundaryLayer,
      catchmentFilter,
      catchmentLayer,
      drainFilter,
      drainLayer,
      primaryLayer,
      resultVectorLayer,
      riverFilter,
      riverLayer,
      stretchFilter,
      stretchLayer,
    ],
  );

  return (
    <OpenLayersWorkspace
      layerPanelTitle="River System Layers"
      rasterLayers={displayRaster}
      selectedRasterName={selectedRadioLayer}
      rasterLayerInfo={rasterLayerInfo}
      onSelectRasterLayer={handleLayerSelection}
      onSetRasterLayerInfo={setRasterLayerInfo}
      layerConfigs={layerConfigs}
    />
  );
}
