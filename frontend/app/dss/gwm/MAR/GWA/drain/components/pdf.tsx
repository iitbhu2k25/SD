"use client";

import React, { useState, useContext } from "react";
import jsPDF from "jspdf";
import { useLocation } from "@/contexts/groundwater_assessment/drain/LocationContext";
import { usePDF } from "@/contexts/groundwater_assessment/drain/PDFContext";
import { useWell } from "@/contexts/groundwater_assessment/drain/WellContext";
import { GroundwaterTrendContext } from "@/contexts/groundwater_assessment/drain/TrendContext";
import { GroundwaterForecastContext } from "@/contexts/groundwater_assessment/drain/ForecastContext";
import { useRecharge } from "@/contexts/groundwater_assessment/drain/RechargeContext";
import { useDemand } from "@/contexts/groundwater_assessment/drain/DemandContext";
import { useGSR } from "@/contexts/groundwater_assessment/drain/GSRContext";
import { GroundwaterContourContext } from "@/contexts/groundwater_assessment/drain/ContourContext";

interface PDFProps {
  contourData?: any;
  trendData?: any;
  forecastData?: any;
}

const PDF: React.FC<PDFProps> = ({
  contourData,
  trendData,
  forecastData
}) => {
  const {
    rivers,
    stretches,
    selectedRiver,
    selectedStretch,
    selectedDrain,
    selectedCatchments,
    selectedVillages,
    catchments,
    villages,
  } = useLocation();

  const { generatePDFReport, pdfGenerationError } = usePDF();
  const { wellsData } = useWell();
  const { tableData } = useRecharge();
  const {
    domesticTableData,
    agriculturalTableData,
    industrialTableData,
    chartData,
    perCapitaConsumption,
    selectedCrops,
  } = useDemand();
  const { gsrTableData, stressTableData, mapImageBase64 } = useGSR();

  // Get trend data from context
  const { trendData: contextTrendData } = useContext(GroundwaterTrendContext);
  const { visualizationData, rasterData, geoJsonData } = useContext(GroundwaterContourContext);
  // Use context trend data if props trend data is not available
  const finalTrendData = trendData || contextTrendData;

  const [generating, setGenerating] = useState(false);

  // Constants for layout
  const PAGE_HEIGHT = 297;
  const PAGE_WIDTH = 210;
  const MARGIN_LEFT = 15;
  const MARGIN_RIGHT = 15;
  const MARGIN_TOP = 15;
  const MARGIN_BOTTOM = 15;
  const USABLE_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
  const LINE_HEIGHT = 7;
  const SECTION_SPACING = 10;
  const SUBSECTION_SPACING = 8;

  // Utility to calculate dynamic column widths
  const calculateColumnWidths = (doc: jsPDF, headers: string[], tableWidth: number): number[] => {
    const minColWidth = 20;
    const textWidths = headers.map(header => doc.getTextWidth(header) + 4);
    const totalTextWidth = textWidths.reduce((sum, w) => sum + w, 0);
    let colWidths: number[];

    if (totalTextWidth > tableWidth) {
      const scaleFactor = tableWidth / totalTextWidth;
      colWidths = textWidths.map(w => Math.max(minColWidth, w * scaleFactor));
    } else {
      const remainingWidth = tableWidth - totalTextWidth;
      const extraPerCol = remainingWidth / headers.length;
      colWidths = textWidths.map(w => w + extraPerCol);
    }

    const sumWidths = colWidths.reduce((sum, w) => sum + w, 0);
    if (Math.abs(sumWidths - tableWidth) > 0.1) {
      const adjustFactor = tableWidth / sumWidths;
      colWidths = colWidths.map(w => w * adjustFactor);
    }

    return colWidths;
  };

  // Utility functions to handle text wrapping and pagination
  const wrapTextLines = (
    doc: jsPDF,
    items: string[],
    marginLeft: number,
    marginRight: number,
    maxWidthRatio = 1
  ): string[] => {
    const maxWidth = (PAGE_WIDTH - marginLeft - marginRight) * maxWidthRatio;
    const lines: string[] = [];
    let currentLine = "";

    items.forEach((item, idx) => {
      const text = idx === items.length - 1 ? item : item + ", ";
      if (doc.getTextWidth(currentLine + text) > maxWidth) {
        if (currentLine) lines.push(currentLine.trim());
        currentLine = text;
      } else {
        currentLine += text;
      }
    });
    if (currentLine) lines.push(currentLine.trim());
    return lines;
  };

  const addTextWithPagination = (
    doc: jsPDF,
    lines: string[],
    x: number,
    y: number,
    usableWidth: number,
    align: "left" | "center" = "left",
    lineHeight = LINE_HEIGHT
  ): number => {
    let cursorY = y;
    for (const line of lines) {
      if (cursorY + lineHeight > PAGE_HEIGHT - MARGIN_BOTTOM) {
        doc.addPage();
        cursorY = MARGIN_TOP;
      }
      doc.text(line, x, cursorY, { maxWidth: usableWidth, align });
      cursorY += lineHeight;
    }
    return cursorY;
  };

  // Add Section Heading
  const addSectionHeading = (doc: jsPDF, title: string, cursorY: number, sectionNumber: string): number => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    if (cursorY + 15 > PAGE_HEIGHT - MARGIN_BOTTOM) {
      doc.addPage();
      cursorY = MARGIN_TOP;
    }
    doc.text(`${sectionNumber}. ${title}`, MARGIN_LEFT, cursorY);
    return cursorY + 15;
  };

  // Add Subsection Heading
  const addSubsectionHeading = (doc: jsPDF, title: string, cursorY: number): number => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    if (cursorY + 10 > PAGE_HEIGHT - MARGIN_BOTTOM) {
      doc.addPage();
      cursorY = MARGIN_TOP;
    }
    doc.text(title, MARGIN_LEFT, cursorY);
    return cursorY + 10;
  };

  // Add Contour Visualization
  const addContourVisualization = (doc: jsPDF, startY: number): number => {
    console.log("addContourVisualization called");

    console.log("visualizationData:", visualizationData);
    console.log("geoJsonData:", geoJsonData);
    console.log("rasterData:", rasterData);

    if (!visualizationData || !visualizationData.png_base64) {
      console.warn("No visualization data or PNG base64 available for contour.");
      return startY;
    }

    let cursorY = startY;

    try {
      // Add section heading for contour visualization
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      if (cursorY > PAGE_HEIGHT - MARGIN_BOTTOM - 15) {
        doc.addPage();
        cursorY = MARGIN_TOP;
      }
      doc.text("2. Groundwater Contour Raster Analysis", MARGIN_LEFT, cursorY);
      cursorY += 15;

      let imgBase64 = visualizationData.png_base64;
      console.log("Original PNG Base64 length:", imgBase64.length);
      if (!imgBase64.startsWith("data:image/png;base64,")) {
        imgBase64 = "data:image/png;base64," + imgBase64;
        console.log("Prepended data prefix to PNG Base64");
      }

      try {
        const imgProps = doc.getImageProperties(imgBase64);
        console.log("Image properties:", imgProps);

        const imgWidth = USABLE_WIDTH;
        const imgHeight = (imgWidth * imgProps.height) / imgProps.width;

        console.log(`Adding image at Y=${cursorY} with width=${imgWidth} and height=${imgHeight}`);

        if (cursorY + imgHeight > PAGE_HEIGHT - MARGIN_BOTTOM) {
          doc.addPage();
          cursorY = MARGIN_TOP;
          console.log("Added new page for the contour image due to space constraints");
        }

        doc.addImage(imgBase64, "PNG", MARGIN_LEFT, cursorY, imgWidth, imgHeight);
        cursorY += imgHeight + SUBSECTION_SPACING;

        console.log("Contour visualization image added successfully");
      } catch (imgError) {
        console.log("Error while adding image to PDF:", imgError);
        console.log("Image data length:", imgBase64.length);
      }
    } catch (error) {
      console.log("Unexpected error in addContourVisualization:", error);
    }

    return cursorY;
  };



  // Add Trend Analysis Table - UPDATED to handle new API structure
  const addTrendAnalysisTable = (doc: jsPDF, startY: number): number => {
    console.log("Adding trend analysis table. TrendData:", finalTrendData);

    // Check if we have trend data from new API structure
    if (!finalTrendData || !finalTrendData.villages || finalTrendData.villages.length === 0) {
      console.log("No trend data available for PDF");
      return startY;
    }

    let cursorY = addSectionHeading(doc, "Trend Analysis", startY, "3");

    const tableStartX = MARGIN_LEFT;
    const tableWidth = USABLE_WIDTH;
    const headers = [
      "Village Name",
      "Location",
      "Trend Status",
      "Tau",
      "P-Value",
      "Sen Slope",
      "Data Points",
      "Years Range"
    ];
    const colWidths = calculateColumnWidths(doc, headers, tableWidth);
    const rowHeight = 8;
    const headerHeight = 10;

    if (cursorY + headerHeight > PAGE_HEIGHT - MARGIN_BOTTOM) {
      doc.addPage();
      cursorY = MARGIN_TOP;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setFillColor(230, 230, 230);
    doc.rect(tableStartX, cursorY - 2, tableWidth, headerHeight, "F");
    doc.setDrawColor(100, 100, 100);
    doc.rect(tableStartX, cursorY - 2, tableWidth, headerHeight);

    let colX = tableStartX;
    for (let i = 0; i < headers.length; i++) {
      doc.text(headers[i], colX + 2, cursorY + 5, { maxWidth: colWidths[i] - 4 });
      if (i < headers.length - 1) {
        doc.line(colX + colWidths[i], cursorY - 2, colX + colWidths[i], cursorY + headerHeight - 2);
      }
      colX += colWidths[i];
    }

    cursorY += headerHeight;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);

    for (let i = 0; i < finalTrendData.villages.length; i++) {
      const village = finalTrendData.villages[i];

      if (cursorY + rowHeight > PAGE_HEIGHT - MARGIN_BOTTOM) {
        doc.addPage();
        cursorY = MARGIN_TOP;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setFillColor(230, 230, 230);
        doc.rect(tableStartX, cursorY - 2, tableWidth, headerHeight, "F");
        doc.setDrawColor(100, 100, 100);
        doc.rect(tableStartX, cursorY - 2, tableWidth, headerHeight);

        colX = tableStartX;
        for (let j = 0; j < headers.length; j++) {
          doc.text(headers[j], colX + 2, cursorY + 5, { maxWidth: colWidths[j] - 4 });
          if (j < headers.length - 1) {
            doc.line(colX + colWidths[j], cursorY - 2, colX + colWidths[j], cursorY + headerHeight - 2);
          }
          colX += colWidths[j];
        }
        cursorY += headerHeight;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
      }

      // Format trend status for better display
      const formatTrendStatus = (status: string): string => {
        if (!status) return "N/A";
        return status.replace("No-Trend", "No Trend").replace("-", " ");
      };

      const rowData = [
        village.Village_Name || "N/A",
        `${village.Block || "N/A"}, ${village.District || "N/A"}`,
        formatTrendStatus(village.Trend_Status),
        village.Mann_Kendall_Tau != null ? village.Mann_Kendall_Tau.toFixed(3) : "N/A",
        village.P_Value != null ? village.P_Value.toFixed(3) : "N/A",
        village.Sen_Slope != null ? village.Sen_Slope.toFixed(3) : "N/A",
        village.Data_Points != null ? village.Data_Points.toString() : "N/A",
        village.Years_Analyzed || "N/A"
      ];

      if (i % 2 === 0) {
        doc.setFillColor(245, 245, 245);
        doc.rect(tableStartX, cursorY, tableWidth, rowHeight, "F");
      }

      doc.setDrawColor(150, 150, 150);
      doc.rect(tableStartX, cursorY, tableWidth, rowHeight);

      colX = tableStartX;
      for (let j = 0; j < rowData.length; j++) {
        let displayText = rowData[j];
        const maxCellWidth = colWidths[j] - 4;

        if (doc.getTextWidth(displayText) > maxCellWidth) {
          while (doc.getTextWidth(displayText + "...") > maxCellWidth && displayText.length > 0) {
            displayText = displayText.slice(0, -1);
          }
          displayText += "...";
        }

        doc.text(displayText, colX + 2, cursorY + 5, { maxWidth: maxCellWidth });
        if (j < rowData.length - 1) {
          doc.line(colX + colWidths[j], cursorY, colX + colWidths[j], cursorY + rowHeight);
        }
        colX += colWidths[j];
      }

      cursorY += rowHeight;
    }

    cursorY += SECTION_SPACING;

    // Add trend summary section
    if (finalTrendData.summary_stats?.trend_distribution) {
      cursorY = addSubsectionHeading(doc, "Trend Summary:", cursorY);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);

      const distribution = finalTrendData.summary_stats.trend_distribution;
      const summaryData = [
        `Total Villages Analyzed: ${distribution.total || 0}`,
        `Increasing Trends (Worsening): ${distribution.increasing || 0}`,
        `Decreasing Trends (Improving): ${distribution.decreasing || 0}`,
        `No Significant Trend: ${distribution.no_trend || 0}`,
        `Insufficient Data: ${distribution.insufficient_data || 0}`,
      ];

      // Add analysis period info
      const analysisInfo = finalTrendData.summary_stats?.file_info;
      if (analysisInfo) {
        summaryData.push(`Analysis Date: ${analysisInfo.analysis_date || 'N/A'}`);
        if (analysisInfo.filtered_by_village_codes && analysisInfo.filtered_by_village_codes.length > 0) {
          summaryData.push(`Villages Filter Applied: ${analysisInfo.filtered_by_village_codes.length} villages`);
        }
      }

      cursorY = addTextWithPagination(doc, summaryData, MARGIN_LEFT, cursorY, USABLE_WIDTH, "left", 6);
    }

    return cursorY + SECTION_SPACING;
  };

  // Add Trend Map Image - UPDATED to handle new API structure
  const addTrendMapImage = (doc: jsPDF, startY: number): number => {
    console.log("Adding trend map image. Checking for base64 data...");

    // Check for trend map base64 data in multiple locations
    const trendMapBase64 =
      finalTrendData?.trend_map_base64 ||
      finalTrendData?.summary_stats?.file_info?.trend_map_base64;

    console.log("Trend map base64 found:", !!trendMapBase64);

    if (!trendMapBase64) {
      console.log("No trend map base64 data found");
      return startY;
    }

    let cursorY = startY;
    try {
      // Ensure base64 string has proper data prefix
      const imgBase64 = trendMapBase64.startsWith('data:') ? trendMapBase64 : `data:image/png;base64,${trendMapBase64}`;
      const imgProps = doc.getImageProperties(imgBase64);
      const imgWidth = USABLE_WIDTH;
      const imgHeight = imgWidth / (imgProps.width / imgProps.height);

      cursorY = addSubsectionHeading(doc, "Trend Analysis Map", cursorY);

      if (cursorY + imgHeight + SUBSECTION_SPACING > PAGE_HEIGHT - MARGIN_BOTTOM) {
        doc.addPage();
        cursorY = MARGIN_TOP;
      }

      doc.addImage(imgBase64, "PNG", MARGIN_LEFT, cursorY, imgWidth, imgHeight);
      cursorY += imgHeight + SECTION_SPACING;

      console.log("Trend map image added successfully");
      return cursorY;
    } catch (error) {
      console.log("Error adding trend map image:", error);
      doc.text("Failed to include trend map image.", MARGIN_LEFT, cursorY);
      return cursorY + SECTION_SPACING;
    }
  };

  // Add Forecast Analysis Table
  const addForecastAnalysisTable = (doc: jsPDF, startY: number): number => {
    if (!forecastData || !forecastData.villages || forecastData.villages.length === 0) {
      return startY;
    }

    let cursorY = addSectionHeading(doc, "Forecast Analysis", startY, "4");

    const tableStartX = MARGIN_LEFT;
    const tableWidth = USABLE_WIDTH;
    const headers = ["Village Name", "Forecasted Values"];

    // ✅ Fixed column widths: village smaller, forecast wider
    const colWidths = [50, tableWidth - 50];

    const rowHeight = 10;
    const headerHeight = 10;

    // Header
    if (cursorY + headerHeight > PAGE_HEIGHT - MARGIN_BOTTOM) {
      doc.addPage();
      cursorY = MARGIN_TOP;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setFillColor(230, 230, 230);
    doc.rect(tableStartX, cursorY - 2, tableWidth, headerHeight, "F");
    doc.setDrawColor(100, 100, 100);
    doc.rect(tableStartX, cursorY - 2, tableWidth, headerHeight);

    let colX = tableStartX;
    for (let i = 0; i < headers.length; i++) {
      doc.text(headers[i], colX + 2, cursorY + 5, { maxWidth: colWidths[i] - 4 });
      if (i < headers.length - 1) {
        doc.line(colX + colWidths[i], cursorY - 2, colX + colWidths[i], cursorY + headerHeight - 2);
      }
      colX += colWidths[i];
    }

    cursorY += headerHeight;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);

    // Rows
    for (let i = 0; i < forecastData.villages.length; i++) {
      const village = forecastData.villages[i];

      if (cursorY + rowHeight > PAGE_HEIGHT - MARGIN_BOTTOM) {
        doc.addPage();
        cursorY = MARGIN_TOP;

        // Redraw header on new page
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setFillColor(230, 230, 230);
        doc.rect(tableStartX, cursorY - 2, tableWidth, headerHeight, "F");
        doc.setDrawColor(100, 100, 100);
        doc.rect(tableStartX, cursorY - 2, tableWidth, headerHeight);

        colX = tableStartX;
        for (let j = 0; j < headers.length; j++) {
          doc.text(headers[j], colX + 2, cursorY + 5, { maxWidth: colWidths[j] - 4 });
          if (j < headers.length - 1) {
            doc.line(colX + colWidths[j], cursorY - 2, colX + colWidths[j], cursorY + headerHeight - 2);
          }
          colX += colWidths[j];
        }
        cursorY += headerHeight;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
      }

      // ✅ Forecast text simplified
      let forecastText = "";
      if (Array.isArray(village.forecast_data?.values)) {
        const years = village.forecast_data.years?.join(", ") || "";
        const values = village.forecast_data.values?.map((v: number) => v.toFixed(2)).join(", ") || "";
        forecastText = years
          .split(", ")
          .map((y: any, idx: string | number) => `${y}: ${values.split(", ")[idx] || "N/A"}`)
          .join(", ");
      } else {
        forecastText = `${village.forecast_data?.year || "N/A"}: ${village.forecast_data?.value?.toFixed(2) || "N/A"}`;
      }

      const rowData = [
        village.village_info?.village || "N/A",
        forecastText,
      ];

      // Zebra striping
      if (i % 2 === 0) {
        doc.setFillColor(245, 245, 245);
        doc.rect(tableStartX, cursorY, tableWidth, rowHeight, "F");
      }

      doc.setDrawColor(150, 150, 150);
      doc.rect(tableStartX, cursorY, tableWidth, rowHeight);

      colX = tableStartX;
      for (let j = 0; j < rowData.length; j++) {
        const cellText = rowData[j];
        const lines = cellText.split("\n");
        const maxCellWidth = colWidths[j] - 4;

        let textY = cursorY + 3;
        lines.forEach((line: any) => {
          let displayText = line;
          if (doc.getTextWidth(displayText) > maxCellWidth) {
            while (doc.getTextWidth(displayText + "...") > maxCellWidth && displayText.length > 0) {
              displayText = displayText.slice(0, -1);
            }
            displayText += "...";
          }
          doc.text(displayText, colX + 2, textY, { maxWidth: maxCellWidth });
          textY += 3;
        });

        if (j < rowData.length - 1) {
          doc.line(colX + colWidths[j], cursorY, colX + colWidths[j], cursorY + rowHeight);
        }
        colX += colWidths[j];
      }

      cursorY += rowHeight;
    }

    cursorY += SECTION_SPACING;

    if (forecastData.total_villages_processed) {
      cursorY = addSubsectionHeading(doc, "Forecast Summary:", cursorY);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      cursorY = addTextWithPagination(
        doc,
        [`Total Villages Processed: ${forecastData.total_villages_processed}`],
        MARGIN_LEFT,
        cursorY,
        USABLE_WIDTH
      );
    }

    return cursorY + SECTION_SPACING;
  };


  // Add Recharge Analysis Table
  const addRechargeAnalysisTable = (doc: jsPDF, startY: number, rechargeData: any[], summaryStats: any): number => {
    if (!rechargeData || rechargeData.length === 0) {
      return startY;
    }

    let cursorY = addSectionHeading(doc, "Recharge Analysis", startY, "5");

    const tableStartX = MARGIN_LEFT;
    const tableWidth = USABLE_WIDTH;
    const allowedColumns = ["village", "SY", "mean_water_fluctuation", "Shape_Area", "recharge"];
    const allFields = rechargeData.length > 0 ? Object.keys(rechargeData[0]).filter(field => allowedColumns.includes(field)) : [];
    const headers = allFields.map(key =>
    ({
      village: "Village",
      SY: "Specific Yield",
      mean_water_fluctuation: "Water Fluctuation (m)",
      Shape_Area: "Shape Area (m²)",
      recharge: "Recharge (m³)",
    }[key] || key.replace(/\_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()))
    );
    const colWidths = calculateColumnWidths(doc, headers, tableWidth);
    const rowHeight = 8;
    const headerHeight = 10;

    if (cursorY + headerHeight > PAGE_HEIGHT - MARGIN_BOTTOM) {
      doc.addPage();
      cursorY = MARGIN_TOP;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setFillColor(230, 230, 230);
    doc.rect(tableStartX, cursorY - 2, tableWidth, headerHeight, "F");
    doc.setDrawColor(100, 100, 100);
    doc.rect(tableStartX, cursorY - 2, tableWidth, headerHeight);

    let colX = tableStartX;
    for (let i = 0; i < headers.length; i++) {
      doc.text(headers[i], colX + 2, cursorY + 5, { maxWidth: colWidths[i] - 4 });
      if (i < headers.length - 1) {
        doc.line(colX + colWidths[i], cursorY - 2, colX + colWidths[i], cursorY + headerHeight - 2);
      }
      colX += colWidths[i];
    }

    cursorY += headerHeight;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);

    const formatValue = (key: string, val: any): string => {
      if (val === null || val === undefined || val === "") return "N/A";
      if (typeof val === "number") {
        switch (key) {
          case "SY":
            return val.toFixed(3);
          case "mean_water_fluctuation":
            return `${val.toFixed(2)} m`;
          case "Shape_Area":
            return val.toLocaleString(undefined, { maximumFractionDigits: 0 });
          case "recharge":
            return val.toLocaleString(undefined, { maximumFractionDigits: 2 });
          default:
            return val.toString();
        }
      }
      return String(val);
    };

    for (let i = 0; i < rechargeData.length; i++) {
      if (cursorY + rowHeight > PAGE_HEIGHT - MARGIN_BOTTOM) {
        doc.addPage();
        cursorY = MARGIN_TOP;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setFillColor(230, 230, 230);
        doc.rect(tableStartX, cursorY - 2, tableWidth, headerHeight, "F");
        doc.setDrawColor(100, 100, 100);
        doc.rect(tableStartX, cursorY - 2, tableWidth, headerHeight);

        colX = tableStartX;
        for (let j = 0; j < headers.length; j++) {
          doc.text(headers[j], colX + 2, cursorY + 5, { maxWidth: colWidths[j] - 4 });
          if (j < headers.length - 1) {
            doc.line(colX + colWidths[j], cursorY - 2, colX + colWidths[j], cursorY + headerHeight - 2);
          }
          colX += colWidths[j];
        }
        cursorY += headerHeight;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
      }

      if (i % 2 === 0) {
        doc.setFillColor(245, 245, 245);
        doc.rect(tableStartX, cursorY, tableWidth, rowHeight, "F");
      }

      doc.setDrawColor(150, 150, 150);
      doc.rect(tableStartX, cursorY, tableWidth, rowHeight);

      colX = tableStartX;
      for (let j = 0; j < allFields.length; j++) {
        const field = allFields[j];
        const val = formatValue(field, rechargeData[i][field]);
        let displayText = val;
        const maxCellWidth = colWidths[j] - 4;

        if (doc.getTextWidth(displayText) > maxCellWidth) {
          while (doc.getTextWidth(displayText + "...") > maxCellWidth && displayText.length > 0) {
            displayText = displayText.slice(0, -1);
          }
          displayText += "...";
        }
        doc.text(displayText, colX + 2, cursorY + 5, { maxWidth: maxCellWidth });
        if (j < allFields.length - 1) {
          doc.line(colX + colWidths[j], cursorY, colX + colWidths[j], cursorY + rowHeight);
        }
        colX += colWidths[j];
      }
      cursorY += rowHeight;
    }

    cursorY += SECTION_SPACING;

    cursorY = addSubsectionHeading(doc, "Recharge Summary:", cursorY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const summaryData = [
      `Total Villages: ${summaryStats?.totalVillages || 0}`,
      `Total Recharge: ${summaryStats?.totalRecharge?.toLocaleString(undefined, { maximumFractionDigits: 2 }) || "0.00"} m³`,
      `Average Water Fluctuation: ${summaryStats?.averageWaterFluctuation?.toFixed(2) || "0.00"} m`,
    ];
    cursorY = addTextWithPagination(doc, summaryData, MARGIN_LEFT, cursorY, USABLE_WIDTH, "left", 6);

    return cursorY + SECTION_SPACING;
  };

  // Add Domestic Demand Table
  const addDomesticDemandTable = (doc: jsPDF, startY: number, perCapita: number): number => {
    let cursorY = addSectionHeading(doc, "Domestic Demand Analysis", startY, "6");

    cursorY = addSubsectionHeading(doc, "User Selected Per Capita Consumption:", cursorY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    cursorY = addTextWithPagination(doc, [`${perCapita} LPCD`], MARGIN_LEFT, cursorY, USABLE_WIDTH);
    cursorY += SUBSECTION_SPACING;

    if (!domesticTableData || domesticTableData.length === 0) {
      return cursorY;
    }

    const tableStartX = MARGIN_LEFT;
    const tableWidth = USABLE_WIDTH;
    const headers = ["Village Name", "Demand (m³)", "Population", "Target Year", "LPCD"];
    const colWidths = calculateColumnWidths(doc, headers, tableWidth);
    const rowHeight = 8;
    const headerHeight = 10;

    if (cursorY + headerHeight > PAGE_HEIGHT - MARGIN_BOTTOM) {
      doc.addPage();
      cursorY = MARGIN_TOP;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setFillColor(230, 230, 230);
    doc.rect(tableStartX, cursorY - 2, tableWidth, headerHeight, "F");
    doc.setDrawColor(100, 100, 100);
    doc.rect(tableStartX, cursorY - 2, tableWidth, headerHeight);

    let colX = tableStartX;
    for (let i = 0; i < headers.length; i++) {
      doc.text(headers[i], colX + 2, cursorY + 5, { maxWidth: colWidths[i] - 4 });
      if (i < headers.length - 1) {
        doc.line(colX + colWidths[i], cursorY - 2, colX + colWidths[i], cursorY + headerHeight - 2);
      }
      colX += colWidths[i];
    }

    cursorY += headerHeight;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);

    for (let i = 0; i < domesticTableData.length; i++) {
      const row = domesticTableData[i];

      if (cursorY + rowHeight > PAGE_HEIGHT - MARGIN_BOTTOM) {
        doc.addPage();
        cursorY = MARGIN_TOP;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setFillColor(230, 230, 230);
        doc.rect(tableStartX, cursorY - 2, tableWidth, headerHeight, "F");
        doc.setDrawColor(100, 100, 100);
        doc.rect(tableStartX, cursorY - 2, tableWidth, headerHeight);

        colX = tableStartX;
        for (let j = 0; j < headers.length; j++) {
          doc.text(headers[j], colX + 2, cursorY + 5, { maxWidth: colWidths[j] - 4 });
          if (j < headers.length - 1) {
            doc.line(colX + colWidths[j], cursorY - 2, colX + colWidths[j], cursorY + headerHeight - 2);
          }
          colX += colWidths[j];
        }
        cursorY += headerHeight;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
      }

      const rowData = [
        row.village_name || "N/A",
        row.demand_mld ? Number(row.demand_mld).toFixed(2) : "N/A",
        row.forecast_population || "N/A",
        row.target_year || "N/A",
        row.lpcd || "N/A",
      ];

      if (i % 2 === 0) {
        doc.setFillColor(245, 245, 245);
        doc.rect(tableStartX, cursorY, tableWidth, rowHeight, "F");
      }

      doc.setDrawColor(150, 150, 150);
      doc.rect(tableStartX, cursorY, tableWidth, rowHeight);

      colX = tableStartX;
      for (let j = 0; j < rowData.length; j++) {
        let displayText = String(rowData[j]);
        const maxCellWidth = colWidths[j] - 4;

        if (doc.getTextWidth(displayText) > maxCellWidth) {
          while (doc.getTextWidth(displayText + "...") > maxCellWidth && displayText.length > 0) {
            displayText = displayText.slice(0, -1);
          }
          displayText += "...";
        }

        doc.text(displayText, colX + 2, cursorY + 5, { maxWidth: maxCellWidth });
        if (j < rowData.length - 1) {
          doc.line(colX + colWidths[j], cursorY, colX + colWidths[j], cursorY + rowHeight);
        }
        colX += colWidths[j];
      }

      cursorY += rowHeight;
    }

    cursorY += SECTION_SPACING;

    cursorY = addSubsectionHeading(doc, "Domestic Demand Summary:", cursorY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const totalDemand = domesticTableData.reduce((sum, row) => sum + (Number(row.demand_mld) || 0), 0);
    const summaryData = [
      `Total Villages: ${domesticTableData.length}`,
      `Total Demand: ${totalDemand.toFixed(2)} m³`,
    ];
    cursorY = addTextWithPagination(doc, summaryData, MARGIN_LEFT, cursorY, USABLE_WIDTH, "left", 6);

    return cursorY + SECTION_SPACING;
  };

  // Add Agricultural Demand Table
  const addAgriculturalDemandTable = (doc: jsPDF, startY: number, selectedCrops: any): number => {
    let cursorY = addSectionHeading(doc, "Agricultural Demand Analysis", startY, "7");

    const seasons = ['Kharif', 'Rabi', 'Zaid'];
    seasons.forEach(season => {
      if (selectedCrops[season] && selectedCrops[season].length > 0) {
        cursorY = addSubsectionHeading(doc, `${season} Selected Crops:`, cursorY);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        const cropLines = wrapTextLines(doc, selectedCrops[season], MARGIN_LEFT, MARGIN_RIGHT);
        cursorY = addTextWithPagination(doc, cropLines, MARGIN_LEFT, cursorY, USABLE_WIDTH, "left", 6);
        cursorY += SUBSECTION_SPACING;
      }
    });

    if (!agriculturalTableData || agriculturalTableData.length === 0) {
      return cursorY;
    }

    const tableStartX = MARGIN_LEFT;
    const tableWidth = USABLE_WIDTH;
    const headers = ["Village Name", "Cropland (m²)", "Demand (m³)"];
    const colWidths = calculateColumnWidths(doc, headers, tableWidth);
    const rowHeight = 8;
    const headerHeight = 10;

    if (cursorY + headerHeight > PAGE_HEIGHT - MARGIN_BOTTOM) {
      doc.addPage();
      cursorY = MARGIN_TOP;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setFillColor(230, 230, 230);
    doc.rect(tableStartX, cursorY - 2, tableWidth, headerHeight, "F");
    doc.setDrawColor(100, 100, 100);
    doc.rect(tableStartX, cursorY - 2, tableWidth, headerHeight);

    let colX = tableStartX;
    for (let i = 0; i < headers.length; i++) {
      doc.text(headers[i], colX + 2, cursorY + 5, { maxWidth: colWidths[i] - 4 });
      if (i < headers.length - 1) {
        doc.line(colX + colWidths[i], cursorY - 2, colX + colWidths[i], cursorY + headerHeight - 2);
      }
      colX += colWidths[i];
    }

    cursorY += headerHeight;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);

    for (let i = 0; i < agriculturalTableData.length; i++) {
      const row = agriculturalTableData[i];

      if (cursorY + rowHeight > PAGE_HEIGHT - MARGIN_BOTTOM) {
        doc.addPage();
        cursorY = MARGIN_TOP;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setFillColor(230, 230, 230);
        doc.rect(tableStartX, cursorY - 2, tableWidth, headerHeight, "F");
        doc.setDrawColor(100, 100, 100);
        doc.rect(tableStartX, cursorY - 2, tableWidth, headerHeight);

        colX = tableStartX;
        for (let j = 0; j < headers.length; j++) {
          doc.text(headers[j], colX + 2, cursorY + 5, { maxWidth: colWidths[j] - 4 });
          if (j < headers.length - 1) {
            doc.line(colX + colWidths[j], cursorY - 2, colX + colWidths[j], cursorY + headerHeight - 2);
          }
          colX += colWidths[j];
        }
        cursorY += headerHeight;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
      }

      const rowData = [
        row.village || "N/A",
        row.cropland ? Number(row.cropland).toLocaleString() : "N/A",
        row.village_demand ? Number(row.village_demand).toFixed(3) : "N/A",
      ];

      if (i % 2 === 0) {
        doc.setFillColor(245, 245, 245);
        doc.rect(tableStartX, cursorY, tableWidth, rowHeight, "F");
      }

      doc.setDrawColor(150, 150, 150);
      doc.rect(tableStartX, cursorY, tableWidth, rowHeight);

      colX = tableStartX;
      for (let j = 0; j < rowData.length; j++) {
        let displayText = String(rowData[j]);
        const maxCellWidth = colWidths[j] - 4;

        if (doc.getTextWidth(displayText) > maxCellWidth) {
          while (doc.getTextWidth(displayText + "...") > maxCellWidth && displayText.length > 0) {
            displayText = displayText.slice(0, -1);
          }
          displayText += "...";
        }

        doc.text(displayText, colX + 2, cursorY + 5, { maxWidth: maxCellWidth });
        if (j < rowData.length - 1) {
          doc.line(colX + colWidths[j], cursorY, colX + colWidths[j], cursorY + rowHeight);
        }
        colX += colWidths[j];
      }

      cursorY += rowHeight;
    }

    cursorY += SECTION_SPACING;

    cursorY = addSubsectionHeading(doc, "Agricultural Demand Summary:", cursorY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    let summaryData: string[];
    if (chartData?.summary_stats) {
      const stats = chartData.summary_stats;
      summaryData = [
        `Total Villages: ${stats.total_villages}`,
        `Total Demand: ${stats.total_demand_cubic_meters.toLocaleString()} m³`,
        `Average per Village: ${stats.average_demand_per_village.toFixed(2)} m³`,
      ];
    } else {
      const totalDemand = agriculturalTableData.reduce((sum, row) => sum + (Number(row.village_demand) || 0), 0);
      summaryData = [
        `Total Villages: ${agriculturalTableData.length}`,
        `Total Demand: ${totalDemand.toFixed(2)} m³`,
      ];
    }
    cursorY = addTextWithPagination(doc, summaryData, MARGIN_LEFT, cursorY, USABLE_WIDTH, "left", 6);

    return cursorY + SECTION_SPACING;
  };

  // Add Industrial Demand Table
  const addIndustrialDemandTable = (doc: jsPDF, startY: number): number => {
    if (!industrialTableData || industrialTableData.length === 0) {
      return startY;
    }

    let cursorY = addSectionHeading(doc, "Industrial Demand Analysis", startY, "8");

    const tableStartX = MARGIN_LEFT;
    const tableWidth = USABLE_WIDTH;
    const firstRow = industrialTableData[0];
    const allFields = firstRow ? Object.keys(firstRow) : [];
    const headers = allFields.map(field => field.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()));
    const colWidths = calculateColumnWidths(doc, headers, tableWidth);
    const rowHeight = 8;
    const headerHeight = 10;

    if (cursorY + headerHeight > PAGE_HEIGHT - MARGIN_BOTTOM) {
      doc.addPage();
      cursorY = MARGIN_TOP;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setFillColor(230, 230, 230);
    doc.rect(tableStartX, cursorY - 2, tableWidth, headerHeight, "F");
    doc.setDrawColor(100, 100, 100);
    doc.rect(tableStartX, cursorY - 2, tableWidth, headerHeight);

    let colX = tableStartX;
    for (let i = 0; i < headers.length; i++) {
      doc.text(headers[i], colX + 2, cursorY + 5, { maxWidth: colWidths[i] - 4 });
      if (i < headers.length - 1) {
        doc.line(colX + colWidths[i], cursorY - 2, colX + colWidths[i], cursorY + headerHeight - 2);
      }
      colX += colWidths[i];
    }

    cursorY += headerHeight;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);

    for (let i = 0; i < industrialTableData.length; i++) {
      const row = industrialTableData[i];

      if (cursorY + rowHeight > PAGE_HEIGHT - MARGIN_BOTTOM) {
        doc.addPage();
        cursorY = MARGIN_TOP;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setFillColor(230, 230, 230);
        doc.rect(tableStartX, cursorY - 2, tableWidth, headerHeight, "F");
        doc.setDrawColor(100, 100, 100);
        doc.rect(tableStartX, cursorY - 2, tableWidth, headerHeight);

        colX = tableStartX;
        for (let j = 0; j < headers.length; j++) {
          doc.text(headers[j], colX + 2, cursorY + 5, { maxWidth: colWidths[j] - 4 });
          if (j < headers.length - 1) {
            doc.line(colX + colWidths[j], cursorY - 2, colX + colWidths[j], cursorY + headerHeight - 2);
          }
          colX += colWidths[j];
        }
        cursorY += headerHeight;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
      }

      if (i % 2 === 0) {
        doc.setFillColor(245, 245, 245);
        doc.rect(tableStartX, cursorY, tableWidth, rowHeight, "F");
      }

      doc.setDrawColor(150, 150, 150);
      doc.rect(tableStartX, cursorY, tableWidth, rowHeight);

      colX = tableStartX;
      for (let j = 0; j < allFields.length; j++) {
        const field = allFields[j];
        let displayText = String(row[field] || "N/A");
        const maxCellWidth = colWidths[j] - 4;

        if (doc.getTextWidth(displayText) > maxCellWidth) {
          while (doc.getTextWidth(displayText + "...") > maxCellWidth && displayText.length > 0) {
            displayText = displayText.slice(0, -1);
          }
          displayText += "...";
        }

        doc.text(displayText, colX + 2, cursorY + 5, { maxWidth: maxCellWidth });
        if (j < allFields.length - 1) {
          doc.line(colX + colWidths[j], cursorY, colX + colWidths[j], cursorY + rowHeight);
        }
        colX += colWidths[j];
      }

      cursorY += rowHeight;
    }

    cursorY += SECTION_SPACING;

    cursorY = addSubsectionHeading(doc, "Industrial Demand Summary:", cursorY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    cursorY = addTextWithPagination(
      doc,
      [`Total Records: ${industrialTableData.length}`],
      MARGIN_LEFT,
      cursorY,
      USABLE_WIDTH,
      "left",
      6
    );

    return cursorY + SECTION_SPACING;
  };

  // Add GSR Analysis Table
  const addGSRAnalysisTable = (doc: jsPDF, startY: number): number => {
    if (!gsrTableData || gsrTableData.length === 0) {
      return startY;
    }

    let cursorY = addSectionHeading(doc, "GSR Analysis", startY, "9");

    const tableStartX = MARGIN_LEFT;
    const tableWidth = USABLE_WIDTH;
    const visibleColumns = [
      'village_name',
      'recharge',
      'total_demand',
      'gsr',
      'trend_status',
      'gsr_classification',
    ];
    const headers = [
      'Village Name',
      'Recharge (m³)',
      'Total Demand (m³)',
      'GSR Ratio',
      'Trend Status',
      'GSR Classification',
    ];
    const colWidths = calculateColumnWidths(doc, headers, tableWidth);
    const rowHeight = 8;
    const headerHeight = 10;

    if (cursorY + headerHeight > PAGE_HEIGHT - MARGIN_BOTTOM) {
      doc.addPage();
      cursorY = MARGIN_TOP;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setFillColor(230, 230, 230);
    doc.rect(tableStartX, cursorY - 2, tableWidth, headerHeight, "F");
    doc.setDrawColor(100, 100, 100);
    doc.rect(tableStartX, cursorY - 2, tableWidth, headerHeight);

    let colX = tableStartX;
    for (let i = 0; i < headers.length; i++) {
      doc.text(headers[i], colX + 2, cursorY + 5, { maxWidth: colWidths[i] - 4 });
      if (i < headers.length - 1) {
        doc.line(colX + colWidths[i], cursorY - 2, colX + colWidths[i], cursorY + headerHeight - 2);
      }
      colX += colWidths[i];
    }

    cursorY += headerHeight;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);

    for (let i = 0; i < gsrTableData.length; i++) {
      const row = gsrTableData[i];

      if (cursorY + rowHeight > PAGE_HEIGHT - MARGIN_BOTTOM) {
        doc.addPage();
        cursorY = MARGIN_TOP;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setFillColor(230, 230, 230);
        doc.rect(tableStartX, cursorY - 2, tableWidth, headerHeight, "F");
        doc.setDrawColor(100, 100, 100);
        doc.rect(tableStartX, cursorY - 2, tableWidth, headerHeight);

        colX = tableStartX;
        for (let j = 0; j < headers.length; j++) {
          doc.text(headers[j], colX + 2, cursorY + 5, { maxWidth: colWidths[j] - 4 });
          if (j < headers.length - 1) {
            doc.line(colX + colWidths[j], cursorY - 2, colX + colWidths[j], cursorY + headerHeight - 2);
          }
          colX += colWidths[j];
        }
        cursorY += headerHeight;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
      }

      const rowData = visibleColumns.map((col) => {
        if (col === 'recharge' || col === 'total_demand') {
          return row[col] ? Number(row[col]).toFixed(3) : "N/A";
        } else if (col === 'gsr') {
          return row[col] ? Number(row[col]).toFixed(4) : "N/A";
        } else {
          return (row as any)[col] || "N/A";

        }
      });

      if (i % 2 === 0) {
        doc.setFillColor(245, 245, 245);
        doc.rect(tableStartX, cursorY, tableWidth, rowHeight, "F");
      }

      doc.setDrawColor(150, 150, 150);
      doc.rect(tableStartX, cursorY, tableWidth, rowHeight);

      colX = tableStartX;
      for (let j = 0; j < rowData.length; j++) {
        let displayText = String(rowData[j]);
        const maxCellWidth = colWidths[j] - 4;

        if (doc.getTextWidth(displayText) > maxCellWidth) {
          while (doc.getTextWidth(displayText + "...") > maxCellWidth && displayText.length > 0) {
            displayText = displayText.slice(0, -1);
          }
          displayText += "...";
        }

        doc.text(displayText, colX + 2, cursorY + 5, { maxWidth: maxCellWidth });
        if (j < rowData.length - 1) {
          doc.line(colX + colWidths[j], cursorY, colX + colWidths[j], cursorY + rowHeight);
        }
        colX += colWidths[j];
      }

      cursorY += rowHeight;
    }

    cursorY += SECTION_SPACING;

    cursorY = addSubsectionHeading(doc, "GSR Summary:", cursorY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const totalVillages = gsrTableData.length;
    const totalRecharge = gsrTableData.reduce((sum, row) => sum + (Number(row.recharge) || 0), 0);
    const totalDemand = gsrTableData.reduce((sum, row) => sum + (Number(row.total_demand) || 0), 0);
    const averageGSR = gsrTableData.reduce((sum, row) => sum + (Number(row.gsr) || 0), 0) / (totalVillages || 1);
    const summaryData = [
      `Total Villages: ${totalVillages}`,
      `Total Recharge: ${totalRecharge.toLocaleString(undefined, { maximumFractionDigits: 2 })} m³`,
      `Total Demand: ${totalDemand.toLocaleString(undefined, { maximumFractionDigits: 2 })} m³`,
      `Average GSR Ratio: ${averageGSR.toFixed(4)}`,
    ];
    cursorY = addTextWithPagination(doc, summaryData, MARGIN_LEFT, cursorY, USABLE_WIDTH, "left", 6);

    return cursorY + SECTION_SPACING;
  };

  // Add GSR Map Image
  const addGSRMapImage = (doc: jsPDF, startY: number): number => {
    if (!mapImageBase64) {
      return startY;
    }

    let cursorY = startY;
    try {
      const imgProps = doc.getImageProperties(mapImageBase64);
      const imgWidth = USABLE_WIDTH;
      const imgHeight = imgWidth / (imgProps.width / imgProps.height);

      cursorY = addSubsectionHeading(doc, "GSR Analysis Map", cursorY);

      if (cursorY + imgHeight + SUBSECTION_SPACING > PAGE_HEIGHT - MARGIN_BOTTOM) {
        doc.addPage();
        cursorY = MARGIN_TOP;
      }

      doc.addImage(mapImageBase64, "PNG", MARGIN_LEFT, cursorY, imgWidth, imgHeight);
      cursorY += imgHeight + SECTION_SPACING;

      return cursorY;
    } catch (error) {
      console.log("Error adding GSR map image:", error);
      return cursorY + SECTION_SPACING;
    }
  };

  // Add Stress Identification Analysis Table
  const addStressAnalysisTable = (doc: jsPDF, startY: number): number => {
    if (!stressTableData || stressTableData.length === 0) {
      return startY;
    }

    let cursorY = addSectionHeading(doc, "Stress Identification Analysis", startY, "10");

    const tableStartX = MARGIN_LEFT;
    const tableWidth = USABLE_WIDTH;
    const visibleColumns = [
      'village_name',
      'recharge',
      'total_demand',
      'injection',
      'stress_value',
    ];
    const headers = [
      'Village Name',
      'Recharge (m³)',
      'Total Demand (m³)',
      'Injection',
      'Stress Value',
    ];
    const colWidths = calculateColumnWidths(doc, headers, tableWidth);
    const rowHeight = 8;
    const headerHeight = 10;

    if (cursorY + headerHeight > PAGE_HEIGHT - MARGIN_BOTTOM) {
      doc.addPage();
      cursorY = MARGIN_TOP;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setFillColor(230, 230, 230);
    doc.rect(tableStartX, cursorY - 2, tableWidth, headerHeight, "F");
    doc.setDrawColor(100, 100, 100);
    doc.rect(tableStartX, cursorY - 2, tableWidth, headerHeight);

    let colX = tableStartX;
    for (let i = 0; i < headers.length; i++) {
      doc.text(headers[i], colX + 2, cursorY + 5, { maxWidth: colWidths[i] - 4 });
      if (i < headers.length - 1) {
        doc.line(colX + colWidths[i], cursorY - 2, colX + colWidths[i], cursorY + headerHeight - 2);
      }
      colX += colWidths[i];
    }

    cursorY += headerHeight;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);

    for (let i = 0; i < stressTableData.length; i++) {
      const row = stressTableData[i];

      if (cursorY + rowHeight > PAGE_HEIGHT - MARGIN_BOTTOM) {
        doc.addPage();
        cursorY = MARGIN_TOP;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setFillColor(230, 230, 230);
        doc.rect(tableStartX, cursorY - 2, tableWidth, headerHeight, "F");
        doc.setDrawColor(100, 100, 100);
        doc.rect(tableStartX, cursorY - 2, tableWidth, headerHeight);

        colX = tableStartX;
        for (let j = 0; j < headers.length; j++) {
          doc.text(headers[j], colX + 2, cursorY + 5, { maxWidth: colWidths[j] - 4 });
          if (j < headers.length - 1) {
            doc.line(colX + colWidths[j], cursorY - 2, colX + colWidths[j], cursorY + headerHeight - 2);
          }
          colX += colWidths[j];
        }
        cursorY += headerHeight;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
      }

      const rowData = visibleColumns.map((col) => {
        if (['recharge', 'total_demand', 'injection', 'stress_value'].includes(col)) {
          return row[col] ? Number(row[col]).toFixed(4) : "N/A";
        } else {
          return row[col] || "N/A";
        }
      });

      if (i % 2 === 0) {
        doc.setFillColor(245, 245, 245);
        doc.rect(tableStartX, cursorY, tableWidth, rowHeight, "F");
      }

      doc.setDrawColor(150, 150, 150);
      doc.rect(tableStartX, cursorY, tableWidth, rowHeight);

      colX = tableStartX;
      for (let j = 0; j < rowData.length; j++) {
        let displayText = String(rowData[j]);
        const maxCellWidth = colWidths[j] - 4;

        if (doc.getTextWidth(displayText) > maxCellWidth) {
          while (doc.getTextWidth(displayText + "...") > maxCellWidth && displayText.length > 0) {
            displayText = displayText.slice(0, -1);
          }
          displayText += "...";
        }

        doc.text(displayText, colX + 2, cursorY + 5, { maxWidth: maxCellWidth });
        if (j < rowData.length - 1) {
          doc.line(colX + colWidths[j], cursorY, colX + colWidths[j], cursorY + rowHeight);
        }
        colX += colWidths[j];
      }

      cursorY += rowHeight;
    }

    cursorY += SECTION_SPACING;

    cursorY = addSubsectionHeading(doc, "Stress Identification Summary:", cursorY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const totalVillages = stressTableData.length;
    const totalStressValue = stressTableData.reduce((sum, row) => sum + (Number(row.stress_value) || 0), 0);
    const averageStressValue = totalStressValue / (totalVillages || 1);
    const summaryData = [
      `Total Villages: ${totalVillages}`,
      `Average Stress Value: ${averageStressValue.toFixed(4)}`,
    ];
    cursorY = addTextWithPagination(doc, summaryData, MARGIN_LEFT, cursorY, USABLE_WIDTH, "left", 6);

    return cursorY + SECTION_SPACING;
  };

  const computeSummaryStats = (tableData: any[]) => {
    if (!tableData || tableData.length === 0) return null;
    const totalRecharge = tableData.reduce((sum, row) => {
      const recharge = parseFloat(String(row.recharge || 0));
      return sum + (isNaN(recharge) ? 0 : recharge);
    }, 0);
    const avgWaterFluctuation =
      tableData.reduce((sum, row) => {
        const fluctuation = parseFloat(String(row.mean_water_fluctuation || 0));
        return sum + (isNaN(fluctuation) ? 0 : fluctuation);
      }, 0) / tableData.length;
    return {
      totalVillages: tableData.length,
      totalRecharge,
      averageWaterFluctuation: avgWaterFluctuation,
    };
  };

  const generateLocalPDFReport = async (imageBase64?: string) => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      let cursorY = MARGIN_TOP;

      // Title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      cursorY = addTextWithPagination(
        doc,
        ["Groundwater Assessment Report"],
        MARGIN_LEFT,
        cursorY,
        USABLE_WIDTH,
        "left",
        LINE_HEIGHT + 2
      );
      cursorY += SECTION_SPACING;

      // Timestamp
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(12);
      cursorY = addTextWithPagination(
        doc,
        [`Generated on: ${new Date().toLocaleString()}`],
        MARGIN_LEFT,
        cursorY,
        USABLE_WIDTH
      );
      cursorY += SECTION_SPACING;

      // Selected Location Details
      cursorY = addSectionHeading(doc, "Location Summary", cursorY, "1");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      cursorY = addTextWithPagination(doc, ["Selected Location Details:"], MARGIN_LEFT, cursorY, USABLE_WIDTH);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);

      // River
      const riverName = rivers.find((r) => r.code === selectedRiver)?.name || "None";
      cursorY = addTextWithPagination(doc, [`River: ${riverName}`], MARGIN_LEFT, cursorY, USABLE_WIDTH);
      cursorY += SUBSECTION_SPACING;

      // Stretch
      const stretchName = stretches.find((s) => s.stretchId === selectedStretch)?.name || "None";
      cursorY = addTextWithPagination(
        doc,
        [`Stretch: ${stretchName}${selectedStretch ? ` (ID: ${selectedStretch})` : ''}`],
        MARGIN_LEFT,
        cursorY,
        USABLE_WIDTH
      );
      cursorY += SUBSECTION_SPACING;

      // Drain
      const drainText = selectedDrain ? `Drain ${selectedDrain}` : "None";
      cursorY = addTextWithPagination(
        doc,
        [`Drain: ${drainText}${selectedDrain ? ` (No: ${selectedDrain})` : ''}`],
        MARGIN_LEFT,
        cursorY,
        USABLE_WIDTH
      );
      cursorY += SUBSECTION_SPACING;

      // Catchments
      const catchmentsText = selectedCatchments.length > 0
        ? selectedCatchments.length === catchments.length
          ? "All Catchments"
          : catchments
            .filter((c) => selectedCatchments.includes(Number(c.objectId)))
            .map((c) => c.name)
            .join(", ")
        : "None";
      cursorY = addTextWithPagination(doc, [`Catchments: ${catchmentsText}`], MARGIN_LEFT, cursorY, USABLE_WIDTH);
      if (selectedCatchments.length > 0) {
        const catchmentsIds = `Object IDs: ${selectedCatchments.join(", ")}`;
        cursorY = addTextWithPagination(doc, [catchmentsIds], MARGIN_LEFT + 10, cursorY, USABLE_WIDTH - 10);
      }
      cursorY += SUBSECTION_SPACING;

      // Villages
      const villagesText = selectedVillages.length > 0
        ? selectedVillages.length === villages.length
          ? "All Villages"
          : villages
            .filter((v) => selectedVillages.includes(Number(v.code)))
            .map((v) => v.name)
            .join(", ")
        : "None";
      cursorY = addTextWithPagination(doc, [`Villages: ${villagesText}`], MARGIN_LEFT, cursorY, USABLE_WIDTH);
      cursorY += SUBSECTION_SPACING;

      // Wells count
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      cursorY = addTextWithPagination(doc, ["Selected Wells Count:"], MARGIN_LEFT, cursorY, USABLE_WIDTH);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      cursorY = addTextWithPagination(doc, [String(wellsData.length)], MARGIN_LEFT, cursorY, USABLE_WIDTH);
      cursorY += SUBSECTION_SPACING;

      // Add the base64 image if provided
      if (imageBase64) {
        try {
          const base64Data = imageBase64.replace(/^data:image\/png;base64,/, '');
          const imgProps = doc.getImageProperties(`data:image/png;base64,${base64Data}`);
          const imgWidth = USABLE_WIDTH;
          const imgHeight = imgWidth / (imgProps.width / imgProps.height);

          if (cursorY + imgHeight > PAGE_HEIGHT - MARGIN_BOTTOM) {
            doc.addPage();
            cursorY = MARGIN_TOP;
          }
          doc.addImage(base64Data, 'PNG', MARGIN_LEFT, cursorY, imgWidth, imgHeight);
          cursorY += imgHeight + SECTION_SPACING;
        } catch (error) {
          console.log('Error adding location map image to PDF:', error);
          cursorY = addTextWithPagination(
            doc,
            ['Failed to include location map image.'],
            MARGIN_LEFT,
            cursorY,
            USABLE_WIDTH
          );
          cursorY += SECTION_SPACING;
        }
      }

      // Add analysis sections
      const summaryStats = computeSummaryStats(tableData);
      cursorY = addContourVisualization(doc, cursorY);
      cursorY = addTrendAnalysisTable(doc, cursorY);
      cursorY = addTrendMapImage(doc, cursorY);
      cursorY = addForecastAnalysisTable(doc, cursorY);
      cursorY = addRechargeAnalysisTable(doc, cursorY, tableData, summaryStats);
      cursorY = addDomesticDemandTable(doc, cursorY, perCapitaConsumption);
      cursorY = addAgriculturalDemandTable(doc, cursorY, selectedCrops);
      cursorY = addIndustrialDemandTable(doc, cursorY);
      cursorY = addGSRAnalysisTable(doc, cursorY);
      cursorY = addGSRMapImage(doc, cursorY);
      cursorY = addStressAnalysisTable(doc, cursorY);

      const fileName = `Groundwater_Assessment_Report_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);

      console.log('Local PDF report generated successfully');
    } catch (error) {
      console.log('Error generating local PDF report:', error);
      alert('Error generating local PDF report. Please try again.');
    }
  };

  const handleDownload = async () => {
    try {
      setGenerating(true);
      console.log('Initiating API PDF generation...');
      const result = await generatePDFReport();

      if (result && result.success && result.data) {
        const { filename, imageBase64 } = result.data;

        // Trigger local PDF generation with the image
        await generateLocalPDFReport(imageBase64);
      } else {
        throw new Error(result?.error || result?.message || 'API PDF generation failed');
      }
    } catch (error) {
      console.log('Error during PDF generation:', error);
      alert(`Error generating PDF report: ${pdfGenerationError || 'Please try again.'}`);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <button
      onClick={handleDownload}
      disabled={generating}
      className={[
        "inline-flex items-center justify-center gap-2 text-white font-semibold transition-colors duration-300 ease-in-out",
        generating
          ? "bg-gray-400 cursor-not-allowed rounded-full px-6 py-3"
          : "bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 shadow-md focus:outline-none focus:ring-4 focus:ring-green-400 focus:ring-opacity-50 rounded-full px-6 py-3",
      ].join(" ")}
    >
      {generating ? (
        <>
          <svg
            className="animate-spin -ml-1 mr-2 h-5 w-5 text-white"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span>Downloading Report...</span>
        </>
      ) : (
        <>
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 001 0 2-2v-6a2 2 0 00-2-2z"
            />
          </svg>
          <span>Download Report</span>
        </>
      )}
    </button>

  );
};

export default PDF;