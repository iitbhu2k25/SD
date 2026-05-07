import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { GeneralCsvUploadResult } from "../types";

interface GenerateGeneralWqiReportInput {
  data: GeneralCsvUploadResult;
  selectedFileLabel: string;
  analysisLayerName: string;
  mapImage?: string;
  legendImage?: string;
  chartImage?: string;
}

const sanitizeForFilename = (value: string) =>
  (value || "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "general_wqi";

const toImageData = (value?: string) => {
  if (!value) return null;
  return value.startsWith("data:image") ? value : `data:image/png;base64,${value}`;
};

export async function generateGeneralWqiReport({
  data,
  selectedFileLabel,
  analysisLayerName,
  mapImage,
  legendImage,
  chartImage,
}: GenerateGeneralWqiReportInput) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
    putOnlyUsedFonts: true,
  });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  const reportDate = new Date().toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  let y = 20;

  const addTitle = (title: string) => {
    doc.setFont("times", "bold");
    doc.setFontSize(14);
    doc.text(title, margin, y);
    y += 8;
  };

  const addText = (text: string, fontSize = 10) => {
    doc.setFont("times", "normal");
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(text, contentWidth);
    if (y + lines.length * 5 > pageHeight - margin) {
      doc.addPage();
      y = 20;
    }
    doc.text(lines, margin, y);
    y += lines.length * 5 + 4;
  };

  const addImage = (label: string, image?: string) => {
    const imageData = toImageData(image);
    if (!imageData) return;
    if (y > pageHeight - 90) {
      doc.addPage();
      y = 20;
    }
    doc.setFont("times", "bold");
    doc.setFontSize(11);
    doc.text(label, margin, y);
    y += 5;
    try {
      doc.addImage(imageData, "PNG", margin, y, contentWidth, 70);
      y += 78;
    } catch {
      addText(`${label} image could not be embedded.`, 9);
    }
  };

  doc.setFont("times", "bold");
  doc.setFontSize(16);
  doc.text("Report on River Water Quality Monitoring", pageWidth / 2, y, {
    align: "center",
  });
  y += 8;
  doc.setFontSize(13);
  doc.text("(General Assessment)", pageWidth / 2, y, { align: "center" });
  y += 14;
  doc.setFont("times", "normal");
  doc.setFontSize(10);
  doc.text(`Selected File: ${selectedFileLabel}`, pageWidth / 2, y, { align: "center" });
  y += 6;
  doc.text(`Analysis Layer: ${analysisLayerName}`, pageWidth / 2, y, { align: "center" });
  y += 6;
  doc.text(`Report Generated: ${reportDate}`, pageWidth / 2, y, { align: "center" });

  doc.addPage();
  y = 20;

  addTitle("1. Executive Summary");
  addText(
    `This report summarizes Water Quality Index results for "${selectedFileLabel}". The uploaded dataset contains ${data.totalPoints} total points, ${data.validPoints} valid points, and ${data.rejectedPoints} rejected points outside the analysis region.`,
  );

  addTitle("2. WQI Summary");
  autoTable(doc, {
    startY: y,
    head: [["Metric", "Value"]],
    body: [
      ["Minimum WQI", data.summary?.min?.toFixed?.(2) ?? "NA"],
      ["Maximum WQI", data.summary?.max?.toFixed?.(2) ?? "NA"],
      ["Mean WQI", data.summary?.mean?.toFixed?.(2) ?? "NA"],
      ["Valid points", String(data.validPoints)],
      ["Rejected points", String(data.rejectedPoints)],
    ],
    theme: "grid",
    styles: { font: "times", fontSize: 9 },
    headStyles: { fillColor: [37, 99, 235] },
    margin: { left: margin, right: margin },
  });
  y = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 10 : y + 45;

  const classRows = Object.entries(data.summary?.countByClass || {}).map(([name, count]) => [
    name,
    String(count),
  ]);
  if (classRows.length) {
    addTitle("3. WQI Class Distribution");
    autoTable(doc, {
      startY: y,
      head: [["Class", "Points"]],
      body: classRows,
      theme: "striped",
      styles: { font: "times", fontSize: 9 },
      headStyles: { fillColor: [5, 150, 105] },
      margin: { left: margin, right: margin },
    });
    y = (doc as any).lastAutoTable?.finalY
      ? (doc as any).lastAutoTable.finalY + 10
      : y + 40;
  }

  if (data.givenParameters.length || data.missingParameters.length) {
    addTitle("4. Parameter Availability");
    addText(`Given parameters: ${data.givenParameters.join(", ") || "NA"}`, 9);
    addText(`Missing parameters: ${data.missingParameters.join(", ") || "None"}`, 9);
  }

  addImage("Raster Map", mapImage);
  addImage("Raster Legend", legendImage);
  addImage("Comparison Chart", chartImage);

  doc.save(`${sanitizeForFilename(selectedFileLabel)}_general_wqi_report.pdf`);
}

