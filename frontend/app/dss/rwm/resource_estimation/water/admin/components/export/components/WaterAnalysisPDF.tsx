// import React from "react";
// import { Document, Page, StyleSheet, View } from "@react-pdf/renderer";
// import { CoverPage } from "./CoverPage";
// import { ExecutiveSummary } from "./ExecutiveSummary";
// import { BasinContext } from "./BasinContext";
// import { RainfallRunoffSection } from "./RainfallRunoffSection";
// import { MethodologyTheory } from "./MethodologyTheory";
// import { PrimaryDatasets } from "./PrimaryDatasets";
// import { DataProcessing } from "./DataProcessing";
// import { OperationalEquations } from "./OperationalEquations";
// import { SWCISection } from "./SWCISection";
// import { TemporalAnalysis } from "./TemporalAnalysis";
// import { ResultsSection } from "./ResultsSection";
// import { RasterDetails } from "./RasterDetails";
// import { Conclusions } from "./Conclusions";
// import { References } from "./References";
// interface RasterData {
//   layer_name: string;
//   volume_MLD?: number;
//   year?: number;
//   [key: string]: any;
// }

// interface WaterAnalysisPDFProps {
//   exportData: any;
//   rasterResponse: any;
//   subdistrictCodes: number[];
//   mapImageUrl?: string;
// }

// const pdfPageStyles = StyleSheet.create({
//   page: {
//     paddingTop: 50,
//     paddingBottom: 50,
//     paddingLeft: 60,
//     paddingRight: 60,
//     fontSize: 11,
//     fontFamily: "Times-Roman" as const,
//     backgroundColor: "#ffffff",
//     lineHeight: 1.6,
//   },
// });

// export const WaterAnalysisPDF: React.FC<WaterAnalysisPDFProps> = ({
//   exportData,
//   rasterResponse,
//   subdistrictCodes,
//   mapImageUrl,
// }) => {
//   const { year, season, productType, timeScale } = exportData;

//   const firstRaster = rasterResponse?.clipped_rasters?.[0];
//   const totalWaterBudget = firstRaster?.volume_MLD || 0;

//   return (
//     <Document>
//       {/* PAGE 1: COVER PAGE  */}
//       <Page size="A4" style={pdfPageStyles.page}>
//         <CoverPage />
//       </Page>

// {/* PAGE 2: EXECUTIVE SUMMARY */}
// {/* <Page size="A4" style={pdfPageStyles.page}>
//   <ExecutiveSummary />
// </Page> */}

// <Page size="A4" style={pdfPageStyles.page}>
  
   
//     <ExecutiveSummary />
//     <BasinContext />
//     <RainfallRunoffSection />
//     <MethodologyTheory />
//     <PrimaryDatasets />
//     <DataProcessing />
//     <OperationalEquations />
//     <SWCISection />
//     <TemporalAnalysis />
//     <ResultsSection
//       totalWaterBudget={totalWaterBudget}
//       productType={productType}
//       year={year}
//       season={season}   timeScale={timeScale}
//       mapImageUrl={mapImageUrl}
//     />
//     <RasterDetails clippedRasters={rasterResponse?.clipped_rasters} />
//     <Conclusions />
    
    
  
// </Page>


//       {/* PAGE 3: BASIN CONTEXT
//       <Page size="A4" style={pdfPageStyles.page}>
//         <BasinContext />
//       </Page> */}

//       {/* PAGE 4: RAINFALL-RUNOFF */}
//       {/* <Page size="A4" style={pdfPageStyles.page}>
//         <RainfallRunoffSection />
//       </Page> */}

//       {/* PAGE 5: METHODOLOGY THEORY */}
//       {/* <Page size="A4" style={pdfPageStyles.page}>
//         <MethodologyTheory />
//       </Page> */}

//       {/* PAGE 6: PRIMARY DATASETS */}
//       {/* <Page size="A4" style={pdfPageStyles.page}>
//         <PrimaryDatasets />
//       </Page> */}

//       {/* PAGE 7: DATA PROCESSING */}
//       {/* <Page size="A4" style={pdfPageStyles.page}>
//         <DataProcessing />
//       </Page> */}

//       {/* PAGE 8: OPERATIONAL EQUATIONS */}
//       {/* <Page size="A4" style={pdfPageStyles.page}>
//         <OperationalEquations />
//       </Page> */}

//       {/* PAGE 9: SWCI SECTION */}
//       {/* <Page size="A4" style={pdfPageStyles.page}>
//         <SWCISection />
//       </Page> */}

//       {/* PAGE 10: TEMPORAL ANALYSIS */}
//       {/* <Page size="A4" style={pdfPageStyles.page}>
//         <TemporalAnalysis />
//       </Page> */}

//       {/* PAGE 11: RESULTS */}
//       {/* <Page size="A4" style={pdfPageStyles.page}>
//         <ResultsSection
//           totalWaterBudget={totalWaterBudget}
//           productType={productType}
//           year={year}
//           season={season}
//           timeScale={timeScale}
//           mapImageUrl={mapImageUrl}
//         />
//       </Page> */}

//       {/* PAGE 12: RASTER DETAILS */}
//       {/* {rasterResponse?.clipped_rasters && (
//         <Page size="A4" style={pdfPageStyles.page}>
//           <RasterDetails clippedRasters={rasterResponse.clipped_rasters} />
//         </Page>
//       )} */}

//       {/* PAGE 13: CONCLUSIONS */}
//       {/* <Page size="A4" style={pdfPageStyles.page}>
//         <Conclusions />
//       </Page> */}

//       {/* PAGE 14: REFERENCES */}
//       <Page size="A4" style={pdfPageStyles.page}>
//         <References />
//       </Page>
//     </Document>
//   );
// };










// // ============================================================
// //  WaterAnalysisPDF.ts  -  jsPDF + autoTable implementation
// //  Replaces all @react-pdf/renderer components
// //  Mirrors the style/conventions of the WQI PDF generator
// // ============================================================

// import jsPDF from "jspdf";
// import autoTable from "jspdf-autotable";

// // ---------------------------------------------
// //  Types
// // ---------------------------------------------
// interface RasterData {
//   layer_name: string;
//   volume_MLD?: number;
//   year?: number;
//   [key: string]: any;
// }

// interface WaterAnalysisPDFOptions {
//   exportData: {
//     year: number;
//     season: string;
//     productType: string;
//     timeScale: string;
//   };
//   rasterResponse: {
//     clipped_rasters: RasterData[];
//   };
//   subdistrictCodes?: number[];
//   mapImageUrl?: string;   // base64 or URL
//   legendImageUrl?: string; // base64 or URL for legend
//   chartImageUrl?: string;  // base64 PNG of Plotly chart
// }

// // ---------------------------------------------
// //  Entry point  -  call this to generate & save
// // ---------------------------------------------
// export async function generateWaterAnalysisPDF(
//   options: WaterAnalysisPDFOptions
// ): Promise<void> {
//   const { exportData, rasterResponse, subdistrictCodes = [], mapImageUrl, legendImageUrl, chartImageUrl } =
//     options;

//   const { year, season, productType, timeScale } = exportData;
//   const clippedRasters = rasterResponse?.clipped_rasters ?? [];
//   const totalWaterBudget = clippedRasters[0]?.volume_MLD ?? 0;
//   const endYear = clippedRasters.length > 1
//     ? Math.max(...clippedRasters.map((r: any) => r.year))
//     : year;

//   // -- Document setup --------------------------
//   const doc = new jsPDF({ orientation: "p", unit: "mm", format: "a4", compress: true });
//   const PW = doc.internal.pageSize.getWidth();   // 210
//   const PH = doc.internal.pageSize.getHeight();  // 297
//   const M  = 20;          // margin
//   const CW = PW - 2 * M;  // content width  = 170

//   // Logo paths (same convention as WQI report)
//   const LEFT_LOGO  = "/Images/export/logo_iitbhu.png";
//   const RIGHT_LOGO = "/Images/export/right1_slcr.png";
//   const LOGO_H     = 20;   // logo height
//   const LOGO_TOP   =  8;   // logo top offset
//   const CONTENT_TOP = LOGO_TOP + LOGO_H + 6; // y where body begins on header pages

//   // -- Shared helpers ---------------------------

//   /** Add both logos to the current page */
//   const addLogos = () => {
//     try { doc.addImage(LEFT_LOGO,  "PNG", M,          LOGO_TOP, 20, LOGO_H); } catch (_) {}
//     try { doc.addImage(RIGHT_LOGO, "PNG", PW - M - 25, LOGO_TOP, 25, LOGO_H); } catch (_) {}
//   };

//   let y = 0; // current y cursor

//   /** Add a new page, draw logos, reset cursor */
//   const newPage = () => {
//     doc.addPage();
//     addLogos();
//     y = CONTENT_TOP;
//   };

//   /**
//    * Check if `needed` mm fits below current y.
//    * If not, start a new page.
//    */
//   const ensureSpace = (needed: number) => {
//     if (y + needed > PH - M) newPage();
//   };

//   /**
//    * Render wrapped text, respecting page breaks.
//    * Returns the new y after rendering.
//    */
//   const addText = (
//     text: string,
//     opts: {
//       fontSize?: number;
//       bold?: boolean;
//       italic?: boolean;
//       align?: "left" | "center" | "justify";
//       color?: [number, number, number];
//       marginBottom?: number;
//     } = {}
//   ) => {
//     const {
//       fontSize    = 11,
//       bold        = false,
//       italic      = false,
//       align       = "left",
//       color       = [0, 0, 0],
//       marginBottom = 5,
//     } = opts;

//     doc.setFontSize(fontSize);
//     doc.setTextColor(...color);
//     const style = bold ? "bold" : italic ? "italic" : "normal";
//     doc.setFont("times", style);

//     const lines: string[] = doc.splitTextToSize(text, CW);
//     const lineH = fontSize * 0.53;

//     // Check if whole block fits; if not, start new page first
//     ensureSpace(lines.length * lineH + marginBottom);
//     // Re-apply font after possible page break
//     doc.setFontSize(fontSize);
//     doc.setTextColor(...color);
//     doc.setFont("times", style);
//     lines.forEach((line) => {
//       if (y + lineH > PH - M) {
//         doc.addPage();
//         addLogos();
//         y = CONTENT_TOP;
//         doc.setFontSize(fontSize);
//         doc.setTextColor(...color);
//         doc.setFont("times", style);
//       }
//       if (align === "center") {
//         doc.text(line, PW / 2, y, { align: "center" });
//       } else {
//         doc.text(line, M, y);
//       }
//       y += lineH;
//     });
//     y += marginBottom;
//   };

//   /** Section heading  (e.g. "1. Executive Summary") */
//   const sectionHeading = (text: string, level: 1 | 2 = 1) => {
//     ensureSpace(14);
//     y += level === 1 ? 4 : 2;
//     addText(text, {
//       fontSize:     level === 1 ? 13 : 12,
//       bold:         true,
//       marginBottom: 6,
//     });
//   };

//   /** Horizontal rule */
//   const hRule = () => {
//     doc.setDrawColor(0, 0, 0);
//     doc.setLineWidth(0.4);
//     doc.line(M, y, PW - M, y);
//     y += 4;
//   };

//   /**
//    * Draw a centred equation box that ALWAYS fits within the page margins.
//    * Shrinks font automatically if text is too wide.
//    * highlight=true uses a blue accent box.
//    */
//   const addEquation = (
//     eq: string,
//     opts: { highlight?: boolean } = {}
//   ) => {
//     const accent = opts.highlight ?? false;

//     // Use a fixed safe font size - no font-metric guessing
//     const fs    = 10;
//     const padH  = 6;   // horizontal padding inside box (each side)
//     const padV  = 5;   // vertical padding inside box (each side)
//     const lineH = fs * 0.55;

//     // Box spans full content width - same as all other content blocks
//     const boxX = M;
//     const boxW = CW;

//     // Split equation into lines that fit inside the box padding
//     doc.setFontSize(fs);
//     doc.setFont("times", "italic");
//     const eqLines: string[] = doc.splitTextToSize(eq, boxW - padH * 2);
//     const boxH = padV * 2 + eqLines.length * lineH + 2;

//     ensureSpace(boxH + 4);

//     // Draw box
//     if (accent) {
//       doc.setFillColor(230, 244, 255);
//       doc.setDrawColor(22, 78, 99);
//       doc.setLineWidth(0.5);
//     } else {
//       doc.setFillColor(248, 249, 250);
//       doc.setDrawColor(180, 180, 180);
//       doc.setLineWidth(0.3);
//     }
//     doc.roundedRect(boxX, y, boxW, boxH, 2, 2, "FD");

//     // Draw each line centred inside the box
//     doc.setFontSize(fs);
//     doc.setFont("times", "italic");
//     doc.setTextColor(0, 0, 0);
//     eqLines.forEach((line: string, i: number) => {
//       doc.text(
//         line,
//         PW / 2,
//         y + padV + (i + 0.75) * lineH,
//         { align: "center" }
//       );
//     });

//     y += boxH + 5;
//   };

//   // -- Page numbers (added last) ----------------
//   // We stamp page numbers after all content is written (loop at end).

//   // ==============================================
//   //  PAGE 1 - COVER PAGE
//   // ==============================================
//   addLogos();


//   // -- Pre-calculate title box height so it never overflows --
//   const TITLE_FONT   = 16;
//   const SUBTITLE_FONT = 11;
//   const BOX_PAD      = 8;   // inner padding top/bottom
//   const titleText    = "Comprehensive Report on Water Availability";
//   const subtitleText = "A Geospatial and Hydrological Analysis for Water Resource Assessment";

//   doc.setFontSize(TITLE_FONT);
//   doc.setFont("times", "bold");
//   const titleLines: string[]    = doc.splitTextToSize(titleText,    CW - BOX_PAD * 2);

//   doc.setFontSize(SUBTITLE_FONT);
//   doc.setFont("times", "normal");
//   const subtitleLines: string[] = doc.splitTextToSize(subtitleText, CW - BOX_PAD * 2);

//   const titleBlockH =
//     BOX_PAD +
//     titleLines.length    * (TITLE_FONT    * 0.45) + 4 +
//     subtitleLines.length * (SUBTITLE_FONT * 0.45) +
//     BOX_PAD;

//   // Draw the title box at a fixed vertical centre of the page
//   const BOX_TOP = 95;
//   doc.setFillColor(240, 249, 255);
//   doc.setDrawColor(22, 78, 99);
//   doc.setLineWidth(0.6);
//   doc.roundedRect(M, BOX_TOP, CW, titleBlockH, 3, 3, "FD");

//   // Title text inside box
//   y = BOX_TOP + BOX_PAD + TITLE_FONT * 0.45;
//   doc.setFontSize(TITLE_FONT);
//   doc.setFont("times", "bold");
//   doc.setTextColor(22, 78, 99);
//   titleLines.forEach((line: string) => {
//     doc.text(line, PW / 2, y, { align: "center" });
//     y += TITLE_FONT * 0.45;
//   });

//   y += 4; // gap between title and subtitle
//   doc.setFontSize(SUBTITLE_FONT);
//   doc.setFont("times", "normal");
//   doc.setTextColor(55, 65, 81);
//   subtitleLines.forEach((line: string) => {
//     doc.text(line, PW / 2, y, { align: "center" });
//     y += SUBTITLE_FONT * 0.45;
//   });

//   // -- Meta block - starts below the box with a fixed gap --
//   y = BOX_TOP + titleBlockH + 12;

//   const reportDate = new Date().toLocaleDateString("en-IN", {
//     year: "numeric", month: "long", day: "numeric",
//   });

//   const labelW    = 38; // mm reserved for bold label column
//   const valueMaxW = CW - labelW;

//   const metaLines: [string, string][] = [
//     ["Prepared by",   "IIT (BHU), Varanasi"],
//     ["Date",          reportDate],
//     ["Year / Season", `${year} / ${season.charAt(0).toUpperCase() + season.slice(1)}`],
//     ["Product Type",  productType || "Water Budget"],
//     ["Time Scale",    timeScale   || "Annual"],
//   ];

//   const LINE_H = 6.5;

//   metaLines.forEach(([label, value]) => {
//     // Work out how many lines the value needs
//     doc.setFontSize(11);
//     doc.setFont("times", "normal");
//     const valueLines: string[] = doc.splitTextToSize(value, valueMaxW);
//     const rowH = valueLines.length * LINE_H + 2;

//     // Bold label
//     doc.setFont("times", "bold");
//     doc.setTextColor(0, 0, 0);
//     doc.text(`${label}:`, M, y);

//     // Normal value - indented past the label column
//     doc.setFont("times", "normal");
//     valueLines.forEach((vLine: string, vi: number) => {
//       doc.text(vLine, M + labelW, y + vi * LINE_H);
//     });

//     y += rowH;
//   });

//   // Footer band (always at bottom of page 1, not affected by y cursor)
//   doc.setFillColor(22, 78, 99);
//   doc.rect(0, PH - 22, PW, 22, "F");
//   doc.setFontSize(10);
//   doc.setFont("times", "normal");
//   doc.setTextColor(255, 255, 255);
//   doc.text("Department of Civil Engineering",                   PW / 2, PH - 13, { align: "center" });
//   doc.text("Indian Institute of Technology (BHU), Varanasi",   PW / 2, PH - 6,  { align: "center" });

//   // ==============================================
//   //  PAGE 2 - EXECUTIVE SUMMARY
//   // ==============================================
//   newPage();
//   hRule();
//   sectionHeading("1. Executive Summary");

//   addText(
//     "The Water Availability sub-module estimates surface water quantity generated and sustained within the Varuna Basin " +
//     "through basin-scale rainfall-runoff modeling embedded in decision support system. This framework translates climatic " +
//     "inputs and land-surface interactions into spatially explicit measures of runoff, infiltration, and discharge at 500 m " +
//     "resolution, providing quantitative foundations for water resource planning within the decision making. Water availability " +
//     "represents a central concern in the Varuna Basin, where rainfall variability, land use change, and population growth " +
//     "increasingly pressure local water resources. The operational monitoring framework captures these dynamics through " +
//     "integration of multiple Earth observation datasets viz., TerraClimate (precipitation & runoff) and MODIS " +
//     "evapotranspiration, to generate comprehensive water budget assessments incorporating bias-corrected precipitation " +
//     "against Indian Meteorological Department (IMD) observations and accounting for physical losses through seepage. Key " +
//     "outcomes include basin-wide quantification of surface water availability, computed through water balance equation. " +
//     "Outputs are resolved spatially at 500 m through pixel-level mapping and temporally at seasonal and annual scales. " +
//     "This resolution enables identification of water-deficit hotspots and prioritization of interventions for agricultural, " +
//     "urban, and ecosystem needs, moving beyond isolated measurements toward dynamic basin-scale assessments that support " +
//     "data-driven water governance.",
//     { align: "left" }
//   );

//   // ==============================================
//   //  SECTION 2 - BASIN CONTEXT
//   // ==============================================
//   ensureSpace(30);
//   hRule();
//   sectionHeading("2. Basin and Water Availability Challenges");

//   addText(
//     "Water availability in the Varuna Basin is governed by intertwined climatic, geomorphic, and anthropogenic factors " +
//     "that complicate reliable assessment and management of surface water resources. As a rain-fed tributary of the Ganga, " +
//     "the basin depends heavily on monsoonal precipitation, which supplies most of the annual inflow and creates pronounced " +
//     "contrasts between surplus conditions during the monsoon and acute shortages in the pre-monsoon months. These dynamics " +
//     "highlight the need for basin-scale monitoring and forecasting frameworks that can track both seasonal variability and " +
//     "long-term trends. Natural controls play a central role in shaping hydrological responses. The basin's alluvial geology " +
//     "exhibits spatially variable infiltration potential, influencing how rainfall is partitioned among surface runoff, " +
//     "groundwater recharge, and soil moisture storage. Steeper upper reaches promote rapid runoff and limited retention, " +
//     "while gentler downstream areas favor stagnation and sediment deposition; clay-rich soils restrict infiltration and " +
//     "enhance overland flow, whereas sandy and mixed textures support recharge but can deplete quickly. Human pressures " +
//     "compound these vulnerabilities. Expansion of irrigated agriculture, especially rice-wheat systems, has raised water " +
//     "demand and altered infiltration and runoff pathways, and urbanization around Varanasi has replaced permeable surfaces " +
//     "with built-up areas, increasing runoff and reducing recharge. Inadequate drainage and industrial effluents further " +
//     "degrade water quality, so scarcity increasingly reflects misaligned demand and pollution as much as limited natural " +
//     "supply, making robust, integrated water availability frameworks indispensable.",
//     { align: "left" }
//   );

//   // 2.2 Rainfall-Runoff
//   ensureSpace(20);
//   sectionHeading("2.2 Rainfall-Runoff Modeling Framework", 2);

//   addText(
//     "Rainfall-runoff modeling provides a structured means to quantify how precipitation is partitioned into " +
//     "evapotranspiration, infiltration, soil water storage, and surface runoff, supporting consistent water balance " +
//     "estimation across heterogeneous terrain and land uses, even where direct flow records are sparse [5]. By integrating " +
//     "spatial inputs such as land use/land cover, soil texture, and topography, these models capture variability in " +
//     "hydrological responses and enable comparison between sub-basins or management units [6]. In the Varuna Basin, where " +
//     "pronounced seasonal variability and human pressures drive sharp contrasts in water supply, this framework is essential " +
//     "for diagnosing when and where water deficits are most likely to occur, and can be extended over multiple years or " +
//     "coupled with climate projections to explore future water availability scenarios. Embedding model outputs within the " +
//     "Decision Support System transforms gridded results into interactive maps and indicators, helping decision-makers " +
//     "prioritize rainwater harvesting, managed recharge, and irrigation scheduling based on seasonal runoff potential.",
//     { align: "left" }
//   );

//   // ==============================================
//   //  SECTION 3 - METHODOLOGY
//   // ==============================================
//   ensureSpace(30);
//   hRule();
//   sectionHeading("3. Methodology");

//   // 3.1 Theoretical Foundation
//   sectionHeading("3.1 Theoretical Foundation: Water Balance Equation", 2);

//   addText(
//     "The fundamental water balance equation represents conservation of mass for the hydrological cycle over a " +
//     "defined spatial domain and time period:",
//     { align: "left" }
//   );

//   addEquation("Delta_S = P - ET - Q - I");

//   addText(
//     "where Delta_S represents change in storage (soil water, groundwater), P is precipitation, ET is evapotranspiration, " +
//     "Q is surface and subsurface runoff, and I is infiltration [5].",
//     { align: "left" }
//   );

//   addText(
//     "The implemented water balance in Google Earth Engine adapts this framework to basin-scale satellite-based " +
//     "analysis at pixel level, as shown in Table 1.",
//     { align: "left" }
//   );

//   // Table 1: Correspondence
//   ensureSpace(12);
//   doc.setFontSize(10);
//   doc.setFont("times", "normal");
//   doc.setTextColor(0, 0, 0);
//   doc.text(
//     "Table 1: Correspondence between theoretical components and operational implementation",
//     PW / 2, y, { align: "center" }
//   );
//   y += 6;

//   autoTable(doc, {
//     startY: y,
//     head: [["Theoretical Variable", "Implementation", "Source Dataset"]],
//     body: [
//       ["P_day (Precipitation)",       "P_corrected",       "TerraCLIMATE + IMD correction"],
//       ["E_a (Evapotranspiration)",     "ET_normalized",     "MODIS MOD16A2GF"],
//       ["Q_surf + Q_gw (Total runoff)", "Q",                 "TerraCLIMATE runoff"],
//       ["w_seep (Seepage)",             "0.12 * water budget","Empirical (12% loss)"],
//     ],
//     styles:      { font: "times", fontSize: 10, cellPadding: 4, halign: "left", valign: "middle" },
//     headStyles:  { fillColor: [211, 211, 211], textColor: [0, 0, 0], fontStyle: "bold", halign: "center" },
//     columnStyles:{ 0: { cellWidth: 55 }, 1: { cellWidth: 40 }, 2: { cellWidth: 75 } },
//     margin:      { left: M, right: M, top: CONTENT_TOP },
//     didDrawPage: () => addLogos(),
//   });
//   y = (doc as any).lastAutoTable.finalY + 10;

//   // 3.3 Primary Datasets
//   ensureSpace(20);
//   sectionHeading("3.3 Primary Datasets", 2);

//   addText(
//     "This sub-module relies on three complementary datasets that together enable a robust, satellite-driven " +
//     "characterization of water balance in the Varuna Basin. TerraCLIMATE provides global high-resolution (approximately " +
//     "4 km) monthly climate and climatic water balance data from 1958 onwards, combining WorldClim climatological normals " +
//     "with CRU TS 4.0 and JRA55 reanalysis within a modified Thornthwaite-Mather model, and supplies precipitation (p_r), " +
//     "actual evapotranspiration (a_et), and runoff (r_no) as millimeter-depth inputs for basin-scale assessments in " +
//     "data-scarce settings. The MODIS Terra Net Evapotranspiration product (MOD16A2GF Version 6.1) contributes gap-filled " +
//     "8-day evapotranspiration at 500 m resolution, computed using the Penman-Monteith formulation:",
//     { align: "left" }
//   );

//   addEquation("ET = (Delta*(Rn-G) + rho_a*cp*(es-ea)/ra) / (Delta + gamma*(1 + rs/ra))");

//   addText(
//     "where Rn is net radiation, G is soil heat flux, es-ea is vapor pressure deficit, rs is surface resistance, " +
//     "ra is aerodynamic resistance, Delta is the slope of the saturation vapor pressure curve, and gamma is the psychrometric " +
//     "constant. To reduce systematic bias in satellite-derived precipitation, TerraCLIMATE rainfall is further adjusted " +
//     "using Indian Meteorological Department gauge data through a linear bias-correction:",
//     { align: "left" }
//   );

//   addEquation("P_corrected = a * P_TC + b");

//   addText(
//     "with slope a = 1.01 and intercept b = 10.12, thereby improving representation of intense, convective monsoon " +
//     "rainfall typical of the Indo-Gangetic plains.",
//     { align: "left" }
//   );

//   // 3.4 Data Processing
//   ensureSpace(20);
//   sectionHeading("3.4 Data Processing and Integration Procedures", 2);

//   addText(
//     "This sub-module applies a five-step Google Earth Engine workflow to derive pixel-wise water balance in the " +
//     "Varuna Basin. First, monthly TerraCLIMATE and MODIS products are aggregated to seasonal or annual periods, and " +
//     "TerraCLIMATE precipitation is bias-corrected using IMD coefficients so that P_corrected = a * P_TC + b. " +
//     "MODIS evapotranspiration is then normalized to the TerraCLIMATE AET range by computing:",
//     { align: "left" }
//   );

//   addEquation("MODIS_norm = (MODIS - MODIS_min) / (MODIS_max - MODIS_min)");
//   addEquation("ET_normalized = MODIS_norm * (TC_max - TC_min) + TC_min");
//   addEquation("WB = (P_corrected - ET_normalized - Q) * 0.25 * 0.88");

//   addText(
//     "where 0.25 converts millimeter depth to volume at 500 m resolution (0.25 km2 per pixel) and 0.88 allocates 88% " +
//     "of the budget to soil water in the root zone and 12% to seepage losses.",
//     { align: "left" }
//   );

//   // 3.5 Combined Operational Equations
//   ensureSpace(20);
//   sectionHeading("3.5 Combined Operational Water Balance Equations", 2);

//   addText("The final operational formula integrates all corrections and adjustments:", { align: "left" });

//   addEquation("WB = (P_corrected - ET_normalized - Q) * 0.25 * 0.88", { highlight: true });

//   addText(
//     "where P_corrected is IMD-corrected precipitation (mm), ET_normalized is MODIS ET rescaled to TerraCLIMATE range (mm), " +
//     "Q is TerraCLIMATE runoff (mm), 0.25 is the pixel area conversion factor (to km2), and 0.88 is the seepage loss " +
//     "compensation factor. Daily water balance is derived through temporal disaggregation:",
//     { align: "left" }
//   );

//   addEquation("W_daily = W_b / n_days");

//   addText("where n_days is the number of days in the analysis period.", { align: "left" });

//   // 3.6 SWCI
//   ensureSpace(20);
//   sectionHeading("3.6 Soil Water Content Index (SWCI)", 2);

//   addText(
//     "The Soil Water Content Index (SWCI) is a standardized anomaly (z-score) of daily water balance, enabling " +
//     "classification of water availability conditions relative to long-term climatology:",
//     { align: "left" }
//   );

//   addEquation("SWCI = (WB_daily - mean_WB) / std_WB");

//   addText(
//     "where WB_daily is the daily-mean water balance for a given year or period, mean_WB is the long-term mean daily water " +
//     "balance, and std_WB is its standard deviation [12]. SWCI values are classified into ten categories as detailed in Table 2.",
//     { align: "left" }
//   );

//   // Table 2: SWCI Classification
//   ensureSpace(12);
//   doc.setFontSize(10);
//   doc.setFont("times", "normal");
//   doc.setTextColor(0, 0, 0);
//   doc.text("Table 2: SWCI classification scheme for water availability assessment", PW / 2, y, { align: "center" });
//   y += 6;

//   autoTable(doc, {
//     startY: y,
//     head: [["Class Code", "SWCI Range", "Class Name"]],
//     body: [
//       ["1",  "Z < -2.0",              "Extremely Dry"],
//       ["2",  "-2.0 <= Z < -1.5",       "Severely Dry"],
//       ["3",  "-1.5 <= Z < -1.0",       "Highly Dry"],
//       ["4",  "-1.0 <= Z < -0.5",       "Moderately Dry"],
//       ["5",  "-0.5 <= Z < 0",          "Mild Dry"],
//       ["6",  "0 <= Z < 0.5",           "Mild Surplus"],
//       ["7",  "0.5 <= Z < 1.0",         "Moderate Surplus"],
//       ["8",  "1.0 <= Z < 1.5",         "High Surplus"],
//       ["9",  "1.5 <= Z < 2.0",         "Abundant"],
//       ["10", "Z >= 2.0",               "Extreme Surplus"],
//     ],
//     styles:      { font: "times", fontSize: 10, cellPadding: 3, halign: "center", valign: "middle" },
//     headStyles:  { fillColor: [211, 211, 211], textColor: [0, 0, 0], fontStyle: "bold", halign: "center" },
//     columnStyles:{ 0: { cellWidth: 30 }, 1: { cellWidth: 65 }, 2: { cellWidth: 75 } },
//     margin:      { left: M, right: M, top: CONTENT_TOP },
//     didDrawPage: () => addLogos(),
//   });
//   y = (doc as any).lastAutoTable.finalY + 10;

//   // 3.7 Temporal Analysis
//   ensureSpace(20);
//   sectionHeading("3.7 Temporal Analysis Framework", 2);

//   addText(
//     "This module summarizes water balance at multiple time scales consistent with the monsoon-dominated hydrology of " +
//     "the Varuna Basin, including seasonal windows (winter, pre-monsoon, summer-monsoon, post-monsoon) and full annual " +
//     "totals. Long-term behavior is evaluated over study area and time during the last ten year period, enabling assessment " +
//     "of variability and trends in water availability under changing climate and land use. For each selected period, the " +
//     "GEE application provides four standardized outputs: a daily water budget (MLD), surplus and deficit masks indicating " +
//     "areas of positive or negative water balance, and a 1-10 SWCI-based index class that groups conditions from dry to " +
//     "surplus for management use.",
//     { align: "left" }
//   );

//   // Table 3: Output Products
//   ensureSpace(12);
//   doc.setFontSize(10);
//   doc.setFont("times", "normal");
//   doc.setTextColor(0, 0, 0);
//   doc.text("Table 3: Primary output products from water availability assessment", PW / 2, y, { align: "center" });
//   y += 6;

//   autoTable(doc, {
//     startY: y,
//     head: [["Product", "Definition", "Units"]],
//     body: [
//       ["Water Budget", "Daily water balance (P - ET - Q)",             "MLD"],
//       ["Surplus",      "Positive water balance (water availability)",   "Binary mask"],
//       ["Deficit",      "Negative water balance (water stress)",         "Binary mask"],
//       ["Index Class",  "Classified water availability category",        "Ordinal (1-10)"],
//     ],
//     styles:      { font: "times", fontSize: 10, cellPadding: 4, halign: "left", valign: "middle" },
//     headStyles:  { fillColor: [211, 211, 211], textColor: [0, 0, 0], fontStyle: "bold", halign: "center" },
//     columnStyles:{ 0: { cellWidth: 40 }, 1: { cellWidth: 90 }, 2: { cellWidth: 40 } },
//     margin:      { left: M, right: M, top: CONTENT_TOP },
//     didDrawPage: () => addLogos(),
//   });
//   y = (doc as any).lastAutoTable.finalY + 10;

//   // ==============================================
//   //  SECTION 4 - RESULTS
//   // ==============================================
//   ensureSpace(30);
//   hRule();
//   sectionHeading("4. Results");

//   addText(
//     "Pixel-level water balance components are first computed as depth (mm) and then converted to volume (million liters) " +
//     "using the 0.25 km2 pixel area, allowing aggregation from local to basin scale. For the analysis period, annual totals " +
//     "of precipitation, evapotranspiration, runoff, and net water balance are derived, with indicative averages of about " +
//     "930 mm of precipitation and 400 mm of evapotranspiration, yielding an ET/P ratio near 0.43 that is consistent with " +
//     "an agriculture-dominated Indo-Gangetic alluvial basin where the remaining water is distributed between runoff, " +
//     "infiltration, and changes in storage.",
//     { align: "left" }
//   );

//   // Water Budget Summary card
//   ensureSpace(45);
//   doc.setFillColor(240, 249, 255);
//   doc.setDrawColor(22, 78, 99);
//   doc.setLineWidth(0.6);
//   doc.roundedRect(M, y, CW, 38, 4, 4, "FD");

//   doc.setFontSize(12);
//   doc.setFont("times", "bold");
//   doc.setTextColor(22, 78, 99);
//   doc.text("Water Budget Summary", M + 6, y + 10);

//   doc.setFontSize(22);
//   doc.setFont("times", "bold");
//   doc.setTextColor(0, 0, 0);
//   const budgetStr = totalWaterBudget.toLocaleString("en-IN", {
//     minimumFractionDigits: 2,
//     maximumFractionDigits: 2,
//   });
//   doc.text(budgetStr, PW / 2, y + 24, { align: "center" });

//   doc.setFontSize(10);
//   doc.setFont("times", "normal");
//   doc.setTextColor(100, 100, 100);
//   doc.text("Million Liters per Day (MLD)", PW / 2, y + 32, { align: "center" });
//   y += 44;

//   // Analysis metadata row
//   ensureSpace(20);
//   doc.setFontSize(10);
//   doc.setFont("times", "normal");
//   doc.setTextColor(0, 0, 0);
//   const metaStr = [
//     `Year: ${year}`,
//     `Season: ${season.charAt(0).toUpperCase() + season.slice(1)}`,
//     `Product: ${productType}`,
//     `Scale: ${timeScale}`,
//   ].join("     |     ");
//   doc.text(metaStr, PW / 2, y, { align: "center" });
//   y += 10;

//   // Map with lat/lon border labels + vertical legend on right side
//   if (mapImageUrl) {
//     ensureSpace(130);
//     sectionHeading("Spatial Distribution Map", 2);

//     // Varuna Basin bounding box
//     const BBOX = {
//       minLon: 81.76, maxLon: 83.06,
//       minLat: 25.25, maxLat: 25.79,
//     };

//     // Axis label space
//     const axisL = 12;  // left  (lat labels)
//     const axisB = 8;   // bottom (lon labels)
//     const axisT = 4;   // top
//     const axisR = 2;   // right gap between map and legend

//     // Legend box dimensions (right side, same height as map)
//     const legW   = legendImageUrl ? 48 : 0;  // legend column width
//     const legGap = legendImageUrl ? 4  : 0;  // gap between map and legend

//     // Map width = full CW minus axis space minus legend column
//     const mapW = CW - axisL - axisR - legGap - legW;
//     const mapH = mapW * 0.70;   // taller aspect since map is narrower now

//     ensureSpace(axisT + mapH + axisB + 14);

//     const mapX = M + axisL;
//     const mapY = y + axisT;

//     try {
//       // ── White background fill inside border ────────
//       doc.setFillColor(255, 255, 255);
//       doc.rect(mapX, mapY, mapW, mapH, "F");

//       // ── Draw map image (transparent PNG over white bg) ──
//       const brd = 0.3;
//       doc.addImage(mapImageUrl, "PNG", mapX + brd, mapY + brd, mapW - brd * 2, mapH - brd * 2);

//       // ── Border on top ────────────────────────────────
//       doc.setDrawColor(80, 80, 80);
//       doc.setLineWidth(0.6);
//       doc.rect(mapX, mapY, mapW, mapH);

//       // ── Latitude labels (left axis) ─────────────────
//       const latTicks = 4;
//       doc.setFontSize(7);
//       doc.setFont("times", "normal");
//       doc.setTextColor(60, 60, 60);
//       for (let i = 0; i <= latTicks; i++) {
//         const frac   = i / latTicks;
//         const latVal = BBOX.minLat + (BBOX.maxLat - BBOX.minLat) * frac;
//         const tickY  = mapY + mapH - frac * mapH;
//         doc.setDrawColor(80, 80, 80);
//         doc.setLineWidth(0.3);
//         doc.line(mapX - 2, tickY, mapX, tickY);
//         doc.text(latVal.toFixed(2) + "N", mapX - 3, tickY + 1.5, { align: "right" });
//       }

//       // ── Longitude labels (bottom axis) ──────────────
//       const lonTicks = 4;
//       doc.setFontSize(7);
//       doc.setFont("times", "normal");
//       doc.setTextColor(60, 60, 60);
//       for (let i = 0; i <= lonTicks; i++) {
//         const frac   = i / lonTicks;
//         const lonVal = BBOX.minLon + (BBOX.maxLon - BBOX.minLon) * frac;
//         const tickX  = mapX + frac * mapW;
//         doc.setDrawColor(80, 80, 80);
//         doc.setLineWidth(0.3);
//         doc.line(tickX, mapY + mapH, tickX, mapY + mapH + 2);
//         doc.text(lonVal.toFixed(2) + "E", tickX, mapY + mapH + axisB - 1, { align: "center" });
//       }

//       // ── Axis titles ──────────────────────────────────
//       doc.setFontSize(7);
//       doc.setFont("times", "italic");
//       doc.setTextColor(40, 40, 40);
//       doc.text("Latitude", M + 3, mapY + mapH / 2, { align: "center", angle: 90 });
//       doc.text("Longitude", mapX + mapW / 2, mapY + mapH + axisB + 1, { align: "center" });

//       // ── Legend: vertical, right side, same height as map ─
//       if (legendImageUrl) {
//         const legX    = mapX + mapW + axisR + legGap;
//         const legY    = mapY;
//         const legPad  = 3;
//         const titleH  = 8;
//         const legImgH = mapH - titleH - legPad * 2;

//         // Shadow
//         doc.setFillColor(220, 220, 220);
//         doc.roundedRect(legX + 1, legY + 1, legW, mapH, 2, 2, "F");

//         // White box same height as map
//         doc.setFillColor(255, 255, 255);
//         doc.setDrawColor(120, 120, 120);
//         doc.setLineWidth(0.4);
//         doc.roundedRect(legX, legY, legW, mapH, 2, 2, "FD");

//         // "Legend" title
//         doc.setFontSize(8);
//         doc.setFont("times", "bold");
//         doc.setTextColor(20, 20, 20);
//         doc.text("Legend", legX + legW / 2, legY + legPad + 4, { align: "center" });

//         // Separator
//         doc.setDrawColor(180, 180, 180);
//         doc.setLineWidth(0.2);
//         doc.line(legX + 3, legY + titleH, legX + legW - 3, legY + titleH);

//         // Legend image fills remaining height
//         try {
//           doc.addImage(
//             legendImageUrl, "PNG",
//             legX + legPad,
//             legY + titleH + legPad,
//             legW - legPad * 2,
//             legImgH
//           );
//         } catch (_) {}
//       }

//       // ── Figure caption below map ─────────────────────
//       y = mapY + mapH + axisB + 4;
//       doc.setFontSize(9);
//       doc.setFont("times", "italic");
//       doc.setTextColor(80, 80, 80);
//       doc.text(
//         `Figure 1: Spatial distribution of water availability - ${season} ${year}`,
//         PW / 2, y, { align: "center" }
//       );
//       y += 8;

//     } catch (_) {
//       addText("[Map image could not be loaded]", { italic: true, color: [150, 0, 0] });
//     }
//   }

//   // Raster Details
//   if (clippedRasters.length > 0) {
//     ensureSpace(20);
//     sectionHeading("Processed Raster Layers", 2);

//     clippedRasters.forEach((raster, idx) => {
//       ensureSpace(22);
//       doc.setFillColor(248, 249, 250);
//       doc.setDrawColor(200, 200, 200);
//       doc.setLineWidth(0.3);
//       doc.roundedRect(M, y, CW, 18, 2, 2, "FD");

//       doc.setFontSize(10);
//       doc.setFont("times", "bold");
//       doc.setTextColor(0, 0, 0);
//       const cleanName = raster.layer_name
//         .replace(/_clipped__[a-f0-9]+$/i, "")  // remove _clipped__<hash>
//         .replace(/_clipped$/i, "")              // remove trailing _clipped
//         .replace(/_/g, " ")                     // underscores to spaces
//         .trim();
//       doc.text(`Layer ${idx + 1}: ${cleanName}`, M + 4, y + 7);

//       doc.setFont("times", "normal");
//       doc.setFontSize(9);
//       doc.setTextColor(73, 80, 87);
//       const vol = raster.volume_MLD
//         ? `${raster.volume_MLD.toLocaleString("en-IN", { maximumFractionDigits: 2 })} MLD`
//         : "N/A";
//       doc.text(`Volume: ${vol}     Year: ${raster.year ?? "N/A"}`, M + 4, y + 14);
//       y += 22;
//     });
//   }

//   // ==============================================
//   //  CHART: Year-wise Water Volume (Plotly PNG)
//   // ==============================================
//   if (chartImageUrl) {
//     ensureSpace(100);
//     sectionHeading("Year-wise Water Volume Trend", 2);

//     addText(
//       "The following chart shows the year-wise variation in water volume (MLD) for the selected product " +
//       "and time scale. The dashed line represents the long-term average across the analysis period.",
//       { align: "left" }
//     );

//     const chartW = CW;
//     const chartH = chartW * 0.42; // ~16:7 aspect ratio matches Plotly output

//     ensureSpace(chartH + 14);

//     // White background + border
//     doc.setFillColor(255, 255, 255);
//     doc.setDrawColor(200, 200, 200);
//     doc.setLineWidth(0.4);
//     doc.roundedRect(M, y, chartW, chartH, 3, 3, "FD");

//     try {
//       doc.addImage(chartImageUrl, "PNG", M + 1, y + 1, chartW - 2, chartH - 2);
//     } catch (_) {
//       doc.setFontSize(9);
//       doc.setFont("times", "italic");
//       doc.setTextColor(150, 0, 0);
//       doc.text("[Chart image could not be loaded]", PW / 2, y + chartH / 2, { align: "center" });
//     }

//     y += chartH + 4;

//     // Caption
//     doc.setFontSize(9);
//     doc.setFont("times", "italic");
//     doc.setTextColor(80, 80, 80);
//     doc.text(
//       `Figure 2: Year-wise ${productType} volume trend (MLD) - ${season} ${year}-${endYear}`,
//       PW / 2, y, { align: "center" }
//     );
//     y += 10;
//   }

//   // ==============================================
//   //  SECTION 5 - CONCLUSIONS
//   // ==============================================
//   ensureSpace(30);
//   hRule();
//   sectionHeading("5. Conclusions");

//   addText(
//     "This module provides a basin-scale assessment of surface water availability using satellite-based precipitation, " +
//     "evapotranspiration, and runoff, adjusted with ground observations where available. It generates 500 m resolution " +
//     "water balance and Soil Water Content Index (SWCI) layers across seasons and multi-year periods, highlighting spatial " +
//     "and temporal patterns of surplus and deficit to support planning for irrigation, urban supply, and ecosystem needs. " +
//     "Results are presented as static summary products for the Varuna Basin, designed for screening, prioritization, and " +
//     "scenario exploration in the DSS, rather than for real-time forecasting or parcel-scale water accounting.",
//     { align: "left" }
//   );

//   // ==============================================
//   //  SECTION 6 - REFERENCES
//   // ==============================================
//   ensureSpace(30);
//   hRule();
//   sectionHeading("References");

//   const references = [
//     "[1] Singh, P., et al. (2015). Assessment of ground and surface water quality along the river Varuna, Varanasi, India. Environmental Monitoring and Assessment, 187(4), 170. https://doi.org/10.1007/s10661-015-4405-9",
//     "[2] Raju, N. J., Ram, P., & Dey, S. (2009). Groundwater quality in the lower Varuna River basin, Varanasi district, Uttar Pradesh. Journal of the Geological Society of India, 73(2), 178-192. https://doi.org/10.17491/jgsi/2009/73/62778",
//     "[3] Athavale, R. N., Murti, C. S., & Chand, R. (1992). Estimation of recharge to the phreatic aquifers of the Lower Maner Basin. Journal of Hydrology, 107(1-4), 185-202. https://doi.org/10.1016/0022-1694(89)90056-8",
//     "[4] Singh, V. P., & Woolhiser, D. A. (2002). Mathematical modeling of watershed hydrology. Journal of Hydrologic Engineering, 7(4), 270-292. https://doi.org/10.1061/(ASCE)1084-0699(2002)7:4(270)",
//     "[5] Mishra, S. K., & Singh, V. P. (2003). Soil Conservation Service Curve Number (SCS-CN) Methodology. Dordrecht: Kluwer Academic Publishers. https://doi.org/10.1007/978-94-017-0147-1",
//     "[6] Gorelick, N., et al. (2017). Google Earth Engine: Planetary-scale geospatial analysis for everyone. Remote Sensing of Environment, 202, 18-27. https://doi.org/10.1016/j.rse.2017.06.031",
//     "[7] Abatzoglou, J. T., et al. (2018). TerraClimate, a high-resolution global dataset of monthly climate and climatic water balance from 1958-2015. Scientific Data, 5, 170191. https://doi.org/10.1038/sdata.2017.191",
//     "[8] Running, S., Mu, Q., & Zhao, M. (2017). MOD16A2 MODIS/Terra Net Evapotranspiration 8-Day L4 Global 500m SIN Grid V006. NASA EOSDIS Land Processes DAAC. https://doi.org/10.5067/MODIS/MOD16A2.006",
//     "[9] Prakash, S., et al. (2015). From TRMM to GPM: How well can heavy rainfall be detected from space? Advances in Water Resources, 88, 1-7. https://doi.org/10.1016/j.advwatres.2015.11.008",
//     "[10] Roy, D. P., et al. (2016). Examination of Sentinel-2A multi-temporal data for land cover classification. International Journal of Applied Earth Observation and Geoinformation, 81, 52-64.",
//     "[11] Nistor, M. M., et al. (2020). Soil water content index: A standardized method for assessing soil moisture anomalies. Hydrological Sciences Journal, 65(5), 746-758. https://doi.org/10.1080/02626667.2019.1706718",
//   ];

//   references.forEach((ref) => {
//     const lines = doc.splitTextToSize(ref, CW);
//     ensureSpace(lines.length * 5 + 3);
//     doc.setFontSize(9.5);
//     doc.setFont("times", "normal");
//     doc.setTextColor(0, 0, 0);
//     doc.text(lines, M, y);
//     y += lines.length * 4.5 + 4;
//   });

//   // ==============================================
//   //  PAGE NUMBERS  (stamp every page)
//   // ==============================================
//   const totalPages = (doc.internal as any).pages.length - 1;
//   for (let i = 1; i <= totalPages; i++) {
//     doc.setPage(i);
//     doc.setFontSize(9);
//     doc.setFont("times", "normal");
//     doc.setTextColor(120, 120, 120);
//     doc.text(`Page ${i} of ${totalPages}`, PW / 2, PH - 8, { align: "center" });
//   }

//   // ==============================================
//   //  SAVE
//   // ==============================================
//   const fileName = `WaterAvailabilityReport_${year}_${season}_${new Date()
//     .toISOString()
//     .split("T")[0]}.pdf`;
//   doc.save(fileName);
//   console.log(`OK PDF saved: ${fileName}`);
// }













// import jsPDF from "jspdf";
// import autoTable from "jspdf-autotable";

// // ---------------------------------------------
// //  Types
// // ---------------------------------------------
// interface RasterData {
//   layer_name: string;
//   volume_MLD?: number;
//   year?: number;
//   [key: string]: any;
// }

// interface WaterAnalysisPDFOptions {
//   exportData: {
//     year: number;
//     endYear?: number;
//     season: string;
//     productType: string;
//     timeScale: string;
//   };
//   rasterResponse: {
//     clipped_rasters: RasterData[];
//   };
//   subdistrictCodes?: number[];
//   mapImageUrl?: string;
//   legendImageUrl?: string;
//   chartImageUrl?: string;
// }

// // ---------------------------------------------
// //  Entry point
// // ---------------------------------------------
// export async function generateWaterAnalysisPDF(
//   options: WaterAnalysisPDFOptions
// ): Promise<void> {
//   const { exportData, rasterResponse, subdistrictCodes = [], mapImageUrl, legendImageUrl, chartImageUrl } = options;

//   const { year, season, productType, timeScale } = exportData;
//   const clippedRasters = rasterResponse?.clipped_rasters ?? [];
//   const totalWaterBudget = clippedRasters[0]?.volume_MLD ?? 0;
//   const endYear = new Date().getFullYear();
//   const endYearFinal = exportData.endYear ?? endYear;

//   const doc = new jsPDF({ orientation: "p", unit: "mm", format: "a4", compress: true });
//   const PW = doc.internal.pageSize.getWidth();
//   const PH = doc.internal.pageSize.getHeight();
//   const M  = 20;
//   const CW = PW - 2 * M;

//   const LEFT_LOGO  = "/Images/export/logo_iitbhu.png";
//   const RIGHT_LOGO = "/Images/export/right1_slcr.png";
//   const LOGO_H     = 20;
//   const LOGO_TOP   = 8;
//   const CONTENT_TOP = LOGO_TOP + LOGO_H + 6;

//   const addLogos = () => {
//     try { doc.addImage(LEFT_LOGO,  "PNG", M,           LOGO_TOP, 20, LOGO_H); } catch (_) {}
//     try { doc.addImage(RIGHT_LOGO, "PNG", PW - M - 25, LOGO_TOP, 25, LOGO_H); } catch (_) {}
//   };

//   let y = 0;

//   const newPage = () => {
//     doc.addPage();
//     addLogos();
//     y = CONTENT_TOP;
//   };

//   const ensureSpace = (needed: number) => {
//     if (y + needed > PH - M) newPage();
//   };

//   const addText = (
//     text: string,
//     opts: {
//       fontSize?: number;
//       bold?: boolean;
//       italic?: boolean;
//       align?: "left" | "center" | "justify";
//       color?: [number, number, number];
//       marginBottom?: number;
//     } = {}
//   ) => {
//     const {
//       fontSize     = 11,
//       bold         = false,
//       italic       = false,
//       align        = "left",
//       color        = [0, 0, 0],
//       marginBottom = 5,
//     } = opts;

//     doc.setFontSize(fontSize);
//     doc.setTextColor(...color);
//     const style = bold ? "bold" : italic ? "italic" : "normal";
//     doc.setFont("times", style);

//     const lines: string[] = doc.splitTextToSize(text, CW);
//     const lineH = fontSize * 0.53;

//     ensureSpace(lines.length * lineH + marginBottom);
//     doc.setFontSize(fontSize);
//     doc.setTextColor(...color);
//     doc.setFont("times", style);
//     lines.forEach((line) => {
//       if (y + lineH > PH - M) {
//         doc.addPage();
//         addLogos();
//         y = CONTENT_TOP;
//         doc.setFontSize(fontSize);
//         doc.setTextColor(...color);
//         doc.setFont("times", style);
//       }
//       if (align === "center") {
//         doc.text(line, PW / 2, y, { align: "center" });
//       } else {
//         doc.text(line, M, y);
//       }
//       y += lineH;
//     });
//     y += marginBottom;
//   };

//   const sectionHeading = (text: string, level: 1 | 2 = 1) => {
//     ensureSpace(14);
//     y += level === 1 ? 4 : 2;
//     addText(text, {
//       fontSize:     level === 1 ? 13 : 12,
//       bold:         true,
//       marginBottom: 6,
//     });
//   };

//   const hRule = () => {
//     doc.setDrawColor(0, 0, 0);
//     doc.setLineWidth(0.4);
//     doc.line(M, y, PW - M, y);
//     y += 4;
//   };

//   const addEquation = (eq: string, opts: { highlight?: boolean } = {}) => {
//     const accent = opts.highlight ?? false;
//     const fs     = 10;
//     const padH   = 6;
//     const padV   = 5;
//     const lineH  = fs * 0.55;
//     const boxX   = M;
//     const boxW   = CW;

//     doc.setFontSize(fs);
//     doc.setFont("times", "italic");
//     const eqLines: string[] = doc.splitTextToSize(eq, boxW - padH * 2);
//     const boxH = padV * 2 + eqLines.length * lineH + 2;

//     ensureSpace(boxH + 4);

//     if (accent) {
//       doc.setFillColor(230, 244, 255);
//       doc.setDrawColor(22, 78, 99);
//       doc.setLineWidth(0.5);
//     } else {
//       doc.setFillColor(248, 249, 250);
//       doc.setDrawColor(180, 180, 180);
//       doc.setLineWidth(0.3);
//     }
//     doc.roundedRect(boxX, y, boxW, boxH, 2, 2, "FD");

//     doc.setFontSize(fs);
//     doc.setFont("times", "italic");
//     doc.setTextColor(0, 0, 0);
//     eqLines.forEach((line: string, i: number) => {
//       doc.text(line, PW / 2, y + padV + (i + 0.75) * lineH, { align: "center" });
//     });

//     y += boxH + 5;
//   };

//   // ==============================================
//   //  PAGE 1 - COVER PAGE
//   // ==============================================
//   addLogos();

//   const TITLE_FONT    = 16;
//   const SUBTITLE_FONT = 11;
//   const BOX_PAD       = 8;
//   const titleText     = "Comprehensive Report on Water Availability";
//   const subtitleText  = "A Geospatial and Hydrological Analysis for Water Resource Assessment";

//   doc.setFontSize(TITLE_FONT);
//   doc.setFont("times", "bold");
//   const titleLines: string[]    = doc.splitTextToSize(titleText,    CW - BOX_PAD * 2);

//   doc.setFontSize(SUBTITLE_FONT);
//   doc.setFont("times", "normal");
//   const subtitleLines: string[] = doc.splitTextToSize(subtitleText, CW - BOX_PAD * 2);

//   const titleBlockH =
//     BOX_PAD +
//     titleLines.length    * (TITLE_FONT    * 0.45) + 4 +
//     subtitleLines.length * (SUBTITLE_FONT * 0.45) +
//     BOX_PAD;

//   const BOX_TOP = 95;
//   doc.setFillColor(240, 249, 255);
//   doc.setDrawColor(22, 78, 99);
//   doc.setLineWidth(0.6);
//   doc.roundedRect(M, BOX_TOP, CW, titleBlockH, 3, 3, "FD");

//   y = BOX_TOP + BOX_PAD + TITLE_FONT * 0.45;
//   doc.setFontSize(TITLE_FONT);
//   doc.setFont("times", "bold");
//   doc.setTextColor(22, 78, 99);
//   titleLines.forEach((line: string) => {
//     doc.text(line, PW / 2, y, { align: "center" });
//     y += TITLE_FONT * 0.45;
//   });

//   y += 4;
//   doc.setFontSize(SUBTITLE_FONT);
//   doc.setFont("times", "normal");
//   doc.setTextColor(55, 65, 81);
//   subtitleLines.forEach((line: string) => {
//     doc.text(line, PW / 2, y, { align: "center" });
//     y += SUBTITLE_FONT * 0.45;
//   });

//   y = BOX_TOP + titleBlockH + 12;

//   const reportDate = new Date().toLocaleDateString("en-IN", {
//     year: "numeric", month: "long", day: "numeric",
//   });

//   const labelW    = 38;
//   const valueMaxW = CW - labelW;

//   const metaLines: [string, string][] = [
//     ["Prepared by",   "IIT (BHU), Varanasi"],
//     ["Date",          reportDate],
//     ["Year / Season", `${year} / ${season.charAt(0).toUpperCase() + season.slice(1)}`],
//     ["Product Type",  productType || "Water Budget"],
//     ["Time Scale",    timeScale   || "Annual"],
//   ];

//   const LINE_H = 6.5;

//   metaLines.forEach(([label, value]) => {
//     doc.setFontSize(11);
//     doc.setFont("times", "normal");
//     const valueLines: string[] = doc.splitTextToSize(value, valueMaxW);
//     const rowH = valueLines.length * LINE_H + 2;

//     doc.setFont("times", "bold");
//     doc.setTextColor(0, 0, 0);
//     doc.text(`${label}:`, M, y);

//     doc.setFont("times", "normal");
//     valueLines.forEach((vLine: string, vi: number) => {
//       doc.text(vLine, M + labelW, y + vi * LINE_H);
//     });

//     y += rowH;
//   });

//   doc.setFillColor(22, 78, 99);
//   doc.rect(0, PH - 22, PW, 22, "F");
//   doc.setFontSize(10);
//   doc.setFont("times", "normal");
//   doc.setTextColor(255, 255, 255);
//   doc.text("Department of Civil Engineering",                 PW / 2, PH - 13, { align: "center" });
//   doc.text("Indian Institute of Technology (BHU), Varanasi", PW / 2, PH - 6,  { align: "center" });

//   // ==============================================
//   //  PAGE 2 - EXECUTIVE SUMMARY
//   // ==============================================
//   newPage();
//   hRule();
//   sectionHeading("1. Executive Summary");

//   addText(
//     "The Water Availability sub-module estimates surface water quantity generated and sustained within the Varuna Basin " +
//     "through basin-scale rainfall-runoff modeling embedded in decision support system. This framework translates climatic " +
//     "inputs and land-surface interactions into spatially explicit measures of runoff, infiltration, and discharge at 500 m " +
//     "resolution, providing quantitative foundations for water resource planning within the decision making. Water availability " +
//     "represents a central concern in the Varuna Basin, where rainfall variability, land use change, and population growth " +
//     "increasingly pressure local water resources. The operational monitoring framework captures these dynamics through " +
//     "integration of multiple Earth observation datasets viz., TerraClimate (precipitation & runoff) and MODIS " +
//     "evapotranspiration, to generate comprehensive water budget assessments incorporating bias-corrected precipitation " +
//     "against Indian Meteorological Department (IMD) observations and accounting for physical losses through seepage. Key " +
//     "outcomes include basin-wide quantification of surface water availability, computed through water balance equation. " +
//     "Outputs are resolved spatially at 500 m through pixel-level mapping and temporally at seasonal and annual scales. " +
//     "This resolution enables identification of water-deficit hotspots and prioritization of interventions for agricultural, " +
//     "urban, and ecosystem needs, moving beyond isolated measurements toward dynamic basin-scale assessments that support " +
//     "data-driven water governance.",
//     { align: "left" }
//   );

//   // ==============================================
//   //  SECTION 2 - BASIN CONTEXT
//   // ==============================================
//   ensureSpace(30);
//   hRule();
//   sectionHeading("2. Basin and Water Availability Challenges");

//   addText(
//     "Water availability in the Varuna Basin is governed by intertwined climatic, geomorphic, and anthropogenic factors " +
//     "that complicate reliable assessment and management of surface water resources. As a rain-fed tributary of the Ganga, " +
//     "the basin depends heavily on monsoonal precipitation, which supplies most of the annual inflow and creates pronounced " +
//     "contrasts between surplus conditions during the monsoon and acute shortages in the pre-monsoon months. These dynamics " +
//     "highlight the need for basin-scale monitoring and forecasting frameworks that can track both seasonal variability and " +
//     "long-term trends. Natural controls play a central role in shaping hydrological responses. The basin's alluvial geology " +
//     "exhibits spatially variable infiltration potential, influencing how rainfall is partitioned among surface runoff, " +
//     "groundwater recharge, and soil moisture storage. Steeper upper reaches promote rapid runoff and limited retention, " +
//     "while gentler downstream areas favor stagnation and sediment deposition; clay-rich soils restrict infiltration and " +
//     "enhance overland flow, whereas sandy and mixed textures support recharge but can deplete quickly. Human pressures " +
//     "compound these vulnerabilities. Expansion of irrigated agriculture, especially rice-wheat systems, has raised water " +
//     "demand and altered infiltration and runoff pathways, and urbanization around Varanasi has replaced permeable surfaces " +
//     "with built-up areas, increasing runoff and reducing recharge. Inadequate drainage and industrial effluents further " +
//     "degrade water quality, so scarcity increasingly reflects misaligned demand and pollution as much as limited natural " +
//     "supply, making robust, integrated water availability frameworks indispensable.",
//     { align: "left" }
//   );

//   ensureSpace(20);
//   sectionHeading("2.2 Rainfall-Runoff Modeling Framework", 2);

//   addText(
//     "Rainfall-runoff modeling provides a structured means to quantify how precipitation is partitioned into " +
//     "evapotranspiration, infiltration, soil water storage, and surface runoff, supporting consistent water balance " +
//     "estimation across heterogeneous terrain and land uses, even where direct flow records are sparse [5]. By integrating " +
//     "spatial inputs such as land use/land cover, soil texture, and topography, these models capture variability in " +
//     "hydrological responses and enable comparison between sub-basins or management units [6]. In the Varuna Basin, where " +
//     "pronounced seasonal variability and human pressures drive sharp contrasts in water supply, this framework is essential " +
//     "for diagnosing when and where water deficits are most likely to occur, and can be extended over multiple years or " +
//     "coupled with climate projections to explore future water availability scenarios. Embedding model outputs within the " +
//     "Decision Support System transforms gridded results into interactive maps and indicators, helping decision-makers " +
//     "prioritize rainwater harvesting, managed recharge, and irrigation scheduling based on seasonal runoff potential.",
//     { align: "left" }
//   );

//   // ==============================================
//   //  SECTION 3 - METHODOLOGY
//   // ==============================================
//   ensureSpace(30);
//   hRule();
//   sectionHeading("3. Methodology");

//   sectionHeading("3.1 Theoretical Foundation: Water Balance Equation", 2);

//   addText(
//     "The fundamental water balance equation represents conservation of mass for the hydrological cycle over a " +
//     "defined spatial domain and time period:",
//     { align: "left" }
//   );

//   addEquation("Delta_S = P - ET - Q - I");

//   addText(
//     "where Delta_S represents change in storage (soil water, groundwater), P is precipitation, ET is evapotranspiration, " +
//     "Q is surface and subsurface runoff, and I is infiltration [5].",
//     { align: "left" }
//   );

//   addText(
//     "The implemented water balance in Google Earth Engine adapts this framework to basin-scale satellite-based " +
//     "analysis at pixel level, as shown in Table 1.",
//     { align: "left" }
//   );

//   ensureSpace(12);
//   doc.setFontSize(10);
//   doc.setFont("times", "normal");
//   doc.setTextColor(0, 0, 0);
//   doc.text(
//     "Table 1: Correspondence between theoretical components and operational implementation",
//     PW / 2, y, { align: "center" }
//   );
//   y += 6;

//   autoTable(doc, {
//     startY: y,
//     head: [["Theoretical Variable", "Implementation", "Source Dataset"]],
//     body: [
//       ["P_day (Precipitation)",       "P_corrected",        "TerraCLIMATE + IMD correction"],
//       ["E_a (Evapotranspiration)",     "ET_normalized",      "MODIS MOD16A2GF"],
//       ["Q_surf + Q_gw (Total runoff)", "Q",                  "TerraCLIMATE runoff"],
//       ["w_seep (Seepage)",             "0.12 * water budget","Empirical (12% loss)"],
//     ],
//     styles:       { font: "times", fontSize: 10, cellPadding: 4, halign: "left", valign: "middle" },
//     headStyles:   { fillColor: [211, 211, 211], textColor: [0, 0, 0], fontStyle: "bold", halign: "center" },
//     columnStyles: { 0: { cellWidth: 55 }, 1: { cellWidth: 40 }, 2: { cellWidth: 75 } },
//     margin:       { left: M, right: M, top: CONTENT_TOP },
//     didDrawPage:  () => addLogos(),
//   });
//   y = (doc as any).lastAutoTable.finalY + 10;

//   ensureSpace(20);
//   sectionHeading("3.3 Primary Datasets", 2);

//   addText(
//     "This sub-module relies on three complementary datasets that together enable a robust, satellite-driven " +
//     "characterization of water balance in the Varuna Basin. TerraCLIMATE provides global high-resolution (approximately " +
//     "4 km) monthly climate and climatic water balance data from 1958 onwards, combining WorldClim climatological normals " +
//     "with CRU TS 4.0 and JRA55 reanalysis within a modified Thornthwaite-Mather model, and supplies precipitation (p_r), " +
//     "actual evapotranspiration (a_et), and runoff (r_no) as millimeter-depth inputs for basin-scale assessments in " +
//     "data-scarce settings. The MODIS Terra Net Evapotranspiration product (MOD16A2GF Version 6.1) contributes gap-filled " +
//     "8-day evapotranspiration at 500 m resolution, computed using the Penman-Monteith formulation:",
//     { align: "left" }
//   );

//   addEquation("ET = (Delta*(Rn-G) + rho_a*cp*(es-ea)/ra) / (Delta + gamma*(1 + rs/ra))");

//   addText(
//     "where Rn is net radiation, G is soil heat flux, es-ea is vapor pressure deficit, rs is surface resistance, " +
//     "ra is aerodynamic resistance, Delta is the slope of the saturation vapor pressure curve, and gamma is the psychrometric " +
//     "constant. To reduce systematic bias in satellite-derived precipitation, TerraCLIMATE rainfall is further adjusted " +
//     "using Indian Meteorological Department gauge data through a linear bias-correction:",
//     { align: "left" }
//   );

//   addEquation("P_corrected = a * P_TC + b");

//   addText(
//     "with slope a = 1.01 and intercept b = 10.12, thereby improving representation of intense, convective monsoon " +
//     "rainfall typical of the Indo-Gangetic plains.",
//     { align: "left" }
//   );

//   ensureSpace(20);
//   sectionHeading("3.4 Data Processing and Integration Procedures", 2);

//   addText(
//     "This sub-module applies a five-step Google Earth Engine workflow to derive pixel-wise water balance in the " +
//     "Varuna Basin. First, monthly TerraCLIMATE and MODIS products are aggregated to seasonal or annual periods, and " +
//     "TerraCLIMATE precipitation is bias-corrected using IMD coefficients so that P_corrected = a * P_TC + b. " +
//     "MODIS evapotranspiration is then normalized to the TerraCLIMATE AET range by computing:",
//     { align: "left" }
//   );

//   addEquation("MODIS_norm = (MODIS - MODIS_min) / (MODIS_max - MODIS_min)");
//   addEquation("ET_normalized = MODIS_norm * (TC_max - TC_min) + TC_min");
//   addEquation("WB = (P_corrected - ET_normalized - Q) * 0.25 * 0.88");

//   addText(
//     "where 0.25 converts millimeter depth to volume at 500 m resolution (0.25 km2 per pixel) and 0.88 allocates 88% " +
//     "of the budget to soil water in the root zone and 12% to seepage losses.",
//     { align: "left" }
//   );

//   ensureSpace(20);
//   sectionHeading("3.5 Combined Operational Water Balance Equations", 2);

//   addText("The final operational formula integrates all corrections and adjustments:", { align: "left" });

//   addEquation("WB = (P_corrected - ET_normalized - Q) * 0.25 * 0.88", { highlight: true });

//   addText(
//     "where P_corrected is IMD-corrected precipitation (mm), ET_normalized is MODIS ET rescaled to TerraCLIMATE range (mm), " +
//     "Q is TerraCLIMATE runoff (mm), 0.25 is the pixel area conversion factor (to km2), and 0.88 is the seepage loss " +
//     "compensation factor. Daily water balance is derived through temporal disaggregation:",
//     { align: "left" }
//   );

//   addEquation("W_daily = W_b / n_days");

//   addText("where n_days is the number of days in the analysis period.", { align: "left" });

//   ensureSpace(20);
//   sectionHeading("3.6 Soil Water Content Index (SWCI)", 2);

//   addText(
//     "The Soil Water Content Index (SWCI) is a standardized anomaly (z-score) of daily water balance, enabling " +
//     "classification of water availability conditions relative to long-term climatology:",
//     { align: "left" }
//   );

//   addEquation("SWCI = (WB_daily - mean_WB) / std_WB");

//   addText(
//     "where WB_daily is the daily-mean water balance for a given year or period, mean_WB is the long-term mean daily water " +
//     "balance, and std_WB is its standard deviation [12]. SWCI values are classified into ten categories as detailed in Table 2.",
//     { align: "left" }
//   );

//   ensureSpace(12);
//   doc.setFontSize(10);
//   doc.setFont("times", "normal");
//   doc.setTextColor(0, 0, 0);
//   doc.text("Table 2: SWCI classification scheme for water availability assessment", PW / 2, y, { align: "center" });
//   y += 6;

//   autoTable(doc, {
//     startY: y,
//     head: [["Class Code", "SWCI Range", "Class Name"]],
//     body: [
//       ["1",  "Z < -2.0",         "Extremely Dry"],
//       ["2",  "-2.0 <= Z < -1.5", "Severely Dry"],
//       ["3",  "-1.5 <= Z < -1.0", "Highly Dry"],
//       ["4",  "-1.0 <= Z < -0.5", "Moderately Dry"],
//       ["5",  "-0.5 <= Z < 0",    "Mild Dry"],
//       ["6",  "0 <= Z < 0.5",     "Mild Surplus"],
//       ["7",  "0.5 <= Z < 1.0",   "Moderate Surplus"],
//       ["8",  "1.0 <= Z < 1.5",   "High Surplus"],
//       ["9",  "1.5 <= Z < 2.0",   "Abundant"],
//       ["10", "Z >= 2.0",         "Extreme Surplus"],
//     ],
//     styles:       { font: "times", fontSize: 10, cellPadding: 3, halign: "center", valign: "middle" },
//     headStyles:   { fillColor: [211, 211, 211], textColor: [0, 0, 0], fontStyle: "bold", halign: "center" },
//     columnStyles: { 0: { cellWidth: 30 }, 1: { cellWidth: 65 }, 2: { cellWidth: 75 } },
//     margin:       { left: M, right: M, top: CONTENT_TOP },
//     didDrawPage:  () => addLogos(),
//   });
//   y = (doc as any).lastAutoTable.finalY + 10;

//   ensureSpace(20);
//   sectionHeading("3.7 Temporal Analysis Framework", 2);

//   addText(
//     "This module summarizes water balance at multiple time scales consistent with the monsoon-dominated hydrology of " +
//     "the Varuna Basin, including seasonal windows (winter, pre-monsoon, summer-monsoon, post-monsoon) and full annual " +
//     "totals. Long-term behavior is evaluated over study area and time during the last ten year period, enabling assessment " +
//     "of variability and trends in water availability under changing climate and land use. For each selected period, the " +
//     "GEE application provides four standardized outputs: a daily water budget (MLD), surplus and deficit masks indicating " +
//     "areas of positive or negative water balance, and a 1-10 SWCI-based index class that groups conditions from dry to " +
//     "surplus for management use.",
//     { align: "left" }
//   );

//   ensureSpace(12);
//   doc.setFontSize(10);
//   doc.setFont("times", "normal");
//   doc.setTextColor(0, 0, 0);
//   doc.text("Table 3: Primary output products from water availability assessment", PW / 2, y, { align: "center" });
//   y += 6;

//   autoTable(doc, {
//     startY: y,
//     head: [["Product", "Definition", "Units"]],
//     body: [
//       ["Water Budget", "Daily water balance (P - ET - Q)",           "MLD"],
//       ["Surplus",      "Positive water balance (water availability)", "Binary mask"],
//       ["Deficit",      "Negative water balance (water stress)",       "Binary mask"],
//       ["Index Class",  "Classified water availability category",      "Ordinal (1-10)"],
//     ],
//     styles:       { font: "times", fontSize: 10, cellPadding: 4, halign: "left", valign: "middle" },
//     headStyles:   { fillColor: [211, 211, 211], textColor: [0, 0, 0], fontStyle: "bold", halign: "center" },
//     columnStyles: { 0: { cellWidth: 40 }, 1: { cellWidth: 90 }, 2: { cellWidth: 40 } },
//     margin:       { left: M, right: M, top: CONTENT_TOP },
//     didDrawPage:  () => addLogos(),
//   });
//   y = (doc as any).lastAutoTable.finalY + 10;

//   // ==============================================
//   //  SECTION 4 - RESULTS
//   // ==============================================
//   ensureSpace(30);
//   hRule();
//   sectionHeading("4. Results");

//   addText(
//     "Pixel-level water balance components are first computed as depth (mm) and then converted to volume (million liters) " +
//     "using the 0.25 km2 pixel area, allowing aggregation from local to basin scale. For the analysis period, annual totals " +
//     "of precipitation, evapotranspiration, runoff, and net water balance are derived, with indicative averages of about " +
//     "930 mm of precipitation and 400 mm of evapotranspiration, yielding an ET/P ratio near 0.43 that is consistent with " +
//     "an agriculture-dominated Indo-Gangetic alluvial basin where the remaining water is distributed between runoff, " +
//     "infiltration, and changes in storage.",
//     { align: "left" }
//   );

//   // Water Budget Summary card
//   ensureSpace(45);
//   doc.setFillColor(240, 249, 255);
//   doc.setDrawColor(22, 78, 99);
//   doc.setLineWidth(0.6);
//   doc.roundedRect(M, y, CW, 38, 4, 4, "FD");

//   doc.setFontSize(12);
//   doc.setFont("times", "bold");
//   doc.setTextColor(22, 78, 99);
//   doc.text("Water Budget Summary", M + 6, y + 10);

//   doc.setFontSize(22);
//   doc.setFont("times", "bold");
//   doc.setTextColor(0, 0, 0);
//   const budgetStr = totalWaterBudget.toLocaleString("en-IN", {
//     minimumFractionDigits: 2,
//     maximumFractionDigits: 2,
//   });
//   // ✅ MLD appended to value
//   doc.text(`${budgetStr} MLD`, PW / 2, y + 24, { align: "center" });

//   doc.setFontSize(10);
//   doc.setFont("times", "normal");
//   doc.setTextColor(100, 100, 100);
//   doc.text("Million Liters per Day (MLD)", PW / 2, y + 32, { align: "center" });
//   y += 44;

//   // Analysis metadata row
//   ensureSpace(20);
//   doc.setFontSize(10);
//   doc.setFont("times", "normal");
//   doc.setTextColor(0, 0, 0);
//   const metaStr = [
//     `Year: ${year}`,
//     `Season: ${season.charAt(0).toUpperCase() + season.slice(1)}`,
//     `Product: ${productType}`,
//     `Scale: ${timeScale}`,
//   ].join("     |     ");
//   doc.text(metaStr, PW / 2, y, { align: "center" });
//   y += 10;

//   // Map
//   if (mapImageUrl) {
//     ensureSpace(130);
//     sectionHeading("Spatial Distribution Map", 2);

//     const BBOX = {
//       minLon: 81.76, maxLon: 83.06,
//       minLat: 25.25, maxLat: 25.79,
//     };

//     const axisL = 12;
//     const axisB = 8;
//     const axisT = 4;
//     const axisR = 2;
//     const legW   = legendImageUrl ? 48 : 0;
//     const legGap = legendImageUrl ? 4  : 0;
//     const mapW   = CW - axisL - axisR - legGap - legW;
//     const mapH   = mapW * 0.70;

//     ensureSpace(axisT + mapH + axisB + 14);

//     const mapX = M + axisL;
//     const mapY = y + axisT;

//     try {
//       doc.setFillColor(255, 255, 255);
//       doc.rect(mapX, mapY, mapW, mapH, "F");

//       const brd = 0.3;
//       doc.addImage(mapImageUrl, "PNG", mapX + brd, mapY + brd, mapW - brd * 2, mapH - brd * 2);

//       doc.setDrawColor(80, 80, 80);
//       doc.setLineWidth(0.6);
//       doc.rect(mapX, mapY, mapW, mapH);

//       const latTicks = 4;
//       doc.setFontSize(7);
//       doc.setFont("times", "normal");
//       doc.setTextColor(60, 60, 60);
//       for (let i = 0; i <= latTicks; i++) {
//         const frac   = i / latTicks;
//         const latVal = BBOX.minLat + (BBOX.maxLat - BBOX.minLat) * frac;
//         const tickY  = mapY + mapH - frac * mapH;
//         doc.setDrawColor(80, 80, 80);
//         doc.setLineWidth(0.3);
//         doc.line(mapX - 2, tickY, mapX, tickY);
//         doc.text(latVal.toFixed(2) + "N", mapX - 3, tickY + 1.5, { align: "right" });
//       }

//       const lonTicks = 4;
//       for (let i = 0; i <= lonTicks; i++) {
//         const frac   = i / lonTicks;
//         const lonVal = BBOX.minLon + (BBOX.maxLon - BBOX.minLon) * frac;
//         const tickX  = mapX + frac * mapW;
//         doc.setDrawColor(80, 80, 80);
//         doc.setLineWidth(0.3);
//         doc.line(tickX, mapY + mapH, tickX, mapY + mapH + 2);
//         doc.text(lonVal.toFixed(2) + "E", tickX, mapY + mapH + axisB - 1, { align: "center" });
//       }

//       doc.setFontSize(7);
//       doc.setFont("times", "italic");
//       doc.setTextColor(40, 40, 40);
//       doc.text("Latitude",  M + 3,              mapY + mapH / 2, { align: "center", angle: 90 });
//       doc.text("Longitude", mapX + mapW / 2,    mapY + mapH + axisB + 1, { align: "center" });

//       if (legendImageUrl) {
//         const legX    = mapX + mapW + axisR + legGap;
//         const legY    = mapY;
//         const legPad  = 3;
//         const titleH  = 8;
//         const legImgH = mapH - titleH - legPad * 2;

//         doc.setFillColor(220, 220, 220);
//         doc.roundedRect(legX + 1, legY + 1, legW, mapH, 2, 2, "F");
//         doc.setFillColor(255, 255, 255);
//         doc.setDrawColor(120, 120, 120);
//         doc.setLineWidth(0.4);
//         doc.roundedRect(legX, legY, legW, mapH, 2, 2, "FD");

//         doc.setFontSize(8);
//         doc.setFont("times", "bold");
//         doc.setTextColor(20, 20, 20);
//         doc.text("Legend", legX + legW / 2, legY + legPad + 4, { align: "center" });

//         doc.setDrawColor(180, 180, 180);
//         doc.setLineWidth(0.2);
//         doc.line(legX + 3, legY + titleH, legX + legW - 3, legY + titleH);

//         try {
//           doc.addImage(legendImageUrl, "PNG", legX + legPad, legY + titleH + legPad, legW - legPad * 2, legImgH);
//         } catch (_) {}
//       }

//       y = mapY + mapH + axisB + 4;
//       doc.setFontSize(9);
//       doc.setFont("times", "italic");
//       doc.setTextColor(80, 80, 80);
//       doc.text(
//         `Figure 1: Spatial distribution of water availability - ${season} ${year}-${endYearFinal}`,
//         PW / 2, y, { align: "center" }
//       );
//       y += 8;

//     } catch (_) {
//       addText("[Map image could not be loaded]", { italic: true, color: [150, 0, 0] });
//     }
//   }

//   // Raster Details
//   if (clippedRasters.length > 0) {
//     ensureSpace(20);
//     sectionHeading("Processed Raster Layers", 2);

//     clippedRasters.forEach((raster, idx) => {
//       ensureSpace(22);
//       doc.setFillColor(248, 249, 250);
//       doc.setDrawColor(200, 200, 200);
//       doc.setLineWidth(0.3);
//       doc.roundedRect(M, y, CW, 18, 2, 2, "FD");

//       doc.setFontSize(10);
//       doc.setFont("times", "bold");
//       doc.setTextColor(0, 0, 0);

//       // ✅ User selected productType + year
//       const productLabel = productType.replace(/\s*(entire[-\s]?year|annual|seasonal)/gi, "").trim();
//       const cleanName    = `${productLabel} ${raster.year ?? year}`;
//       doc.text(`Layer ${idx + 1}: ${cleanName}`, M + 4, y + 7);

//       doc.setFont("times", "normal");
//       doc.setFontSize(9);
//       doc.setTextColor(73, 80, 87);
//       const vol = raster.volume_MLD
//         ? `${raster.volume_MLD.toLocaleString("en-IN", { maximumFractionDigits: 2 })} MLD`
//         : "N/A";
//       doc.text(`Volume: ${vol}     Year: ${raster.year ?? "N/A"}`, M + 4, y + 14);
//       y += 22;
//     });
//   }

//   // ==============================================
//   //  CHART
//   // ==============================================
//   if (chartImageUrl) {
//     ensureSpace(100);
//     sectionHeading("Year-wise Water Volume Trend", 2);

//     addText(
//       "The following chart shows the year-wise variation in water volume (MLD) for the selected product " +
//       "and time scale. The dashed line represents the long-term average across the analysis period.",
//       { align: "left" }
//     );

//     const chartW = CW;
//     const chartH = chartW * 0.42;

//     ensureSpace(chartH + 14);

//     doc.setFillColor(255, 255, 255);
//     doc.setDrawColor(200, 200, 200);
//     doc.setLineWidth(0.4);
//     doc.roundedRect(M, y, chartW, chartH, 3, 3, "FD");

//     try {
//       doc.addImage(chartImageUrl, "PNG", M + 1, y + 1, chartW - 2, chartH - 2);
//     } catch (_) {
//       doc.setFontSize(9);
//       doc.setFont("times", "italic");
//       doc.setTextColor(150, 0, 0);
//       doc.text("[Chart image could not be loaded]", PW / 2, y + chartH / 2, { align: "center" });
//     }

//     y += chartH + 4;

//     // Caption
//     doc.setFontSize(9);
//     doc.setFont("times", "italic");
//     doc.setTextColor(80, 80, 80);
//     doc.text(
//       `Figure 2: Year-wise ${productType} volume trend (MLD) - ${season} ${year}-${endYearFinal}`,
//       PW / 2, y, { align: "center" }
//     );
//     y += 10;

//     // ✅ Peak / Lowest / Average stat cards
//     const rastersWithVol = clippedRasters.filter((r: any) => r.volume_MLD && r.year);
//     if (rastersWithVol.length > 0) {
//       const volumes   = rastersWithVol.map((r: any) => r.volume_MLD as number);
//       const peakVal   = Math.max(...volumes);
//       const lowestVal = Math.min(...volumes);
//       const avgVal    = volumes.reduce((a, b) => a + b, 0) / volumes.length;

//       const peakRaster   = rastersWithVol.find((r: any) => r.volume_MLD === peakVal);
//       const lowestRaster = rastersWithVol.find((r: any) => r.volume_MLD === lowestVal);

//       ensureSpace(32);

//       const cardW = (CW - 8) / 3;
//       const cardH = 26;

//       const cards = [
//         {
//           label:  "PEAK",
//           value:  peakVal,
//           year:   peakRaster?.year,
//           bg:     [219, 234, 254] as [number, number, number],
//           accent: [37,  99,  235] as [number, number, number],
//         },
//         {
//           label:  "LOWEST",
//           value:  lowestVal,
//           year:   lowestRaster?.year,
//           bg:     [254, 226, 226] as [number, number, number],
//           accent: [220, 38,  38 ] as [number, number, number],
//         },
//         {
//           label:  "AVERAGE",
//           value:  avgVal,
//           year:   undefined,
//           bg:     [220, 252, 231] as [number, number, number],
//           accent: [22,  163, 74 ] as [number, number, number],
//         },
//       ];

//       cards.forEach((card, i) => {
//         const cx = M + i * (cardW + 4);

//         doc.setFillColor(...card.bg);
//         doc.setDrawColor(...card.accent);
//         doc.setLineWidth(0.4);
//         doc.roundedRect(cx, y, cardW, cardH, 3, 3, "FD");

//         // Label
//         doc.setFontSize(8);
//         doc.setFont("times", "bold");
//         doc.setTextColor(...card.accent);
//         doc.text(card.label, cx + cardW / 2, y + 7, { align: "center" });

//         // Value
//         doc.setFontSize(13);
//         doc.setFont("times", "bold");
//         doc.setTextColor(0, 0, 0);
//         doc.text(`${card.value.toFixed(1)} MLD`, cx + cardW / 2, y + 17, { align: "center" });

//         // Year
//         if (card.year) {
//           doc.setFontSize(8);
//           doc.setFont("times", "normal");
//           doc.setTextColor(100, 100, 100);
//           doc.text(`(${card.year})`, cx + cardW / 2, y + 23, { align: "center" });
//         }
//       });

//       y += cardH + 10;
//     }
//   }

//   // ==============================================
//   //  SECTION 5 - CONCLUSIONS
//   // ==============================================
//   ensureSpace(30);
//   hRule();
//   sectionHeading("5. Conclusions");

//   addText(
//     "This module provides a basin-scale assessment of surface water availability using satellite-based precipitation, " +
//     "evapotranspiration, and runoff, adjusted with ground observations where available. It generates 500 m resolution " +
//     "water balance and Soil Water Content Index (SWCI) layers across seasons and multi-year periods, highlighting spatial " +
//     "and temporal patterns of surplus and deficit to support planning for irrigation, urban supply, and ecosystem needs. " +
//     "Results are presented as static summary products for the Varuna Basin, designed for screening, prioritization, and " +
//     "scenario exploration in the DSS, rather than for real-time forecasting or parcel-scale water accounting.",
//     { align: "left" }
//   );

//   // ==============================================
//   //  SECTION 6 - REFERENCES
//   // ==============================================
//   ensureSpace(30);
//   hRule();
//   sectionHeading("References");

//   const references = [
//     "[1] Singh, P., et al. (2015). Assessment of ground and surface water quality along the river Varuna, Varanasi, India. Environmental Monitoring and Assessment, 187(4), 170. https://doi.org/10.1007/s10661-015-4405-9",
//     "[2] Raju, N. J., Ram, P., & Dey, S. (2009). Groundwater quality in the lower Varuna River basin, Varanasi district, Uttar Pradesh. Journal of the Geological Society of India, 73(2), 178-192. https://doi.org/10.17491/jgsi/2009/73/62778",
//     "[3] Athavale, R. N., Murti, C. S., & Chand, R. (1992). Estimation of recharge to the phreatic aquifers of the Lower Maner Basin. Journal of Hydrology, 107(1-4), 185-202. https://doi.org/10.1016/0022-1694(89)90056-8",
//     "[4] Singh, V. P., & Woolhiser, D. A. (2002). Mathematical modeling of watershed hydrology. Journal of Hydrologic Engineering, 7(4), 270-292. https://doi.org/10.1061/(ASCE)1084-0699(2002)7:4(270)",
//     "[5] Mishra, S. K., & Singh, V. P. (2003). Soil Conservation Service Curve Number (SCS-CN) Methodology. Dordrecht: Kluwer Academic Publishers. https://doi.org/10.1007/978-94-017-0147-1",
//     "[6] Gorelick, N., et al. (2017). Google Earth Engine: Planetary-scale geospatial analysis for everyone. Remote Sensing of Environment, 202, 18-27. https://doi.org/10.1016/j.rse.2017.06.031",
//     "[7] Abatzoglou, J. T., et al. (2018). TerraClimate, a high-resolution global dataset of monthly climate and climatic water balance from 1958-2015. Scientific Data, 5, 170191. https://doi.org/10.1038/sdata.2017.191",
//     "[8] Running, S., Mu, Q., & Zhao, M. (2017). MOD16A2 MODIS/Terra Net Evapotranspiration 8-Day L4 Global 500m SIN Grid V006. NASA EOSDIS Land Processes DAAC. https://doi.org/10.5067/MODIS/MOD16A2.006",
//     "[9] Prakash, S., et al. (2015). From TRMM to GPM: How well can heavy rainfall be detected from space? Advances in Water Resources, 88, 1-7. https://doi.org/10.1016/j.advwatres.2015.11.008",
//     "[10] Roy, D. P., et al. (2016). Examination of Sentinel-2A multi-temporal data for land cover classification. International Journal of Applied Earth Observation and Geoinformation, 81, 52-64.",
//     "[11] Nistor, M. M., et al. (2020). Soil water content index: A standardized method for assessing soil moisture anomalies. Hydrological Sciences Journal, 65(5), 746-758. https://doi.org/10.1080/02626667.2019.1706718",
//   ];

//   references.forEach((ref) => {
//     const lines = doc.splitTextToSize(ref, CW);
//     ensureSpace(lines.length * 5 + 3);
//     doc.setFontSize(9.5);
//     doc.setFont("times", "normal");
//     doc.setTextColor(0, 0, 0);
//     doc.text(lines, M, y);
//     y += lines.length * 4.5 + 4;
//   });

//   // ==============================================
//   //  PAGE NUMBERS
//   // ==============================================
//   const totalPages = (doc.internal as any).pages.length - 1;
//   for (let i = 1; i <= totalPages; i++) {
//     doc.setPage(i);
//     doc.setFontSize(9);
//     doc.setFont("times", "normal");
//     doc.setTextColor(120, 120, 120);
//     doc.text(`Page ${i} of ${totalPages}`, PW / 2, PH - 8, { align: "center" });
//   }

//   // ==============================================
//   //  SAVE
//   // ==============================================
//   const rawYear   = String(year);
//   const yearArr   = rawYear.split(",").map((y) => parseInt(y.trim(), 10)).filter(Boolean);
//   const startYear = yearArr.length > 0 ? Math.min(...yearArr) : year;

//   const fileName = `WaterAvailabilityReport_${startYear}-${endYearFinal}_${new Date()
//     .toISOString()
//     .split("T")[0]}.pdf`;
//   doc.save(fileName);
// }
  














// // WaterAnalysisPDF.ts
// import jsPDF from "jspdf";
// import autoTable from "jspdf-autotable";

// interface RasterData {
//   layer_name: string;
//   volume_MLD?: number;
//   year?: number;
//   [key: string]: any;
// }

// interface WaterAnalysisPDFOptions {
//   exportData: {
//     year: number;
//     endYear?: number;
//     season: string;
//     productType: string;
//     timeScale: string;
//   };
//   rasterResponse: {
//     clipped_rasters: RasterData[];
//   };
//   subdistrictCodes?: number[];
//   mapImageUrls?:    { url: string; year: number }[];
//   legendImageUrls?: { url: string; year: number }[];  // ✅ per-raster legends
//   chartImageUrl?: string;
// }

// export async function generateWaterAnalysisPDF(
//   options: WaterAnalysisPDFOptions
// ): Promise<void> {
//   const { exportData, rasterResponse, mapImageUrls, legendImageUrls, chartImageUrl } = options;

//   const { season, productType, timeScale } = exportData;
//   const clippedRasters   = rasterResponse?.clipped_rasters ?? [];
//   const totalWaterBudget = clippedRasters[0]?.volume_MLD ?? 0;

//   // ✅ Start/End year — clipped_rasters se derive karo (most reliable source)
//   const rasterYears  = clippedRasters.map((r: RasterData) => r.year).filter(Boolean) as number[];
//   const startYear    = rasterYears.length > 0 ? Math.min(...rasterYears) : exportData.year;
//   const endYearFinal = rasterYears.length > 0 ? Math.max(...rasterYears) : (exportData.endYear ?? new Date().getFullYear());
//   const year         = startYear; // backward compat

//   const doc = new jsPDF({ orientation: "p", unit: "mm", format: "a4", compress: true });
//   const PW  = doc.internal.pageSize.getWidth();
//   const PH  = doc.internal.pageSize.getHeight();
//   const M   = 20;
//   const CW  = PW - 2 * M;

//   const LEFT_LOGO   = "/Images/export/logo_iitbhu.png";
//   const RIGHT_LOGO  = "/Images/export/right1_slcr.png";
//   const LOGO_H      = 20;
//   const LOGO_TOP    = 8;
//   const CONTENT_TOP = LOGO_TOP + LOGO_H + 6;

//   const addLogos = () => {
//     try { doc.addImage(LEFT_LOGO,  "PNG", M,           LOGO_TOP, 20, LOGO_H); } catch (_) {}
//     try { doc.addImage(RIGHT_LOGO, "PNG", PW - M - 25, LOGO_TOP, 25, LOGO_H); } catch (_) {}
//     // ✅ Horizontal line below logos on every page
//     doc.setDrawColor(0, 0, 0);
//     doc.setLineWidth(0.5);
//     doc.line(M, LOGO_TOP + LOGO_H + 3, PW - M, LOGO_TOP + LOGO_H + 3);
//   };
//   let y = 0;

//   const newPage = () => {
//     doc.addPage();
//     addLogos();
//     y = CONTENT_TOP;
//   };

//   const ensureSpace = (needed: number) => {
//     if (y + needed > PH - M) newPage();
//   };

//   const addText = (
//     text: string,
//     opts: {
//       fontSize?: number;
//       bold?: boolean;
//       italic?: boolean;
//       align?: "left" | "center";
//       color?: [number, number, number];
//       marginBottom?: number;
//     } = {}
//   ) => {
//     const {
//       fontSize     = 11,
//       bold         = false,
//       italic       = false,
//       align        = "left",
//       color        = [0, 0, 0],
//       marginBottom = 5,
//     } = opts;

//     doc.setFontSize(fontSize);
//     doc.setTextColor(...color);
//     const style = bold ? "bold" : italic ? "italic" : "normal";
//     doc.setFont("times", style);

//     const lines: string[] = doc.splitTextToSize(text, CW);
//     const lineH = fontSize * 0.53;

//     ensureSpace(lines.length * lineH + marginBottom);
//     doc.setFontSize(fontSize);
//     doc.setTextColor(...color);
//     doc.setFont("times", style);

//     lines.forEach((line) => {
//       if (y + lineH > PH - M) {
//         doc.addPage();
//         addLogos();
//         y = CONTENT_TOP;
//         doc.setFontSize(fontSize);
//         doc.setTextColor(...color);
//         doc.setFont("times", style);
//       }
//       if (align === "center") doc.text(line, PW / 2, y, { align: "center" });
//       else doc.text(line, M, y);
//       y += lineH;
//     });
//     y += marginBottom;
//   };

//   const sectionHeading = (text: string, level: 1 | 2 = 1) => {
//     ensureSpace(14);
//     y += level === 1 ? 4 : 2;
//     addText(text, { fontSize: level === 1 ? 13 : 12, bold: true, marginBottom: 6 });
//   };

//   const hRule = () => {
//     doc.setDrawColor(0, 0, 0);
//     doc.setLineWidth(0.4);
//     doc.line(M, y, PW - M, y);
//     y += 4;
//   };

//   const addEquation = (eq: string, opts: { highlight?: boolean } = {}) => {
//     const accent = opts.highlight ?? false;
//     const fs = 10, padH = 6, padV = 5, lineH = fs * 0.55;
//     doc.setFontSize(fs);
//     doc.setFont("times", "italic");
//     const eqLines: string[] = doc.splitTextToSize(eq, CW - padH * 2);
//     const boxH = padV * 2 + eqLines.length * lineH + 2;
//     ensureSpace(boxH + 4);
//     if (accent) { doc.setFillColor(230, 244, 255); doc.setDrawColor(22, 78, 99); doc.setLineWidth(0.5); }
//     else        { doc.setFillColor(248, 249, 250); doc.setDrawColor(180, 180, 180); doc.setLineWidth(0.3); }
//     doc.roundedRect(M, y, CW, boxH, 2, 2, "FD");
//     doc.setFontSize(fs); doc.setFont("times", "italic"); doc.setTextColor(0, 0, 0);
//     eqLines.forEach((line, i) => {
//       doc.text(line, PW / 2, y + padV + (i + 0.75) * lineH, { align: "center" });
//     });
//     y += boxH + 5;
//   };

//   // ==============================================
//   //  PAGE 1 - COVER
//   // ==============================================
//   addLogos();

//   const lineY = LOGO_TOP + LOGO_H + 3;
//   doc.setDrawColor(0, 0, 0);
//   doc.setLineWidth(0.5);
//   doc.line(M, lineY, PW - M, lineY);

//   const TITLE_FONT = 16, SUBTITLE_FONT = 11, BOX_PAD = 8;
//   const titleText    = "Comprehensive Report on Water Availability (Admin Mode)";
//   const subtitleText = "A Geospatial and Hydrological Analysis for Water Resource Assessment";

//   doc.setFontSize(TITLE_FONT);    doc.setFont("times", "bold");
//   const titleLines: string[]    = doc.splitTextToSize(titleText,    CW - BOX_PAD * 2);
//   doc.setFontSize(SUBTITLE_FONT); doc.setFont("times", "normal");
//   const subtitleLines: string[] = doc.splitTextToSize(subtitleText, CW - BOX_PAD * 2);

//   const titleBlockH =
//     BOX_PAD + titleLines.length * (TITLE_FONT * 0.45) + 4 +
//     subtitleLines.length * (SUBTITLE_FONT * 0.45) + BOX_PAD;

//   const BOX_TOP = 95;
//   doc.setFillColor(240, 249, 255); doc.setDrawColor(22, 78, 99); doc.setLineWidth(0.6);
//   doc.roundedRect(M, BOX_TOP, CW, titleBlockH, 3, 3, "FD");

//   y = BOX_TOP + BOX_PAD + TITLE_FONT * 0.45;
//   doc.setFontSize(TITLE_FONT); doc.setFont("times", "bold"); doc.setTextColor(22, 78, 99);
//   titleLines.forEach((line) => { doc.text(line, PW / 2, y, { align: "center" }); y += TITLE_FONT * 0.45; });

//   y += 4;
//   doc.setFontSize(SUBTITLE_FONT); doc.setFont("times", "normal"); doc.setTextColor(55, 65, 81);
//   subtitleLines.forEach((line) => { doc.text(line, PW / 2, y, { align: "center" }); y += SUBTITLE_FONT * 0.45; });

//   y = BOX_TOP + titleBlockH + 12;

//   const reportDate = new Date().toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" });
//   const labelW = 38, valueMaxW = CW - 38, LINE_H = 6.5;

//   const metaLines: [string, string][] = [
//     ["Year / Season", `${startYear}-${endYearFinal} / ${season.charAt(0).toUpperCase() + season.slice(1)}`],
//     ["Product Type",  productType || "Water Budget"],
//     ["Time Scale",    timeScale   || "Annual"],
//   ];

// metaLines.forEach(([label, value]) => {
//     doc.setFontSize(11); doc.setFont("times", "normal");
//     const vLines: string[] = doc.splitTextToSize(value, valueMaxW);
//     doc.setFont("times", "bold"); doc.setTextColor(0, 0, 0);
//     doc.text(`${label}:`, M, y);
//     doc.setFont("times", "normal");
//     vLines.forEach((vl, vi) => doc.text(vl, M + labelW, y + vi * LINE_H));
//     y += vLines.length * LINE_H + 2;
//   });

//   // ✅ Prepared by + Date fixed above footer
//   const footerMetaY = PH - 22 - 22; // just above footer band
//   const footerMeta: [string, string][] = [
//     ["Prepared by", "IIT (BHU), Varanasi"],
//     ["Date",        reportDate],
//   ];
//   footerMeta.forEach(([label, value], i) => {
//     const fy = footerMetaY + i * 8;
//     doc.setFontSize(11); doc.setFont("times", "bold"); doc.setTextColor(0, 0, 0);
//     doc.text(`${label}:`, M, fy);
//     doc.setFont("times", "normal");
//     doc.text(value, M + labelW, fy);
//   });

//   doc.setFillColor(22, 78, 99); doc.rect(0, PH - 22, PW, 22, "F");
//   doc.setFontSize(10); doc.setFont("times", "normal"); doc.setTextColor(255, 255, 255);
//   doc.text("Smart Laboratory on Clean Rivers (Dept. of Civil Engineering)",                 PW / 2, PH - 13, { align: "center" });
//   doc.text("Indian Institute of Technology (BHU), Varanasi", PW / 2, PH - 6,  { align: "center" });

//   // ==============================================
//   //  PAGE 2 - EXECUTIVE SUMMARY
//   // ==============================================
//   newPage();  sectionHeading("1. Executive Summary");
//   addText(
//     "The Water Availability sub-module estimates surface water quantity generated and sustained within the Varuna Basin " +
//     "through basin-scale rainfall-runoff modeling embedded in decision support system. This framework translates climatic " +
//     "inputs and land-surface interactions into spatially explicit measures of runoff, infiltration, and discharge at 500 m " +
//     "resolution, providing quantitative foundations for water resource planning within the decision making. Water availability " +
//     "represents a central concern in the Varuna Basin, where rainfall variability, land use change, and population growth " +
//     "increasingly pressure local water resources. The operational monitoring framework captures these dynamics through " +
//     "integration of multiple Earth observation datasets viz., TerraClimate (precipitation & runoff) and MODIS " +
//     "evapotranspiration, to generate comprehensive water budget assessments incorporating bias-corrected precipitation " +
//     "against Indian Meteorological Department (IMD) observations and accounting for physical losses through seepage. Key " +
//     "outcomes include basin-wide quantification of surface water availability, computed through water balance equation. " +
//     "Outputs are resolved spatially at 500 m through pixel-level mapping and temporally at seasonal and annual scales. " +
//     "This resolution enables identification of water-deficit hotspots and prioritization of interventions for agricultural, " +
//     "urban, and ecosystem needs, moving beyond isolated measurements toward dynamic basin-scale assessments that support " +
//     "data-driven water governance."
//   );

//   ensureSpace(30); hRule(); sectionHeading("2. Basin and Water Availability Challenges");
//   addText(
//     "Water availability in the Varuna Basin is governed by intertwined climatic, geomorphic, and anthropogenic factors " +
//     "that complicate reliable assessment and management of surface water resources. As a rain-fed tributary of the Ganga, " +
//     "the basin depends heavily on monsoonal precipitation, which supplies most of the annual inflow and creates pronounced " +
//     "contrasts between surplus conditions during the monsoon and acute shortages in the pre-monsoon months. These dynamics " +
//     "highlight the need for basin-scale monitoring and forecasting frameworks that can track both seasonal variability and " +
//     "long-term trends. Natural controls play a central role in shaping hydrological responses. The basin's alluvial geology " +
//     "exhibits spatially variable infiltration potential, influencing how rainfall is partitioned among surface runoff, " +
//     "groundwater recharge, and soil moisture storage. Steeper upper reaches promote rapid runoff and limited retention, " +
//     "while gentler downstream areas favor stagnation and sediment deposition; clay-rich soils restrict infiltration and " +
//     "enhance overland flow, whereas sandy and mixed textures support recharge but can deplete quickly. Human pressures " +
//     "compound these vulnerabilities. Expansion of irrigated agriculture, especially rice-wheat systems, has raised water " +
//     "demand and altered infiltration and runoff pathways, and urbanization around Varanasi has replaced permeable surfaces " +
//     "with built-up areas, increasing runoff and reducing recharge. Inadequate drainage and industrial effluents further " +
//     "degrade water quality, so scarcity increasingly reflects misaligned demand and pollution as much as limited natural " +
//     "supply, making robust, integrated water availability frameworks indispensable."
//   );

//   ensureSpace(20); sectionHeading("2.2 Rainfall-Runoff Modeling Framework", 2);
//   addText(
//     "Rainfall-runoff modeling provides a structured means to quantify how precipitation is partitioned into " +
//     "evapotranspiration, infiltration, soil water storage, and surface runoff, supporting consistent water balance " +
//     "estimation across heterogeneous terrain and land uses, even where direct flow records are sparse [5]. By integrating " +
//     "spatial inputs such as land use/land cover, soil texture, and topography, these models capture variability in " +
//     "hydrological responses and enable comparison between sub-basins or management units [6]. In the Varuna Basin, where " +
//     "pronounced seasonal variability and human pressures drive sharp contrasts in water supply, this framework is essential " +
//     "for diagnosing when and where water deficits are most likely to occur, and can be extended over multiple years or " +
//     "coupled with climate projections to explore future water availability scenarios. Embedding model outputs within the " +
//     "Decision Support System transforms gridded results into interactive maps and indicators, helping decision-makers " +
//     "prioritize rainwater harvesting, managed recharge, and irrigation scheduling based on seasonal runoff potential."
//   );

//   // ==============================================
//   //  SECTION 3 - METHODOLOGY
//   // ==============================================
//   ensureSpace(30); hRule(); sectionHeading("3. Methodology");
//   sectionHeading("3.1 Theoretical Foundation: Water Balance Equation", 2);
//   addText("The fundamental water balance equation represents conservation of mass for the hydrological cycle over a defined spatial domain and time period:");
//   addEquation("Delta_S = P - ET - Q - I");
//   addText("where Delta_S represents change in storage (soil water, groundwater), P is precipitation, ET is evapotranspiration, Q is surface and subsurface runoff, and I is infiltration [5].");
//   addText("The implemented water balance in Google Earth Engine adapts this framework to basin-scale satellite-based analysis at pixel level, as shown in Table 1.");

//   ensureSpace(12);
//   doc.setFontSize(10); doc.setFont("times", "normal"); doc.setTextColor(0, 0, 0);
//   doc.text("Table 1: Correspondence between theoretical components and operational implementation", PW / 2, y, { align: "center" });
//   y += 6;
//   autoTable(doc, {
//     startY: y,
//     head: [["Theoretical Variable", "Implementation", "Source Dataset"]],
//     body: [
//       ["P_day (Precipitation)",       "P_corrected",         "TerraCLIMATE + IMD correction"],
//       ["E_a (Evapotranspiration)",     "ET_normalized",       "MODIS MOD16A2GF"],
//       ["Q_surf + Q_gw (Total runoff)", "Q",                   "TerraCLIMATE runoff"],
//       ["w_seep (Seepage)",             "0.12 * water budget", "Empirical (12% loss)"],
//     ],
//     styles:       { font: "times", fontSize: 10, cellPadding: 4, halign: "left", valign: "middle" },
//     headStyles:   { fillColor: [211, 211, 211], textColor: [0, 0, 0], fontStyle: "bold", halign: "center" },
//     columnStyles: { 0: { cellWidth: 55 }, 1: { cellWidth: 40 }, 2: { cellWidth: 75 } },
//     margin:       { left: M, right: M, top: CONTENT_TOP },
//     didDrawPage:  () => addLogos(),
//   });
//   y = (doc as any).lastAutoTable.finalY + 10;

//   ensureSpace(20); sectionHeading("3.3 Primary Datasets", 2);
//   addText(
//     "This sub-module relies on three complementary datasets that together enable a robust, satellite-driven " +
//     "characterization of water balance in the Varuna Basin. TerraCLIMATE provides global high-resolution (approximately " +
//     "4 km) monthly climate and climatic water balance data from 1958 onwards, combining WorldClim climatological normals " +
//     "with CRU TS 4.0 and JRA55 reanalysis within a modified Thornthwaite-Mather model, and supplies precipitation (p_r), " +
//     "actual evapotranspiration (a_et), and runoff (r_no) as millimeter-depth inputs for basin-scale assessments in " +
//     "data-scarce settings. The MODIS Terra Net Evapotranspiration product (MOD16A2GF Version 6.1) contributes gap-filled " +
//     "8-day evapotranspiration at 500 m resolution, computed using the Penman-Monteith formulation:"
//   );
//   addEquation("ET = (Delta*(Rn-G) + rho_a*cp*(es-ea)/ra) / (Delta + gamma*(1 + rs/ra))");
//   addText("where Rn is net radiation, G is soil heat flux, es-ea is vapor pressure deficit, rs is surface resistance, ra is aerodynamic resistance, Delta is the slope of the saturation vapor pressure curve, and gamma is the psychrometric constant. To reduce systematic bias in satellite-derived precipitation, TerraCLIMATE rainfall is further adjusted using Indian Meteorological Department gauge data through a linear bias-correction:");
//   addEquation("P_corrected = a * P_TC + b");
//   addText("with slope a = 1.01 and intercept b = 10.12, thereby improving representation of intense, convective monsoon rainfall typical of the Indo-Gangetic plains.");

//   ensureSpace(20); sectionHeading("3.4 Data Processing and Integration Procedures", 2);
//   addText("This sub-module applies a five-step Google Earth Engine workflow to derive pixel-wise water balance in the Varuna Basin. First, monthly TerraCLIMATE and MODIS products are aggregated to seasonal or annual periods, and TerraCLIMATE precipitation is bias-corrected using IMD coefficients so that P_corrected = a * P_TC + b. MODIS evapotranspiration is then normalized to the TerraCLIMATE AET range by computing:");
//   addEquation("MODIS_norm = (MODIS - MODIS_min) / (MODIS_max - MODIS_min)");
//   addEquation("ET_normalized = MODIS_norm * (TC_max - TC_min) + TC_min");
//   addEquation("WB = (P_corrected - ET_normalized - Q) * 0.25 * 0.88");
//   addText("where 0.25 converts millimeter depth to volume at 500 m resolution (0.25 km2 per pixel) and 0.88 allocates 88% of the budget to soil water in the root zone and 12% to seepage losses.");

//   ensureSpace(20); sectionHeading("3.5 Combined Operational Water Balance Equations", 2);
//   addText("The final operational formula integrates all corrections and adjustments:");
//   addEquation("WB = (P_corrected - ET_normalized - Q) * 0.25 * 0.88", { highlight: true });
//   addText("where P_corrected is IMD-corrected precipitation (mm), ET_normalized is MODIS ET rescaled to TerraCLIMATE range (mm), Q is TerraCLIMATE runoff (mm), 0.25 is the pixel area conversion factor (to km2), and 0.88 is the seepage loss compensation factor. Daily water balance is derived through temporal disaggregation:");
//   addEquation("W_daily = W_b / n_days");
//   addText("where n_days is the number of days in the analysis period.");

//   ensureSpace(20); sectionHeading("3.6 Soil Water Content Index (SWCI)", 2);
//   addText("The Soil Water Content Index (SWCI) is a standardized anomaly (z-score) of daily water balance, enabling classification of water availability conditions relative to long-term climatology:");
//   addEquation("SWCI = (WB_daily - mean_WB) / std_WB");
//   addText("where WB_daily is the daily-mean water balance for a given year or period, mean_WB is the long-term mean daily water balance, and std_WB is its standard deviation [12]. SWCI values are classified into ten categories as detailed in Table 2.");

//   ensureSpace(12);
//   doc.setFontSize(10); doc.setFont("times", "normal"); doc.setTextColor(0, 0, 0);
//   doc.text("Table 2: SWCI classification scheme for water availability assessment", PW / 2, y, { align: "center" });
//   y += 6;
//   autoTable(doc, {
//     startY: y,
//     head: [["Class Code", "SWCI Range", "Class Name"]],
//     body: [
//       ["1","Z < -2.0","Extremely Dry"],["2","-2.0 <= Z < -1.5","Severely Dry"],
//       ["3","-1.5 <= Z < -1.0","Highly Dry"],["4","-1.0 <= Z < -0.5","Moderately Dry"],
//       ["5","-0.5 <= Z < 0","Mild Dry"],["6","0 <= Z < 0.5","Mild Surplus"],
//       ["7","0.5 <= Z < 1.0","Moderate Surplus"],["8","1.0 <= Z < 1.5","High Surplus"],
//       ["9","1.5 <= Z < 2.0","Abundant"],["10","Z >= 2.0","Extreme Surplus"],
//     ],
//     styles:       { font: "times", fontSize: 10, cellPadding: 3, halign: "center", valign: "middle" },
//     headStyles:   { fillColor: [211, 211, 211], textColor: [0, 0, 0], fontStyle: "bold", halign: "center" },
//     columnStyles: { 0: { cellWidth: 30 }, 1: { cellWidth: 65 }, 2: { cellWidth: 75 } },
//     margin:       { left: M, right: M, top: CONTENT_TOP },
//     didDrawPage:  () => addLogos(),
//   });
//   y = (doc as any).lastAutoTable.finalY + 10;

//   ensureSpace(20); sectionHeading("3.7 Temporal Analysis Framework", 2);
//   addText("This module summarizes water balance at multiple time scales consistent with the monsoon-dominated hydrology of the Varuna Basin, including seasonal windows (winter, pre-monsoon, summer-monsoon, post-monsoon) and full annual totals. Long-term behavior is evaluated over study area and time during the last ten year period, enabling assessment of variability and trends in water availability under changing climate and land use. For each selected period, the GEE application provides four standardized outputs: a daily water budget (MLD), surplus and deficit masks indicating areas of positive or negative water balance, and a 1-10 SWCI-based index class that groups conditions from dry to surplus for management use.");

//   ensureSpace(12);
//   doc.setFontSize(10); doc.setFont("times", "normal"); doc.setTextColor(0, 0, 0);
//   doc.text("Table 3: Primary output products from water availability assessment", PW / 2, y, { align: "center" });
//   y += 6;
//   autoTable(doc, {
//     startY: y,
//     head: [["Product", "Definition", "Units"]],
//     body: [
//       ["Water Budget","Daily water balance (P - ET - Q)","MLD"],
//       ["Surplus","Positive water balance (water availability)","Binary mask"],
//       ["Deficit","Negative water balance (water stress)","Binary mask"],
//       ["Index Class","Classified water availability category","Ordinal (1-10)"],
//     ],
//     styles:       { font: "times", fontSize: 10, cellPadding: 4, halign: "left", valign: "middle" },
//     headStyles:   { fillColor: [211, 211, 211], textColor: [0, 0, 0], fontStyle: "bold", halign: "center" },
//     columnStyles: { 0: { cellWidth: 40 }, 1: { cellWidth: 90 }, 2: { cellWidth: 40 } },
//     margin:       { left: M, right: M, top: CONTENT_TOP },
//     didDrawPage:  () => addLogos(),
//   });
//   y = (doc as any).lastAutoTable.finalY + 10;

//   // ==============================================
//   //  SECTION 4 - RESULTS
//   // ==============================================
//   ensureSpace(30); hRule(); sectionHeading("4. Results");
//   addText("Pixel-level water balance components are first computed as depth (mm) and then converted to volume (million liters) using the 0.25 km2 pixel area, allowing aggregation from local to basin scale. For the analysis period, annual totals of precipitation, evapotranspiration, runoff, and net water balance are derived, with indicative averages of about 930 mm of precipitation and 400 mm of evapotranspiration, yielding an ET/P ratio near 0.43 that is consistent with an agriculture-dominated Indo-Gangetic alluvial basin where the remaining water is distributed between runoff, infiltration, and changes in storage.");

//   // Water Budget Summary card
//   ensureSpace(45);
//   doc.setFillColor(240, 249, 255); doc.setDrawColor(22, 78, 99); doc.setLineWidth(0.6);
//   doc.roundedRect(M, y, CW, 38, 4, 4, "FD");
//   doc.setFontSize(12); doc.setFont("times", "bold"); doc.setTextColor(22, 78, 99);
//   doc.text("Water Budget Summary", M + 6, y + 10);
//   doc.setFontSize(22); doc.setFont("times", "bold"); doc.setTextColor(0, 0, 0);
//   const budgetStr = totalWaterBudget.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
//   doc.text(`${budgetStr} MLD`, PW / 2, y + 24, { align: "center" });
//   doc.setFontSize(10); doc.setFont("times", "normal"); doc.setTextColor(100, 100, 100);
//   doc.text("Million Liters per Day (MLD)", PW / 2, y + 32, { align: "center" });
//   y += 44;

//   ensureSpace(20);
//   doc.setFontSize(10); doc.setFont("times", "normal"); doc.setTextColor(0, 0, 0);
//   doc.text(
//     [`Year: ${year}`, `Season: ${season.charAt(0).toUpperCase() + season.slice(1)}`, `Product: ${productType}`, `Scale: ${timeScale}`].join("     |     "),
//     PW / 2, y, { align: "center" }
//   );
//   y += 10;

//   // ==============================================
//   //  MAPS - 1 per section, full width, own legend
//   // ==============================================
//   if (mapImageUrls && mapImageUrls.length > 0) {
//     ensureSpace(20);
//     hRule();
//     sectionHeading("Spatial Distribution Maps", 2);

//     const BBOX_PDF = { minLon: 81.76, maxLon: 83.06, minLat: 25.25, maxLat: 25.79 };
//     const axL    = 12;
//     const axB    = 14;
//     const axT    = 10;
//     const legW   = 45;
//     const legGap = 5;
//     const imgW   = CW - axL - legW - legGap;
//     const imgH   = imgW * 0.68;
//     const productLabel = productType.replace(/\s*(entire[-\s]?year|annual|seasonal)/gi, "").trim();

//     for (let i = 0; i < mapImageUrls.length; i++) {
//       const mapItem = mapImageUrls[i];

//       // ✅ Find this year's legend specifically
//       const thisLegend =
//         legendImageUrls?.find(l => l.year === mapItem.year)?.url ??
//         legendImageUrls?.[0]?.url ??
//         null;

//       ensureSpace(axT + imgH + axB + 14);

//       const imgX = M + axL;
//       const imgY = y + axT;

//       // ── Year label above ──────────────────────────────────────────────
//       doc.setFontSize(10); doc.setFont("times", "bold"); doc.setTextColor(22, 78, 99);
//       doc.text(`${productLabel} — ${mapItem.year}`, imgX + imgW / 2, y + axT - 3, { align: "center" });

//       // ── White bg ──────────────────────────────────────────────────────
//       doc.setFillColor(255, 255, 255);
//       doc.rect(imgX, imgY, imgW, imgH, "F");

//       // ── Map image ─────────────────────────────────────────────────────
//       try { doc.addImage(mapItem.url, "PNG", imgX + 0.3, imgY + 0.3, imgW - 0.6, imgH - 0.6); } catch (_) {}

//       // ── Border ───────────────────────────────────────────────────────
//       doc.setDrawColor(80, 80, 80); doc.setLineWidth(0.5);
//       doc.rect(imgX, imgY, imgW, imgH);

//       // ── Lat ticks ────────────────────────────────────────────────────
//       doc.setFontSize(7); doc.setFont("times", "normal"); doc.setTextColor(60, 60, 60);
//       for (let t = 0; t <= 4; t++) {
//         const frac   = t / 4;
//         const latVal = BBOX_PDF.minLat + (BBOX_PDF.maxLat - BBOX_PDF.minLat) * frac;
//         const tickY  = imgY + imgH - frac * imgH;
//         doc.setDrawColor(80, 80, 80); doc.setLineWidth(0.3);
//         doc.line(imgX - 2, tickY, imgX, tickY);
//         doc.text(latVal.toFixed(2) + "N", imgX - 3, tickY + 1.5, { align: "right" });
//       }

//       // ── Lon ticks ────────────────────────────────────────────────────
//       for (let t = 0; t <= 4; t++) {
//         const frac   = t / 4;
//         const lonVal = BBOX_PDF.minLon + (BBOX_PDF.maxLon - BBOX_PDF.minLon) * frac;
//         const tickX  = imgX + frac * imgW;
//         doc.setDrawColor(80, 80, 80); doc.setLineWidth(0.3);
//         doc.line(tickX, imgY + imgH, tickX, imgY + imgH + 2);
//         doc.text(lonVal.toFixed(2) + "E", tickX, imgY + imgH + axB - 1, { align: "center" });
//       }

//       // ── Axis titles ───────────────────────────────────────────────────
//       doc.setFontSize(7); doc.setFont("times", "italic"); doc.setTextColor(40, 40, 40);
//       doc.text("Latitude",  M + 3,           imgY + imgH / 2, { align: "center", angle: 90 });
//       doc.text("Longitude", imgX + imgW / 2, imgY + imgH + 6, { align: "center" });

//       // ── Legend (this year's own legend) ───────────────────────────────
//       if (thisLegend) {
//         const legX   = imgX + imgW + legGap;
//         const legY   = imgY;
//         const legPad = 3;
//         const titleH = 8;

//         // Shadow
//         doc.setFillColor(220, 220, 220);
//         doc.roundedRect(legX + 1, legY + 1, legW, imgH, 2, 2, "F");

//         // White box
//         doc.setFillColor(255, 255, 255); doc.setDrawColor(120, 120, 120); doc.setLineWidth(0.4);
//         doc.roundedRect(legX, legY, legW, imgH, 2, 2, "FD");

//         // Title
//         doc.setFontSize(8); doc.setFont("times", "bold"); doc.setTextColor(20, 20, 20);
//         doc.text("Legend", legX + legW / 2, legY + legPad + 4, { align: "center" });

//         // Separator
//         doc.setDrawColor(180, 180, 180); doc.setLineWidth(0.2);
//         doc.line(legX + 3, legY + titleH, legX + legW - 3, legY + titleH);

//         // Legend image
//         try {
//           doc.addImage(
//             thisLegend, "PNG",
//             legX + legPad,
//             legY + titleH + legPad,
//             legW - legPad * 2,
//             imgH - titleH - legPad * 2
//           );
//         } catch (_) {}
//       }

//       // ── Figure caption ────────────────────────────────────────────────
//       const capY = imgY + imgH + axB + 6;
//       doc.setFontSize(9); doc.setFont("times", "italic"); doc.setTextColor(80, 80, 80);
//       doc.text(
//         `Figure ${i + 1}: Spatial distribution of ${productLabel} - ${season} ${mapItem.year}`,
//         PW / 2, capY, { align: "center" }
//       );

//       y = capY + 8;
//     }
//   }

//   // Raster Details
//   if (clippedRasters.length > 0) {
//     ensureSpace(20);
//     sectionHeading("Processed Raster Layers", 2);
//     clippedRasters.forEach((raster, idx) => {
//       ensureSpace(22);
//       doc.setFillColor(248, 249, 250); doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.3);
//       doc.roundedRect(M, y, CW, 18, 2, 2, "FD");
//       doc.setFontSize(10); doc.setFont("times", "bold"); doc.setTextColor(0, 0, 0);
//       const productLabel = productType.replace(/\s*(entire[-\s]?year|annual|seasonal)/gi, "").trim();
//       doc.text(`Layer ${idx + 1}: ${productLabel} ${raster.year ?? year}`, M + 4, y + 7);
//       doc.setFont("times", "normal"); doc.setFontSize(9); doc.setTextColor(73, 80, 87);
//       const vol = raster.volume_MLD
//         ? `${raster.volume_MLD.toLocaleString("en-IN", { maximumFractionDigits: 2 })} MLD`
//         : "N/A";
//       doc.text(`Volume: ${vol}     Year: ${raster.year ?? "N/A"}`, M + 4, y + 14);
//       y += 22;
//     });
//   }

//   // ==============================================
//   //  CHART
//   // ==============================================
//   if (chartImageUrl) {
//     ensureSpace(100);
//     sectionHeading("Year-wise Water Volume Trend", 2);
//     addText("The following chart shows the year-wise variation in water volume (MLD) for the selected product and time scale. The dashed line represents the long-term average across the analysis period.");

//     const chartW = CW, chartH = chartW * 0.42;
//     ensureSpace(chartH + 14);
//     doc.setFillColor(255, 255, 255); doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.4);
//     doc.roundedRect(M, y, chartW, chartH, 3, 3, "FD");
//     try { doc.addImage(chartImageUrl, "PNG", M + 1, y + 1, chartW - 2, chartH - 2); }
//     catch (_) {
//       doc.setFontSize(9); doc.setFont("times", "italic"); doc.setTextColor(150, 0, 0);
//       doc.text("[Chart image could not be loaded]", PW / 2, y + chartH / 2, { align: "center" });
//     }
//     y += chartH + 4;

//     doc.setFontSize(9); doc.setFont("times", "italic"); doc.setTextColor(80, 80, 80);
//     doc.text(`Figure: Year-wise ${productType} volume trend (MLD) - ${season} ${year}-${endYearFinal}`, PW / 2, y, { align: "center" });
//     y += 10;

//     // Peak / Lowest / Average cards
//     const rastersWithVol = clippedRasters.filter((r: any) => r.volume_MLD && r.year);
//     if (rastersWithVol.length > 0) {
//       const volumes    = rastersWithVol.map((r: any) => r.volume_MLD as number);
//       const peakVal    = Math.max(...volumes);
//       const lowestVal  = Math.min(...volumes);
//       const avgVal     = volumes.reduce((a, b) => a + b, 0) / volumes.length;
//       const peakRaster   = rastersWithVol.find((r: any) => r.volume_MLD === peakVal);
//       const lowestRaster = rastersWithVol.find((r: any) => r.volume_MLD === lowestVal);

//       ensureSpace(32);
//       const cardW = (CW - 8) / 3, cardH = 26;
//       const cards = [
//         { label: "PEAK",    value: peakVal,   yr: peakRaster?.year,   bg: [219,234,254] as [number,number,number], accent: [37,99,235]  as [number,number,number] },
//         { label: "LOWEST",  value: lowestVal, yr: lowestRaster?.year, bg: [254,226,226] as [number,number,number], accent: [220,38,38]  as [number,number,number] },
//         { label: "AVERAGE", value: avgVal,    yr: undefined,          bg: [220,252,231] as [number,number,number], accent: [22,163,74]  as [number,number,number] },
//       ];
//       cards.forEach((card, i) => {
//         const cx = M + i * (cardW + 4);
//         doc.setFillColor(...card.bg); doc.setDrawColor(...card.accent); doc.setLineWidth(0.4);
//         doc.roundedRect(cx, y, cardW, cardH, 3, 3, "FD");
//         doc.setFontSize(8); doc.setFont("times", "bold"); doc.setTextColor(...card.accent);
//         doc.text(card.label, cx + cardW / 2, y + 7, { align: "center" });
//         doc.setFontSize(13); doc.setFont("times", "bold"); doc.setTextColor(0, 0, 0);
//         doc.text(`${card.value.toFixed(1)} MLD`, cx + cardW / 2, y + 17, { align: "center" });
//         if (card.yr) {
//           doc.setFontSize(8); doc.setFont("times", "normal"); doc.setTextColor(100, 100, 100);
//           doc.text(`(${card.yr})`, cx + cardW / 2, y + 23, { align: "center" });
//         }
//       });
//       y += cardH + 10;
//     }
//   }

//   // ==============================================
//   //  SECTION 5 - CONCLUSIONS
//   // ==============================================
//   ensureSpace(30); hRule(); sectionHeading("5. Conclusions");
//   addText("This module provides a basin-scale assessment of surface water availability using satellite-based precipitation, evapotranspiration, and runoff, adjusted with ground observations where available. It generates 500 m resolution water balance and Soil Water Content Index (SWCI) layers across seasons and multi-year periods, highlighting spatial and temporal patterns of surplus and deficit to support planning for irrigation, urban supply, and ecosystem needs. Results are presented as static summary products for the Varuna Basin, designed for screening, prioritization, and scenario exploration in the DSS, rather than for real-time forecasting or parcel-scale water accounting.");

//   // ==============================================
//   //  REFERENCES
//   // ==============================================
//   ensureSpace(30); sectionHeading("References");
//   const references = [
//     "[1] Singh, P., et al. (2015). Assessment of ground and surface water quality along the river Varuna, Varanasi, India. Environmental Monitoring and Assessment, 187(4), 170. https://doi.org/10.1007/s10661-015-4405-9",
//     "[2] Raju, N. J., Ram, P., & Dey, S. (2009). Groundwater quality in the lower Varuna River basin, Varanasi district, Uttar Pradesh. Journal of the Geological Society of India, 73(2), 178-192. https://doi.org/10.17491/jgsi/2009/73/62778",
//     "[3] Athavale, R. N., Murti, C. S., & Chand, R. (1992). Estimation of recharge to the phreatic aquifers of the Lower Maner Basin. Journal of Hydrology, 107(1-4), 185-202. https://doi.org/10.1016/0022-1694(89)90056-8",
//     "[4] Singh, V. P., & Woolhiser, D. A. (2002). Mathematical modeling of watershed hydrology. Journal of Hydrologic Engineering, 7(4), 270-292. https://doi.org/10.1061/(ASCE)1084-0699(2002)7:4(270)",
//     "[5] Mishra, S. K., & Singh, V. P. (2003). Soil Conservation Service Curve Number (SCS-CN) Methodology. Dordrecht: Kluwer Academic Publishers. https://doi.org/10.1007/978-94-017-0147-1",
//     "[6] Gorelick, N., et al. (2017). Google Earth Engine: Planetary-scale geospatial analysis for everyone. Remote Sensing of Environment, 202, 18-27. https://doi.org/10.1016/j.rse.2017.06.031",
//     "[7] Abatzoglou, J. T., et al. (2018). TerraClimate, a high-resolution global dataset of monthly climate and climatic water balance from 1958-2015. Scientific Data, 5, 170191. https://doi.org/10.1038/sdata.2017.191",
//     "[8] Running, S., Mu, Q., & Zhao, M. (2017). MOD16A2 MODIS/Terra Net Evapotranspiration 8-Day L4 Global 500m SIN Grid V006. NASA EOSDIS Land Processes DAAC. https://doi.org/10.5067/MODIS/MOD16A2.006",
//     "[9] Prakash, S., et al. (2015). From TRMM to GPM: How well can heavy rainfall be detected from space? Advances in Water Resources, 88, 1-7. https://doi.org/10.1016/j.advwatres.2015.11.008",
//     "[10] Roy, D. P., et al. (2016). Examination of Sentinel-2A multi-temporal data for land cover classification. International Journal of Applied Earth Observation and Geoinformation, 81, 52-64.",
//     "[11] Nistor, M. M., et al. (2020). Soil water content index: A standardized method for assessing soil moisture anomalies. Hydrological Sciences Journal, 65(5), 746-758. https://doi.org/10.1080/02626667.2019.1706718",
//   ];
//   references.forEach((ref) => {
//     const lines = doc.splitTextToSize(ref, CW);
//     ensureSpace(lines.length * 5 + 3);
//     doc.setFontSize(9.5); doc.setFont("times", "normal"); doc.setTextColor(0, 0, 0);
//     doc.text(lines, M, y);
//     y += lines.length * 4.5 + 4;
//   });

//   // ==============================================
//   //  PAGE NUMBERS
//   // ==============================================
// const totalPages = (doc.internal as any).pages.length - 1;
//   for (let i = 1; i <= totalPages; i++) {
//     if (i === 1) continue; // ✅ Skip cover page
//     doc.setPage(i);
//     doc.setFontSize(9); doc.setFont("times", "normal"); doc.setTextColor(120, 120, 120);
//     doc.text(`Page ${i} of ${totalPages}`, PW / 2, PH - 8, { align: "center" });
//   }

//   // ==============================================
//   //  SAVE
//   // ==============================================
//   const fileName  = `WaterAvailabilityReport_${startYear}-${endYearFinal}_${new Date().toISOString().split("T")[0]}.pdf`;
//   doc.save(fileName);
//   console.log(`OK PDF saved: ${fileName}`);
// }



















// WaterAnalysisPDF.ts
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface RasterData {
  layer_name: string;
  volume_MLD?: number;
  year?: number;
  [key: string]: any;
}

interface WaterAnalysisPDFOptions {
  exportData: {
    year: number;
    endYear?: number;
    season: string;
    productType: string;
    timeScale: string;
  };
  rasterResponse: {
    clipped_rasters: RasterData[];
  };
  subdistrictCodes?: number[];
  mapImageUrls?:    { url: string; year: number }[];
  legendImageUrls?: { url: string; year: number }[];
  chartImageUrls?:  { url: string; year: number }[];
  chartImageUrl?: string;
}

export async function generateWaterAnalysisPDF(
  options: WaterAnalysisPDFOptions
): Promise<void> {
  const {
    exportData,
    rasterResponse,
    mapImageUrls,
    legendImageUrls,
    chartImageUrls,
    chartImageUrl,
  } = options;

  const { season, productType, timeScale } = exportData;
  const clippedRasters   = rasterResponse?.clipped_rasters ?? [];
  const totalWaterBudget = clippedRasters[0]?.volume_MLD ?? 0;
  const isIndexProduct   = String(productType ?? "").toLowerCase() === "index";

  const rasterYears  = clippedRasters.map((r: RasterData) => r.year).filter(Boolean) as number[];
  const startYear    = rasterYears.length > 0 ? Math.min(...rasterYears) : exportData.year;
  const endYearFinal = rasterYears.length > 0 ? Math.max(...rasterYears) : (exportData.endYear ?? new Date().getFullYear());
  const year         = startYear;

  const doc = new jsPDF({ orientation: "p", unit: "mm", format: "a4", compress: true });
  const PW  = doc.internal.pageSize.getWidth();
  const PH  = doc.internal.pageSize.getHeight();
  const M   = 20;
  const CW  = PW - 2 * M;

  const LEFT_LOGO   = "/Images/export/logo_iitbhu.png";
  const RIGHT_LOGO  = "/Images/export/right1_slcr.png";
  const LOGO_H      = 20;
  const LOGO_TOP    = 8;
  const CONTENT_TOP = LOGO_TOP + LOGO_H + 6;

  const addLogos = () => {
    try { doc.addImage(LEFT_LOGO,  "PNG", M,           LOGO_TOP, 20, LOGO_H); } catch (_) {}
    try { doc.addImage(RIGHT_LOGO, "PNG", PW - M - 25, LOGO_TOP, 25, LOGO_H); } catch (_) {}
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.line(M, LOGO_TOP + LOGO_H + 3, PW - M, LOGO_TOP + LOGO_H + 3);
  };

  let y = 0;

  const newPage = () => {
    doc.addPage();
    addLogos();
    y = CONTENT_TOP;
  };

  const ensureSpace = (needed: number) => {
    if (y + needed > PH - M) newPage();
  };

  const addText = (
    text: string,
    opts: {
      fontSize?: number;
      bold?: boolean;
      italic?: boolean;
      align?: "left" | "center";
      color?: [number, number, number];
      marginBottom?: number;
    } = {}
  ) => {
    const {
      fontSize     = 11,
      bold         = false,
      italic       = false,
      align        = "left",
      color        = [0, 0, 0],
      marginBottom = 5,
    } = opts;

    doc.setFontSize(fontSize);
    doc.setTextColor(...color);
    const style = bold ? "bold" : italic ? "italic" : "normal";
    doc.setFont("times", style);

    const lines: string[] = doc.splitTextToSize(text, CW);
    const lineH = fontSize * 0.53;

    ensureSpace(lines.length * lineH + marginBottom);
    doc.setFontSize(fontSize);
    doc.setTextColor(...color);
    doc.setFont("times", style);

    lines.forEach((line) => {
      if (y + lineH > PH - M) {
        doc.addPage();
        addLogos();
        y = CONTENT_TOP;
        doc.setFontSize(fontSize);
        doc.setTextColor(...color);
        doc.setFont("times", style);
      }
      if (align === "center") doc.text(line, PW / 2, y, { align: "center" });
      else doc.text(line, M, y);
      y += lineH;
    });
    y += marginBottom;
  };

  const sectionHeading = (text: string, level: 1 | 2 = 1) => {
    ensureSpace(14);
    y += level === 1 ? 4 : 2;
    addText(text, { fontSize: level === 1 ? 13 : 12, bold: true, marginBottom: 6 });
  };

  const hRule = () => {
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.4);
    doc.line(M, y, PW - M, y);
    y += 4;
  };

  const addEquation = (eq: string, opts: { highlight?: boolean } = {}) => {
    const accent = opts.highlight ?? false;
    const fs = 10, padH = 6, padV = 5, lineH = fs * 0.55;
    doc.setFontSize(fs);
    doc.setFont("times", "italic");
    const eqLines: string[] = doc.splitTextToSize(eq, CW - padH * 2);
    const boxH = padV * 2 + eqLines.length * lineH + 2;
    ensureSpace(boxH + 4);
    if (accent) { doc.setFillColor(230, 244, 255); doc.setDrawColor(22, 78, 99); doc.setLineWidth(0.5); }
    else        { doc.setFillColor(248, 249, 250); doc.setDrawColor(180, 180, 180); doc.setLineWidth(0.3); }
    doc.roundedRect(M, y, CW, boxH, 2, 2, "FD");
    doc.setFontSize(fs); doc.setFont("times", "italic"); doc.setTextColor(0, 0, 0);
    eqLines.forEach((line, i) => {
      doc.text(line, PW / 2, y + padV + (i + 0.75) * lineH, { align: "center" });
    });
    y += boxH + 5;
  };

  // ================================================================
  //  SINGLE COMBINED MULTI-COLOR HISTOGRAM
  //  All layers in one chart — each bar a distinct attractive color
  // ================================================================
  const drawCombinedHistogram = (
    rasters: RasterData[],
    chartX: number,
    chartY: number,
    chartW: number,
    chartH: number
  ) => {
    // 10-color attractive palette
    const BAR_COLORS: [number, number, number][] = [
      [37,  99,  235],  // blue
      [16,  185, 129],  // emerald
      [245, 158,  11],  // amber
      [239,  68,  68],  // red
      [139,  92, 246],  // violet
      [20,  184, 166],  // teal
      [249, 115,  22],  // orange
      [236,  72, 153],  // pink
      [34,  197,  94],  // green
      [99,  102, 241],  // indigo
    ];
    const BAR_HIGHLIGHTS: [number, number, number][] = [
      [147, 197, 253],
      [110, 231, 183],
      [253, 211, 106],
      [252, 165, 165],
      [196, 181, 253],
      [94,  234, 212],
      [253, 186, 116],
      [249, 168, 212],
      [134, 239, 172],
      [165, 180, 252],
    ];

    const volumes = rasters.map(r => r.volume_MLD ?? 0);
    // No headroom needed — value labels are inside bars now
    const maxVol  = Math.max(...volumes, 1);
    const avgVol  = volumes.reduce((a, b) => a + b, 0) / (volumes.length || 1);

    const padTop    = 18;  // enough room for value labels inside plot border
    const padBottom = 28;
    const padLeft   = 30;  // space for rotated "Volume (MLD)" + Y-axis tick labels
    const padRight  = 32; // space for avg label on right

    const plotX = chartX + padLeft;
    const plotY = chartY + padTop;
    const plotW = chartW - padLeft - padRight;
    const plotH = chartH - padTop - padBottom;

    // ── Plot background ───────────────────────────────────────────
    doc.setFillColor(248, 250, 255);
    doc.setDrawColor(200, 215, 235);
    doc.setLineWidth(0.3);
    doc.rect(plotX, plotY, plotW, plotH, "FD");

    // ── Grid lines + Y-axis labels ────────────────────────────────
    const gridCount = 5;
    for (let g = 1; g <= gridCount; g++) {
      const gy   = plotY + plotH - (g / gridCount) * plotH;
      const gVal = (maxVol * g) / gridCount;
      const lbl  = gVal >= 1000 ? (gVal / 1000).toFixed(1) + "k" : gVal.toFixed(0);
      doc.setDrawColor(215, 228, 248);
      doc.setLineWidth(0.2);
      doc.line(plotX, gy, plotX + plotW, gy);
      doc.setFontSize(5.8);
      doc.setFont("times", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text(lbl, plotX - 1.5, gy + 1.5, { align: "right" });
    }

    // ── Average dashed line ───────────────────────────────────────
    const avgY      = plotY + plotH - (avgVol / maxVol) * plotH;
    const dashLen   = 3, gapLen = 2;
    doc.setDrawColor(200, 40, 40);
    doc.setLineWidth(0.4);
    let dx = plotX;
    while (dx < plotX + plotW) {
      doc.line(dx, avgY, Math.min(dx + dashLen, plotX + plotW), avgY);
      dx += dashLen + gapLen;
    }
    const avgLbl = avgVol >= 1000 ? (avgVol / 1000).toFixed(2) + "k" : avgVol.toFixed(1);
    doc.setFontSize(6);
    doc.setFont("times", "italic");
    doc.setTextColor(200, 40, 40);
    doc.text(`Avg: ${avgLbl}`, plotX + plotW + 2, avgY + 1.8);

    // ── Bars ──────────────────────────────────────────────────────
    const count    = rasters.length;
    const gapRatio = 0.28;
    const slotW    = plotW / count;
    const barW     = slotW * (1 - gapRatio);
    const barOff   = (slotW - barW) / 2;

    rasters.forEach((raster, i) => {
      const vol    = raster.volume_MLD ?? 0;
      const barH   = (vol / maxVol) * plotH;
      const bx     = plotX + i * slotW + barOff;
      const by     = plotY + plotH - barH;
      const color  = BAR_COLORS[i % BAR_COLORS.length];
      const hiCol  = BAR_HIGHLIGHTS[i % BAR_HIGHLIGHTS.length];

      // Main bar fill
      doc.setFillColor(...color);
      doc.setDrawColor(Math.max(0, color[0] - 25), Math.max(0, color[1] - 25), Math.max(0, color[2] - 25));
      doc.setLineWidth(0.2);
      doc.rect(bx, by, barW, barH, "FD");

      // Highlight strip on top
      if (barH > 3) {
        doc.setFillColor(...hiCol);
        doc.rect(bx, by, barW, 3, "F");
      }

      // Value label — inside bar at top, white text for contrast
      const valLbl = vol >= 1000 ? (vol / 1000).toFixed(2) + "k" : vol.toFixed(1);
      doc.setFontSize(6.2);
      doc.setFont("times", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text(valLbl, bx + barW / 2, by + 5.5, { align: "center" });

      // Year label below X-axis
      doc.setFontSize(7);
      doc.setFont("times", "bold");
      doc.setTextColor(40, 40, 40);
      doc.text(String(raster.year ?? ""), bx + barW / 2, plotY + plotH + 9, { align: "center" });
    });

    // ── Axes ──────────────────────────────────────────────────────
    doc.setDrawColor(60, 60, 60);
    doc.setLineWidth(0.55);
    doc.line(plotX, plotY + plotH, plotX + plotW, plotY + plotH); // X-axis
    doc.line(plotX, plotY,        plotX,          plotY + plotH); // Y-axis

    // ── Axis titles ───────────────────────────────────────────────
    doc.setFontSize(7);
    doc.setFont("times", "italic");
    doc.setTextColor(60, 60, 60);
    doc.text("Volume (MLD)", plotX - 8, plotY + plotH / 2, { align: "center", angle: 90 });
    doc.text("Year",         plotX + plotW / 2, chartY + chartH - 1, { align: "center" });

    // ── Outer chart border ────────────────────────────────────────
    doc.setDrawColor(110, 130, 170);
    doc.setLineWidth(0.45);
    doc.rect(chartX, chartY, chartW, chartH);
  };

  // ==============================================
  //  PAGE 1 - COVER
  // ==============================================
  addLogos();

  const lineY = LOGO_TOP + LOGO_H + 3;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.line(M, lineY, PW - M, lineY);

  const TITLE_FONT = 16, SUBTITLE_FONT = 11, BOX_PAD = 8;
  const titleText    = "Comprehensive Report on Water Availability (Admin Mode)";
  const subtitleText = "A Geospatial and Hydrological Analysis for Water Resource Assessment";

  doc.setFontSize(TITLE_FONT);    doc.setFont("times", "bold");
  const titleLines: string[]    = doc.splitTextToSize(titleText,    CW - BOX_PAD * 2);
  doc.setFontSize(SUBTITLE_FONT); doc.setFont("times", "normal");
  const subtitleLines: string[] = doc.splitTextToSize(subtitleText, CW - BOX_PAD * 2);

  const titleBlockH =
    BOX_PAD + titleLines.length * (TITLE_FONT * 0.45) + 4 +
    subtitleLines.length * (SUBTITLE_FONT * 0.45) + BOX_PAD;

  const BOX_TOP = 95;
  doc.setFillColor(240, 249, 255); doc.setDrawColor(22, 78, 99); doc.setLineWidth(0.6);
  doc.roundedRect(M, BOX_TOP, CW, titleBlockH, 3, 3, "FD");

  y = BOX_TOP + BOX_PAD + TITLE_FONT * 0.45;
  doc.setFontSize(TITLE_FONT); doc.setFont("times", "bold"); doc.setTextColor(22, 78, 99);
  titleLines.forEach((line) => { doc.text(line, PW / 2, y, { align: "center" }); y += TITLE_FONT * 0.45; });

  y += 4;
  doc.setFontSize(SUBTITLE_FONT); doc.setFont("times", "normal"); doc.setTextColor(55, 65, 81);
  subtitleLines.forEach((line) => { doc.text(line, PW / 2, y, { align: "center" }); y += SUBTITLE_FONT * 0.45; });

  y = BOX_TOP + titleBlockH + 12;

  const reportDate = new Date().toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" });
  const labelW = 38, valueMaxW = CW - 38, LINE_H = 6.5;

  const metaLines: [string, string][] = [
    ["Year / Season", `${startYear}-${endYearFinal} / ${season.charAt(0).toUpperCase() + season.slice(1)}`],
    ["Product Type",  productType || "Water Budget"],
    ["Time Scale",    timeScale   || "Annual"],
  ];

  metaLines.forEach(([label, value]) => {
    doc.setFontSize(11); doc.setFont("times", "normal");
    const vLines: string[] = doc.splitTextToSize(value, valueMaxW);
    doc.setFont("times", "bold"); doc.setTextColor(0, 0, 0);
    doc.text(`${label}:`, M, y);
    doc.setFont("times", "normal");
    vLines.forEach((vl, vi) => doc.text(vl, M + labelW, y + vi * LINE_H));
    y += vLines.length * LINE_H + 2;
  });

  const footerMetaY = PH - 22 - 22;
  const footerMeta: [string, string][] = [
    ["Prepared by", "IIT (BHU), Varanasi"],
    ["Date",        reportDate],
  ];
  footerMeta.forEach(([label, value], i) => {
    const fy = footerMetaY + i * 8;
    doc.setFontSize(11); doc.setFont("times", "bold"); doc.setTextColor(0, 0, 0);
    doc.text(`${label}:`, M, fy);
    doc.setFont("times", "normal");
    doc.text(value, M + labelW, fy);
  });

  doc.setFillColor(22, 78, 99); doc.rect(0, PH - 22, PW, 22, "F");
  doc.setFontSize(10); doc.setFont("times", "normal"); doc.setTextColor(255, 255, 255);
  doc.text("Smart Laboratory on Clean Rivers (Dept. of Civil Engineering)", PW / 2, PH - 13, { align: "center" });
  doc.text("Indian Institute of Technology (BHU), Varanasi",                PW / 2, PH - 6,  { align: "center" });

  // ==============================================
  //  PAGE 2 - EXECUTIVE SUMMARY
  // ==============================================
  newPage(); sectionHeading("1. Executive Summary");
  addText(
    "The Water Availability sub-module estimates surface water quantity generated and sustained within the Varuna Basin " +
    "through basin-scale rainfall-runoff modeling embedded in decision support system. This framework translates climatic " +
    "inputs and land-surface interactions into spatially explicit measures of runoff, infiltration, and discharge at 500 m " +
    "resolution, providing quantitative foundations for water resource planning within the decision making. Water availability " +
    "represents a central concern in the Varuna Basin, where rainfall variability, land use change, and population growth " +
    "increasingly pressure local water resources. The operational monitoring framework captures these dynamics through " +
    "integration of multiple Earth observation datasets viz., TerraClimate (precipitation & runoff) and MODIS " +
    "evapotranspiration, to generate comprehensive water budget assessments incorporating bias-corrected precipitation " +
    "against Indian Meteorological Department (IMD) observations and accounting for physical losses through seepage. Key " +
    "outcomes include basin-wide quantification of surface water availability, computed through water balance equation. " +
    "Outputs are resolved spatially at 500 m through pixel-level mapping and temporally at seasonal and annual scales. " +
    "This resolution enables identification of water-deficit hotspots and prioritization of interventions for agricultural, " +
    "urban, and ecosystem needs, moving beyond isolated measurements toward dynamic basin-scale assessments that support " +
    "data-driven water governance."
  );

  ensureSpace(30); hRule(); sectionHeading("2. Basin and Water Availability Challenges");
  addText(
    "Water availability in the Varuna Basin is governed by intertwined climatic, geomorphic, and anthropogenic factors " +
    "that complicate reliable assessment and management of surface water resources. As a rain-fed tributary of the Ganga, " +
    "the basin depends heavily on monsoonal precipitation, which supplies most of the annual inflow and creates pronounced " +
    "contrasts between surplus conditions during the monsoon and acute shortages in the pre-monsoon months. These dynamics " +
    "highlight the need for basin-scale monitoring and forecasting frameworks that can track both seasonal variability and " +
    "long-term trends. Natural controls play a central role in shaping hydrological responses. The basin's alluvial geology " +
    "exhibits spatially variable infiltration potential, influencing how rainfall is partitioned among surface runoff, " +
    "groundwater recharge, and soil moisture storage. Steeper upper reaches promote rapid runoff and limited retention, " +
    "while gentler downstream areas favor stagnation and sediment deposition; clay-rich soils restrict infiltration and " +
    "enhance overland flow, whereas sandy and mixed textures support recharge but can deplete quickly. Human pressures " +
    "compound these vulnerabilities. Expansion of irrigated agriculture, especially rice-wheat systems, has raised water " +
    "demand and altered infiltration and runoff pathways, and urbanization around Varanasi has replaced permeable surfaces " +
    "with built-up areas, increasing runoff and reducing recharge. Inadequate drainage and industrial effluents further " +
    "degrade water quality, so scarcity increasingly reflects misaligned demand and pollution as much as limited natural " +
    "supply, making robust, integrated water availability frameworks indispensable."
  );

  ensureSpace(20); sectionHeading("2.2 Rainfall-Runoff Modeling Framework", 2);
  addText(
    "Rainfall-runoff modeling provides a structured means to quantify how precipitation is partitioned into " +
    "evapotranspiration, infiltration, soil water storage, and surface runoff, supporting consistent water balance " +
    "estimation across heterogeneous terrain and land uses, even where direct flow records are sparse [5]. By integrating " +
    "spatial inputs such as land use/land cover, soil texture, and topography, these models capture variability in " +
    "hydrological responses and enable comparison between sub-basins or management units [6]. In the Varuna Basin, where " +
    "pronounced seasonal variability and human pressures drive sharp contrasts in water supply, this framework is essential " +
    "for diagnosing when and where water deficits are most likely to occur, and can be extended over multiple years or " +
    "coupled with climate projections to explore future water availability scenarios. Embedding model outputs within the " +
    "Decision Support System transforms gridded results into interactive maps and indicators, helping decision-makers " +
    "prioritize rainwater harvesting, managed recharge, and irrigation scheduling based on seasonal runoff potential."
  );

  // ==============================================
  //  SECTION 3 - METHODOLOGY
  // ==============================================
  ensureSpace(30); hRule(); sectionHeading("3. Methodology");
  sectionHeading("3.1 Theoretical Foundation: Water Balance Equation", 2);
  addText("The fundamental water balance equation represents conservation of mass for the hydrological cycle over a defined spatial domain and time period:");
  addEquation("Delta_S = P - ET - Q - I");
  addText("where Delta_S represents change in storage (soil water, groundwater), P is precipitation, ET is evapotranspiration, Q is surface and subsurface runoff, and I is infiltration [5].");
  addText("The implemented water balance in Google Earth Engine adapts this framework to basin-scale satellite-based analysis at pixel level, as shown in Table 1.");

  ensureSpace(12);
  doc.setFontSize(10); doc.setFont("times", "normal"); doc.setTextColor(0, 0, 0);
  doc.text("Table 1: Correspondence between theoretical components and operational implementation", PW / 2, y, { align: "center" });
  y += 6;
  autoTable(doc, {
    startY: y,
    head: [["Theoretical Variable", "Implementation", "Source Dataset"]],
    body: [
      ["P_day (Precipitation)",       "P_corrected",         "TerraCLIMATE + IMD correction"],
      ["E_a (Evapotranspiration)",     "ET_normalized",       "MODIS MOD16A2GF"],
      ["Q_surf + Q_gw (Total runoff)", "Q",                   "TerraCLIMATE runoff"],
      ["w_seep (Seepage)",             "0.12 * water budget", "Empirical (12% loss)"],
    ],
    styles:       { font: "times", fontSize: 10, cellPadding: 4, halign: "left", valign: "middle" },
    headStyles:   { fillColor: [211, 211, 211], textColor: [0, 0, 0], fontStyle: "bold", halign: "center" },
    columnStyles: { 0: { cellWidth: 55 }, 1: { cellWidth: 40 }, 2: { cellWidth: 75 } },
    margin:       { left: M, right: M, top: CONTENT_TOP },
    didDrawPage:  () => addLogos(),
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  ensureSpace(20); sectionHeading("3.3 Primary Datasets", 2);
  addText(
    "This sub-module relies on three complementary datasets that together enable a robust, satellite-driven " +
    "characterization of water balance in the Varuna Basin. TerraCLIMATE provides global high-resolution (approximately " +
    "4 km) monthly climate and climatic water balance data from 1958 onwards, combining WorldClim climatological normals " +
    "with CRU TS 4.0 and JRA55 reanalysis within a modified Thornthwaite-Mather model, and supplies precipitation (p_r), " +
    "actual evapotranspiration (a_et), and runoff (r_no) as millimeter-depth inputs for basin-scale assessments in " +
    "data-scarce settings. The MODIS Terra Net Evapotranspiration product (MOD16A2GF Version 6.1) contributes gap-filled " +
    "8-day evapotranspiration at 500 m resolution, computed using the Penman-Monteith formulation:"
  );
  addEquation("ET = (Delta*(Rn-G) + rho_a*cp*(es-ea)/ra) / (Delta + gamma*(1 + rs/ra))");
  addText("where Rn is net radiation, G is soil heat flux, es-ea is vapor pressure deficit, rs is surface resistance, ra is aerodynamic resistance, Delta is the slope of the saturation vapor pressure curve, and gamma is the psychrometric constant. To reduce systematic bias in satellite-derived precipitation, TerraCLIMATE rainfall is further adjusted using Indian Meteorological Department gauge data through a linear bias-correction:");
  addEquation("P_corrected = a * P_TC + b");
  addText("with slope a = 1.01 and intercept b = 10.12, thereby improving representation of intense, convective monsoon rainfall typical of the Indo-Gangetic plains.");

  ensureSpace(20); sectionHeading("3.4 Data Processing and Integration Procedures", 2);
  addText("This sub-module applies a five-step Google Earth Engine workflow to derive pixel-wise water balance in the Varuna Basin. First, monthly TerraCLIMATE and MODIS products are aggregated to seasonal or annual periods, and TerraCLIMATE precipitation is bias-corrected using IMD coefficients so that P_corrected = a * P_TC + b. MODIS evapotranspiration is then normalized to the TerraCLIMATE AET range by computing:");
  addEquation("MODIS_norm = (MODIS - MODIS_min) / (MODIS_max - MODIS_min)");
  addEquation("ET_normalized = MODIS_norm * (TC_max - TC_min) + TC_min");
  addEquation("WB = (P_corrected - ET_normalized - Q) * 0.25 * 0.88");
  addText("where 0.25 converts millimeter depth to volume at 500 m resolution (0.25 km2 per pixel) and 0.88 allocates 88% of the budget to soil water in the root zone and 12% to seepage losses.");

  ensureSpace(20); sectionHeading("3.5 Combined Operational Water Balance Equations", 2);
  addText("The final operational formula integrates all corrections and adjustments:");
  addEquation("WB = (P_corrected - ET_normalized - Q) * 0.25 * 0.88", { highlight: true });
  addText("where P_corrected is IMD-corrected precipitation (mm), ET_normalized is MODIS ET rescaled to TerraCLIMATE range (mm), Q is TerraCLIMATE runoff (mm), 0.25 is the pixel area conversion factor (to km2), and 0.88 is the seepage loss compensation factor. Daily water balance is derived through temporal disaggregation:");
  addEquation("W_daily = W_b / n_days");
  addText("where n_days is the number of days in the analysis period.");

  ensureSpace(20); sectionHeading("3.6 Soil Water Content Index (SWCI)", 2);
  addText("The Soil Water Content Index (SWCI) is a standardized anomaly (z-score) of daily water balance, enabling classification of water availability conditions relative to long-term climatology:");
  addEquation("SWCI = (WB_daily - mean_WB) / std_WB");
  addText("where WB_daily is the daily-mean water balance for a given year or period, mean_WB is the long-term mean daily water balance, and std_WB is its standard deviation [12]. SWCI values are classified into ten categories as detailed in Table 2.");

  ensureSpace(12);
  doc.setFontSize(10); doc.setFont("times", "normal"); doc.setTextColor(0, 0, 0);
  doc.text("Table 2: SWCI classification scheme for water availability assessment", PW / 2, y, { align: "center" });
  y += 6;
  autoTable(doc, {
    startY: y,
    head: [["Class Code", "SWCI Range", "Class Name"]],
    body: [
      ["1","Z < -2.0","Extremely Dry"],["2","-2.0 <= Z < -1.5","Severely Dry"],
      ["3","-1.5 <= Z < -1.0","Highly Dry"],["4","-1.0 <= Z < -0.5","Moderately Dry"],
      ["5","-0.5 <= Z < 0","Mild Dry"],["6","0 <= Z < 0.5","Mild Surplus"],
      ["7","0.5 <= Z < 1.0","Moderate Surplus"],["8","1.0 <= Z < 1.5","High Surplus"],
      ["9","1.5 <= Z < 2.0","Abundant"],["10","Z >= 2.0","Extreme Surplus"],
    ],
    styles:       { font: "times", fontSize: 10, cellPadding: 3, halign: "center", valign: "middle" },
    headStyles:   { fillColor: [211, 211, 211], textColor: [0, 0, 0], fontStyle: "bold", halign: "center" },
    columnStyles: { 0: { cellWidth: 30 }, 1: { cellWidth: 65 }, 2: { cellWidth: 75 } },
    margin:       { left: M, right: M, top: CONTENT_TOP },
    didDrawPage:  () => addLogos(),
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  ensureSpace(20); sectionHeading("3.7 Temporal Analysis Framework", 2);
  addText("This module summarizes water balance at multiple time scales consistent with the monsoon-dominated hydrology of the Varuna Basin, including seasonal windows (winter, pre-monsoon, summer-monsoon, post-monsoon) and full annual totals. Long-term behavior is evaluated over study area and time during the last ten year period, enabling assessment of variability and trends in water availability under changing climate and land use. For each selected period, the GEE application provides four standardized outputs: a daily water budget (MLD), surplus and deficit masks indicating areas of positive or negative water balance, and a 1-10 SWCI-based index class that groups conditions from dry to surplus for management use.");

  ensureSpace(12);
  doc.setFontSize(10); doc.setFont("times", "normal"); doc.setTextColor(0, 0, 0);
  doc.text("Table 3: Primary output products from water availability assessment", PW / 2, y, { align: "center" });
  y += 6;
  autoTable(doc, {
    startY: y,
    head: [["Product", "Definition", "Units"]],
    body: [
      ["Water Budget","Daily water balance (P - ET - Q)","MLD"],
      ["Surplus","Positive water balance (water availability)","Binary mask"],
      ["Deficit","Negative water balance (water stress)","Binary mask"],
      ["Index Class","Classified water availability category","Ordinal (1-10)"],
    ],
    styles:       { font: "times", fontSize: 10, cellPadding: 4, halign: "left", valign: "middle" },
    headStyles:   { fillColor: [211, 211, 211], textColor: [0, 0, 0], fontStyle: "bold", halign: "center" },
    columnStyles: { 0: { cellWidth: 40 }, 1: { cellWidth: 90 }, 2: { cellWidth: 40 } },
    margin:       { left: M, right: M, top: CONTENT_TOP },
    didDrawPage:  () => addLogos(),
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  // ==============================================
  //  SECTION 4 - RESULTS
  // ==============================================
  ensureSpace(30); hRule(); sectionHeading("4. Results");
  addText("Pixel-level water balance components are first computed as depth (mm) and then converted to volume (million liters) using the 0.25 km2 pixel area, allowing aggregation from local to basin scale. For the analysis period, annual totals of precipitation, evapotranspiration, runoff, and net water balance are derived, with indicative averages of about 930 mm of precipitation and 400 mm of evapotranspiration, yielding an ET/P ratio near 0.43 that is consistent with an agriculture-dominated Indo-Gangetic alluvial basin where the remaining water is distributed between runoff, infiltration, and changes in storage.");

  if (!isIndexProduct) {
    // Water Budget Summary card
    ensureSpace(45);
    doc.setFillColor(240, 249, 255); doc.setDrawColor(22, 78, 99); doc.setLineWidth(0.6);
    doc.roundedRect(M, y, CW, 38, 4, 4, "FD");
    doc.setFontSize(12); doc.setFont("times", "bold"); doc.setTextColor(22, 78, 99);
    doc.text("Water Budget Summary", M + 6, y + 10);
    doc.setFontSize(22); doc.setFont("times", "bold"); doc.setTextColor(0, 0, 0);
    const budgetStr = totalWaterBudget.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    doc.text(`${budgetStr} MLD`, PW / 2, y + 24, { align: "center" });
    doc.setFontSize(10); doc.setFont("times", "normal"); doc.setTextColor(100, 100, 100);
    doc.text("Million Liters per Day (MLD)", PW / 2, y + 32, { align: "center" });
    y += 44;
  }

  ensureSpace(20);
  doc.setFontSize(10); doc.setFont("times", "normal"); doc.setTextColor(0, 0, 0);
  doc.text(
    [`Year: ${year}`, `Season: ${season.charAt(0).toUpperCase() + season.slice(1)}`, `Product: ${productType}`, `Scale: ${timeScale}`].join("     |     "),
    PW / 2, y, { align: "center" }
  );
  y += 10;

  // ==============================================
  //  MAPS
  // ==============================================
  if (mapImageUrls && mapImageUrls.length > 0) {
    ensureSpace(20);
    hRule();
    sectionHeading("Spatial Distribution Maps", 2);

    const BBOX_PDF = { minLon: 81.76, maxLon: 83.06, minLat: 25.25, maxLat: 25.79 };
    const axL = 12, axB = 14, axT = 10, legW = 45, legGap = 5;
    const imgW = CW - axL - legW - legGap;
    const imgH = imgW * 0.68;
    const productLabel = productType.replace(/\s*(entire[-\s]?year|annual|seasonal)/gi, "").trim();

    for (let i = 0; i < mapImageUrls.length; i++) {
      const mapItem    = mapImageUrls[i];
      const thisLegend =
        legendImageUrls?.find(l => l.year === mapItem.year)?.url ??
        legendImageUrls?.[0]?.url ?? null;

      ensureSpace(axT + imgH + axB + 14);
      const imgX = M + axL;
      const imgY = y + axT;

      doc.setFontSize(10); doc.setFont("times", "bold"); doc.setTextColor(22, 78, 99);
      doc.text(`${productLabel} — ${mapItem.year}`, imgX + imgW / 2, y + axT - 3, { align: "center" });
      doc.setFillColor(255, 255, 255);
      doc.rect(imgX, imgY, imgW, imgH, "F");
      try { doc.addImage(mapItem.url, "PNG", imgX + 0.3, imgY + 0.3, imgW - 0.6, imgH - 0.6); } catch (_) {}
      doc.setDrawColor(80, 80, 80); doc.setLineWidth(0.5);
      doc.rect(imgX, imgY, imgW, imgH);

      doc.setFontSize(7); doc.setFont("times", "normal"); doc.setTextColor(60, 60, 60);
      for (let t = 0; t <= 4; t++) {
        const frac   = t / 4;
        const latVal = BBOX_PDF.minLat + (BBOX_PDF.maxLat - BBOX_PDF.minLat) * frac;
        const tickY  = imgY + imgH - frac * imgH;
        doc.setDrawColor(80, 80, 80); doc.setLineWidth(0.3);
        doc.line(imgX - 2, tickY, imgX, tickY);
        doc.text(latVal.toFixed(2) + "N", imgX - 3, tickY + 1.5, { align: "right" });
      }
      for (let t = 0; t <= 4; t++) {
        const frac   = t / 4;
        const lonVal = BBOX_PDF.minLon + (BBOX_PDF.maxLon - BBOX_PDF.minLon) * frac;
        const tickX  = imgX + frac * imgW;
        doc.setDrawColor(80, 80, 80); doc.setLineWidth(0.3);
        doc.line(tickX, imgY + imgH, tickX, imgY + imgH + 2);
        doc.text(lonVal.toFixed(2) + "E", tickX, imgY + imgH + axB - 1, { align: "center" });
      }
      doc.setFontSize(7); doc.setFont("times", "italic"); doc.setTextColor(40, 40, 40);
      doc.text("Latitude",  M + 3,           imgY + imgH / 2, { align: "center", angle: 90 });
      doc.text("Longitude", imgX + imgW / 2, imgY + imgH + 6, { align: "center" });

      if (thisLegend) {
        const legX = imgX + imgW + legGap, legY = imgY, legPad = 3, titleH = 8;
        doc.setFillColor(220, 220, 220);
        doc.roundedRect(legX + 1, legY + 1, legW, imgH, 2, 2, "F");
        doc.setFillColor(255, 255, 255); doc.setDrawColor(120, 120, 120); doc.setLineWidth(0.4);
        doc.roundedRect(legX, legY, legW, imgH, 2, 2, "FD");
        doc.setFontSize(8); doc.setFont("times", "bold"); doc.setTextColor(20, 20, 20);
        doc.text("Legend", legX + legW / 2, legY + legPad + 4, { align: "center" });
        doc.setDrawColor(180, 180, 180); doc.setLineWidth(0.2);
        doc.line(legX + 3, legY + titleH, legX + legW - 3, legY + titleH);
        try { doc.addImage(thisLegend, "PNG", legX + legPad, legY + titleH + legPad, legW - legPad * 2, imgH - titleH - legPad * 2); } catch (_) {}
      }

      const capY = imgY + imgH + axB + 6;
      doc.setFontSize(9); doc.setFont("times", "italic"); doc.setTextColor(80, 80, 80);
      doc.text(`Figure ${i + 1}: Spatial distribution of ${productLabel} - ${season} ${mapItem.year}`, PW / 2, capY, { align: "center" });
      y = capY + 8;
    }
  }

  // ================================================================
  //  PROCESSED RASTER LAYERS
  //  Single combined histogram — all layers, each bar distinct color
  // ================================================================
  if (!isIndexProduct && clippedRasters.length > 0) {
    ensureSpace(20);
    hRule();
    sectionHeading("Processed Raster Layers — Water Volume Histogram", 2);

    addText(
      "The histogram below presents the year-wise water budget volume (MLD) for all processed raster layers in a single " +
      "combined view. Each bar is rendered in a distinct color to aid visual differentiation across years. The dashed " +
      "red line indicates the long-term mean volume across the full analysis period."
    );

    const productLabel = productType.replace(/\s*(entire[-\s]?year|annual|seasonal)/gi, "").trim();

    // ── Dark header bar ──────────────────────────────────────────
    const headH = 9;
    ensureSpace(headH + 3);
    doc.setFillColor(22, 78, 99);
    doc.roundedRect(M, y, CW, headH, 2, 2, "F");
    doc.setFontSize(9.5);
    doc.setFont("times", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text(
      `${productLabel}  —  All Layers  (${startYear} – ${endYearFinal})  |  Season: ${season.charAt(0).toUpperCase() + season.slice(1)}`,
      M + 4, y + 6
    );
    y += headH + 4;

    // ── Histogram height — taller for more bars ───────────────────
    const HIST_H = clippedRasters.length > 7 ? 75 : 68;
    ensureSpace(HIST_H + 22);

    drawCombinedHistogram(clippedRasters, M, y, CW, HIST_H);

    // ── Figure caption ───────────────────────────────────────────
    y += HIST_H + 4;
    doc.setFontSize(8.5);
    doc.setFont("times", "italic");
    doc.setTextColor(80, 80, 80);
    doc.text(
      `Figure: Year-wise Water Budget Volume (MLD) — ${productLabel} — All Layers  |  Dashed line = Long-term average`,
      PW / 2, y, { align: "center" }
    );
    y += 7;

    // ── Summary stats table ────────────────────────────────────────
    const rastersWithVol = clippedRasters.filter((r: RasterData) => r.volume_MLD && r.year);
    if (rastersWithVol.length > 0) {
      ensureSpace(20);
      doc.setFontSize(10); doc.setFont("times", "normal"); doc.setTextColor(0, 0, 0);
      doc.text("Table: Year-wise Water Budget Volume Summary", PW / 2, y, { align: "center" });
      y += 5;

      autoTable(doc, {
        startY: y,
        head: [["Layer", "Year", "Volume (MLD)", "Relative to Mean"]],
        body: (() => {
          const vols = rastersWithVol.map((r: RasterData) => r.volume_MLD as number);
          const avg  = vols.reduce((a: number, b: number) => a + b, 0) / vols.length;
          return rastersWithVol.map((r: RasterData, idx: number) => {
            const vol   = r.volume_MLD as number;
            const diff  = vol - avg;
            const label = diff >= 0
              ? `+${diff.toFixed(1)} (Above Avg)`
              : `${diff.toFixed(1)} (Below Avg)`;
            return [`Layer ${idx + 1}`, String(r.year ?? "N/A"), vol.toLocaleString("en-IN", { maximumFractionDigits: 2 }), label];
          });
        })(),
        styles:             { font: "times", fontSize: 9.5, cellPadding: 3.5, halign: "center", valign: "middle" },
        headStyles:         { fillColor: [22, 78, 99], textColor: [255, 255, 255], fontStyle: "bold", halign: "center" },
        alternateRowStyles: { fillColor: [240, 247, 255] },
        columnStyles:       { 0: { cellWidth: 28 }, 1: { cellWidth: 24 }, 2: { cellWidth: 54 }, 3: { cellWidth: 64 } },
        margin:             { left: M, right: M, top: CONTENT_TOP },
        didDrawPage:        () => addLogos(),
      });
      y = (doc as any).lastAutoTable.finalY + 10;
    }
  }

  // ==============================================
  //  CHART
  // ==============================================
  if (isIndexProduct && chartImageUrls && chartImageUrls.length > 0) {
    newPage();
    sectionHeading("Year-wise Index Class Distribution", 2);
    addText("The following donut charts show year-wise class distribution for the selected index product. Each chart summarizes the percentage share of SWCI classes for that year.");

    const sortedChartImages = [...chartImageUrls].sort((a, b) => a.year - b.year);
    const chartsPerPage = 2;
    const cardW = CW * 0.7;
    const imageW = cardW - 14;
    const imageH = imageW * (800 / 1100);
    const cardH = imageH + 18;
    const cardX = M + (CW - cardW) / 2;

    for (let index = 0; index < sortedChartImages.length; index += 1) {
      if (index > 0 && index % chartsPerPage === 0) {
        newPage();
      }

      const rowItems = sortedChartImages.slice(index, index + 1);
      ensureSpace(cardH + 10);

      rowItems.forEach((item) => {
        const x = cardX;

        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.4);
        doc.roundedRect(x, y, cardW, cardH, 3, 3, "FD");

        try {
          doc.addImage(item.url, "PNG", x + 7, y + 6, imageW, imageH);
        } catch (_) {
          doc.setFontSize(9);
          doc.setFont("times", "italic");
          doc.setTextColor(150, 0, 0);
          doc.text("[Chart image could not be loaded]", x + cardW / 2, y + cardH / 2, {
            align: "center",
          });
        }

        doc.setFontSize(9);
        doc.setFont("times", "italic");
        doc.setTextColor(80, 80, 80);
        doc.text(`Year ${item.year}`, x + cardW / 2, y + cardH - 5, { align: "center" });
      });

      y += cardH + 10;
    }

    doc.setFontSize(9);
    doc.setFont("times", "italic");
    doc.setTextColor(80, 80, 80);
    doc.text(`Figure: Year-wise ${productType} class distribution - ${season} ${year}-${endYearFinal}`, PW / 2, y, { align: "center" });
    y += 10;
  } else if (chartImageUrl) {
    ensureSpace(100);
    sectionHeading("Year-wise Water Volume Trend", 2);
    addText("The following chart shows the year-wise variation in water volume (MLD) for the selected product and time scale. The dashed line represents the long-term average across the analysis period.");

    const chartW = CW, chartH = chartW * 0.42;
    ensureSpace(chartH + 14);
    doc.setFillColor(255, 255, 255); doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.4);
    doc.roundedRect(M, y, chartW, chartH, 3, 3, "FD");
    try { doc.addImage(chartImageUrl, "PNG", M + 1, y + 1, chartW - 2, chartH - 2); }
    catch (_) {
      doc.setFontSize(9); doc.setFont("times", "italic"); doc.setTextColor(150, 0, 0);
      doc.text("[Chart image could not be loaded]", PW / 2, y + chartH / 2, { align: "center" });
    }
    y += chartH + 4;

    doc.setFontSize(9); doc.setFont("times", "italic"); doc.setTextColor(80, 80, 80);
    doc.text(`Figure: Year-wise ${productType} volume trend (MLD) - ${season} ${year}-${endYearFinal}`, PW / 2, y, { align: "center" });
    y += 10;

    const rastersWithVol = clippedRasters.filter((r: any) => r.volume_MLD && r.year);
    if (rastersWithVol.length > 0) {
      const volumes      = rastersWithVol.map((r: any) => r.volume_MLD as number);
      const peakVal      = Math.max(...volumes);
      const lowestVal    = Math.min(...volumes);
      const avgVal       = volumes.reduce((a: number, b: number) => a + b, 0) / volumes.length;
      const peakRaster   = rastersWithVol.find((r: any) => r.volume_MLD === peakVal);
      const lowestRaster = rastersWithVol.find((r: any) => r.volume_MLD === lowestVal);

      ensureSpace(32);
      const cardW = (CW - 8) / 3, cardH = 26;
      const cards = [
        { label: "PEAK",    value: peakVal,   yr: peakRaster?.year,   bg: [219,234,254] as [number,number,number], accent: [37,99,235]  as [number,number,number] },
        { label: "LOWEST",  value: lowestVal, yr: lowestRaster?.year, bg: [254,226,226] as [number,number,number], accent: [220,38,38]  as [number,number,number] },
        { label: "AVERAGE", value: avgVal,    yr: undefined,          bg: [220,252,231] as [number,number,number], accent: [22,163,74]  as [number,number,number] },
      ];
      cards.forEach((card, i) => {
        const cx = M + i * (cardW + 4);
        doc.setFillColor(...card.bg); doc.setDrawColor(...card.accent); doc.setLineWidth(0.4);
        doc.roundedRect(cx, y, cardW, cardH, 3, 3, "FD");
        doc.setFontSize(8); doc.setFont("times", "bold"); doc.setTextColor(...card.accent);
        doc.text(card.label, cx + cardW / 2, y + 7, { align: "center" });
        doc.setFontSize(13); doc.setFont("times", "bold"); doc.setTextColor(0, 0, 0);
        doc.text(`${card.value.toFixed(1)} MLD`, cx + cardW / 2, y + 17, { align: "center" });
        if (card.yr) {
          doc.setFontSize(8); doc.setFont("times", "normal"); doc.setTextColor(100, 100, 100);
          doc.text(`(${card.yr})`, cx + cardW / 2, y + 23, { align: "center" });
        }
      });
      y += cardH + 10;
    }
  }

  // ==============================================
  //  SECTION 5 - CONCLUSIONS
  // ==============================================
  ensureSpace(30); hRule(); sectionHeading("5. Conclusions");
  addText("This module provides a basin-scale assessment of surface water availability using satellite-based precipitation, evapotranspiration, and runoff, adjusted with ground observations where available. It generates 500 m resolution water balance and Soil Water Content Index (SWCI) layers across seasons and multi-year periods, highlighting spatial and temporal patterns of surplus and deficit to support planning for irrigation, urban supply, and ecosystem needs. Results are presented as static summary products for the Varuna Basin, designed for screening, prioritization, and scenario exploration in the DSS, rather than for real-time forecasting or parcel-scale water accounting.");

  // ==============================================
  //  REFERENCES
  // ==============================================
  ensureSpace(30); sectionHeading("References");
  const references = [
    "[1] Singh, P., et al. (2015). Assessment of ground and surface water quality along the river Varuna, Varanasi, India. Environmental Monitoring and Assessment, 187(4), 170. https://doi.org/10.1007/s10661-015-4405-9",
    "[2] Raju, N. J., Ram, P., & Dey, S. (2009). Groundwater quality in the lower Varuna River basin, Varanasi district, Uttar Pradesh. Journal of the Geological Society of India, 73(2), 178-192. https://doi.org/10.17491/jgsi/2009/73/62778",
    "[3] Athavale, R. N., Murti, C. S., & Chand, R. (1992). Estimation of recharge to the phreatic aquifers of the Lower Maner Basin. Journal of Hydrology, 107(1-4), 185-202. https://doi.org/10.1016/0022-1694(89)90056-8",
    "[4] Singh, V. P., & Woolhiser, D. A. (2002). Mathematical modeling of watershed hydrology. Journal of Hydrologic Engineering, 7(4), 270-292. https://doi.org/10.1061/(ASCE)1084-0699(2002)7:4(270)",
    "[5] Mishra, S. K., & Singh, V. P. (2003). Soil Conservation Service Curve Number (SCS-CN) Methodology. Dordrecht: Kluwer Academic Publishers. https://doi.org/10.1007/978-94-017-0147-1",
    "[6] Gorelick, N., et al. (2017). Google Earth Engine: Planetary-scale geospatial analysis for everyone. Remote Sensing of Environment, 202, 18-27. https://doi.org/10.1016/j.rse.2017.06.031",
    "[7] Abatzoglou, J. T., et al. (2018). TerraClimate, a high-resolution global dataset of monthly climate and climatic water balance from 1958-2015. Scientific Data, 5, 170191. https://doi.org/10.1038/sdata.2017.191",
    "[8] Running, S., Mu, Q., & Zhao, M. (2017). MOD16A2 MODIS/Terra Net Evapotranspiration 8-Day L4 Global 500m SIN Grid V006. NASA EOSDIS Land Processes DAAC. https://doi.org/10.5067/MODIS/MOD16A2.006",
    "[9] Prakash, S., et al. (2015). From TRMM to GPM: How well can heavy rainfall be detected from space? Advances in Water Resources, 88, 1-7. https://doi.org/10.1016/j.advwatres.2015.11.008",
    "[10] Roy, D. P., et al. (2016). Examination of Sentinel-2A multi-temporal data for land cover classification. International Journal of Applied Earth Observation and Geoinformation, 81, 52-64.",
    "[11] Nistor, M. M., et al. (2020). Soil water content index: A standardized method for assessing soil moisture anomalies. Hydrological Sciences Journal, 65(5), 746-758. https://doi.org/10.1080/02626667.2019.1706718",
  ];
  references.forEach((ref) => {
    const lines = doc.splitTextToSize(ref, CW);
    ensureSpace(lines.length * 5 + 3);
    doc.setFontSize(9.5); doc.setFont("times", "normal"); doc.setTextColor(0, 0, 0);
    doc.text(lines, M, y);
    y += lines.length * 4.5 + 4;
  });

  // ==============================================
  //  PAGE NUMBERS
  // ==============================================
  const totalPages = (doc.internal as any).pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1) continue;
    doc.setPage(i);
    doc.setFontSize(9); doc.setFont("times", "normal"); doc.setTextColor(120, 120, 120);
    doc.text(`Page ${i} of ${totalPages}`, PW / 2, PH - 8, { align: "center" });
  }

  // ==============================================
  //  SAVE
  // ==============================================
  const fileName = `WaterAvailabilityReport_${startYear}-${endYearFinal}_${new Date().toISOString().split("T")[0]}.pdf`;
  doc.save(fileName);
  console.log(`OK PDF saved: ${fileName}`);
}
