"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "react-toastify";
import ManualSuitabilityWorkflowPanel from "./ManualSuitabilityWorkflowPanel";
import ManualStpTechnologyDss from "./ManualStpTechnologyDss";
import type { TechnologyAreaSubmitValues } from "./ManualStpTechnologyDss";
import ManualCategorySlider from "./ManualCategorySlider";
import { useManualCategoryStore } from "../stores/manualCategoryStore";
import { useManualMapStore } from "../stores/manualMapStore";
import { useManualUiStore } from "../stores/manualUiStore";
import { useManualMultiStore } from "../stores/manualMultiStore";
import { findMultiPath, findMultiArea, runManualSuitabilityAnalysis } from "../services/manual_stpSuitabilityApi";
import type { MultiPolygonResult } from "../stores/manualMultiStore";
import type { ClipRasters } from "../services/manual_stpSuitabilityTypes";

// ── Multi-polygon Technology DSS panel ────────────────────────────────────────
function MultiPolygonPanel() {
  const polygonEntries = useManualMultiStore((s) => s.polygonEntries);
  const drainCapacityMld = useManualMultiStore((s) => s.drainCapacityMld);
  const setPolygonResults = useManualMultiStore((s) => s.setPolygonResults);
  const unlockSelections = useManualMultiStore((s) => s.unlockSelections);
  const setShowDssWorkflow = useManualUiStore((s) => s.setShowDssWorkflow);
  const setTreatmentLoading = useManualUiStore((s) => s.setTreatmentLoading);
  const [isFinding, setIsFinding] = useState(false);

  const handleFindArea = async (values: TechnologyAreaSubmitValues) => {
    const currentEntries = useManualMultiStore.getState().polygonEntries;
    if (currentEntries.length === 0) {
      toast.error("No polygons confirmed for multi-area");
      return false;
    }
    setIsFinding(true);
    setTreatmentLoading(true);
    try {
      // No-constraint path: road path per polygon — sequential to avoid backend contention
      const resultsMap = new Map<number, MultiPolygonResult>();
      for (const entry of currentEntries) {
        const effectiveDrains =
          entry.selectedDrainNos.length > 0
            ? entry.drainPoints.filter((d) => entry.selectedDrainNos.includes(d.Drain_No))
            : entry.drainPoints;
        try {
          const pathResponse = await findMultiPath({
            polygons: [{
              polygon_layer: entry.polygonLayer ?? undefined,
              location: [entry.centroid] as [number, number][],
              drain_points: effectiveDrains,
              buffer_bbox: entry.bufferBbox,
            }],
          });
          const r = pathResponse.results[0];
          if (r) {
            resultsMap.set(entry.index, {
              index: entry.index,
              clusterLayer: entry.polygonLayer ?? null,
              suitablePath: r.suitable_path ?? null,
              clusterDistances: r.cluster_distances ?? null,
            });
          }
        } catch {
          // leave out — will show as no result for this polygon
        }
      }

      const results: MultiPolygonResult[] = currentEntries.map((entry) =>
        resultsMap.get(entry.index) ?? { index: entry.index, clusterLayer: null, suitablePath: null, clusterDistances: null }
      );

      setPolygonResults(results);

      // Build per-polygon grouped cluster distances for the table in StpTechnologyDss
      const groups = results
        .map((r, i) => ({
          label: `Polygon ${i + 1}`,
          clusters: r.clusterDistances ?? [],
        }))
        .filter((g) => g.clusters.length > 0);
      useManualMapStore.getState().setMultiClusterDistances(groups.length > 0 ? groups : null);

      toast.success(`Multi-area analysis completed for ${values.technologyName}`);
      return true;
    } catch {
      toast.error("Failed to run multi-area analysis");
      return false;
    } finally {
      setIsFinding(false);
      setTreatmentLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3">
      <p className="mb-2 border-l-2 border-emerald-400 pl-2 text-xs font-semibold text-emerald-800">
        Multi-Area STP Technology Selection
      </p>
      <p className="mb-3 text-[10px] text-slate-500">
        {polygonEntries.length} polygon(s) — results will be kept separate per polygon.
      </p>
      <ManualStpTechnologyDss
        canFindArea={true}
        enableDprCostEstimator={true}
        isFindingArea={isFinding}
        drainCapacityMld={drainCapacityMld}
        drainCapacityRequired={false}
        markedAreaHa={polygonEntries.reduce((sum, e) => sum + e.areaHa, 0)}
        onFindArea={handleFindArea}
        redrawPolygonLabel="Re-upload Files"
        onRedrawPolygon={() => {
          unlockSelections();
          useManualMapStore.getState().resetMapView();
          useManualUiStore.getState().setRightPanelOpen(false);
        }}
        onApplyDss={() => {
          useManualCategoryStore.getState().reset();
          setShowDssWorkflow(true);
        }}
      />
    </div>
  );
}

// ── Multi-polygon DSS Workflow Panel ─────────────────────────────────────────
// Shown when multiSelectionsLocked && showDssWorkflow (constraint "Find through DSS" path)
function MultiDssWorkflowPanel() {
  const polygonEntries = useManualMultiStore((s) => s.polygonEntries);
  const setPolygonEntries = useManualMultiStore((s) => s.setPolygonEntries);
  const setPolygonResults = useManualMultiStore((s) => s.setPolygonResults);
  const selectedCondition = useManualCategoryStore((s) => s.selectedCondition);
  const selectedConstraint = useManualCategoryStore((s) => s.selectedConstraint);
  const categoryLoading = useManualCategoryStore((s) => s.isLoading);
  const categoryError = useManualCategoryStore((s) => s.error);
  const tableData = useManualCategoryStore((s) => s.tableData);
  const stpOperation = useManualMapStore((s) => s.stpOperation);
  const setTreatmentLoading = useManualUiStore((s) => s.setTreatmentLoading);
  const [isFinding, setIsFinding] = useState(false);

  const handleAnalyze = async () => {
    const selectedCategories = [...selectedCondition, ...selectedConstraint];
    if (selectedCategories.length === 0) {
      toast.error("Please select at least one category");
      return;
    }
    useManualMapStore.setState({ stpOperation: true, isMapLoading: true, error: null });
    try {
      // Read fresh from store — hook closure may be stale if entries changed since last render
      const currentEntries = useManualMultiStore.getState().polygonEntries;

      // Run suitability analysis for every polygon sequentially to avoid backend overload
      const results: PromiseSettledResult<import("../services/manual_stpSuitabilityTypes").stp_sutability_Output>[] = [];
      for (const entry of currentEntries) {
        try {
          const result = await runManualSuitabilityAnalysis({
            data: selectedCategories,
            village_layer: entry.vectorLayer,
            method: "shapefile",
          });
          results.push({ status: "fulfilled", value: result });
        } catch (e) {
          results.push({ status: "rejected", reason: e });
        }
      }

      // Update each entry's displayRasters with its suitability result
      const updatedEntries = currentEntries.map((entry, i) => {
        const settled = results[i];
        if (settled.status !== "fulfilled") return entry;
        const result = settled.value;
        const suitabilityRaster: ClipRasters = {
          file_name: `STP_Suitability_P${i + 1}`,
          workspace: result.workspace,
          layer_name: result.layer_name,
        };
        const existingIdx = entry.displayRasters.findIndex((r) => r.file_name === suitabilityRaster.file_name);
        const nextRasters = existingIdx === -1
          ? [...entry.displayRasters, suitabilityRaster]
          : entry.displayRasters.map((r, ri) => ri === existingIdx ? suitabilityRaster : r);
        return { ...entry, displayRasters: nextRasters };
      });

      setPolygonEntries(updatedEntries);

      // Show raster for the first successful polygon on map and enable legend.
      // Use "STP_Suitability" as the selectedRadioLayer key (matches the deduplicated selector entry).
      const firstResult = results.find((r) => r.status === "fulfilled");
      if (firstResult && firstResult.status === "fulfilled") {
        const firstSuitability = { file_name: "STP_Suitability", workspace: firstResult.value.workspace, layer_name: firstResult.value.layer_name };
        useManualMapStore.setState({
          rasterLayerInfo: firstSuitability,
          selectedRadioLayer: "STP_Suitability",
          showLegend: true,
        });
      }

      // Set tableData so SuitabilityWorkflowPanel reveals StpTechnologyDss
      // Use the first polygon's csv_details as representative table
      const firstFulfilled = results.find((r) => r.status === "fulfilled");
      if (firstFulfilled && firstFulfilled.status === "fulfilled") {
        useManualCategoryStore.getState().setTableData(firstFulfilled.value.csv_details ?? []);
        useManualCategoryStore.getState().setShowTable(true);
      }

      useManualMapStore.setState({ stpOperation: false, isMapLoading: false });
      const successCount = results.filter((r) => r.status === "fulfilled").length;
      toast.success(`Suitability analysis completed for ${successCount}/${polygonEntries.length} polygon(s)`);
    } catch {
      useManualMapStore.setState({ stpOperation: false, isMapLoading: false });
      toast.error("Failed to run suitability analysis");
    }
  };

  const handleFindArea = async (values: TechnologyAreaSubmitValues) => {
    // Read entries fresh from the store — polygonEntries in closure may be stale
    // if setPolygonEntries was called after the last render (e.g. after Analyze)
    const currentEntries = useManualMultiStore.getState().polygonEntries;
    if (currentEntries.length === 0) return false;
    setIsFinding(true);
    setTreatmentLoading(true);
    try {
      const n = values.numClusters ?? 10;

      // Build per-polygon payloads — each polygon uses its own suitability raster
      const polygonsWithRaster = currentEntries.map((entry, i) => {
        const suitabilityLayer = entry.displayRasters.find((r) => r.file_name === `STP_Suitability_P${i + 1}`);
        const effectiveDrains = entry.selectedDrainNos.length > 0
          ? entry.drainPoints.filter((d) => entry.selectedDrainNos.includes(d.Drain_No))
          : entry.drainPoints;
        return { entry, i, suitabilityLayer, effectiveDrains };
      });

      // Split into two groups: those with a suitability raster (DSS path) and those without (fallback)
      const dssPolygons = polygonsWithRaster.filter((p) => p.suitabilityLayer);
      const fallbackPolygons = polygonsWithRaster.filter((p) => !p.suitabilityLayer);

      // DSS path: call /stp_multi_area one polygon at a time to avoid Celery worker contention
      const dssResultsMap = new Map<number, MultiPolygonResult>();
      for (const p of dssPolygons) {
        try {
          const multiAreaResponse = await findMultiArea({
            polygons: [{
              treatment_technology: values.landPerMld,
              mld_capacity: values.mldCapacity,
              custom_land_per_mld: 2,
              layer_name: p.suitabilityLayer!.layer_name,
              location: [p.entry.centroid] as [number, number][],
              drain_points: p.effectiveDrains,
              num_clusters: n,
            }],
          });
          const r = multiAreaResponse.results[0];
          if (r) {
            dssResultsMap.set(p.i, {
              index: p.i,
              clusterLayer: r.cluster_layer ?? null,
              suitablePath: null,
              clusterDistances: r.cluster_distances ?? null,
            });
          }
        } catch {
          // leave this polygon out of dssResultsMap — fallback will handle it
        }
      }

      // Fallback path (no suitability raster): road path per polygon — sequential to avoid contention
      const fallbackResultsMap = new Map<number, MultiPolygonResult>();
      for (const p of fallbackPolygons) {
        try {
          const pathResponse = await findMultiPath({
            polygons: [{
              polygon_layer: p.entry.polygonLayer ?? undefined,
              location: [p.entry.centroid] as [number, number][],
              drain_points: p.effectiveDrains,
              buffer_bbox: p.entry.bufferBbox,
            }],
          });
          const r = pathResponse.results[0];
          if (r) {
            fallbackResultsMap.set(p.i, {
              index: p.i,
              clusterLayer: p.entry.polygonLayer ?? null,
              suitablePath: r.suitable_path ?? null,
              clusterDistances: r.cluster_distances ?? null,
            });
          }
        } catch {
          // leave out — will show as no result for this polygon
        }
      }

      // Merge results in original polygon order
      const results: MultiPolygonResult[] = currentEntries.map((_, i) =>
        dssResultsMap.get(i) ?? fallbackResultsMap.get(i) ?? { index: i, clusterLayer: null, suitablePath: null, clusterDistances: null }
      );

      setPolygonResults(results);

      // Build per-polygon grouped cluster distances for the table in StpTechnologyDss
      const groups = results
        .map((r, i) => ({
          label: `Polygon ${i + 1}`,
          clusters: r.clusterDistances ?? [],
        }))
        .filter((g) => g.clusters.length > 0);
      useManualMapStore.getState().setMultiClusterDistances(groups.length > 0 ? groups : null);

      toast.success(`Multi-area DSS analysis completed for ${values.technologyName}`);
      return true;
    } catch {
      toast.error("Failed to run multi-area DSS analysis");
      return false;
    } finally {
      setIsFinding(false);
      setTreatmentLoading(false);
    }
  };

  return (
    <ManualSuitabilityWorkflowPanel
      showCategories={selectedCondition.length > 0}
      categoryLoading={categoryLoading}
      workflowError={categoryError}
      selectedConditionCount={selectedCondition.length}
      selectedConstraintCount={selectedConstraint.length}
      stpProcess={stpOperation}
      isTreatmentLoading={isFinding}
      tableData={tableData}
      canFindTechnologyArea={true}
      enableDprCostEstimator={true}
      renderCategorySlider={() => <ManualCategorySlider />}
      onAnalyze={() => void handleAnalyze()}
      onTechnologyAreaSubmit={handleFindArea}
    />
  );
}

interface ManualRightPanelProps {
  isOpen: boolean;
  width: string;
  widthPercent: number;
  minWidthPercent: number;
  maxWidthPercent: number;
  onWidthChange: (value: number) => void;
  onClose: () => void;
  isMobile?: boolean;
  isTreatmentLoading: boolean;
  canFindTechnologyArea: boolean;
  drainCapacityMld?: number | null;
  markedAreaHa?: number;
  handleTechnologyAreaSubmit: (
    values: TechnologyAreaSubmitValues,
  ) => void | boolean | Promise<void | boolean>;
  onRedrawPolygon?: () => void;
}

export default function ManualRightPanel({
  isOpen,
  width,
  widthPercent: _widthPercent,
  minWidthPercent,
  maxWidthPercent,
  onWidthChange,
  onClose,
  isMobile = false,
  isTreatmentLoading,
  canFindTechnologyArea,
  drainCapacityMld,
  markedAreaHa = 0,
  handleTechnologyAreaSubmit,
  onRedrawPolygon,
}: ManualRightPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const showDssWorkflow = useManualUiStore((state) => state.showDssWorkflow);
  const setShowDssWorkflow = useManualUiStore((state) => state.setShowDssWorkflow);
  const pendingTechnologyValues = useManualUiStore((state) => state.pendingTechnologyValues);
  const setPendingTechnologyValues = useManualUiStore((state) => state.setPendingTechnologyValues);

  const selectedCondition = useManualCategoryStore((state) => state.selectedCondition);
  const selectedConstraint = useManualCategoryStore((state) => state.selectedConstraint);
  const categoryLoading = useManualCategoryStore((state) => state.isLoading);
  const categoryError = useManualCategoryStore((state) => state.error);
  const tableData = useManualCategoryStore((state) => state.tableData);
  const areaOptions = useManualCategoryStore((state) => state.areaOptions);

  const runAnalysis = useManualMapStore((state) => state.runAnalysis);
  const stpOperation = useManualMapStore((state) => state.stpOperation);

  const handleResizeMouseDown = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      document.body.style.userSelect = "none";
      document.body.style.cursor = "col-resize";

      const onMouseMove = (moveEvent: MouseEvent) => {
        if (!containerRef.current) return;
        const parent = containerRef.current.parentElement;
        if (!parent) return;
        const parentRect = parent.getBoundingClientRect();
        const newWidthPx = parentRect.right - moveEvent.clientX;
        const newWidthPercent = (newWidthPx / parentRect.width) * 100;
        const clamped = Math.min(maxWidthPercent, Math.max(minWidthPercent, newWidthPercent));
        onWidthChange(Number(clamped.toFixed(1)));
      };

      const onMouseUp = () => {
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [maxWidthPercent, minWidthPercent, onWidthChange],
  );

  const handleApplyDss = useCallback((values: TechnologyAreaSubmitValues) => {
    setPendingTechnologyValues(values);
    useManualCategoryStore.getState().reset();
    setShowDssWorkflow(true);
  }, [setPendingTechnologyValues, setShowDssWorkflow]);

  const multiSelectionsLocked = useManualMultiStore((s) => s.selectionsLocked);

  return (
    <>
      {isOpen && <div className="absolute inset-0 z-30 bg-black/30 lg:hidden" onClick={onClose} />}
      <div
        ref={containerRef}
        className={`${
          isMobile
            ? "absolute inset-y-0 right-0 z-40 max-w-full"
            : "relative z-20 h-full shrink-0"
        } overflow-hidden border-l border-stone-200 bg-[linear-gradient(180deg,#f5f1ea_0%,#f2f5f7_48%,#f0edf7_100%)] text-slate-800 shadow-2xl transition-[width] duration-300 ease-in-out ${
          isOpen ? "" : "w-0 border-l-0"
        }`}
        style={{ width: isOpen ? width : "0px" }}
      >
        {isOpen && (
          <div
            onMouseDown={handleResizeMouseDown}
            className="group absolute inset-y-0 left-0 z-10 hidden w-2 cursor-col-resize items-center justify-center transition-colors hover:bg-violet-400/20 lg:flex"
            title="Resize analysis panel"
          >
            <div className="h-10 w-0.5 rounded-full bg-stone-300 transition-colors group-hover:bg-violet-500" />
          </div>
        )}
        <div className="flex h-full max-w-full flex-col" style={{ width: "100%" }}>
          <div className="flex-1 space-y-3 overflow-y-auto p-2.5 sm:space-y-4 sm:p-4">
            {multiSelectionsLocked && showDssWorkflow ? (
              /* ── Multi-polygon DSS workflow (constraint "Find through DSS" path) ── */
              <MultiDssWorkflowPanel />
            ) : multiSelectionsLocked ? (
              /* ── Multi-polygon normal flow ── */
              <MultiPolygonPanel />
            ) : showDssWorkflow ? (
              /* ── Single-polygon DSS workflow ── */
              <ManualSuitabilityWorkflowPanel
                showCategories={selectedCondition.length > 0}
                categoryLoading={categoryLoading}
                workflowError={categoryError}
                selectedConditionCount={selectedCondition.length}
                selectedConstraintCount={selectedConstraint.length}
                stpProcess={stpOperation}
                isTreatmentLoading={isTreatmentLoading}
                tableData={tableData}
                canFindTechnologyArea={canFindTechnologyArea}
                enableDprCostEstimator={true}
                initialTechnologyValues={pendingTechnologyValues}
                renderCategorySlider={() => <ManualCategorySlider />}
                onAnalyze={() => void runAnalysis()}
                onTechnologyAreaSubmit={handleTechnologyAreaSubmit}
              />
            ) : (
              /* ── Single-polygon normal flow ── */
              <ManualStpTechnologyDss
                canFindArea={canFindTechnologyArea}
                enableDprCostEstimator={true}
                isFindingArea={isTreatmentLoading}
                drainCapacityMld={drainCapacityMld}
                drainCapacityRequired={drainCapacityMld === null || drainCapacityMld === undefined}
                markedAreaHa={markedAreaHa}
                onFindArea={handleTechnologyAreaSubmit}
                onRedrawPolygon={onRedrawPolygon}
                onApplyDss={handleApplyDss}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
