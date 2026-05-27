"use client";

import { toast } from "react-toastify";
import { useManualAreaStore } from "../stores/manualAreaStore";
import { useManualMapStore } from "../stores/manualMapStore";
import { useManualUiStore } from "../stores/manualUiStore";
import type { TechnologyAreaSubmitValues } from "../../components/StpTechnologyDss";
import { findManualPath, findSuitabilityAreaClusterFresh } from "../../services/manual_stpSuitabilityApi";

export function useManualViewModel() {
  const selectionsLocked = useManualAreaStore((state) => state.selectionsLocked);
  const selectionVectorLayer = useManualAreaStore((state) => state.selectionVectorLayer);
  const polygonLayer = useManualAreaStore((state) => state.polygonLayer);
  const areaCentroid = useManualAreaStore((state) => state.areaCentroid);
  const drawnPolygon = useManualAreaStore((state) => state.drawnPolygon);
  const drainPoints = useManualAreaStore((state) => state.drainPoints);
  const selectedDrainNos = useManualAreaStore((state) => state.selectedDrainNos);
  const drainCapacityMld = useManualAreaStore((state) => state.drainCapacityMld);
  const bufferBbox = useManualAreaStore((state) => state.bufferBbox);
  const markedAreaHa = useManualAreaStore((state) => state.markedAreaHa);
  const areaLoading = useManualAreaStore((state) => state.isLoading);
  const areaError = useManualAreaStore((state) => state.error);

  const setResultVectorLayer = useManualMapStore((state) => state.setResultVectorLayer);
  const setResultPathVectorLayer = useManualMapStore((state) => state.setResultPathVectorLayer);
  const setClusterDistances = useManualMapStore((state) => state.setClusterDistances);
  const rasterLayerInfo = useManualMapStore((state) => state.rasterLayerInfo);
  const displayRaster = useManualAreaStore((state) => state.displayRaster);
  const loading = useManualMapStore((state) => state.loading);
  const isMapLoading = useManualMapStore((state) => state.isMapLoading);
  const stpOperation = useManualMapStore((state) => state.stpOperation);
  const clusterDistances = useManualMapStore((state) => state.clusterDistances);
  const mapError = useManualMapStore((state) => state.error);


  const isRightPanelOpen = useManualUiStore((state) => state.isRightPanelOpen);
  const reportLoading = useManualUiStore((state) => state.reportLoading);
  const treatmentLoading = useManualUiStore((state) => state.treatmentLoading);
  const isPdfGenerating = useManualUiStore((state) => state.isPdfGenerating);
  const showPdfStatus = useManualUiStore((state) => state.showPdfStatus);
  const taskId = useManualUiStore((state) => state.taskId);
  const setRightPanelOpen = useManualUiStore((state) => state.setRightPanelOpen);
  const toggleRightPanel = useManualUiStore((state) => state.toggleRightPanel);
  const completePdfGeneration = useManualUiStore((state) => state.completePdfGeneration);
  const failPdfGeneration = useManualUiStore((state) => state.failPdfGeneration);
  const setTreatmentLoading = useManualUiStore((state) => state.setTreatmentLoading);

  const handleTechnologyAreaSubmit = async ({
    landPerMld,
    mldCapacity,
    technologyName,
    numClusters,
  }: TechnologyAreaSubmitValues) => {
    if (!polygonLayer) {
      toast.error("Please confirm your area selection first");
      return false;
    }

    setTreatmentLoading(true);

    try {
      const effectiveDrainPoints =
        selectedDrainNos.length > 0
          ? drainPoints.filter((d) => selectedDrainNos.includes(d.Drain_No))
          : drainPoints;

      // Step 1: Find the best cluster using suitability raster (like admin mode)
      // Use the suitability layer produced by the manual analysis run
      const suitabilityLayerName =
        rasterLayerInfo?.layer_name ??
        displayRaster.find((r) => r.file_name === "STP_Suitability")?.layer_name ??
        null;

      if (suitabilityLayerName && areaCentroid) {
        // Apply DSS mode: find top 10 nearest clusters from suitability raster
        // Road path is NOT shown on map — distances are returned in cluster_distances
        try {
          const n = numClusters ?? 10;
          const areaResult = await findSuitabilityAreaClusterFresh({
            treatment_technology: landPerMld,
            mld_capacity: mldCapacity,
            custom_land_per_mld: 2,
            layer_name: suitabilityLayerName,
            location: [areaCentroid],
            drain_points: effectiveDrainPoints,
            num_clusters: n,
          });
          setResultVectorLayer(areaResult.cluster_layer ?? null);
          const distances = areaResult.cluster_distances ?? null;
          setClusterDistances(distances ?? null);
        } catch (clusterError) {
          console.error("[manual cluster] error:", clusterError);
          setResultVectorLayer(null);
          setClusterDistances(null);
        }
        // No road path in DSS mode
        setResultPathVectorLayer(null);
      } else {
        // Normal manual mode (no DSS): show drawn polygon, road from centroid → drains
        setResultVectorLayer(polygonLayer ?? null);
        const hasGeometry = !!(drawnPolygon?.geojson ?? polygonLayer);
        if (hasGeometry && effectiveDrainPoints.length > 0 && areaCentroid) {
          try {
            const pathResult = await findManualPath({
              polygon_geojson: drawnPolygon?.geojson,
              polygon_layer: drawnPolygon?.geojson ? undefined : (polygonLayer ?? undefined),
              location: [areaCentroid],
              drain_points: effectiveDrainPoints,
              buffer_bbox: bufferBbox ?? undefined,
            });
            setResultPathVectorLayer(pathResult.suitable_path ?? null);
            setClusterDistances(pathResult.cluster_distances ?? null);
          } catch (pathError) {
            console.error("[manual path] error:", pathError);
            setResultPathVectorLayer(null);
            setClusterDistances(null);
          }
        } else {
          setResultPathVectorLayer(null);
          setClusterDistances(null);
        }
      }

      toast.success(`Area analysis completed for ${technologyName}`);
      return true;
    } catch (_error) {
      toast.error("Failed to run area analysis");
      return false;
    } finally {
      setTreatmentLoading(false);
    }
  };

  return {
    selectionsLocked,
    selectionVectorLayer,
    areaLoading,
    areaError,
    loading,
    isMapLoading,
    stpOperation,
    mapError,
    isRightPanelOpen,
    reportLoading,
    treatmentLoading,
    canFindTechnologyArea: selectionsLocked,
    isPdfGenerating,
    showPdfStatus,
    taskId,
    setRightPanelOpen,
    toggleRightPanel,
    completePdfGeneration,
    failPdfGeneration,
    handleTechnologyAreaSubmit,
    drainCapacityMld,
    markedAreaHa,
    clusterDistances,
  };
}
