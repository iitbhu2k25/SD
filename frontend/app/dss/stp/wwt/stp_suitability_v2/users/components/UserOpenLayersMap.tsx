"use client";

import { useMemo } from "react";
import OpenLayersWorkspace, {
  type WorkspaceLayerConfig,
} from "../../components/OpenLayersWorkspace";
import { useUserMapStore } from "../stores/userMapStore";
import { useUserRiverStore } from "../stores/userRiverStore";

export default function UserOpenLayersMap() {
  const displayRaster = useUserRiverStore((state) => state.displayRaster);
  const selectionVectorLayer = useUserRiverStore((state) => state.selectionVectorLayer);
  const primaryLayer = useUserMapStore((state) => state.primaryLayer);
  const boundaryLayer = useUserMapStore((state) => state.boundaryLayer);
  const riverLayer = useUserMapStore((state) => state.riverLayer);
  const stretchLayer = useUserMapStore((state) => state.stretchLayer);
  const drainLayer = useUserMapStore((state) => state.drainLayer);
  const catchmentLayer = useUserMapStore((state) => state.catchmentLayer);
  const resultVectorLayer = useUserMapStore((state) => state.resultVectorLayer);
  const resultPathVectorLayer = useUserMapStore((state) => state.resultPathVectorLayer);
  const riverFilter = useUserMapStore((state) => state.riverFilter);
  const stretchFilter = useUserMapStore((state) => state.stretchFilter);
  const drainFilter = useUserMapStore((state) => state.drainFilter);
  const catchmentFilter = useUserMapStore((state) => state.catchmentFilter);
  const selectedRadioLayer = useUserMapStore((state) => state.selectedRadioLayer);
  const rasterLayerInfo = useUserMapStore((state) => state.rasterLayerInfo);
  const layerOpacity = useUserMapStore((state) => state.layerOpacity);
  const showLegend = useUserMapStore((state) => state.showLegend);
  const handleLayerSelection = useUserMapStore((state) => state.handleLayerSelection);
  const setRasterLayerInfo = useUserMapStore((state) => state.setRasterLayerInfo);
  const setLayerOpacity = useUserMapStore((state) => state.setLayerOpacity);
  const setShowLegend = useUserMapStore((state) => state.setShowLegend);

  const activeFitTarget = useMemo(() => {
    if (resultVectorLayer || resultPathVectorLayer) {
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
    resultPathVectorLayer,
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
        id: "selectionResult",
        label: "Confirmed Catchments",
        layerName:
          selectionVectorLayer && selectionVectorLayer !== catchmentLayer
            ? selectionVectorLayer
            : null,
        color: "#0f766e",
        fillColor: "rgba(15, 118, 110, 0.10)",
        zIndex: 15,
        visibleByDefault: true,
        toggleable: true,
        fitOnLoad:
          Boolean(selectionVectorLayer && selectionVectorLayer !== catchmentLayer) &&
          activeFitTarget === "catchment",
      },
      {
        id: "result",
        label: "Treatment Cluster",
        layerName: resultVectorLayer,
        color: "#9333ea",
        fillColor: "rgba(147, 51, 234, 0.12)",
        zIndex: 40,
        visibleByDefault: true,
        toggleable: true,
        fitOnLoad: activeFitTarget === "result",
      },
      {
        id: "resultPath",
        label: "Suitable Path",
        layerName: resultPathVectorLayer,
        color: "#16a34a",
        fillColor: "transparent",
        zIndex: 41,
        visibleByDefault: true,
        toggleable: true,
        fitOnLoad: activeFitTarget === "result" && !resultVectorLayer,
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
      resultPathVectorLayer,
      resultVectorLayer,
      riverFilter,
      riverLayer,
      selectionVectorLayer,
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
      layerOpacity={layerOpacity}
      showLegend={showLegend}
      onSelectRasterLayer={handleLayerSelection}
      onSetRasterLayerInfo={setRasterLayerInfo}
      onSetLayerOpacity={setLayerOpacity}
      onSetShowLegend={setShowLegend}
      layerConfigs={layerConfigs}
    />
  );
}
