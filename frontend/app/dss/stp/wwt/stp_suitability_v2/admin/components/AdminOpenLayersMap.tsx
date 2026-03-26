"use client";

import { useMemo } from "react";
import OpenLayersWorkspace, {
  type WorkspaceLayerConfig,
} from "../../shared/map/OpenLayersWorkspace";
import { useAdminLocationStore } from "../stores/adminLocationStore";
import { useAdminMapStore } from "../stores/adminMapStore";

export default function AdminOpenLayersMap() {
  const displayRaster = useAdminLocationStore((state) => state.displayRaster);
  const primaryLayer = useAdminMapStore((state) => state.primaryLayer);
  const secondaryLayer = useAdminMapStore((state) => state.secondaryLayer);
  const resultVectorLayer = useAdminMapStore((state) => state.resultVectorLayer);
  const layerFilter = useAdminMapStore((state) => state.layerFilter);
  const layerFilterValue = useAdminMapStore((state) => state.layerFilterValue);
  const selectedRadioLayer = useAdminMapStore((state) => state.selectedRadioLayer);
  const rasterLayerInfo = useAdminMapStore((state) => state.rasterLayerInfo);
  const handleLayerSelection = useAdminMapStore((state) => state.handleLayerSelection);
  const setRasterLayerInfo = useAdminMapStore((state) => state.setRasterLayerInfo);

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
        id: "result",
        label: "Result Layer",
        layerName: resultVectorLayer,
        color: "#9333ea",
        fillColor: "rgba(147, 51, 234, 0.12)",
        zIndex: 20,
        visibleByDefault: true,
        toggleable: true,
        fitOnLoad: Boolean(resultVectorLayer),
      },
    ];

    return configs;
  }, [layerFilter, layerFilterValue, primaryLayer, resultVectorLayer, secondaryLayer]);

  return (
    <OpenLayersWorkspace
      layerPanelTitle="Administrative Layers"
      rasterLayers={displayRaster}
      selectedRasterName={selectedRadioLayer}
      rasterLayerInfo={rasterLayerInfo}
      onSelectRasterLayer={handleLayerSelection}
      onSetRasterLayerInfo={setRasterLayerInfo}
      layerConfigs={layerConfigs}
    />
  );
}
