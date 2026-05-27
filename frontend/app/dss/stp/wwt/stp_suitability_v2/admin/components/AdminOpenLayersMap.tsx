"use client";

import { useMemo } from "react";
import OpenLayersWorkspace, {
  type WorkspaceLayerConfig,
} from "../../components/OpenLayersWorkspace";
import { useAdminLocationStore } from "../stores/adminLocationStore";
import { useAdminMapStore } from "../stores/adminMapStore";

export default function AdminOpenLayersMap() {
  const displayRaster = useAdminLocationStore((state) => state.displayRaster);
  const selectionVectorLayer = useAdminLocationStore((state) => state.selectionVectorLayer);
  const primaryLayer = useAdminMapStore((state) => state.primaryLayer);
  const secondaryLayer = useAdminMapStore((state) => state.secondaryLayer);
  const resultVectorLayer = useAdminMapStore((state) => state.resultVectorLayer);
  const resultPathVectorLayer = useAdminMapStore((state) => state.resultPathVectorLayer);
  const layerFilter = useAdminMapStore((state) => state.layerFilter);
  const layerFilterValue = useAdminMapStore((state) => state.layerFilterValue);
  const selectedRadioLayer = useAdminMapStore((state) => state.selectedRadioLayer);
  const rasterLayerInfo = useAdminMapStore((state) => state.rasterLayerInfo);
  const layerOpacity = useAdminMapStore((state) => state.layerOpacity);
  const showLegend = useAdminMapStore((state) => state.showLegend);
  const handleLayerSelection = useAdminMapStore((state) => state.handleLayerSelection);
  const setRasterLayerInfo = useAdminMapStore((state) => state.setRasterLayerInfo);
  const setLayerOpacity = useAdminMapStore((state) => state.setLayerOpacity);
  const setShowLegend = useAdminMapStore((state) => state.setShowLegend);

  const layerConfigs = useMemo<WorkspaceLayerConfig[]>(() => {
    const configs: WorkspaceLayerConfig[] = [
      {
        id: "primary",
        label: "India Layer",
        layerName: primaryLayer,
        color: "#2563eb",
        fillColor: "transparent",
        zIndex: 1,
        visibleByDefault: true,
        toggleable: true,
        fitOnLoad: !secondaryLayer && !resultVectorLayer,
      },
      {
        id: "secondary",
        label: "Selection Layer",
        layerName: secondaryLayer,
        filter:
          secondaryLayer && layerFilter && layerFilterValue
            ? {
                filterField: layerFilter,
                filterValue: layerFilterValue,
              }
            : null,
        color: "#7c2d12",
        fillColor: "transparent",
        zIndex: 10,
        visibleByDefault: true,
        toggleable: true,
        fitOnLoad: Boolean(secondaryLayer) && !resultVectorLayer,
      },
      {
        id: "selectionResult",
        label: "Confirmed Selection",
        layerName:
          selectionVectorLayer && selectionVectorLayer !== secondaryLayer
            ? selectionVectorLayer
            : null,
        color: "#0f766e",
        fillColor: "rgba(15, 118, 110, 0.10)",
        zIndex: 15,
        visibleByDefault: true,
        toggleable: true,
        fitOnLoad:
          Boolean(selectionVectorLayer && selectionVectorLayer !== secondaryLayer) &&
          !resultVectorLayer,
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
        fitOnLoad: Boolean(resultVectorLayer),
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
        fitOnLoad: Boolean(resultPathVectorLayer) && !resultVectorLayer,
      },
    ];

    return configs;
  }, [
    layerFilter,
    layerFilterValue,
    primaryLayer,
    resultPathVectorLayer,
    resultVectorLayer,
    secondaryLayer,
    selectionVectorLayer,
  ]);

  return (
    <OpenLayersWorkspace
      layerPanelTitle="Administrative Layers"
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
