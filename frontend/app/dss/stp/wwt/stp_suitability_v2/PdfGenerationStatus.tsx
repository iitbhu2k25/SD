"use client";

import PDFGenerationStatus from "@/components/utils/PdfGeneration";

interface StpSuitabilityPdfGenerationStatusProps {
  taskId: string;
  onComplete: () => void;
  onFailure: () => void;
}

export default function StpSuitabilityPdfGenerationStatus({
  taskId,
  onComplete,
  onFailure,
}: StpSuitabilityPdfGenerationStatusProps) {
  return (
    <PDFGenerationStatus
      taskId={taskId}
      className="fixed inset-x-4 bottom-4 z-50 animate-fadeIn sm:inset-x-auto sm:bottom-6 sm:left-6 sm:w-80 lg:bottom-8 lg:left-8 lg:w-96"
      autoClose={true}
      closeDelay={3000}
      enableAutoDownload={true}
      onComplete={onComplete}
      onFailure={onFailure}
    />
  );
}
