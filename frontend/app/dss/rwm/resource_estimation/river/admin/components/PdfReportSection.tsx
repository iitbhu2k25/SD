"use client";

import React, { useState } from "react";
import { useLocation } from "@/contexts/riverwater_assessment/admin/LocationContext";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import LoadingOverlay from "../../components/loadingOverlay";

interface PollJobResult {
  data: {
    results: any[];
    summary: {
      total_attributes: number;
      successful: number;
      failed: number;
    };
    metadata?: any;
  };
}

const WQ_PARAMETERS = [
  { key: "ph", label: "pH", unit: "" },
  { key: "tds", label: "TDS", unit: "mg/L" },
  { key: "ec", label: "EC", unit: "uS/cm" },
  { key: "temperature", label: "Temperature", unit: "C" },
  { key: "turbidity", label: "Turbidity", unit: "NTU" },
  { key: "dissolvedOxygen", label: "Dissolved Oxygen", unit: "mg/L" },
  { key: "orp", label: "ORP", unit: "mV" },
  { key: "tss", label: "TSS", unit: "mg/L" },
  { key: "cod", label: "COD", unit: "mg/L" },
  { key: "bod", label: "BOD", unit: "mg/L" },
  { key: "ts", label: "Total Solids", unit: "mg/L" },
  { key: "chloride", label: "Chloride", unit: "mg/L" },
  { key: "nitrate", label: "Nitrate", unit: "mg/L" },
  { key: "hardness", label: "Hardness", unit: "mg/L" },
  { key: "faecalColiform", label: "Faecal Coliform", unit: "MPN/100ml" },
  { key: "totalColiform", label: "Total Coliform", unit: "MPN/100ml" },
  { key: "wqi", label: "Water Quality Index" },
];

const reportParameters = WQ_PARAMETERS.filter((param) => param.key !== "wqi");

const PdfReportSection: React.FC = () => {
  const { selectedSubDistricts, areaConfirmed, selectedSeason } = useLocation();
  const confirmedSubDistricts = selectedSubDistricts;
  const confirmedStretches: string[] = [];

  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [totalParameters, setTotalParameters] = useState(0);
  const [pdfStatus, setPdfStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [selectedParameters, setSelectedParameters] = useState<string[]>([]);
  const attributeMapping: { [key: string]: string } = {
    ph: "pH",
    tds: "TDS_mg_L_",
    ec: "EC__S_cm_",
    temperature: "Temperatur",
    turbidity: "Turbidity_",
    dissolvedOxygen: "DO_mg_L_",
    orp: "ORP",
    tss: "TSS_mg_L_",
    cod: "COD_mg_L_",
    bod: "BOD_mg_L_",
    ts: "TS_mg_L_",
    chloride: "Chloride_m",
    nitrate: "Nitrate_mg",
    hardness: "Hardness_m",
    faecalColiform: "Faecal_Col",
    totalColiform: "Total_Coli",
    WQI: "WQI",
  };

  const [completedParameters, setCompletedParameters] = useState(0);

  const handleGenerateReport = async () => {
    try {
      setIsGeneratingPDF(true);
      setPdfStatus("loading");
      setTotalParameters(selectedParameters.length + 1); // +1 for WQI
      setErrorMessage("");

      // ==================== VALIDATION ====================
      if (selectedSubDistricts.length === 0) {
        alert("Please select sub-districts first");
        return;
      }

      // if (onGeneratePDF) {
      //   onGeneratePDF(selectedParameters.length + 1); // +1 for WQI
      // }

      // Map frontend parameter keys to backend attribute names
      const backendAttributes = selectedParameters.map(
        (param) =>
          attributeMapping[param as keyof typeof attributeMapping] || param,
      );

      // Always include WQI
      backendAttributes.push("WQI");

      console.log("🔵 Generating PDF Report (Admin - Subdistrict-based)...");
      console.log("   Sub-districts:", selectedSubDistricts);
      console.log("   Backend attributes:", backendAttributes);
      console.log("   Season:", selectedSeason);

      // ==================== FETCH DATA FROM BACKEND ====================
      const response = await fetch(`/django/rwm/start-pdf-report/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subdistrict_codes: selectedSubDistricts, // ✅ Changed from stretch_ids
          attributes: backendAttributes,
          season: selectedSeason,
          data_type: "subdistbased", // ✅ Changed from stretchbased
        }),
      });

      console.log("Response status:", response.status);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const responseData = await response.json();
      const jobId = responseData.job_id;

      console.log("Response data:", responseData);

      // ==================== WEBSOCKET CONNECTION ====================
      const wsUrl = `/django/ws/task/${jobId}`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log("🔌 WebSocket connected to:", wsUrl);
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log("📨 WebSocket message:", data);

        if (data.type === "connection") {
          console.log("✅ Connected to task:", data.task_id);
        } else if (data.status === "processing") {
          console.log(
            `🔄 ${data.attribute}: ${data.message} (${data.progress}%)`,
          );
        } else if (data.status === "completed" && data.attribute) {
          setCompletedParameters((prev) => prev + 1);
          console.log(
            `✅ ${data.attribute} completed (${completedParameters}/${backendAttributes.length})`,
          );
        } else if (data.status === "completed" && data.summary) {
          // ==================== ALL TASKS COMPLETED ====================
          console.log("🎉 All interpolations completed!");
          console.log("   Summary:", data.summary);
          console.log("   Total results:", data.results.length);

          const result: PollJobResult = {
            data: {
              results: data.results,
              summary: data.summary,
              metadata: data.metadata || {},
            },
          };

          ws.close();

          // Generate PDF
          generatePDF(result);
        } else if (data.status === "error") {
          console.log("❌ Error:", data.message);
          ws.close();

          setPdfStatus("error");
          setErrorMessage(
            data.message || "An error occurred during interpolation",
          );
        }
      };

      ws.onerror = (error) => {
        console.log("❌ WebSocket error:", error);
        ws.close();

        setPdfStatus("error");
        setErrorMessage("WebSocket connection failed. Please try again.");
      };

      ws.onclose = () => {
        console.log("🔌 WebSocket closed");
        setCompletedParameters(0);
      };

      const generatePDF = (result: PollJobResult) => {
        // ==================== CREATE PDF DOCUMENT ====================
        const doc = new jsPDF({ orientation: "p", unit: "mm", format: "a4", compress: true });
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 15;

        // ==================== HEADER HEIGHT FOR LOGOS ====================
        const logoHeight = 27;

        // ==================== ADD LOGOS ====================
        const leftLogo = "/Images/export/logo_iitbhu.png";
        const rightLogo = "/Images/export/right1_slcr.png";
        doc.addImage(leftLogo, "JPEG", 15, 10, 20, 20);
        doc.addImage(rightLogo, "JPEG", pageWidth - 40, 10, 25, 25);

        const contentWidth = pageWidth - 2 * margin;

        // ==================== TITLE PAGE ====================
        let yPosition = 125;

        // Calculate text dimensions for the box
        doc.setFontSize(16);
        doc.setFont("times", "bold");
        const headingText =
          "Report on River Water Quality Monitoring\n(Sub-District Analysis)"; // ✅ Updated title
        const textWidth = doc.getTextDimensions(headingText).w;
        const textHeight = doc.getTextDimensions(headingText).h;

        // Box dimensions
        const boxPadding = 10;
        const boxWidth = textWidth + boxPadding * 2;
        const boxHeight = textHeight + boxPadding * 2;
        const boxX = (pageWidth - boxWidth) / 2;
        const boxY = yPosition;

        // Draw rectangle border around heading
        doc.setLineWidth(0.5);
        doc.setDrawColor(0, 0, 0);
        doc.rect(boxX, boxY, boxWidth, boxHeight);

        // Add heading text centered inside the box
        doc.text(
          headingText,
          pageWidth / 2,
          yPosition + boxPadding + textHeight / 2,
          { align: "center" },
        );

        yPosition += boxHeight + 20;

        // Add date and season info
        const reportDate = new Date().toLocaleDateString("en-IN", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });

        const capitalizedSeason =
          selectedSeason.charAt(0).toUpperCase() + selectedSeason.slice(1);
        const pageCenter = pageWidth / 2;

        doc.text(
          `Analysis Period: ${capitalizedSeason} Season`,
          pageCenter,
          yPosition,
          { align: "center" },
        );

        doc.setFontSize(9);
        doc.setFont("times", "italic");
        yPosition += 80;
        doc.text(`Report Generated: ${reportDate}`, margin, yPosition);
        yPosition += 5;

        // ==================== HELPER FUNCTIONS ====================
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
          const textHeight = lines.length * (fontSize * 0.5);

          checkPageBreak(textHeight + 5);

          if (alignment === "center") {
            lines.forEach((line: string) => {
              const textWidth = doc.getTextWidth(line);
              doc.text(line, (pageWidth - textWidth) / 2, yPosition);
              yPosition += fontSize * 0.5;
            });
          } else if (alignment === "justify") {
            if (lines.length > 1) {
              lines.forEach((line: string, index: number) => {
                if (index === lines.length - 1) {
                  doc.text(line, margin, yPosition);
                } else {
                  doc.text(line, margin, yPosition, {
                    align: "justify",
                    maxWidth: contentWidth,
                  });
                }
                yPosition += fontSize * 0.5;
              });
            } else {
              doc.text(lines, margin, yPosition);
              yPosition += textHeight;
            }
          } else {
            doc.text(lines, margin, yPosition);
            yPosition += textHeight;
          }
          yPosition += 5;
        };

        const addLogosToPage = () => {
          try {
            doc.addImage(leftLogo, "JPEG", 15, 10, 20, 20);
            doc.addImage(rightLogo, "JPEG", pageWidth - 40, 10, 25, 25);
          } catch (error) {
            console.log("Error adding logos:", error);
          }
        };

        // ==================== 1. EXECUTIVE SUMMARY ====================
        checkPageBreak(120);

        // Draw horizontal line
        doc.setLineWidth(0.5);
        doc.setDrawColor(0, 0, 0);
        doc.line(margin, yPosition, pageWidth - margin, yPosition);
        yPosition += 10;

        doc.setFontSize(14);
        doc.setFont("times", "bold");
        doc.setTextColor(0, 0, 0);
        doc.text("1. Executive summary", margin, yPosition);
        yPosition += 10;

        doc.setFontSize(11);
        doc.setFont("times", "normal");

        addText(
          "The Water Quality Monitoring module serves as a core component of the Decision Support System for the Varuna Basin. It relies exclusively on field-based observations to assess river health and support sustainable water governance. Seasonal sampling across representative locations—upstream, midstream (urban/tributary zones), and downstream—captures spatial and temporal patterns influenced by hydrological and human factors. The study measures ten key physicochemical and microbiological parameters: Dissolved Oxygen (DO), Biological Oxygen Demand (BOD), Faecal Coliform (FC), pH, Turbidity, Electrical Conductivity (EC), Total Solids (TS), Chemical Oxygen Demand (COD), Temperature, and Nitrate. These parameters are evaluated following CPCB and BIS standards to compute a composite Water Quality Index (WQI), which summarizes the river's overall status. This ground-based framework strengthens data reliability through in-situ and laboratory assessments supported by strict QA/QC protocols, including field duplicates, calibration checks, and laboratory control samples. The resulting WQI provides an interpretable measure of water quality, helping identify critical pollution stretches and guide remedial measures. Unlike prior mixed frameworks, this version eliminates satellite dependence and focuses entirely on field data for improved precision and interpretability.",
          11,
          false,
          "justify",
        );

        // ==================== 2. STUDY AREA ====================
        checkPageBreak(50);

        doc.setFontSize(14);
        doc.setFont("times", "bold");
        doc.text("2. Study area", margin, yPosition);
        yPosition += 10;

        doc.setFontSize(11);
        doc.setFont("times", "normal");

        addText(
          "The Varuna River, a tributary of the Ganga, extends roughly 200 km across the districts of Varanasi and its surroundings. It experiences high seasonal variability due to monsoon flows and anthropogenic stress from urban discharge and agricultural runoff. Sampling sites were selected to represent upstream rural reaches, urban inflow points, and downstream segments to capture cumulative effects.",
          11,
          false,
          "justify",
        );

        // ==================== ADD STUDY AREA MAP IMAGE ====================
        checkPageBreak(100);

        doc.setFontSize(10);
        doc.setFont("times", "italic");

        // Add your study area map image
        const studyAreaImage = "/Images/RWM_WQA/WQI_Sampling_points.png"; // Update with your actual path

        const imgWidth = contentWidth;
        const imgHeight = imgWidth * 0.7; // Adjust ratio based on your image

        checkPageBreak(imgHeight + 10);

        try {
          doc.addImage(
            studyAreaImage,
            "JPEG",
            margin,
            yPosition,
            imgWidth,
            imgHeight,
          );
          yPosition += imgHeight + 5;
        } catch (error) {
          console.log("Error loading study area image:", error);
          yPosition += 10;
        }

        // Add centered caption below the image
        doc.setFontSize(10);
        doc.setFont("times", "italic");
        doc.text(
          "Figure 1: Study area map showing sampling locations",
          pageWidth / 2,
          yPosition,
          { align: "center" },
        );
        yPosition += 10;

        // ==================== 3. METHODOLOGY: GROUND-BASED WQI FRAMEWORK ====================
        checkPageBreak(30);

        doc.setFontSize(14);
        doc.setFont("times", "bold");
        doc.text(
          "3. Methodology: Ground-Based WQI Framework",
          margin,
          yPosition,
        );
        yPosition += 10;

        // ==================== 3.1. SAMPLING AND PARAMETERS ====================
        doc.setFontSize(12);
        doc.setFont("times", "bold");
        doc.text("3.1. Sampling and Parameters", margin, yPosition);
        yPosition += 8;

        doc.setFontSize(11);
        doc.setFont("times", "normal");

        addText(
          "Sampling was conducted during pre-monsoon, monsoon, and post-monsoon seasons. At each site, in-situ measurements included Temperature, pH, EC, DO, and Turbidity, while laboratory analysis covered BOD, COD, Nitrate, TS, and Faecal Coliform. Each parameter followed standard methods from APHA (2017) and guidelines from BIS 10500:2012 and CPCB surface water classes (A–E). Here, CPCB classifies surface water quality into five classes (A–E) based on its intended use. Class A represents water fit for drinking after disinfection, while Class E denotes water suitable only for irrigation and industrial cooling, with intermediate classes (B–D) covering uses such as bathing, drinking after treatment, and propagation of aquatic life.",
          11,
          false,
          "justify",
        );

        // ==================== TABLE 1: PARAMETERS TABLE ====================
        checkPageBreak(30);
        doc.setFontSize(10);
        doc.setFont("times", "bold");
        doc.text(
          "Table 1: Field and laboratory parameters, methods, and permissible limits (as per CPCB/BIS/WHO)",
          pageWidth / 2,
          yPosition,
          { align: "center" },
        );
        yPosition += 8;

        autoTable(doc, {
          startY: yPosition,
          head: [
            [
              "Parameter",
              "Permissible Limit (CPCB/BIS or WHO)",
              "APHA Method (Section)",
              "Reference",
            ],
          ],
          body: [
            [
              "pH",
              "6.5 – 8.5 (BIS 10500:2012)",
              "4500-H+ B",
              "APHA (2017) & BIS (2012); WHO (2017)",
            ],
            [
              "Temperature (°C)",
              "<= 25 °C (WHO: no health-based limit; <= 25 °C for aquatic life)",
              "Field thermometer",
              "WHO (2017)",
            ],
            [
              "Electrical Conductivity (µS/cm)",
              "<= 750 µS/cm (desirable); <= 2 000 µS/cm (permissible) (BIS 10500:2012)",
              "2510 B (Conductivity)",
              "APHA (2017) & BIS (2012)",
            ],
            [
              "Total Dissolved Solids (mg/L)",
              "<= 500 mg/L (desirable); <= 2 000 mg/L (permissible) (BIS 10500:2012)",
              "2540 C (Gravimetric Evaporation)",
              "APHA (2017) & BIS (2012)",
            ],
            [
              "Total Suspended Solids (mg/L)",
              "<= 30 mg/L (WHO turbidity proxy)",
              "2540 D (Gravimetric Suspension)",
              "APHA (2017) & WHO (2017)",
            ],
            [
              "Total Solids (mg/L)",
              "— (sum of TDS + TSS)",
              "2540 B (Evaporation & Ignition)",
              "APHA (2017)",
            ],
            [
              "Dissolved Oxygen (mg/L)",
              ">= 6 mg/L (CPCB Class A); >= 5 mg/L (Class B)",
              "4500-O G (Azide-modified Winkler)",
              'APHA (2017) & CPCB (2002) "Class A/B"',
            ],
            [
              "Turbidity (NTU)",
              "<= 5 NTU (BIS 10500:2012; WHO)",
              "2130 B (Nephelometry)",
              "APHA (2017) & BIS (2012); WHO (2017)",
            ],
            [
              "Oxidation–Reduction Potential",
              "— (200 – 400 mV typical for natural waters)",
              "2580 (ORP electrode)",
              "APHA (2017)",
            ],
            [
              "Chemical Oxygen Demand (mg/L)",
              "<= 3 mg/L (WHO potable recommendation)",
              "5220 D (Closed-reflux, Colorimetric)",
              "APHA (2017) & WHO (2017)",
            ],
            [
              "Biochemical Oxygen Demand (mg/L)",
              "<= 3 mg/L (WHO)",
              "5210 B (5-day, 20 °C incubation)",
              "APHA (2017) & WHO (2017)",
            ],
            [
              "Nitrate (mg/L)",
              "<= 45 mg/L (BIS 10500:2012; WHO)",
              "4500-NO3(-ve) E (UV-Spectrophotometry)",
              "APHA (2017) & BIS (2012); WHO (2017)",
            ],
            [
              "Total Hardness (mg/L as CaCO3)",
              "<= 300 mg/L (desirable); <= 600 mg/L (permissible) (BIS 10500:2012)",
              "2340 B (EDTA titration)",
              "APHA (2017) & BIS (2012)",
            ],
            [
              "Faecal Coliform (CFU/100 mL)",
              "0 CFU/100 mL (BIS 10500:2012; WHO)",
              "9222 D (Multiple-tube fermentation)",
              "APHA (2017) & BIS (2012); WHO (2017)",
            ],
            [
              "Total Coliform (CFU/100 mL)",
              "0 CFU/100 mL (BIS 10500:2012; WHO)",
              "9222 B (Membrane-filter technique)",
              "APHA (2017) & BIS (2012); WHO (2017)",
            ],
          ],
          styles: {
            font: "times",
            fontSize: 8,
            cellPadding: 2,
            overflow: "linebreak",
            halign: "left",
            valign: "middle",
          },
          headStyles: {
            fillColor: [211, 211, 211], // Light gray matching your target
            textColor: [0, 0, 0],
            fontStyle: "bold",
            fontSize: 9,
            halign: "center",
          },
          columnStyles: {
            0: { cellWidth: 35 }, // Parameter - narrower
            1: { cellWidth: 60 }, // Permissible Limit - wider for long text
            2: { cellWidth: 42 }, // APHA Method
            3: { cellWidth: 43 }, // Reference
          },
          margin: { left: margin, right: margin, top: logoHeight + 5 },
          tableWidth: "wrap",
          didDrawPage: function (data) {
            addLogosToPage();
          },
        });

        yPosition = (doc as any).lastAutoTable.finalY + 10;

        // ==================== 3.2. DATA QUALITY ASSURANCE ====================
        checkPageBreak(20);

        doc.setFontSize(12);
        doc.setFont("times", "bold");
        doc.text("3.2. Data Quality Assurance", margin, yPosition);
        yPosition += 8;

        doc.setFontSize(11);
        doc.setFont("times", "normal");

        addText(
          "Data quality assurance was maintained through a combination of field and laboratory controls to ensure reliability and consistency. Field instruments were calibrated before and after sampling, with duplicate and blank samples collected to check precision and contamination. Laboratory analyses followed standard protocols with control samples and detection limit verification. Outliers and missing data were carefully reviewed, and any inconsistencies were corrected or flagged before final WQI computation.",
          11,
          false,
          "justify",
        );

        // ==================== 3.3. WEIGHTING SCHEME ====================
        checkPageBreak(30);
        doc.setFontSize(12);
        doc.setFont("times", "bold");
        doc.text("3.3. Weighting Scheme", margin, yPosition);
        yPosition += 8;

        doc.setFontSize(11);
        doc.setFont("times", "normal");

        addText(
          "Weights are assigned based on the relative importance of each parameter in determining overall water quality. Following the new WQI approach: DO > BOD > FC > pH > Turbidity > EC > TS > COD > Temperature > Nitrate. Your rank order (most to least important): Convert ranks to normalized weights:",
          11,
          false,
          "justify",
        );

        yPosition += 2;

        const rankImage = "/Images/RWM_WQA/rank.png"; // Update with your actual path

        const rankWidth = contentWidth * 0.4;
        const rankHeight = rankWidth * 0.3; // Adjust ratio based on your image

        // checkPageBreak(rankHeight);

        try {
          doc.addImage(
            rankImage,
            "PNG",
            (pageWidth - rankWidth) / 2,
            yPosition,
            rankWidth,
            rankHeight,
          ); // Centered
          yPosition += rankHeight + 3;
        } catch (error) {
          console.log("Error loading rank formula image:", error);
          yPosition += 10;
        }

        doc.setFont("times", "normal");
        addText(
          "(So DO gets the largest weight; Nitrate the smallest.)",
          11,
          false,
          "justify",
        );
        yPosition += 2; // Manual spacing control

        // ==================== 3.3.1. SUB-INDEX CALCULATIONS ====================
        checkPageBreak(20);
        doc.setFontSize(11);
        doc.setFont("times", "bold");
        doc.text("3.3.1. Sub-index (Q_i) calculations", margin, yPosition);
        yPosition += 8;

        doc.setFont("times", "normal");
        addText(
          "To keep WQI interpretable and avoid blow-ups, clamp all Q_i to [0, 300].",
          11,
          false,
          "justify",
        );

        // ==================== 3.3.1.1. BENEFICIAL PARAMETER ====================
        doc.setFontSize(10);
        doc.setFont("times", "bold");
        doc.text(
          "3.3.1.1. Beneficial parameter (higher is better)",
          margin,
          yPosition,
        );
        yPosition += 8;

        doc.setFont("times", "normal");
        addText("DO:", 11, true, "left");

        const doFormulaImage = "/Images/RWM_WQA/Q_do.png";
        const doWidth = contentWidth * 0.6;
        const doHeight = doWidth * 0.2;

        try {
          doc.addImage(
            doFormulaImage,
            "PNG",
            (pageWidth - doWidth) / 2,
            yPosition,
            doWidth,
            doHeight,
          );
          yPosition += doHeight + 3;
        } catch (error) {
          console.log("Error loading DO formula image:", error);
          yPosition += 10;
        }

        doc.setFont("times", "normal");
        addText("Clamp to [0,300].", 11, false, "justify");

        // ==================== 3.3.2. pH ====================
        doc.setFontSize(10);
        doc.setFont("times", "bold");
        doc.text(
          "3.3.2. pH (two-sided deviation from ideal)",
          margin,
          yPosition,
        );
        yPosition += 6;

        // Add pH formula image
        const phFormulaImage = "/Images/RWM_WQA/Q_ph.png";
        const phWidth = contentWidth * 0.7;
        const phHeight = phWidth * 0.15;

        try {
          doc.addImage(
            phFormulaImage,
            "PNG",
            (pageWidth - phWidth) / 2,
            yPosition,
            phWidth,
            phHeight,
          );
          yPosition += phHeight + 5;
        } catch (error) {
          console.log("Error loading pH formula image:", error);
          yPosition += 10;
        }

        doc.setFont("times", "normal");
        addText("Clamp to [0,300].", 11, false, "justify");

        // ==================== 3.3.3. DETRIMENTAL PARAMETERS ====================
        checkPageBreak(30); // Check space for heading
        doc.setFontSize(10);
        doc.setFont("times", "bold");
        doc.text(
          "3.3.3. Detrimental parameters (higher is worse)",
          margin,
          yPosition,
        );
        yPosition += 8;

        checkPageBreak(20); // Check space for description text
        doc.setFontSize(11);
        doc.setFont("times", "normal");

        const detParamsText = doc.splitTextToSize(
          "Use log scaling for heavy-tailed parameters to stabilize extremely high values (FC, BOD, EC, TS, COD, Nitrate) and linear for Turbidity.",
          contentWidth,
        );
        doc.text(detParamsText, margin, yPosition);
        yPosition += detParamsText.length * 5.5;

        // Log-scaled group bullet point
        checkPageBreak(15);
        doc.setFont("times", "bold");
        doc.text("•", margin, yPosition);
        doc.text("Log-scaled group:", margin + 5, yPosition);
        doc.setFont("times", "normal");
        doc.text(" BOD, FC, EC, TS, COD, Nitrate", margin + 42, yPosition);
        yPosition += 5;

        // Log formula image
        const logFormulaImage = "/Images/RWM_WQA/Q_log.png";
        const logWidth = contentWidth * 0.55;
        const logHeight = logWidth * 0.2;

        checkPageBreak(logHeight + 15); // Check space for formula image

        try {
          const logImageX = (pageWidth - logWidth) / 2; // CENTER the image
          doc.addImage(
            logFormulaImage,
            "PNG",
            logImageX,
            yPosition,
            logWidth,
            logHeight,
          );
          yPosition += logHeight + 5;

          // Add "clamp [0,300]" text BELOW the formula, centered
          doc.setFontSize(10);
          doc.text("clamp [0,300]", margin, yPosition);
          yPosition += 8;
        } catch (error) {
          console.log("Error loading log formula image:", error);
          yPosition += 10;
        }

        // Linear: Turbidity
        checkPageBreak(15);
        doc.setFontSize(11);
        doc.setFont("times", "bold");
        doc.text("Linear:", margin, yPosition);
        doc.setFont("times", "normal");
        doc.text(" Turbidity", margin + 18, yPosition);
        yPosition += 4;

        // Turbidity formula image
        const turbFormulaImage = "/Images/RWM_WQA/Q_turb.png";
        const turbWidth = contentWidth * 0.35;
        const turbHeight = turbWidth * 0.3;

        checkPageBreak(turbHeight + 15);

        try {
          const turbImageX = (pageWidth - turbWidth) / 2; // CENTER the image
          doc.addImage(
            turbFormulaImage,
            "PNG",
            turbImageX,
            yPosition,
            turbWidth,
            turbHeight,
          );
          yPosition += turbHeight + 5;

          // Add "clamp [0,300]" text BELOW the formula, centered
          doc.setFontSize(10);
          doc.text("clamp [0,300]", margin, yPosition);
          yPosition += 8;
        } catch (error) {
          console.log("Error loading turbidity formula image:", error);
          yPosition += 10;
        }

        // Temperature section
        checkPageBreak(40);
        doc.setFontSize(11);
        doc.setFont("times", "bold");
        doc.text("Temperature (penalize only above ideal):", margin, yPosition);
        yPosition += 4;

        // Temperature formula image
        const tempFormulaImage = "/Images/RWM_WQA/Q_t.png";
        const tempWidth = contentWidth * 0.45;
        const tempHeight = tempWidth * 0.3;

        checkPageBreak(tempHeight + 15);

        try {
          const tempImageX = (pageWidth - tempWidth) / 2; // CENTER the image
          doc.addImage(
            tempFormulaImage,
            "PNG",
            tempImageX,
            yPosition,
            tempWidth,
            tempHeight,
          );
          yPosition += tempHeight + 5;

          // Add "clamp [0,300]" text BELOW the formula, centered
          doc.setFontSize(10);
          doc.setFont("times", "normal");
          doc.text("clamp [0,300]", margin, yPosition);
          yPosition += 10;
        } catch (error) {
          console.log("Error loading temperature formula image:", error);
          yPosition += 10;
        }

        // Replace S_i note
        checkPageBreak(15);
        doc.setFontSize(10);
        doc.setFont("times", "normal");
        const replaceText = doc.splitTextToSize(
          "Replace S_i (standards) if you adopt different thresholds.",
          contentWidth,
        );
        doc.text(replaceText, margin, yPosition);
        yPosition += replaceText.length * 5 + 4;

        // ==================== 3.3.4. WQI COMPUTATION ====================
        checkPageBreak(30);
        doc.setFontSize(10);
        doc.setFont("times", "bold");
        doc.text(
          "3.3.4. Water Quality Index (WQI) computation",
          margin,
          yPosition,
        );
        yPosition += 8;

        checkPageBreak(15);
        doc.setFontSize(11);
        doc.setFont("times", "normal");
        doc.text("Weighted arithmetic aggregation:", margin, yPosition);
        yPosition += 5;

        // Add WQI formula image
        const wqiFormulaImage = "/Images/RWM_WQA/WQI.png";
        const wqiWidth = contentWidth * 0.25;
        const wqiHeight = wqiWidth * 0.4;

        checkPageBreak(wqiHeight + 10);

        try {
          doc.addImage(
            wqiFormulaImage,
            "PNG",
            (pageWidth - wqiWidth) / 2, // Centered
            yPosition,
            wqiWidth,
            wqiHeight,
          );
          yPosition += wqiHeight + 8;
        } catch (error) {
          console.log("Error loading WQI formula image:", error);
          yPosition += 10;
        }

        // ==================== TABLE: WQI CLASSIFICATION ====================
        checkPageBreak(40);

        autoTable(doc, {
          startY: yPosition,
          head: [
            ["Water Quality", "0-50", "51-100", "101-200", "201-300", "> 300"],
          ],
          body: [
            [
              "Values",
              "Excellent",
              "Good",
              "Poor",
              "Very Poor",
              "Unsuitable for use",
            ],
          ],
          styles: {
            font: "times",
            fontSize: 9,
            cellPadding: 3,
            halign: "center",
            valign: "middle",
          },
          headStyles: {
            fillColor: [211, 211, 211],
            textColor: [0, 0, 0],
            fontStyle: "bold",
            halign: "center",
          },
          columnStyles: {
            0: { cellWidth: 30 },
            1: { cellWidth: 30 },
            2: { cellWidth: 30 },
            3: { cellWidth: 30 },
            4: { cellWidth: 30 },
            5: { cellWidth: 30 },
          },
          margin: { left: margin, right: margin, top: logoHeight + 5 },
          didDrawPage: function (data) {
            addLogosToPage();
          },
          didParseCell: function (data) {
            if (data.cell.raw) {
              data.cell.text = data.cell.text.map((t) => t.replace(/>/g, ">"));
            }
          },
        });

        yPosition = (doc as any).lastAutoTable.finalY + 10;

        // ==================== TABLE 2: PARAMETER WEIGHTS ====================
        checkPageBreak(80);

        doc.setFontSize(10);
        doc.setFont("times", "bold");
        doc.text(
          "Table 2: Parameter weights derived from importance ranking",
          pageWidth / 2,
          yPosition,
          { align: "center" },
        );
        yPosition += 8;

        autoTable(doc, {
          startY: yPosition,
          head: [
            [
              "Parameter",
              "ICMR Permissible Limit",
              "Processed Standard (S_i)",
              "Weight (W_i)",
            ],
          ],
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
          styles: {
            font: "times",
            fontSize: 9,
            cellPadding: 3,
            overflow: "linebreak",
            halign: "center",
            valign: "middle",
          },
          headStyles: {
            fillColor: [211, 211, 211],
            textColor: [0, 0, 0],
            fontStyle: "bold",
            fontSize: 9,
            halign: "center",
          },
          columnStyles: {
            0: { cellWidth: 45, halign: "left" },
            1: { cellWidth: 45 },
            2: { cellWidth: 45 },
            3: { cellWidth: 45 },
          },
          margin: { left: margin, right: margin, top: logoHeight + 5 },
          didDrawPage: function (data) {
            addLogosToPage();
          },
          didParseCell: function (data) {
            if (data.cell.raw) {
              data.cell.text = data.cell.text.map((t) =>
                t
                  .replace(/₁/g, "1")
                  .replace(/₂/g, "2")
                  .replace(/₃/g, "3")
                  .replace(/_/g, ""),
              );
            }
          },
        });

        yPosition = (doc as any).lastAutoTable.finalY + 15;

        // ==================== 4. RESULTS ====================
        checkPageBreak(30);

        doc.setFontSize(14);
        doc.setFont("times", "bold");
        doc.text("4. Results", margin, yPosition);
        yPosition += 10;

        doc.setFontSize(11);
        doc.setFont("times", "normal");

        addText(
          "The ground-based assessment shows clear seasonal and spatial variation in the Water Quality Index (WQI) across the Varuna Basin. Upstream stretches generally fall within the Good to Excellent category, reflecting minimal anthropogenic influence and better ecological balance. In contrast, the urban core and tributary inflow zones exhibit Poor to Very Poor ratings, largely driven by elevated BOD and coliform concentrations associated with domestic and industrial discharge. Downstream reaches demonstrate moderate improvement during the post-monsoon period, likely due to dilution and increased flow. The most influential parameters in determining WQI are DO, BOD, and Faecal Coliform, consistent with their higher assigned weights, while Turbidity and Electrical Conductivity peak during monsoon conditions and nitrate levels remain moderate throughout. Users may further interpret and visualize these results using either an administrative based analysis or a catchment-based approach, depending on the intended management or policy application.",
          11,
          false,
          "justify",
        );

        // ==================== 4.1. SUB-DISTRICT BASED ====================
        checkPageBreak(100);

        doc.setFontSize(12);
        doc.setFont("times", "bold");
        doc.text("4.1. Administrative based", margin, yPosition); // ✅ Changed from "Stretch based"
        yPosition += 10;

        // Helper function for WQI classification
        const getWQIClassification = (mean: number) => {
          if (mean <= 50) return "Excellent";
          if (mean <= 100) return "Good";
          if (mean <= 200) return "Poor";
          if (mean <= 300) return "Very Poor";
          return "Unsuitable for use";
        };

        // ==================== ADD INTERPOLATION MAPS WITH TABLES ====================
        for (const resultItem of result.data.results) {
          if (resultItem.status === "success" && resultItem?.map_image) {
            checkPageBreak(170);

            // Parameter title
            doc.setFontSize(11);
            doc.setFont("times", "bold");
            const paramLabel = resultItem.attribute
              .toUpperCase()
              .replace(/_/g, " ");
            doc.text(`${paramLabel} - Spatial Distribution`, margin, yPosition);
            yPosition += 8;

            // Add map image
            const mapWidth = contentWidth;
            const mapHeight = mapWidth * 0.75;

            // checkPageBreak(mapHeight + 40);

            try {
              doc.addImage(
                resultItem.map_image,
                "JPEG",
                margin,
                yPosition,
                mapWidth,
                mapHeight,
              );
              yPosition += mapHeight + 3;
            } catch (error) {
              console.log(`Error loading ${paramLabel} map:`, error);
              yPosition += 10;
            }

            // Add legend
            // checkPageBreak(20);

            const legendWidth = mapWidth * 0.75;
            const legendHeight = 16;

            try {
              doc.addImage(
                resultItem.legend_image,
                "JPEG",
                margin + (mapWidth - legendWidth) / 2,
                yPosition,
                legendWidth,
                legendHeight,
              );
              yPosition += legendHeight + 6;
            } catch (error) {
              console.log("Error loading legend:", error);
            }

            // Add figure caption
            doc.setFontSize(9);
            doc.setFont("times", "italic");
            const figureNum = result.data.results.indexOf(resultItem) + 2;
            const stats = resultItem.interpolation.statistics;
            const classification = getWQIClassification(stats.mean);

            const isWQI = paramLabel === "WATER QUALITY INDEX (WQI)";
            const captionText = `Figure ${figureNum}: Spatial interpolation map for ${paramLabel.toLowerCase()} (Mean: ${stats.mean.toFixed(
              2,
            )}${isWQI ? ` - ${classification}` : ""})`;

            const wrappedCaption = doc.splitTextToSize(
              captionText,
              contentWidth,
            );

            wrappedCaption.forEach((line: string, index: number) => {
              doc.text(line, pageCenter, yPosition + index * 5, {
                align: "center",
              });
            });

            yPosition += wrappedCaption.length * 5 + 5;

            // ADD TABLE FOR THIS PARAMETER
            checkPageBreak(30);

            doc.setFontSize(9);
            doc.setFont("times", "bold");
            doc.text(
              `Table: ${paramLabel} Statistics${isWQI ? " and Classification" : ""
              }`,
              pageWidth / 2,
              yPosition,
              { align: "center" },
            );
            yPosition += 6;

            let tableHeads;
            let tableBody;

            if (isWQI) {
              tableHeads = [
                "Parameter",
                "Min",
                "Max",
                "Mean",
                "Std Dev",
                "Classification",
              ];
              tableBody = [
                [
                  paramLabel,
                  stats.min.toFixed(2),
                  stats.max.toFixed(2),
                  stats.mean.toFixed(2),
                  stats.std.toFixed(2),
                  classification,
                ],
              ];
            } else {
              tableHeads = ["Parameter", "Min", "Max", "Mean", "Std Dev"];
              tableBody = [
                [
                  paramLabel,
                  stats.min.toFixed(2),
                  stats.max.toFixed(2),
                  stats.mean.toFixed(2),
                  stats.std.toFixed(2),
                ],
              ];
            }

            autoTable(doc, {
              startY: yPosition,
              head: [tableHeads],
              body: tableBody,
              styles: {
                font: "times",
                fontSize: 9,
                cellPadding: 3,
                overflow: "linebreak",
                halign: "center",
                valign: "middle",
              },
              headStyles: {
                fillColor: [211, 211, 211],
                textColor: [0, 0, 0],
                fontStyle: "bold",
                halign: "center",
              },
              columnStyles: isWQI
                ? {
                  0: { cellWidth: 40, halign: "left" },
                  1: { cellWidth: 25 },
                  2: { cellWidth: 25 },
                  3: { cellWidth: 25 },
                  4: { cellWidth: 25 },
                  5: { cellWidth: 40 },
                }
                : {
                  0: { cellWidth: 50, halign: "left" },
                  1: { cellWidth: 30 },
                  2: { cellWidth: 30 },
                  3: { cellWidth: 30 },
                  4: { cellWidth: 30 },
                },
              margin: { left: margin, right: margin, top: logoHeight + 5 },
              didDrawPage: function (data) {
                addLogosToPage();
              },
              didParseCell: function (data) {
                // Color code the classification ONLY for WQI
                if (
                  isWQI &&
                  data.column.index === 5 &&
                  data.row.section === "body"
                ) {
                  const classification = data.cell.text[0];
                  if (classification === "Excellent") {
                    data.cell.styles.textColor = [0, 128, 0];
                  } else if (classification === "Good") {
                    data.cell.styles.textColor = [34, 139, 34];
                  } else if (classification === "Poor") {
                    data.cell.styles.textColor = [255, 140, 0];
                  } else if (classification === "Very Poor") {
                    data.cell.styles.textColor = [255, 0, 0];
                  } else {
                    data.cell.styles.textColor = [139, 0, 0];
                  }
                }
              },
            });

            yPosition = (doc as any).lastAutoTable.finalY + 10;
          }
        }

        // ==================== 5. CONCLUSION ====================
        checkPageBreak(50);

        doc.setFontSize(14);
        doc.setFont("times", "bold");
        doc.text("5. Conclusion", margin, yPosition);
        yPosition += 10;

        doc.setFontSize(11);
        doc.setFont("times", "normal");

        addText(
          "This Water monitoring ground-based data framework, ensuring accurate, verifiable, and locally relevant assessments. This estimation with a fully field-driven model that integrates seasonal and spatial dynamics through a transparent Water Quality Index (WQI) methodology. The system strengthens decision-making for water governance in the Varuna Basin by providing consistent WQI trends for each sampling location and season, enabling the identification of high-risk stretches that require targeted intervention, and maintaining alignment with CPCB's surface water classification standards. Overall, the approach supports adaptive management under changing hydrological and urban conditions while preserving methodological simplicity and transparency.",
          11,
          false,
          "justify",
        );

        // ==================== REPORT METADATA ====================
        checkPageBreak(25);

        doc.setFontSize(9);
        doc.setFont("times", "italic");
        doc.text(
          `Sub-districts Analyzed: ${selectedSubDistricts.length}`, // ✅ Changed from "Stretches"
          margin,
          yPosition,
        );
        yPosition += 5;
        doc.text(
          `Parameters Assessed: ${result.data.results.length}`,
          margin,
          yPosition,
        );

        // ==================== REFERENCES ====================
        checkPageBreak(50);
        yPosition += 10;

        doc.setFontSize(14);
        doc.setFont("times", "bold");
        doc.text("References:", margin, yPosition);
        yPosition += 10;

        doc.setFontSize(10);
        doc.setFont("times", "normal");

        const references = [
          "1. Akhtar, N., Ishak, M. I. S., Ahmad, M. I., Umar, K., Md Yusuff, M. S., Anees, M. T., Qadir, A., & Almanasir, Y. K. (2021). Modification of the water quality index (WQI) process for simple calculation using the multi-criteria decision-making (MCDM) method: A review. Water, 13(7), Article 905. https://doi.org/10.3390/w13070905",

          "2. Gain, A. K., & Giupponi, C. (2014). Impact of the Common Agricultural Policy reform and climatic change on water use in the agriculture sector of Aragon, Spain. Water Resources Management, 28(4), 999-1012. https://doi.org/10.1007/s11269-014-0523-6",

          "3. Makumbura, R. K., Rathnayake, D. T., Gunathilake, M. B., & Rathnayake, U. (2021). Multi-temporal analysis of water quality indices of three waterbodies: A case study from South Florida, USA. E3S Web of Conferences, 266, Article 05003. https://doi.org/10.1051/e3sconf/202126605003",

          "4. Mysiak, J., Giupponi, C., & Rosato, P. (2005). Towards the development of a decision support system for water resource management. Environmental Modelling & Software, 20(2), 203-214. https://doi.org/10.1016/j.envsoft.2004.02.019",

          "5. Raju, N. J., Ram, P., & Dey, S. (2009). Groundwater quality in the lower Varuna River basin, Varanasi district, Uttar Pradesh. Journal of the Geological Society of India, 73(2), 178-192. https://doi.org/10.17491/jgsi/2009/73/62778",

          "6. Rouse, J. W., Jr., Haas, R. H., Schell, J. A., & Deering, D. W. (1973). Monitoring vegetation systems in the Great Plains with ERTS. NASA Special Publication, 351, 309–317.",

          "7. Singh, P., Chaturvedi, R. K., Mishra, A., Kumari, L., Singh, R., Badruddin, I. A., Singh, S. N., Singh, S., Sinha, V., Verma, P., Mishra, S., & Haritash, A. K. (2015). Assessment of ground and surface water quality along the river Varuna, Varanasi, India. Environmental Monitoring and Assessment, 187(4), Article 170. https://doi.org/10.1007/s10661-015-4405-9",
        ];

        references.forEach((ref) => {
          const refLines = doc.splitTextToSize(ref, contentWidth);
          checkPageBreak(refLines.length * 5 + 3);
          doc.text(refLines, margin, yPosition);
          yPosition += refLines.length * 5 + 3;
        });

        // ==================== ADD PAGE NUMBERS ====================
        const pageCount = (doc.internal as any).pages.length - 1;
        for (let i = 1; i <= pageCount; i++) {
          doc.setPage(i);
          doc.setFontSize(9);
          doc.setTextColor(100, 100, 100);
          doc.text(
            `Page ${i} of ${pageCount}`,
            pageWidth / 2,
            pageHeight - 10,
            {
              align: "center",
            },
          );
        }

        // ==================== SAVE PDF ====================
        doc.save(
          `WaterQualityReport_SubDistrict_${new Date().toISOString().split("T")[0]
          }.pdf`,
        ); // ✅ Changed filename

        console.log("✅ PDF generated successfully!");

        setPdfStatus("success");
        console.log("✅ PDF generated successfully!");

        setTimeout(() => {
          setIsGeneratingPDF(false);
        }, 2000);
      };
    } catch (error: any) {
      setIsGeneratingPDF(false);
      console.log("❌ Error:", error);
      console.log("Stack:", error.stack);

      setPdfStatus("error");
      setErrorMessage(
        error.message ||
        "An unexpected error occurred while generating the PDF",
      );
    }
  };

  const handleParameterToggle = (paramKey: string) => {
    setSelectedParameters((prev) =>
      prev.includes(paramKey)
        ? prev.filter((key) => key !== paramKey)
        : [...prev, paramKey],
    );
  };

  // Handle select/deselect all parameters
  const handleSelectAllParameters = () => {
    if (selectedParameters.length === reportParameters.length) {
      setSelectedParameters([]);
    } else {
      setSelectedParameters(reportParameters.map((p) => p.key));
    }
  };

  const handleOverlayComplete = () => {
    setIsGeneratingPDF(false);
    setPdfStatus("loading");
    setErrorMessage("");
  };

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

  const handleSelectTopTen = () => {
    const topTenKeys = reportParameters
      .map((param) => param.key)
      .filter((key) => TOP_TEN_PRIORITY[key] !== undefined)
      .sort((a, b) => TOP_TEN_PRIORITY[a] - TOP_TEN_PRIORITY[b]);
    setSelectedParameters(topTenKeys);
  };

  const handleDeselectTopTen = () => {
    const topTenKeys = new Set(
      reportParameters
        .map((param) => param.key)
        .filter((key) => TOP_TEN_PRIORITY[key] !== undefined),
    );

    setSelectedParameters((prev) =>
      prev.filter((key) => !topTenKeys.has(key)),
    );
  };

  const sortedReportParameters = reportParameters
    .slice()
    .sort((a, b) => {
      const priorityA = TOP_TEN_PRIORITY[a.key] || 999;
      const priorityB = TOP_TEN_PRIORITY[b.key] || 999;
      return priorityA - priorityB;
    });
  const topTenKeys = reportParameters
    .map((param) => param.key)
    .filter((key) => TOP_TEN_PRIORITY[key] !== undefined);
  const allTopTenSelected = topTenKeys.every((key) =>
    selectedParameters.includes(key),
  );

  return (
    <>
      {isGeneratingPDF && (
        <LoadingOverlay
          isGenerating={isGeneratingPDF}
          totalParameters={totalParameters}
          completedParameters={completedParameters}
          onComplete={handleOverlayComplete}
          status={pdfStatus}
          errorMessage={errorMessage}
        />
      )}

      {(confirmedSubDistricts.length > 0 || confirmedStretches.length > 0) &&
        areaConfirmed && (
          <div className="mb-2">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border-l-4 border-l-pink-400">
              <div className="p-5">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-3 h-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full shadow-sm"></div>
                  <h3 className="text-lg font-bold text-gray-800">
                    Generate PDF Report
                  </h3>
                </div>

                <div className="mb-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div>
                        <label className="text-xs font-semibold text-gray-700">
                          Select Water Quality Parameters
                        </label>
                      </div>
                      {/* Question Mark Info Button */}
                      <div className="relative group ml-1">
                        <button
                          type="button"
                          className="inline-flex items-center justify-center w-4 h-4 text-[9px] font-black text-white bg-blue-500 rounded-full hover:bg-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 cursor-help shadow-sm"
                          aria-label="Information about priority rankings"
                        >
                          ?
                        </button>

                        {/* Tooltip */}
                        <div
                          role="tooltip"
                          className="absolute left-1/2 -translate-x-1/2 top-full mt-2 px-3 py-2.5 w-56 text-xs text-white bg-gray-900/95 backdrop-blur-sm rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition-all duration-200 pointer-events-none z-50 border border-white/10"
                        >
                          <p className="font-bold text-sm mb-1.5 text-blue-300">
                            Priority Rankings
                          </p>
                          <p className="text-gray-300 leading-relaxed font-medium">
                            Parameters numbered 1-10 are the most important
                            indicators for water quality assessment, ranked by
                            significance.
                          </p>
                          {/* Tooltip Arrow */}
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 -mb-px">
                            <div className="border-[5px] border-transparent border-b-gray-900/95"></div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="px-2.5 py-1 bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-700 text-xs font-semibold rounded-full">
                        {selectedParameters.length} / {reportParameters.length}
                      </div>
                      <button
                        type="button"
                        onClick={
                          allTopTenSelected
                            ? handleDeselectTopTen
                            : handleSelectTopTen
                        }
                        className="text-xs text-blue-600 hover:text-white font-semibold px-3 py-1 rounded-full border border-blue-200 hover:bg-blue-500 transition-all duration-200"
                      >
                        {allTopTenSelected ? "Deselect Top 10" : "Select Top 10"}
                      </button>
                      <button
                        type="button"
                        onClick={handleSelectAllParameters}
                        className="text-xs text-blue-600 hover:text-white font-semibold px-3 py-1 rounded-full border border-blue-200 hover:bg-blue-500 transition-all duration-200"
                      >
                        {selectedParameters.length === reportParameters.length
                          ? "Deselect All"
                          : "Select All"}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 md:grid-cols-4 gap-2.5">
                    {sortedReportParameters.map((param) => {
                      const topTenPriority = TOP_TEN_PRIORITY[param.key];
                      const isSelected = selectedParameters.includes(param.key);

                      return (
                        <div
                          key={param.key}
                          className={`flex items-center justify-between p-2.5 border-2 rounded-xl transition-all duration-200 cursor-pointer ${isSelected
                            ? "border-blue-400 bg-gradient-to-r from-blue-50 to-indigo-50 shadow-sm hover:shadow-md -translate-y-0.5"
                            : "border-gray-200/80 bg-white hover:border-gray-300 hover:shadow-sm hover:-translate-y-0.5 opacity-80 hover:opacity-100"
                            }`}
                          onClick={() => handleParameterToggle(param.key)}
                        >
                          <div className="flex items-center min-w-0 flex-1">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onClick={(e) => e.stopPropagation()}
                              onChange={() => handleParameterToggle(param.key)}
                              className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer flex-shrink-0"
                            />
                            <div className="ml-2 text-xs min-w-0 flex-1">
                              <label className="font-semibold text-gray-900 cursor-pointer block truncate">
                                {param.label}
                              </label>
                              {param.unit && (
                                <p className="text-gray-400 text-[10px] truncate">
                                  {param.unit}
                                </p>
                              )}
                            </div>
                          </div>

                          {topTenPriority && (
                            <div className="ml-2 flex-shrink-0 bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center shadow-sm">
                              {topTenPriority}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-col items-center mt-2">
                  <button
                    onClick={handleGenerateReport}
                    disabled={selectedParameters.length === 0}
                    className={`
                            group relative overflow-hidden w-full max-w-lg py-3.5 px-6 rounded-xl font-bold text-sm text-white transition-all duration-300 flex items-center justify-center gap-3 cursor-pointer shadow-lg
                            ${selectedParameters.length === 0
                        ? "bg-gray-400 cursor-not-allowed opacity-70"
                        : "bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:from-indigo-600 hover:via-purple-600 hover:to-pink-600 hover:shadow-xl hover:scale-[1.01]"
                      }
                        `}
                  >
                    <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></span>
                    <span className="text-xl relative z-10 drop-shadow-sm filter">📄</span>
                    <span className="relative z-10 tracking-wide text-[15px]">Generate PDF Report</span>
                    {selectedParameters.length > 0 && (
                      <span className="relative z-10 text-xs px-2 py-0.5 bg-white/20 rounded-md backdrop-blur-sm border border-white/20">
                        {selectedParameters.length} item{selectedParameters.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </button>

                  <p className="text-[11px] text-gray-400 text-center mt-3 font-medium flex items-center gap-1.5">
                    <span>ⓘ</span> Report will include study area map, methodology, and data for selected parameters
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
    </>
  );
};

export default PdfReportSection;
