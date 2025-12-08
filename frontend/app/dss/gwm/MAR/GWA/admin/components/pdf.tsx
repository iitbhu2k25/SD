// /app/dss/GWM/MAR/GWA/admin/components/pdf.tsx
"use client";

import React, { useState, useContext } from "react";
import jsPDF from "jspdf";
import { useLocation } from "@/contexts/groundwater_assessment/admin/LocationContext";
import { usePDF } from "@/contexts/groundwater_assessment/admin/PDFContext";
import { useWell } from "@/contexts/groundwater_assessment/admin/WellContext";
import { GroundwaterTrendContext } from "@/contexts/groundwater_assessment/admin/TrendContext";
import { GroundwaterForecastContext } from "@/contexts/groundwater_assessment/admin/ForecastContext";
import { useRecharge } from "@/contexts/groundwater_assessment/admin/RechargeContext";
import { useDemand } from "@/contexts/groundwater_assessment/admin/DemandContext";
import { useGSR } from "@/contexts/groundwater_assessment/admin/GSRContext";
import { GroundwaterContourContext } from "@/contexts/groundwater_assessment/admin/ContourContext";

const PDF: React.FC = () => {
  const {
    states,
    districts,
    subDistricts,
    selectedState,
    selectedDistricts,
    selectedSubDistricts,
  } = useLocation();
  const { isGeneratingPDF, generatePDFReport } = usePDF();
  const { wellsData } = useWell();
  const { trendData } = useContext(GroundwaterTrendContext);
  const { forecastData } = useContext(GroundwaterForecastContext);
  const { visualizationData, geoJsonData, rasterData } = useContext(GroundwaterContourContext);
  const { tableData } = useRecharge();
  const {
    domesticTableData,
    agriculturalTableData,
    industrialTableData,
    combinedDemandData, 
    chartData,
    perCapitaConsumption,
    selectedCrops,
  } = useDemand();
  const { gsrTableData, stressTableData, mapImageBase64 } = useGSR();
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

  // Add Trend Analysis Table
  const addTrendAnalysisTable = (doc: jsPDF, startY: number): number => {
    if (!trendData || !trendData.villages || trendData.villages.length === 0) {
      return startY;
    }

    let cursorY = addSectionHeading(doc, "Trend Analysis", startY, "2");

    const tableStartX = MARGIN_LEFT;
    const tableWidth = USABLE_WIDTH;
    const headers = [
      "Village Name",
      "Location",
      "Trend Status",
      "Tau",
      "P-Value",
      "Sen Slope",
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

    for (let i = 0; i < trendData.villages.length; i++) {
      const village = trendData.villages[i];

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
        village.Village_Name || "N/A",
        `${village.Block || "N/A"}, ${village.District || "N/A"}`,
        village.Trend_Status?.replace("-", " ") || "N/A",
        village.Mann_Kendall_Tau?.toFixed(3) || "N/A",
        village.P_Value?.toFixed(3) || "N/A",
        village.Sen_Slope?.toFixed(3) || "N/A",
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

    if (trendData.summary_stats?.trend_distribution) {
      cursorY = addSubsectionHeading(doc, "Trend Summary:", cursorY);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);

      const summaryData = [
        `Increasing Trends: ${trendData.summary_stats.trend_distribution.increasing || 0}`,
        `Decreasing Trends: ${trendData.summary_stats.trend_distribution.decreasing || 0}`,
        `No Trend: ${trendData.summary_stats.trend_distribution.no_trend || 0}`,
        `Insufficient Data: ${trendData.summary_stats.trend_distribution.insufficient_data || 0}`,
      ];

      cursorY = addTextWithPagination(doc, summaryData, MARGIN_LEFT, cursorY, USABLE_WIDTH, "left", 6);
    }

    return cursorY + SECTION_SPACING;
  };

  // Add Trend Map Image
  const addTrendMapImage = (doc: jsPDF, startY: number): number => {
    if (!trendData || !trendData.summary_stats?.file_info?.trend_map_base64) {
      return startY;
    }

    let cursorY = startY;
    try {
      const imgBase64 = trendData.summary_stats.file_info.trend_map_base64;
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

      return cursorY;
    } catch (error) {
      console.log("Error adding trend map image:", error);
      return cursorY + SECTION_SPACING;
    }
  };

  // Add Forecast Analysis Table
  const addForecastAnalysisTable = (doc: jsPDF, startY: number): number => {
    if (!forecastData || !forecastData.villages || forecastData.villages.length === 0) {
      return startY;
    }

    let cursorY = addSectionHeading(doc, "Forecast Analysis", startY, "3");

    const tableStartX = MARGIN_LEFT;
    const tableWidth = USABLE_WIDTH;
    const headers = ["Village Name", "Forecasted Values"];

    // ✅ Manual column width: first column smaller
    const colWidths = [tableWidth * 0.3, tableWidth * 0.7];

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

        // Redraw header
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

      let forecastText = "";
      if (Array.isArray(village.forecast_data?.values)) {
        const years = village.forecast_data.years?.join(", ") || "";
        const values = village.forecast_data.values?.map((v: number) => v.toFixed(2)).join(", ") || "";
        forecastText = `Years: ${years}\nValues: ${values}`;
      } else {
        forecastText = `Year: ${village.forecast_data?.year || "N/A"}\nValue: ${village.forecast_data?.value?.toFixed(2) || "N/A"}`;
      }

      const rowData = [
        village.village_info?.village || "N/A",
        forecastText,
      ];

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

    return cursorY + SECTION_SPACING;
  };



  // Add Recharge Analysis Table
  const addRechargeAnalysisTable = (doc: jsPDF, startY: number, rechargeData: any[], summaryStats: any): number => {
    if (!rechargeData || rechargeData.length === 0) {
      return startY;
    }

    let cursorY = addSectionHeading(doc, "Recharge Analysis", startY, "4");

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
      recharge: "Recharge (Million Litres)",
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

  //Add Combined Demand Table
  const addCombinedDemandTable = (doc: jsPDF, startY: number): number => {
    let cursorY = addSectionHeading(doc, "Combined Water Demand Analysis", startY, "5");

    if (combinedDemandData.length === 0) {
        cursorY = addSubsectionHeading(doc, "Demand Input Parameters:", cursorY);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        const params = [
            `Domestic Per Capita Consumption: ${perCapitaConsumption} LPCD`,
        ];
        if (Object.keys(selectedCrops).some(s => selectedCrops[s]?.length > 0)) {
            const selectedCropList = Object.keys(selectedCrops)
                .filter(s => selectedCrops[s].length > 0)
                .map(s => `${s}: ${selectedCrops[s].join(', ')}`)
                .join('; ');
            params.push(`Agricultural Selected Crops: ${selectedCropList}`);
        } else {
            params.push('Agricultural Selected Crops: None');
        }
        params.push(`Industrial Data: ${industrialTableData.length > 0 ? 'Provided' : 'Not Provided'}`);

        cursorY = addTextWithPagination(doc, params, MARGIN_LEFT, cursorY, USABLE_WIDTH, "left", 6);
        cursorY += SUBSECTION_SPACING;

        return cursorY;
    }

    const tableStartX = MARGIN_LEFT;
    const tableWidth = USABLE_WIDTH;
    const headers = ["Village Name", "Domestic (Million Litres)", "Agricultural (Million Litres)", "Industrial ( Million Litres)", "Total Demand (Million Litres)"];
    const colWidths = calculateColumnWidths(doc, headers, tableWidth);
    const rowHeight = 8;
    const headerHeight = 10;

    // Table Header
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

    // Table Rows
    let totalDomestic = 0;
    let totalAgricultural = 0;
    let totalIndustrial = 0;
    let grandTotal = 0;

    for (let i = 0; i < combinedDemandData.length; i++) {
      const row = combinedDemandData[i];

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
        doc.setFontSize(8);
      }

      const domestic = Number(row.domestic_demand) || 0;
      const agricultural = Number(row.agricultural_demand) || 0;
      const industrial = Number(row.industrial_demand) || 0;
      const total = domestic + agricultural + industrial;

      totalDomestic += domestic;
      totalAgricultural += agricultural;
      totalIndustrial += industrial;
      grandTotal += total;

      const rowData = [
        row.village_name || "N/A",
        domestic.toFixed(2),
        agricultural.toFixed(2),
        industrial.toFixed(2),
        total.toFixed(2),
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
    
    // Add Total Row
    const totalRowHeight = 8;
    doc.setFont("helvetica", "bold");
    if (cursorY + totalRowHeight > PAGE_HEIGHT - MARGIN_BOTTOM) {
      doc.addPage();
      cursorY = MARGIN_TOP;
    }
    doc.setFillColor(210, 210, 210);
    doc.rect(tableStartX, cursorY, tableWidth, totalRowHeight, "F");
    doc.setDrawColor(150, 150, 150);
    doc.rect(tableStartX, cursorY, tableWidth, totalRowHeight);
    
    const totalRowData = [
      "TOTAL DEMAND",
      totalDomestic.toFixed(2),
      totalAgricultural.toFixed(2),
      totalIndustrial.toFixed(2),
      grandTotal.toFixed(2),
    ];
    
    colX = tableStartX;
    for (let j = 0; j < totalRowData.length; j++) {
        doc.text(totalRowData[j], colX + 2, cursorY + 5, { maxWidth: colWidths[j] - 4 });
        if (j < totalRowData.length - 1) {
            doc.line(colX + colWidths[j], cursorY, colX + colWidths[j], cursorY + totalRowHeight);
        }
        colX += colWidths[j];
    }
    cursorY += totalRowHeight;
    doc.setFont("helvetica", "normal");


    cursorY += SECTION_SPACING;

    cursorY = addSubsectionHeading(doc, "Total Demand Summary:", cursorY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const summaryData = [
      `Total Villages: ${combinedDemandData.length}`,
      `Total Domestic Demand: ${totalDomestic.toFixed(2)} m³`,
      `Total Agricultural Demand: ${totalAgricultural.toFixed(2)} m³`,
      `Total Industrial Demand: ${totalIndustrial.toFixed(2)} m³`,
      `Grand Total Demand: ${grandTotal.toFixed(2)} m³`,
    ];
    cursorY = addTextWithPagination(doc, summaryData, MARGIN_LEFT, cursorY, USABLE_WIDTH, "left", 6);
    
    // Add Agricultural Demand Chart Summary if available
    if (chartData?.summary_stats) {
        cursorY += SUBSECTION_SPACING;
        cursorY = addSubsectionHeading(doc, "Agricultural Demand Chart Summary (Breakdown):", cursorY);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        const stats = chartData.summary_stats;
        const agSummaryData = [
            `Total Demand (from chart): ${stats.total_demand_cubic_meters.toLocaleString()} m³`,
            `Average Demand per Village: ${stats.average_demand_per_village.toFixed(2)} m³`,
        ];
        cursorY = addTextWithPagination(doc, agSummaryData, MARGIN_LEFT, cursorY, USABLE_WIDTH, "left", 6);
    }


    return cursorY + SECTION_SPACING;
  };

  // Add GSR Analysis Table
  const addGSRAnalysisTable = (doc: jsPDF, startY: number): number => {
    // GSR Analysis is now section 6
    if (!gsrTableData || gsrTableData.length === 0) {
      return startY;
    }

    let cursorY = addSectionHeading(doc, "GSR Analysis", startY, "6");

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
      'Recharge (Million Litres)',
      'Total Demand (Million Litres)',
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
    // MAR Need Assessment is now section 7
    if (!stressTableData || stressTableData.length === 0) {
      return startY;
    }

    let cursorY = addSectionHeading(doc, "MAR Need Assessment", startY, "7");

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
      'Recharge (Million Litres)',
      'Total Demand (Million Litres)',
      'Injection',
      'Injection Need (Million Litres/year)',
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
      `Average Injection Need: ${averageStressValue.toFixed(4)}`,
    ];
    cursorY = addTextWithPagination(doc, summaryData, MARGIN_LEFT, cursorY, USABLE_WIDTH, "left", 6);

    return cursorY + SECTION_SPACING;
  };
  // Add Contour Visualization
  const addContourVisualization = (doc: jsPDF, startY: number): number => {
    console.log('addContourVisualization called');
    console.log('visualizationData:', visualizationData);
    console.log('geoJsonData:', geoJsonData);
    console.log('rasterData:', rasterData);

    if (!visualizationData || !visualizationData.png_base64) {
      console.log('No visualization data available');
      return startY;
    }

    let cursorY = startY;

    try {
      // Add section heading
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      if (cursorY + 15 > PAGE_HEIGHT - MARGIN_BOTTOM) {
        doc.addPage();
        cursorY = MARGIN_TOP;
      }
      doc.text("1. Groundwater Contour & Raster Analysis", MARGIN_LEFT, cursorY);
      cursorY += 15;

      // Handle the base64 image properly
      let imgBase64 = visualizationData.png_base64;
      console.log('PNG Base64 exists, length:', imgBase64?.length);

      // Check if it already has the data URL prefix
      if (!imgBase64.startsWith('data:')) {
        imgBase64 = `data:image/png;base64,${imgBase64}`;
      }

      console.log('Image data URL prefix:', imgBase64.substring(0, 50));

      const imgProps = doc.getImageProperties(imgBase64);
      const imgWidth = USABLE_WIDTH;
      const imgHeight = imgWidth / (imgProps.width / imgProps.height);

      if (cursorY + imgHeight > PAGE_HEIGHT - MARGIN_BOTTOM) {
        doc.addPage();
        cursorY = MARGIN_TOP;
      }

      doc.addImage(imgBase64, "PNG", MARGIN_LEFT, cursorY, imgWidth, imgHeight);
      cursorY += imgHeight + SUBSECTION_SPACING;

      // Rest of your statistics code...

    } catch (error) {
      console.log("Error adding contour visualization:", error);
      console.log("Error details:", {
        hasVisualizationData: !!visualizationData,
        hasPngBase64: !!visualizationData?.png_base64,
        base64Length: visualizationData?.png_base64?.length
      });
      return cursorY + SECTION_SPACING;
    }

    return cursorY + SECTION_SPACING;
  };

  const handleGeneratePDF = async () => {
    try {
      setGenerating(true);
      const result = await generatePDFReport();

      if (!result || !result.success || !result.data) {
        alert("PDF generation failed: " + (result?.error ?? "Unknown error"));
        setGenerating(false);
        return;
      }

      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      let cursorY = MARGIN_TOP;

      // Title
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      cursorY = addTextWithPagination(
        doc,
        ["Selected Location Summary Report"],
        MARGIN_LEFT,
        cursorY,
        USABLE_WIDTH,
        "left",
        LINE_HEIGHT + 2
      );
      cursorY += SECTION_SPACING;

      // Timestamp
      doc.setFont("helvetica", "normal");
      doc.setFontSize(12);
      cursorY = addTextWithPagination(
        doc,
        [`Generated on: ${new Date().toLocaleString()}`],
        MARGIN_LEFT,
        cursorY,
        USABLE_WIDTH
      );
      cursorY += SECTION_SPACING;

      // Selected State
      const stateName = states.find((s) => s.id === selectedState)?.name || "None";
      cursorY = addSectionHeading(doc, "Location Summary", cursorY, "1");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      cursorY = addTextWithPagination(doc, ["Selected State:"], MARGIN_LEFT, cursorY, USABLE_WIDTH);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      cursorY = addTextWithPagination(doc, [stateName], MARGIN_LEFT, cursorY, USABLE_WIDTH);
      cursorY += SUBSECTION_SPACING;

      // Selected Districts
      const districtNamesArray =
        selectedDistricts.length === districts.length && districts.length > 0
          ? ["All Districts"]
          : districts.filter((d) => selectedDistricts.includes(Number(d.id))).map((d) => d.name);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      cursorY = addTextWithPagination(doc, ["Selected District(s):"], MARGIN_LEFT, cursorY, USABLE_WIDTH);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      cursorY = addTextWithPagination(
        doc,
        wrapTextLines(doc, districtNamesArray, MARGIN_LEFT, MARGIN_RIGHT),
        MARGIN_LEFT,
        cursorY,
        USABLE_WIDTH
      );
      cursorY += SUBSECTION_SPACING;

      // Selected Sub-Districts
      const subDistrictNamesArray =
        selectedSubDistricts.length === subDistricts.length && subDistricts.length > 0
          ? ["All Sub-Districts"]
          : subDistricts.filter((sd) => selectedSubDistricts.includes(Number(sd.id))).map((sd) => sd.name);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      cursorY = addTextWithPagination(doc, ["Selected Sub-District(s):"], MARGIN_LEFT, cursorY, USABLE_WIDTH);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      cursorY = addTextWithPagination(
        doc,
        wrapTextLines(doc, subDistrictNamesArray, MARGIN_LEFT, MARGIN_RIGHT),
        MARGIN_LEFT,
        cursorY,
        USABLE_WIDTH
      );
      cursorY += SUBSECTION_SPACING;

      // Wells count
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      cursorY = addTextWithPagination(doc, ["Selected Wells Count:"], MARGIN_LEFT, cursorY, USABLE_WIDTH);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      cursorY = addTextWithPagination(doc, [String(wellsData.length)], MARGIN_LEFT, cursorY, USABLE_WIDTH);
      cursorY += SUBSECTION_SPACING;

      // Selected Wells description
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      cursorY = addTextWithPagination(doc, ["Selected Wells (BLOCK - HYDROGRAPH):"], MARGIN_LEFT, cursorY, USABLE_WIDTH);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const wellDescriptions = wellsData.map((well) => {
        const block = well["BLOCK"] || "Unknown Block";
        const hydrograph = well["HYDROGRAPH"] || "Unknown Hydrograph";
        return `${block} - ${hydrograph}`;
      });
      cursorY = addTextWithPagination(
        doc,
        wrapTextLines(doc, wellDescriptions, MARGIN_LEFT, MARGIN_RIGHT, 0.96),
        MARGIN_LEFT,
        cursorY,
        USABLE_WIDTH
      );
      cursorY += SECTION_SPACING;

      // Add location map image if available
      if (result.data.imageBase64) {
        const imgBase64 = result.data.imageBase64;
        const imgProps = doc.getImageProperties(imgBase64);
        const imgWidth = USABLE_WIDTH;
        const imgHeight = imgWidth / (imgProps.width / imgProps.height);

        if (cursorY + imgHeight > PAGE_HEIGHT - MARGIN_BOTTOM) {
          doc.addPage();
          cursorY = MARGIN_TOP;
        }
        doc.addImage(imgBase64, "PNG", MARGIN_LEFT, cursorY, imgWidth, imgHeight);
        cursorY += imgHeight + SECTION_SPACING;
      }

      // Add sections
      // Around line 1500 in handleGeneratePDF
      console.log('Before addContourVisualization:');
      console.log('visualizationData:', visualizationData);
      console.log('geoJsonData:', geoJsonData);
      console.log('rasterData:', rasterData);

      cursorY = addContourVisualization(doc, cursorY);
      cursorY = addTrendAnalysisTable(doc, cursorY);
      cursorY = addTrendMapImage(doc, cursorY);
      cursorY = addForecastAnalysisTable(doc, cursorY);

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

      const summaryStats = computeSummaryStats(tableData);

      cursorY = addRechargeAnalysisTable(doc, cursorY, tableData, summaryStats);
      
      // ✅ UPDATED: Calling the new combined demand table
      cursorY = addCombinedDemandTable(doc, cursorY); 
      
      // ✅ UPDATED: Section numbers are adjusted
      cursorY = addGSRAnalysisTable(doc, cursorY); // Now section 6
      cursorY = addGSRMapImage(doc, cursorY); 
      cursorY = addStressAnalysisTable(doc, cursorY); // Now section 7


      doc.save("Groundwater_Assessment_Report.pdf");
      setGenerating(false);
    } catch (error) {
      console.log("Error generating PDF:", error);
      alert("An error occurred while generating the PDF. Please try again.");
      setGenerating(false);
    }
  };

  return (
    <button
      onClick={handleGeneratePDF}
      disabled={isGeneratingPDF || generating}
      className={[
        "inline-flex items-center justify-center gap-2 text-white font-semibold transition-colors duration-300 ease-in-out mt -30",
        isGeneratingPDF || generating
          ? "bg-gray-400 cursor-not-allowed rounded-full px-6 py-3"
          : "bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-md focus:outline-none focus:ring-4 focus:ring-blue-400 focus:ring-opacity-50 rounded-full px-6 py-3",
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