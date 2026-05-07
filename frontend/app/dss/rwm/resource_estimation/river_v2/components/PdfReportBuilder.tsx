"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { FileText, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import LoadingOverlay from "../../river/components/loadingOverlay";
import {
  getPdfReportSocketUrl,
  startPdfReportJob,
} from "../services/rwmRiverApi";
import {
  CHART_TO_BACKEND_ATTRIBUTE,
  WQ_PARAMETERS,
  attributeLabels,
} from "../utils/chartFormatters";

type DataType = "subdistbased" | "stretchbased";
type ReportStatus = "idle" | "loading" | "success" | "error";

interface PdfReportBuilderProps {
  modeLabel: "Admin" | "Drain";
  dataType: DataType;
  selectedIds: Array<number | string>;
  selectedSeason: string;
  embedded?: boolean;
  showHeader?: boolean;
}

const TOP_TEN_PRIORITY: Record<string, number> = {
  dissolvedOxygen: 1,
  bod: 2,
  faecalColiform: 3,
  ph: 4,
  turbidity: 5,
  ec: 6,
  ts: 7,
  cod: 8,
  temperature: 9,
  nitrate: 10,
};

const reportParameters = WQ_PARAMETERS.filter((param) => param.key !== "wqi");

const backendAttributeLabels = Object.entries(CHART_TO_BACKEND_ATTRIBUTE).reduce(
  (acc, [frontendKey, backendField]) => {
    acc[backendField] = attributeLabels[frontendKey] || backendField;
    return acc;
  },
  {} as Record<string, string>,
);

function buildReportPdf({
  modeLabel,
  dataType,
  selectedIds,
  selectedSeason,
  result,
}: {
  modeLabel: string;
  dataType: DataType;
  selectedIds: Array<number | string>;
  selectedSeason: string;
  result: any;
}) {
  const doc = new jsPDF({ orientation: "p", unit: "mm", format: "a4", compress: true });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const logoHeight = 27;
  const contentWidth = pageWidth - 2 * margin;
  const leftLogo = "/Images/export/logo_iitbhu.png";
  const rightLogo = "/Images/export/right1_slcr.png";
  const isStretch = dataType === "stretchbased";
  const analysisTitle = isStretch ? "Stretch Analysis" : "Sub-District Analysis";
  const analysisHeading = `Report on River Water Quality Monitoring\n(${analysisTitle})`;
  const capitalizedSeason = selectedSeason
    ? selectedSeason.charAt(0).toUpperCase() + selectedSeason.slice(1)
    : "Selected";
  const reportDate = new Date().toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const results = result?.data?.results || result?.results || [];
  const normalizedResult = {
    data: {
      results: Array.isArray(results) ? results : [],
      summary: result?.data?.summary || result?.summary || {},
      metadata: result?.data?.metadata || result?.metadata || {},
    },
  };

  let yPosition = 125;

  const addLogosToPage = () => {
    try {
      doc.addImage(leftLogo, "PNG", 15, 10, 20, 20);
      doc.addImage(rightLogo, "PNG", pageWidth - 40, 10, 25, 25);
    } catch (error) {
      console.log("Error adding logos:", error);
    }
  };

  const checkPageBreak = (heightNeeded: number) => {
    if (yPosition + heightNeeded > pageHeight - margin) {
      doc.addPage();
      addLogosToPage();
      yPosition = 10 + logoHeight;
      return true;
    }
    return false;
  };

  const addText = (
    text: string,
    fontSize = 11,
    isBold = false,
    alignment: "left" | "center" | "justify" = "left",
  ) => {
    doc.setFontSize(fontSize);
    doc.setFont("times", isBold ? "bold" : "normal");
    const lines = doc.splitTextToSize(text, contentWidth);
    const textHeight = lines.length * fontSize * 0.5;
    checkPageBreak(textHeight + 5);

    if (alignment === "center") {
      lines.forEach((line: string) => {
        doc.text(line, pageWidth / 2, yPosition, { align: "center" });
        yPosition += fontSize * 0.5;
      });
    } else if (alignment === "justify" && lines.length > 1) {
      lines.forEach((line: string, index: number) => {
        if (index === lines.length - 1) {
          doc.text(line, margin, yPosition);
        } else {
          doc.text(line, margin, yPosition, { align: "justify", maxWidth: contentWidth });
        }
        yPosition += fontSize * 0.5;
      });
    } else {
      doc.text(lines, margin, yPosition);
      yPosition += textHeight;
    }
    yPosition += 5;
  };

  const addCenteredImage = (
    imagePath: string,
    format: "PNG" | "JPEG",
    width: number,
    height: number,
    errorLabel: string,
  ) => {
    checkPageBreak(height + 10);
    try {
      doc.addImage(imagePath, format, (pageWidth - width) / 2, yPosition, width, height);
      yPosition += height + 5;
    } catch (error) {
      console.log(`Error loading ${errorLabel}:`, error);
      yPosition += 10;
    }
  };

  const getWQIClassification = (mean: number) => {
    if (mean <= 50) return "Excellent";
    if (mean <= 100) return "Good";
    if (mean <= 200) return "Poor";
    if (mean <= 300) return "Very Poor";
    return "Unsuitable for use";
  };

  addLogosToPage();

  doc.setFontSize(16);
  doc.setFont("times", "bold");
  const textWidth = doc.getTextDimensions(analysisHeading).w;
  const textHeight = doc.getTextDimensions(analysisHeading).h;
  const boxPadding = 10;
  const boxWidth = textWidth + boxPadding * 2;
  const boxHeight = textHeight + boxPadding * 2;
  const boxX = (pageWidth - boxWidth) / 2;
  doc.setLineWidth(0.5);
  doc.setDrawColor(0, 0, 0);
  doc.rect(boxX, yPosition, boxWidth, boxHeight);
  doc.text(analysisHeading, pageWidth / 2, yPosition + boxPadding + textHeight / 2, {
    align: "center",
  });
  yPosition += boxHeight + 20;

  doc.setFontSize(11);
  doc.setFont("times", "normal");
  doc.text(`Analysis Period: ${capitalizedSeason} Season`, pageWidth / 2, yPosition, {
    align: "center",
  });

  doc.setFontSize(9);
  doc.setFont("times", "italic");
  yPosition += 80;
  doc.text(`Report Generated: ${reportDate}`, margin, yPosition);
  yPosition += 5;

  checkPageBreak(120);
  doc.setLineWidth(0.5);
  doc.setDrawColor(0, 0, 0);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 10;

  doc.setFontSize(14);
  doc.setFont("times", "bold");
  doc.text("1. Executive summary", margin, yPosition);
  yPosition += 10;
  addText(
    "The Water Quality Monitoring module serves as a core component of the Decision Support System for the Varuna Basin. It relies exclusively on field-based observations to assess river health and support sustainable water governance. Seasonal sampling across representative locations - upstream, midstream urban and tributary zones, and downstream - captures spatial and temporal patterns influenced by hydrological and human factors. The study measures ten key physicochemical and microbiological parameters: Dissolved Oxygen, Biological Oxygen Demand, Faecal Coliform, pH, Turbidity, Electrical Conductivity, Total Solids, Chemical Oxygen Demand, Temperature, and Nitrate. These parameters are evaluated following CPCB and BIS standards to compute a composite Water Quality Index, which summarizes the river's overall status. This ground-based framework strengthens data reliability through in-situ and laboratory assessments supported by strict QA/QC protocols.",
    11,
    false,
    "justify",
  );

  checkPageBreak(50);
  doc.setFontSize(14);
  doc.setFont("times", "bold");
  doc.text("2. Study area", margin, yPosition);
  yPosition += 10;
  addText(
    "The Varuna River, a tributary of the Ganga, extends roughly 200 km across the districts of Varanasi and its surroundings. It experiences high seasonal variability due to monsoon flows and anthropogenic stress from urban discharge and agricultural runoff. Sampling sites were selected to represent upstream rural reaches, urban inflow points, and downstream segments to capture cumulative effects.",
    11,
    false,
    "justify",
  );

  const studyAreaImage = "/Images/RWM_WQA/WQI_Sampling_points.png";
  const imgWidth = contentWidth;
  const imgHeight = imgWidth * 0.7;
  addCenteredImage(studyAreaImage, "PNG", imgWidth, imgHeight, "study area image");
  doc.setFontSize(10);
  doc.setFont("times", "italic");
  doc.text("Figure 1: Study area map showing sampling locations", pageWidth / 2, yPosition, {
    align: "center",
  });
  yPosition += 10;

  checkPageBreak(30);
  doc.setFontSize(14);
  doc.setFont("times", "bold");
  doc.text("3. Methodology: Ground-Based WQI Framework", margin, yPosition);
  yPosition += 10;

  doc.setFontSize(12);
  doc.setFont("times", "bold");
  doc.text("3.1. Sampling and Parameters", margin, yPosition);
  yPosition += 8;
  addText(
    "Sampling was conducted during pre-monsoon, monsoon, and post-monsoon seasons. At each site, in-situ measurements included Temperature, pH, EC, DO, and Turbidity, while laboratory analysis covered BOD, COD, Nitrate, TS, and Faecal Coliform. Each parameter followed standard methods from APHA and guidelines from BIS 10500:2012 and CPCB surface water classes.",
    11,
    false,
    "justify",
  );

  checkPageBreak(30);
  doc.setFontSize(10);
  doc.setFont("times", "bold");
  doc.text(
    "Table 1: Field and laboratory parameters, methods, and permissible limits",
    pageWidth / 2,
    yPosition,
    { align: "center" },
  );
  yPosition += 8;

  autoTable(doc, {
    startY: yPosition,
    head: [["Parameter", "Permissible Limit", "Method", "Reference"]],
    body: [
      ["pH", "6.5 - 8.5", "4500-H+ B", "APHA, BIS"],
      ["Temperature", "<= 25 C", "Field thermometer", "WHO"],
      ["EC", "<= 750 uS/cm desirable", "2510 B", "APHA, BIS"],
      ["TDS", "<= 500 mg/L desirable", "2540 C", "APHA, BIS"],
      ["TSS", "<= 30 mg/L", "2540 D", "APHA, WHO"],
      ["Total Solids", "TDS + TSS", "2540 B", "APHA"],
      ["DO", ">= 5 mg/L", "4500-O G", "APHA, CPCB"],
      ["Turbidity", "<= 5 NTU", "2130 B", "APHA, BIS"],
      ["ORP", "200 - 400 mV typical", "2580 B", "APHA"],
      ["BOD", "<= 3 mg/L", "5210 B", "APHA, CPCB"],
      ["COD", "<= 10 mg/L", "5220 D", "APHA"],
      ["Nitrate", "<= 45 mg/L", "4500-NO3", "APHA, BIS"],
      ["Faecal Coliform", "<= 50 MPN/100mL", "9222 D", "APHA, CPCB"],
      ["Total Coliform", "<= 500 MPN/100mL", "9222 B", "APHA, CPCB"],
    ],
    styles: { font: "times", fontSize: 8, cellPadding: 2, overflow: "linebreak" },
    headStyles: { fillColor: [211, 211, 211], textColor: [0, 0, 0], fontStyle: "bold" },
    margin: { left: margin, right: margin, top: logoHeight + 5 },
    didDrawPage: addLogosToPage,
  });
  yPosition = (doc as any).lastAutoTable.finalY + 10;

  checkPageBreak(30);
  doc.setFontSize(12);
  doc.setFont("times", "bold");
  doc.text("3.2. Ranking and normalized parameter scoring", margin, yPosition);
  yPosition += 8;
  addText(
    "The WQI framework converts raw observations into normalized quality scores and combines them through parameter weights derived from importance ranking. Higher priority is assigned to DO, BOD, Faecal Coliform, pH, Turbidity, EC, TS, COD, Temperature, and Nitrate.",
    11,
    false,
    "justify",
  );

  addCenteredImage("/Images/RWM_WQA/rank.png", "PNG", contentWidth * 0.55, contentWidth * 0.28, "ranking image");

  const formulaImages = [
    { title: "Dissolved Oxygen scoring", path: "/Images/RWM_WQA/Q_do.png", width: 0.45, ratio: 0.3 },
    { title: "pH scoring", path: "/Images/RWM_WQA/Q_ph.png", width: 0.45, ratio: 0.3 },
    { title: "Log-scaled microbiological scoring", path: "/Images/RWM_WQA/Q_log.png", width: 0.5, ratio: 0.28 },
    { title: "Turbidity scoring", path: "/Images/RWM_WQA/Q_turb.png", width: 0.45, ratio: 0.3 },
    { title: "Temperature scoring", path: "/Images/RWM_WQA/Q_t.png", width: 0.45, ratio: 0.3 },
  ];

  formulaImages.forEach((formula) => {
    checkPageBreak(25);
    doc.setFontSize(11);
    doc.setFont("times", "bold");
    doc.text(`${formula.title}:`, margin, yPosition);
    yPosition += 5;
    const width = contentWidth * formula.width;
    addCenteredImage(formula.path, "PNG", width, width * formula.ratio, formula.title);
  });

  checkPageBreak(30);
  doc.setFontSize(11);
  doc.setFont("times", "bold");
  doc.text("3.3. Water Quality Index (WQI) computation", margin, yPosition);
  yPosition += 8;
  addCenteredImage("/Images/RWM_WQA/WQI.png", "PNG", contentWidth * 0.25, contentWidth * 0.1, "WQI formula");

  autoTable(doc, {
    startY: yPosition,
    head: [["Water Quality", "0-50", "51-100", "101-200", "201-300", "> 300"]],
    body: [["Values", "Excellent", "Good", "Poor", "Very Poor", "Unsuitable for use"]],
    styles: { font: "times", fontSize: 9, cellPadding: 3, halign: "center" },
    headStyles: { fillColor: [211, 211, 211], textColor: [0, 0, 0], fontStyle: "bold" },
    margin: { left: margin, right: margin, top: logoHeight + 5 },
    didDrawPage: addLogosToPage,
  });
  yPosition = (doc as any).lastAutoTable.finalY + 10;

  autoTable(doc, {
    startY: yPosition,
    head: [["Parameter", "ICMR Permissible Limit", "Processed Standard", "Weight"]],
    body: [
      ["DO", "6", "6", "0.1818"],
      ["BOD", "5", "5", "0.1636"],
      ["Faecal Coliform", "50", "50", "0.1455"],
      ["pH", "(6.5, 8.5)", "7.5", "0.1273"],
      ["Turbidity", "5", "5", "0.1091"],
      ["EC", "1500", "1500", "0.0909"],
      ["TS", "1500", "1500", "0.0727"],
      ["COD", "10", "10", "0.0545"],
      ["Temperature", "25", "25", "0.0364"],
      ["Nitrate", "45", "45", "0.0182"],
    ],
    styles: { font: "times", fontSize: 9, cellPadding: 3, halign: "center" },
    headStyles: { fillColor: [211, 211, 211], textColor: [0, 0, 0], fontStyle: "bold" },
    margin: { left: margin, right: margin, top: logoHeight + 5 },
    didDrawPage: addLogosToPage,
  });
  yPosition = (doc as any).lastAutoTable.finalY + 15;

  checkPageBreak(30);
  doc.setFontSize(14);
  doc.setFont("times", "bold");
  doc.text("4. Results", margin, yPosition);
  yPosition += 10;
  addText(
    "The ground-based assessment shows clear seasonal and spatial variation in the Water Quality Index across the Varuna Basin. Upstream stretches generally fall within the Good to Excellent category, reflecting minimal anthropogenic influence and better ecological balance. In contrast, the urban core and tributary inflow zones exhibit Poor to Very Poor ratings, largely driven by elevated BOD and coliform concentrations associated with domestic and industrial discharge.",
    11,
    false,
    "justify",
  );

  checkPageBreak(80);
  doc.setFontSize(12);
  doc.setFont("times", "bold");
  doc.text(`4.1. ${isStretch ? "Stretch based" : "Sub-district based"}`, margin, yPosition);
  yPosition += 10;

  normalizedResult.data.results.forEach((resultItem: any, index: number) => {
    if (resultItem?.status !== "success" || !resultItem?.map_image) return;

    checkPageBreak(170);
    doc.setFontSize(11);
    doc.setFont("times", "bold");
    const rawAttribute = String(resultItem.attribute || resultItem.parameter || "Parameter");
    const paramLabel = backendAttributeLabels[rawAttribute] || rawAttribute.replace(/_/g, " ");
    doc.text(`${paramLabel} - Spatial Distribution`, margin, yPosition);
    yPosition += 8;

    const mapWidth = contentWidth;
    const mapHeight = mapWidth * 0.75;
    checkPageBreak(mapHeight + 20);
    try {
      doc.addImage(resultItem.map_image, "PNG", margin, yPosition, mapWidth, mapHeight);
      yPosition += mapHeight + 5;
    } catch (error) {
      console.log(`Error loading ${paramLabel} map:`, error);
      yPosition += 10;
    }

    if (resultItem.legend_image) {
      const legendWidth = mapWidth * 0.75;
      const legendHeight = 16;
      checkPageBreak(legendHeight + 10);
      try {
        doc.addImage(
          resultItem.legend_image,
          "PNG",
          margin + (mapWidth - legendWidth) / 2,
          yPosition,
          legendWidth,
          legendHeight,
        );
        yPosition += legendHeight + 6;
      } catch (error) {
        console.log(`Error loading ${paramLabel} legend:`, error);
      }
    }

    const stats = resultItem?.interpolation?.statistics || resultItem?.statistics || {};
    const mean = Number(stats.mean ?? 0);
    const classification = getWQIClassification(mean);
    const isWQI = rawAttribute === "WQI" || paramLabel.toLowerCase().includes("water quality index");
    const figureNum = index + 2;

    doc.setFontSize(9);
    doc.setFont("times", "italic");
    const captionText = `Figure ${figureNum}: Spatial interpolation map for ${paramLabel.toLowerCase()} (Mean: ${mean.toFixed(2)}${isWQI ? ` - ${classification}` : ""})`;
    const wrappedCaption = doc.splitTextToSize(captionText, contentWidth);
    wrappedCaption.forEach((line: string, captionIndex: number) => {
      doc.text(line, pageWidth / 2, yPosition + captionIndex * 5, { align: "center" });
    });
    yPosition += wrappedCaption.length * 5 + 10;

    checkPageBreak(30);
    doc.setFontSize(9);
    doc.setFont("times", "bold");
    doc.text(`Table: ${paramLabel} Statistics${isWQI ? " and Classification" : ""}`, pageWidth / 2, yPosition, {
      align: "center",
    });
    yPosition += 6;

    const tableHead = isWQI
      ? [["Parameter", "Min", "Max", "Mean", "Std Dev", "Classification"]]
      : [["Parameter", "Min", "Max", "Mean", "Std Dev"]];
    const tableBody = isWQI
      ? [[paramLabel, Number(stats.min ?? 0).toFixed(2), Number(stats.max ?? 0).toFixed(2), mean.toFixed(2), Number(stats.std ?? 0).toFixed(2), classification]]
      : [[paramLabel, Number(stats.min ?? 0).toFixed(2), Number(stats.max ?? 0).toFixed(2), mean.toFixed(2), Number(stats.std ?? 0).toFixed(2)]];

    autoTable(doc, {
      startY: yPosition,
      head: tableHead,
      body: tableBody,
      styles: { font: "times", fontSize: 9, cellPadding: 3, halign: "center", valign: "middle" },
      headStyles: { fillColor: [211, 211, 211], textColor: [0, 0, 0], fontStyle: "bold" },
      margin: { left: margin, right: margin, top: logoHeight + 5 },
      didDrawPage: addLogosToPage,
      didParseCell: (data) => {
        if (isWQI && data.column.index === 5 && data.row.section === "body") {
          const value = data.cell.text[0];
          if (value === "Excellent") data.cell.styles.textColor = [0, 128, 0];
          else if (value === "Good") data.cell.styles.textColor = [34, 139, 34];
          else if (value === "Poor") data.cell.styles.textColor = [255, 140, 0];
          else if (value === "Very Poor") data.cell.styles.textColor = [255, 0, 0];
          else data.cell.styles.textColor = [139, 0, 0];
        }
      },
    });
    yPosition = (doc as any).lastAutoTable.finalY + 10;
  });

  checkPageBreak(50);
  doc.setFontSize(14);
  doc.setFont("times", "bold");
  doc.text("5. Conclusion", margin, yPosition);
  yPosition += 10;
  addText(
    "This water monitoring ground-based framework supports accurate, verifiable, and locally relevant assessments. It integrates seasonal and spatial dynamics through a transparent Water Quality Index methodology. The system strengthens decision-making for water governance in the Varuna Basin by providing consistent WQI trends for each sampling location and season, enabling the identification of high-risk stretches that require targeted intervention.",
    11,
    false,
    "justify",
  );

  checkPageBreak(25);
  doc.setFontSize(9);
  doc.setFont("times", "italic");
  doc.text(`${isStretch ? "Stretches" : "Sub-districts"} Analyzed: ${selectedIds.length}`, margin, yPosition);
  yPosition += 5;
  doc.text(`Parameters Assessed: ${normalizedResult.data.results.length}`, margin, yPosition);

  checkPageBreak(50);
  yPosition += 10;
  doc.setFontSize(14);
  doc.setFont("times", "bold");
  doc.text("References:", margin, yPosition);
  yPosition += 10;
  doc.setFontSize(10);
  doc.setFont("times", "normal");
  [
    "1. Akhtar, N., Ishak, M. I. S., Ahmad, M. I., Umar, K., Md Yusuff, M. S., Anees, M. T., Qadir, A., & Almanasir, Y. K. (2021). Modification of the water quality index process for simple calculation using multi-criteria decision-making methods: A review. Water, 13(7), Article 905.",
    "2. Gain, A. K., & Giupponi, C. (2014). Impact of agricultural policy reform and climatic change on water use in agriculture. Water Resources Management, 28(4), 999-1012.",
    "3. Makumbura, R. K., Rathnayake, D. T., Gunathilake, M. B., & Rathnayake, U. (2021). Multi-temporal analysis of water quality indices of three waterbodies. E3S Web of Conferences, 266, Article 05003.",
    "4. Mysiak, J., Giupponi, C., & Rosato, P. (2005). Towards the development of a decision support system for water resource management. Environmental Modelling & Software, 20(2), 203-214.",
    "5. Raju, N. J., Ram, P., & Dey, S. (2009). Groundwater quality in the lower Varuna River basin, Varanasi district, Uttar Pradesh. Journal of the Geological Society of India, 73(2), 178-192.",
    "6. Rouse, J. W., Jr., Haas, R. H., Schell, J. A., & Deering, D. W. (1973). Monitoring vegetation systems in the Great Plains with ERTS. NASA Special Publication, 351, 309-317.",
    "7. Singh, P., Chaturvedi, R. K., Mishra, A., Kumari, L., Singh, R., Badruddin, I. A., Singh, S. N., Singh, S., Sinha, V., Verma, P., Mishra, S., & Haritash, A. K. (2015). Assessment of ground and surface water quality along the river Varuna, Varanasi, India. Environmental Monitoring and Assessment, 187(4), Article 170.",
  ].forEach((ref) => {
    const refLines = doc.splitTextToSize(ref, contentWidth);
    checkPageBreak(refLines.length * 5 + 3);
    doc.text(refLines, margin, yPosition);
    yPosition += refLines.length * 5 + 3;
  });

  const pageCount = (doc as any).getNumberOfPages
    ? (doc as any).getNumberOfPages()
    : (doc.internal as any).pages.length - 1;
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: "center" });
  }

  doc.save(
    isStretch
      ? `Water_Quality_Report_Stretch_${new Date().toISOString().split("T")[0]}.pdf`
      : `WaterQualityReport_SubDistrict_${new Date().toISOString().split("T")[0]}.pdf`,
  );
}

export default function PdfReportBuilder({
  modeLabel,
  dataType,
  selectedIds,
  selectedSeason,
  embedded = false,
  showHeader = true,
}: PdfReportBuilderProps) {
  const [selectedParameters, setSelectedParameters] = useState<string[]>([]);
  const [status, setStatus] = useState<ReportStatus>("idle");
  const [message, setMessage] = useState("");
  const [completedParameters, setCompletedParameters] = useState(0);
  const [totalParameters, setTotalParameters] = useState(0);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const socketRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number | null>(null);

  const formatDuration = (seconds: number) => {
    const safe = Math.max(0, seconds);
    const mins = Math.floor(safe / 60).toString().padStart(2, "0");
    const secs = (safe % 60).toString().padStart(2, "0");
    return `${mins}:${secs}`;
  };

  const sortedReportParameters = useMemo(
    () =>
      reportParameters
        .slice()
        .sort((a, b) => (TOP_TEN_PRIORITY[a.key] || 999) - (TOP_TEN_PRIORITY[b.key] || 999)),
    [],
  );

  const topTenKeys = useMemo(
    () =>
      reportParameters
        .map((param) => param.key)
        .filter((key) => TOP_TEN_PRIORITY[key] !== undefined)
        .sort((a, b) => TOP_TEN_PRIORITY[a] - TOP_TEN_PRIORITY[b]),
    [],
  );

  const allTopTenSelected = topTenKeys.every((key) => selectedParameters.includes(key));

  const handleParameterToggle = (paramKey: string) => {
    setSelectedParameters((prev) =>
      prev.includes(paramKey)
        ? prev.filter((key) => key !== paramKey)
        : [...prev, paramKey],
    );
  };

  const handleSelectAllParameters = () => {
    setSelectedParameters((prev) =>
      prev.length === reportParameters.length ? [] : reportParameters.map((param) => param.key),
    );
  };

  const handleToggleTopTen = () => {
    setSelectedParameters((prev) =>
      allTopTenSelected
        ? prev.filter((key) => !topTenKeys.includes(key))
        : Array.from(new Set([...prev, ...topTenKeys])),
    );
  };

  useEffect(() => {
    if (status === "loading") {
      if (!startTimeRef.current) startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        if (startTimeRef.current) {
          setTimeElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
        }
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [status]);

  const handleOverlayComplete = () => {
    setIsGeneratingPDF(false);
  };

  const handleGenerateReport = async () => {
    if (selectedIds.length === 0) {
      toast.error(`Confirm ${modeLabel.toLowerCase()} selections before generating a report.`);
      return;
    }

    if (!selectedSeason) {
      toast.error("Select season before generating a report.");
      return;
    }

    if (selectedParameters.length === 0) {
      toast.error("Select at least one parameter.");
      return;
    }

    socketRef.current?.close();
    setIsGeneratingPDF(true);
    setStatus("loading");
    setMessage("Starting report job...");
    setErrorMessage("");
    setCompletedParameters(0);
    setTotalParameters(selectedParameters.length + 1);
    setTimeElapsed(0);
    startTimeRef.current = Date.now();

    try {
      const backendAttributes = selectedParameters.map(
        (param) => CHART_TO_BACKEND_ATTRIBUTE[param] || param,
      );
      backendAttributes.push("WQI");
      const totalCount = backendAttributes.length;

      const job = await startPdfReportJob({
        attributes: backendAttributes,
        season: selectedSeason,
        dataType,
        subDistrictCodes: dataType === "subdistbased" ? selectedIds.map(Number) : undefined,
        stretchIds: dataType === "stretchbased" ? selectedIds.map(String) : undefined,
      });

      if (!job.job_id) {
        throw new Error("Backend did not return a report job id.");
      }

      setMessage("Report job started. Waiting for backend progress...");
      const socket = new WebSocket(getPdfReportSocketUrl(job.job_id));
      socketRef.current = socket;

      socket.onmessage = (event) => {
        const payload = JSON.parse(event.data);
        if (payload.status === "processing") {
          setMessage(payload.message || `Processing ${payload.attribute || "parameter"}...`);
        } else if (payload.status === "completed" && payload.attribute) {
          setCompletedParameters((prev) => prev + 1);
          setMessage(`${payload.attribute} completed.`);
        } else if (payload.status === "cancelled" || payload.stage === "finalization_skipped") {
          socket.close();
          setStatus("error");
          setErrorMessage(payload.message || "Report generation was cancelled.");
          setMessage(payload.message || "Report generation was cancelled.");
          toast.error(payload.message || "Report generation was cancelled.");
        } else if (payload.status === "completed" && payload.summary) {
          socket.close();
          setCompletedParameters(totalCount);
          setMessage("Report data ready. Downloading PDF...");
          try {
            buildReportPdf({
              modeLabel,
              dataType,
              selectedIds,
              selectedSeason,
              result: payload,
            });
            setStatus("success");
            toast.success("PDF report generated.");
          } catch (error: any) {
            const message = error?.message || "Failed to build PDF report.";
            setStatus("error");
            setErrorMessage(message);
            setMessage(message);
            toast.error(message);
          }
        } else if (payload.status === "error") {
          socket.close();
          setStatus("error");
          startTimeRef.current = null;
          setErrorMessage(payload.message || "Report generation failed.");
          setMessage(payload.message || "Report generation failed.");
          toast.error(payload.message || "Report generation failed.");
        }
      };

      socket.onerror = () => {
        setStatus("error");
        startTimeRef.current = null;
        setErrorMessage("WebSocket connection failed. Please try again.");
        setMessage("WebSocket connection failed. Please try again.");
        toast.error("Report progress connection failed.");
      };

      socket.onclose = () => {
        socketRef.current = null;
      };
    } catch (error: any) {
      setStatus("error");
      startTimeRef.current = null;
      setErrorMessage(error?.message || "Failed to generate report.");
      setMessage(error?.message || "Failed to generate report.");
      toast.error(error?.message || "Failed to generate report.");
    }
  };

  const overlayStatus: "loading" | "success" | "error" | "cancelled" =
    status === "success" ? "success" : status === "error" ? "error" : "loading";

  return (
    <>
      {isGeneratingPDF && (
        <LoadingOverlay
          isGenerating={isGeneratingPDF}
          totalParameters={totalParameters}
          completedParameters={completedParameters}
          onComplete={handleOverlayComplete}
          status={overlayStatus}
          errorMessage={errorMessage}
        />
      )}

      <div className={embedded ? "" : "mb-2 rounded-2xl border-l-4 border-l-pink-400 bg-white/80 shadow-lg backdrop-blur-sm"}>
      <div className={embedded ? "" : "p-5"}>
        {showHeader && <div className="mb-5 flex items-center gap-3">
          <div className="h-3 w-3 rounded-full bg-pink-500 shadow-sm" />
          <h3 className="text-lg font-bold text-gray-800">Generate PDF Report</h3>
        </div>}

        <div className="mb-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <label className="text-xs font-semibold text-gray-700">Select Water Quality Parameters</label>
            <div className="flex items-center gap-2">
              <div className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">
                {selectedParameters.length} / {reportParameters.length}
              </div>
              <button type="button" onClick={handleToggleTopTen} className="rounded-full border border-blue-200 px-3 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-500 hover:text-white">
                {allTopTenSelected ? "Deselect Top 10" : "Select Top 10"}
              </button>
              <button type="button" onClick={handleSelectAllParameters} className="rounded-full border border-blue-200 px-3 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-500 hover:text-white">
                {selectedParameters.length === reportParameters.length ? "Deselect All" : "Select All"}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-4">
            {sortedReportParameters.map((param) => {
              const topTenPriority = TOP_TEN_PRIORITY[param.key];
              const isSelected = selectedParameters.includes(param.key);
              return (
                <div
                  key={param.key}
                  onClick={() => handleParameterToggle(param.key)}
                  className={`flex cursor-pointer items-center justify-between rounded-xl border-2 p-2.5 transition-all duration-200 ${
                    isSelected
                      ? "border-blue-400 bg-gradient-to-r from-blue-50 to-indigo-50 shadow-sm hover:shadow-md"
                      : "border-gray-200/80 bg-white opacity-80 hover:border-gray-300 hover:opacity-100 hover:shadow-sm"
                  }`}
                >
                  <div className="flex min-w-0 flex-1 items-center">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onClick={(event) => event.stopPropagation()}
                      onChange={() => handleParameterToggle(param.key)}
                      className="h-3.5 w-3.5 flex-shrink-0 cursor-pointer rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="ml-2 min-w-0 flex-1 text-xs">
                      <label className={`block cursor-pointer truncate font-semibold ${isSelected ? "text-blue-900" : "text-gray-900"}`}>
                        {param.label}
                      </label>
                      {param.unit && (
                        <p className={`truncate text-[10px] ${isSelected ? "font-medium text-blue-600/80" : "text-gray-400"}`}>
                          {param.unit}
                        </p>
                      )}
                    </div>
                  </div>
                  {topTenPriority && (
                    <span className="ml-2 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-xs font-bold text-white shadow-sm">
                      {topTenPriority}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-2 flex flex-col items-center">
          <button
            type="button"
            onClick={handleGenerateReport}
            disabled={status === "loading" || selectedParameters.length === 0}
            className={`group relative flex w-full max-w-lg items-center justify-center gap-3 overflow-hidden rounded-xl px-6 py-3.5 text-sm font-bold text-white shadow-lg transition-all duration-300 ${
              status === "loading" || selectedParameters.length === 0
                ? "cursor-not-allowed bg-gray-400 opacity-70"
                : "cursor-pointer bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:from-indigo-600 hover:via-purple-600 hover:to-pink-600 hover:shadow-xl"
            }`}
          >
            {status !== "loading" && (
              <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
            )}
            <span className="relative z-10">
              {status === "loading" ? <Loader2 size={18} className="animate-spin" /> : <FileText size={18} />}
            </span>
            <span className="relative z-10 tracking-wide">Generate PDF Report</span>
            {selectedParameters.length > 0 && (
              <span className="relative z-10 rounded-md border border-white/20 bg-white/20 px-2 py-0.5 text-xs backdrop-blur-sm">
                {selectedParameters.length} item{selectedParameters.length === 1 ? "" : "s"}
              </span>
            )}
          </button>
        </div>

        {status !== "idle" && (
          <div className={`mt-3 rounded-lg border p-3 text-xs ${
            status === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : status === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-blue-200 bg-blue-50 text-blue-700"
          }`}>
            <div className="flex items-center justify-between gap-3">
              <div className="font-semibold">{message}</div>
              <span className="shrink-0 rounded border border-white/70 bg-white/70 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-slate-500">
                {formatDuration(timeElapsed)}
              </span>
            </div>
            {totalParameters > 0 && status === "loading" && (
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all"
                  style={{ width: `${Math.min(100, (completedParameters / totalParameters) * 100)}%` }}
                />
              </div>
            )}
          </div>
        )}
      </div>
      </div>
    </>
  );
}
