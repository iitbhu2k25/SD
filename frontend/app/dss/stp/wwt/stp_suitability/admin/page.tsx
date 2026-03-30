"use client";

import React, { useEffect, useState } from "react";
import { LocationProvider } from "@/contexts/stp_suitability/admin/LocationContext";
import { CategoryProvider } from "@/contexts/stp_suitability/admin/CategoryContext";
import { MapProvider } from "@/contexts/stp_suitability/admin/MapContext";
import LocationSelector from "@/app/dss/stp/wwt/stp_suitability/admin/components/locations";
import MapView from "@/app/dss/stp/wwt/stp_suitability/admin/components/openlayer";
import { useLocation } from "@/contexts/stp_suitability/admin/LocationContext";
import { useCategory } from "@/contexts/stp_suitability/admin/CategoryContext";
import { useMap } from "@/contexts/stp_suitability/admin/MapContext";
import { CategorySlider } from "./components/weight_slider";
import WholeLoading from "@/components/app_layout/newLoading";
import { toast } from "react-toastify";
import DataTable from "react-data-table-component";
import { Village_columns } from "@/interface/table";
import "react-toastify/dist/ReactToastify.css";
import { api } from "@/services/api";
import PDFGenerationStatus from "@/components/utils/PdfGeneration";
import { downloadCSV } from "@/components/utils/downloadCsv";
import { TreatmentForm } from "@/app/dss/stp/wwt/stp_suitability/admin/components/Stp_area";
import { FaLock, FaUnlock } from "react-icons/fa";
import { STPDss } from "@/app/dss/stp/wwt/stp_suitability/component/STPDss";
import {
  ChevronDown,
  Download,
  BarChart3,
  MapPin,
  FileText,
  SlidersHorizontal,
} from "lucide-react";

// ─── Reusable accordion section ───────────────────────────────────────────────

interface AccordionSectionProps {
  open: boolean;
  onToggle: () => void;
  icon: React.ReactNode;
  iconBg: string;
  iconText: string;
  borderColor: string;
  bgColor: string;
  chevronColor: string;
  label: string;
  sublabel: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}

const AccordionSection: React.FC<AccordionSectionProps> = ({
  open, onToggle,
  icon, iconBg, iconText,
  borderColor, bgColor, chevronColor,
  label, sublabel, badge,
  children,
}) => (
  <section
    className={`rounded-xl border ${borderColor} ${bgColor} overflow-hidden transition-shadow duration-200 ${
      open ? "shadow-sm" : ""
    }`}
  >
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between px-5 py-4 text-left"
    >
      <div className="flex items-center gap-3">
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconBg} ${iconText}`}
        >
          {icon}
        </span>
        <div>
          <p className="text-sm font-semibold text-gray-800 leading-tight">{label}</p>
          <p className="text-xs text-gray-500 mt-0.5">{sublabel}</p>
        </div>
        {badge && <span className="ml-3">{badge}</span>}
      </div>

      <ChevronDown
        className={`h-5 w-5 shrink-0 ${chevronColor} transition-transform duration-200 ${
          open ? "rotate-180" : ""
        }`}
      />
    </button>

    {open && (
      <div className="border-t border-gray-100 px-5 py-4">
        {children}
      </div>
    )}
  </section>
);

// ─────────────────────────────────────────────────────────────────────────────

const MainContent: React.FC = () => {
  const {
    selectedCondition,
    selectedConstraint,
    setSelectedCategory,
    tableData,
  } = useCategory();

  const {
    selectionsLocked,
    displayRaster,
    selectedStateName,
    selectedDistrictsNames,
    selectedSubDistrictsNames,
    selectedTownsNames,
    selectedVillages,
    totalPopulation,
  } = useLocation();

  const { setstpOperation, loading, isMapLoading, stpOperation } = useMap();

  // ── UI state ──────────────────────────────────────────────────────────────
  const [reportLoading, setReportLoading]           = useState(false);
  const [taskId, setTaskId]                         = useState<string | null>(null);
  const [showPdfStatus, setShowPdfStatus]           = useState(false);
  const [isPdfGenerating, setIsPdfGenerating]       = useState(false);
  const [submitting, setSubmitting]                 = useState(false);
  const [activeTab, setActiveTab]                   = useState<"condition" | "constraint">("condition");
  const [categoriesEditable, setCategoriesEditable] = useState(false);

  // accordion state
  const [openCategories, setOpenCategories] = useState(false);
  const [openResults, setOpenResults]       = useState(false);
  const [openCluster, setOpenCluster]       = useState(false);
  const [openTechDSS, setOpenTechDSS]       = useState(false);

  useEffect(() => {
    if (selectionsLocked) setOpenCategories(true);
  }, [selectionsLocked]);

  useEffect(() => {
    if (tableData.length > 0) setOpenResults(true);
  }, [tableData.length]);

  // ── handlers ─────────────────────────────────────────────────────────────
  const handleAnalyze = () => {
    if (selectedCondition.length < 1) {
      toast.error("Please select at least one condition category", { position: "top-center" });
      return;
    }
    setSelectedCategory([...selectedCondition, ...selectedConstraint]);
    setstpOperation(true);
  };

  const handleReport = async () => {
    try {
      setReportLoading(true);
      setTaskId(null);
      setShowPdfStatus(false);
      setIsPdfGenerating(true);

      const response = await api.post("/stp_operation/stp_suitability_admin_report", {
        body: {
          table:           tableData,
          raster:          displayRaster,
          place:           "Admin",
          clip:            selectedVillages,
          location: {
            state:        selectedStateName,
            districts:    selectedDistrictsNames,
            subDistricts: selectedSubDistrictsNames,
            towns:        selectedTownsNames,
            population:   totalPopulation,
          },
          weight_data:     selectedCondition,
          non_weight_data: selectedConstraint,
        },
      });

      if (response.status !== 201) {
        toast.error("Report failed", { position: "top-center" });
        setIsPdfGenerating(false);
        return;
      }

      toast.success("Report generation started");
      const task = response.message as Record<string, string>;
      setTaskId(task["task_id"]);
      setShowPdfStatus(true);
    } catch (error) {
      console.error("Report error", error);
      toast.error("Failed to start report");
      setIsPdfGenerating(false);
    } finally {
      setReportLoading(false);
    }
  };

  const handlePdfComplete = () => { setIsPdfGenerating(false); setShowPdfStatus(false); };
  const handlePdfFailure  = () => { setIsPdfGenerating(false); };

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="bg-gray-50 flex flex-col">
      <WholeLoading
        visible={loading || isMapLoading || stpOperation || reportLoading}
        title={
          stpOperation  ? "Analyzing STP suitability"           :
          reportLoading ? "Generating report for STP suitability" :
                          "Loading Resources"
        }
        message={
          stpOperation  ? "Analyzing site suitability and generating results..." :
          reportLoading ? "Generating report, please wait..."                    :
                          "Fetching map data and initializing components..."
        }
      />

      <main className="flex flex-col lg:flex-row gap-4 py-2 h-[calc(80vh-20px)] overflow-hidden">

        {/* ── LEFT PANEL ──────────────────────────────────────────────────── */}
        <div className="lg:w-1/2 bg-white rounded-xl shadow-md overflow-y-auto p-6 space-y-4 h-full">

          {/* Administrative Selection header */}
          <section className="border-b border-gray-100 pb-4">
            <h2 className="text-xl font-semibold text-gray-800 mb-1">
              Administrative Selection
            </h2>
            {selectionsLocked && (
              <p className="text-sm text-green-600">
                {selectedSubDistrictsNames.length} towns selected
              </p>
            )}
          </section>

          <section className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <LocationSelector />
          </section>

          {/* 1 — Analysis Categories */}
          {selectionsLocked && (
            <AccordionSection
              open={openCategories}
              onToggle={() => setOpenCategories(v => !v)}
              icon={<SlidersHorizontal className="h-4 w-4" />}
              iconBg="bg-blue-600" iconText="text-white"
              borderColor="border-blue-200" bgColor="bg-blue-50"
              chevronColor="text-blue-700"
              label="Analysis Categories"
              sublabel="Adjust weights for conditions &amp; constraints"
            >
              {/* Tab switcher */}
              <div className="flex gap-2 mb-4 flex-wrap">
                {(["condition", "constraint"] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      activeTab === tab
                        ? "bg-blue-600 text-white shadow-sm"
                        : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-100"
                    }`}
                  >
                    {tab === "condition" ? "Conditions" : "Constraints"}
                  </button>
                ))}

                {/* Weight lock button */}
                <button
                  onClick={() => setCategoriesEditable(v => !v)}
                  title={categoriesEditable ? "Lock weights" : "Unlock weights"}
                  className="ml-auto flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 transition hover:bg-gray-50"
                >
                  {categoriesEditable
                    ? <><FaUnlock className="text-blue-600" /><span>Lock</span></>
                    : <><FaLock   className="text-gray-400" /><span>Unlock</span></>
                  }
                </button>
              </div>

              {activeTab === "condition"  && <CategorySlider activeTab="condition"  editable={categoriesEditable} />}
              {activeTab === "constraint" && <CategorySlider activeTab="constraint" editable={categoriesEditable} />}

              <p className="mt-3 flex items-center gap-1.5 text-xs text-red-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                At least one condition category must be selected
              </p>

              <div className="mt-4 flex justify-end">
                <button
                  onClick={handleAnalyze}
                  disabled={stpOperation || submitting}
                  className={`px-6 py-2.5 rounded-full text-sm font-semibold shadow-sm transition ${
                    stpOperation || submitting
                      ? "bg-gray-300 cursor-not-allowed text-gray-500"
                      : "bg-green-500 hover:bg-green-600 text-white hover:scale-105"
                  }`}
                >
                  {stpOperation || submitting ? "Processing…" : "Analyze Suitability"}
                </button>
              </div>
            </AccordionSection>
          )}

          {/* 2 — Village-wise Results */}
          {tableData.length > 0 && (
            <AccordionSection
              open={openResults}
              onToggle={() => setOpenResults(v => !v)}
              icon={<BarChart3 className="h-4 w-4" />}
              iconBg="bg-indigo-600" iconText="text-white"
              borderColor="border-indigo-200" bgColor="bg-indigo-50"
              chevronColor="text-indigo-700"
              label="Village-wise Suitability Results"
              sublabel={`${tableData.length} villages analysed`}
              badge={
                <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
                  {tableData.length}
                </span>
              }
            >
              <div className="mb-3 flex justify-end">
                <button
                  onClick={() => downloadCSV(tableData, "STP_suitability_admin.csv")}
                  className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white shadow-sm transition hover:bg-indigo-700"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download CSV
                </button>
              </div>
              <DataTable
                columns={Village_columns}
                data={tableData}
                pagination
                responsive
                paginationPerPage={5}
                paginationRowsPerPageOptions={[5, 10, 20]}
              />
            </AccordionSection>
          )}

          {/* 3 — STP Cluster Finder */}
          {tableData.length > 0 && (
            <AccordionSection
              open={openCluster}
              onToggle={() => setOpenCluster(v => !v)}
              icon={<MapPin className="h-4 w-4" />}
              iconBg="bg-teal-600" iconText="text-white"
              borderColor="border-teal-200" bgColor="bg-teal-50"
              chevronColor="text-teal-700"
              label="STP Area & Location Finder"
              sublabel="Select technology and capacity to identify clusters on the map"
            >
              <TreatmentForm />
            </AccordionSection>
          )}

          {/* 4 — STP Technology DSS */}
          {tableData.length > 0 && (
            <AccordionSection
              open={openTechDSS}
              onToggle={() => setOpenTechDSS(v => !v)}
              icon={<span className="text-[10px] font-bold leading-none">DSS</span>}
              iconBg="bg-emerald-700" iconText="text-white"
              borderColor="border-emerald-200" bgColor="bg-emerald-50"
              chevronColor="text-emerald-700"
              label="STP Technology Selection"
              sublabel="Rank the best treatment technology for this site"
            >
              <STPDss embedded={true} />
            </AccordionSection>
          )}

          {/* 5 — Generate Report */}
          {tableData.length > 0 && (
            <div className="flex justify-center pb-4">
              <button
                onClick={handleReport}
                disabled={isPdfGenerating}
                className={`flex items-center gap-2 px-8 py-3 rounded-full text-sm font-semibold shadow-md transition duration-200 ${
                  isPdfGenerating
                    ? "bg-gray-300 cursor-not-allowed text-gray-500"
                    : "bg-orange-500 hover:bg-orange-600 text-white hover:scale-105"
                }`}
              >
                <FileText className="h-4 w-4" />
                {isPdfGenerating ? "Generating PDF…" : "Generate Report"}
              </button>
            </div>
          )}
        </div>

        {/* ── RIGHT PANEL — Map ────────────────────────────────────────────── */}
        <div className="lg:w-1/2 bg-white rounded-xl shadow-md overflow-hidden p-4 h-full">
          <div className="w-full h-full md:min-h-[400px]">
            <MapView />
          </div>
        </div>
      </main>

      {showPdfStatus && taskId && (
        <PDFGenerationStatus
          taskId={taskId}
          className="fixed bottom-8 right-8 w-96 z-50 animate-fadeIn"
          autoClose={true}
          closeDelay={3000}
          enableAutoDownload={true}
          onComplete={handlePdfComplete}
          onFailure={handlePdfFailure}
        />
      )}
    </div>
  );
};

const SuitabilityAdminWrapper: React.FC = () => (
  <LocationProvider>
    <CategoryProvider>
      <MapProvider>
        <MainContent />
      </MapProvider>
    </CategoryProvider>
  </LocationProvider>
);

export default SuitabilityAdminWrapper;