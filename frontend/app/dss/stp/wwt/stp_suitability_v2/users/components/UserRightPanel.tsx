"use client";

import { useCallback, useRef } from "react";
import type {
  Category,
  DataRow,
  SelectRasterLayer,
  Stp_area,
} from "../../services/stpSuitabilityTypes";
import SuitabilityWorkflowPanel from "../../shared/ui/SuitabilityWorkflowPanel";
import type { TreatmentSubmitValues } from "../../shared/ui/SuitabilityTreatmentCard";

interface UserRightPanelProps {
  isOpen: boolean;
  width: string;
  widthPercent: number;
  minWidthPercent: number;
  maxWidthPercent: number;
  onWidthChange: (value: number) => void;
  onClose: () => void;
  isMobile?: boolean;
  showCategories: boolean;
  categoryLoading: boolean;
  workflowError: string | null;
  conditionCategories: Category[];
  constraintCategories: Category[];
  selectedCondition: SelectRasterLayer[];
  selectedConstraint: SelectRasterLayer[];
  areaOptions: Stp_area[];
  selectedAreaOptionId: number | null;
  categoriesEditable: boolean;
  stpProcess: boolean;
  isPdfGenerating: boolean;
  isTreatmentLoading: boolean;
  tableData: DataRow[];
  toggleCategoriesEditable: () => void;
  handleSubmit: () => void | Promise<void>;
  handleReport: () => void | Promise<void>;
  handleTreatmentSubmit: (values: TreatmentSubmitValues) => void | Promise<void>;
  setSelectedAreaOption: (areaId: number | null) => void;
  toggleConditionCategory: (id: number, fileName: string) => void;
  toggleConstraintCategory: (id: number, fileName: string) => void;
  updateConditionCategoryInfluence: (id: number, fileName: string, influence: number) => void;
  selectAllConditionCategories: () => void;
  clearAllConditionCategories: () => void;
  selectAllConstraintCategories: () => void;
  clearAllConstraintCategories: () => void;
}

export default function UserRightPanel({
  isOpen,
  width,
  widthPercent: _widthPercent,
  minWidthPercent,
  maxWidthPercent,
  onWidthChange,
  onClose,
  isMobile = false,
  showCategories,
  categoryLoading,
  workflowError,
  conditionCategories,
  constraintCategories,
  selectedCondition,
  selectedConstraint,
  areaOptions,
  selectedAreaOptionId,
  categoriesEditable,
  stpProcess,
  isPdfGenerating,
  isTreatmentLoading,
  tableData,
  toggleCategoriesEditable,
  handleSubmit,
  handleReport,
  handleTreatmentSubmit,
  setSelectedAreaOption,
  toggleConditionCategory,
  toggleConstraintCategory,
  updateConditionCategoryInfluence,
  selectAllConditionCategories,
  clearAllConditionCategories,
  selectAllConstraintCategories,
  clearAllConstraintCategories,
}: UserRightPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleResizeMouseDown = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      document.body.style.userSelect = "none";
      document.body.style.cursor = "col-resize";

      const onMouseMove = (moveEvent: MouseEvent) => {
        if (!containerRef.current) {
          return;
        }

        const parent = containerRef.current.parentElement;
        if (!parent) {
          return;
        }

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

  return (
    <>
      {isOpen && <div className="absolute inset-0 z-20 bg-black/30 lg:hidden" onClick={onClose} />}
      <div
        ref={containerRef}
        className={`absolute inset-y-0 right-0 z-30 max-w-full shrink-0 overflow-hidden border-l border-stone-200 bg-[linear-gradient(180deg,#f5f1ea_0%,#f2f5f7_48%,#edf3ee_100%)] text-slate-800 shadow-2xl transition-[width] duration-300 ease-in-out lg:relative lg:inset-auto lg:z-auto ${
          isOpen ? "" : "w-0 border-l-0"
        }`}
        style={{ width: isOpen ? width : "0px" }}
      >
        {isOpen && (
          <div
            onMouseDown={handleResizeMouseDown}
            className="group absolute inset-y-0 left-0 z-10 hidden w-2 cursor-col-resize items-center justify-center transition-colors hover:bg-emerald-400/20 lg:flex"
            title="Resize analysis panel"
          >
            <div className="h-10 w-0.5 rounded-full bg-stone-300 transition-colors group-hover:bg-emerald-500" />
          </div>
        )}
        <div className="flex h-full max-w-full flex-col" style={{ width: "100%" }}>
          <div className="flex-1 space-y-3 overflow-y-auto p-2.5 sm:space-y-4 sm:p-4">
            <SuitabilityWorkflowPanel
              showCategories={showCategories}
              categoryLoading={categoryLoading}
              workflowError={workflowError}
              conditionCategories={conditionCategories}
              constraintCategories={constraintCategories}
              selectedCondition={selectedCondition}
              selectedConstraint={selectedConstraint}
              areaOptions={areaOptions}
              selectedAreaOptionId={selectedAreaOptionId}
              categoriesEditable={categoriesEditable}
              stpProcess={stpProcess}
              isPdfGenerating={isPdfGenerating}
              isTreatmentLoading={isTreatmentLoading}
              tableData={tableData}
              csvFileName="STP_Suitability_Drain.csv"
              onToggleCategoriesEditable={toggleCategoriesEditable}
              onAnalyze={handleSubmit}
              onReport={handleReport}
              onSelectAreaOption={setSelectedAreaOption}
              onTreatmentSubmit={handleTreatmentSubmit}
              onToggleConditionCategory={toggleConditionCategory}
              onToggleConstraintCategory={toggleConstraintCategory}
              onUpdateConditionInfluence={updateConditionCategoryInfluence}
              onSelectAllCondition={selectAllConditionCategories}
              onClearAllCondition={clearAllConditionCategories}
              onSelectAllConstraint={selectAllConstraintCategories}
              onClearAllConstraint={clearAllConstraintCategories}
            />
          </div>
        </div>
      </div>
    </>
  );
}
