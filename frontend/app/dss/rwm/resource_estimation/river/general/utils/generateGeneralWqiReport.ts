import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface CsvUploadResult {
    datasetLabel?: string;
    sourceFileName?: string;
    totalPoints: number;
    validPoints: number;
    rejectedPoints: number;
    geojson: any;
    wqiSummary: {
        min: number;
        max: number;
        mean: number;
        countByClass: Record<string, number>;
    } | null;
}

interface GenerateGeneralWqiReportInput {
    data: CsvUploadResult;
    selectedFileLabel: string;
    analysisLayerName: string;
    mapImage?: string;
    legendImage?: string;
    chartImage?: string;
}

interface ImageOptimizeOptions {
    maxWidthPx: number;
    maxHeightPx: number;
    quality: number;
}

type JsPdfImageType = "JPEG" | "PNG";

const sanitizeForFilename = (value: string) =>
    (value || "")
        .replace(/[^a-zA-Z0-9._-]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 80) || "unknown";

const getJsPdfImageType = (imageData: string): JsPdfImageType => {
    const prefix = imageData.slice(0, 40).toLowerCase();
    if (prefix.startsWith("data:image/png")) return "PNG";
    return "JPEG";
};

const optimizeImageToJpeg = (
    source: string,
    options: ImageOptimizeOptions
): Promise<string> =>
    new Promise((resolve) => {
        try {
            const img = new Image();
            img.onload = () => {
                const widthRatio = options.maxWidthPx / img.width;
                const heightRatio = options.maxHeightPx / img.height;
                const scale = Math.min(1, widthRatio, heightRatio);

                const outputWidth = Math.max(1, Math.round(img.width * scale));
                const outputHeight = Math.max(1, Math.round(img.height * scale));

                const canvas = document.createElement("canvas");
                canvas.width = outputWidth;
                canvas.height = outputHeight;

                const ctx = canvas.getContext("2d");
                if (!ctx) {
                    resolve(source);
                    return;
                }

                // Use white background since report pages are white.
                ctx.fillStyle = "#ffffff";
                ctx.fillRect(0, 0, outputWidth, outputHeight);
                ctx.drawImage(img, 0, 0, outputWidth, outputHeight);

                resolve(canvas.toDataURL("image/jpeg", options.quality));
            };
            img.onerror = () => resolve(source);
            img.src = source.startsWith("data:image") ? source : `data:image/png;base64,${source}`;
        } catch {
            resolve(source);
        }
    });

export const generateGeneralWqiReport = async ({
    data,
    selectedFileLabel,
    analysisLayerName,
    mapImage,
    legendImage,
    chartImage,
}: GenerateGeneralWqiReportInput) => {
    const selectedFile = selectedFileLabel || data.datasetLabel || data.sourceFileName || "dataset";
    const analysisLayer = analysisLayerName || "NA";

    // ==================== CREATE PDF DOCUMENT ====================
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

    // ==================== HEADER HEIGHT FOR LOGOS ====================
    const logoHeight = 27;

    // ==================== ADD LOGOS ====================
    const leftLogo = "/Images/export/logo_iitbhu.png";
    const rightLogo = "/Images/export/right1_slcr.png";
    try {
        doc.addImage(leftLogo, "PNG", 15, 10, 20, 20);
        doc.addImage(rightLogo, "PNG", pageWidth - 40, 10, 25, 25);
    } catch (e) {
        console.warn("Logo images not found/loaded");
    }

    const contentWidth = pageWidth - 2 * margin;
    let yPosition = 125;

    // ==================== TITLE PAGE ====================
    doc.setFontSize(16);
    doc.setFont("times", "bold");
    const headingText = "Report on River Water Quality Monitoring\n(General Assessment)";
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
        { align: "center" }
    );

    yPosition += boxHeight + 20;

    // Add date info
    const reportDate = new Date().toLocaleDateString("en-IN", {
        year: "numeric",
        month: "long",
        day: "numeric",
    });

    const pageCenter = pageWidth / 2;

    doc.text(
        `Selected File: ${selectedFile}`,
        pageCenter,
        yPosition,
        { align: "center" }
    );

    doc.setFontSize(9);
    doc.setFont("times", "italic");
    yPosition += 88;
    doc.text(`Report Generated: ${reportDate}`, margin, yPosition);

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

    const addLogosToPage = () => {
        try {
            doc.addImage(leftLogo, "PNG", 15, 10, 20, 20);
            doc.addImage(rightLogo, "PNG", pageWidth - 40, 10, 25, 25);
        } catch (error) {
            console.log("Error adding logos:", error);
        }
    };

    const addText = (
        text: string,
        fontSize = 11,
        isBold = false,
        alignment: "left" | "center" | "justify" = "left"
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
            // Simple left align fallback for justify in jsPDF without plugin
            doc.text(lines, margin, yPosition);
            yPosition += textHeight;
        } else {
            doc.text(lines, margin, yPosition);
            yPosition += textHeight;
        }
        yPosition += 5;
    };

    // ==================== 1. EXECUTIVE SUMMARY ====================
    doc.addPage();
    addLogosToPage();
    yPosition = 10 + logoHeight;

    doc.setFontSize(14);
    doc.setFont("times", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("1. Executive Summary", margin, yPosition);
    yPosition += 10;

    addText(
        `This report provides an assessment of river water quality based on uploaded data. A total of ${data.validPoints} valid sampling points were analyzed from the selected dataset "${selectedFile}". The Water Quality Index (WQI) was computed using a weighted arithmetic mean method incorporating 10 physicochemical parameters. The results classify the river water quality into five categories ranging from Excellent to Unsuitable, providing actionable insights for water management.`,
        11,
        false,
        "justify"
    );

    // ==================== 2. METHODOLOGY ====================
    checkPageBreak(30);
    doc.setFontSize(14);
    doc.setFont("times", "bold");
    doc.text("2. Methodology: WQI Framework", margin, yPosition);
    yPosition += 10;

    addText(
        "The Water Quality Index (WQI) is calculated using a designated set of parameters, divided into Essential (Mandatory) and Supporting (Optional) categories. Essential parameters must be present for a valid WQI calculation, while supporting parameters are included if available.",
        11,
        false,
        "justify"
    );

    // Weighting Scheme
    checkPageBreak(30);
    doc.setFontSize(12);
    doc.setFont("times", "bold");
    doc.text("2.1. Weighting Scheme & Normalization", margin, yPosition);
    yPosition += 8;

    addText(
        "Weights are assigned to each parameter based on their significance. The final WQI is computed by normalizing the weights of the available parameters so that their sum equals 1.0. This dynamic normalization ensures that the index remains accurate even when optional parameters are missing.",
        11,
        false,
        "justify"
    );

    // Parameter Weights Table
    autoTable(doc, {
        startY: yPosition,
        head: [["Parameter", "Weight", "Type"]],
        body: [
            ["Dissolved Oxygen (DO)", "0.30", "Essential (Mandatory)"],
            ["Biochemical Oxygen Demand (BOD)", "0.20", "Essential (Mandatory)"],
            ["pH", "0.15", "Essential (Mandatory)"],
            ["Faecal Coliform (FC)", "0.10", "Essential (Mandatory)"],
            ["Turbidity", "0.040", "Supporting (Optional)"],
            ["Total Dissolved Solids (TDS)", "0.038", "Supporting (Optional)"],
            ["Temperature", "0.038", "Supporting (Optional)"],
            ["Electrical Conductivity (EC)", "0.038", "Supporting (Optional)"],
            ["Total Suspended Solids (TSS)", "0.038", "Supporting (Optional)"],
            ["Chemical Oxygen Demand (COD)", "0.029", "Supporting (Optional)"],
            ["Nitrate", "0.029", "Supporting (Optional)"],
        ],
        styles: { font: "times", fontSize: 10, cellPadding: 3, halign: "center" },
        headStyles: { fillColor: [211, 211, 211], textColor: [0, 0, 0], fontStyle: "bold" },
        columnStyles: { 0: { halign: "left" } },
        margin: { left: margin, right: margin },
    });

    yPosition = (doc as any).lastAutoTable.finalY + 10;

    // Sub-Index Calculation
    checkPageBreak(30);
    doc.setFontSize(12);
    doc.setFont("times", "bold");
    doc.text("2.2. Sub-Index Calculation", margin, yPosition);
    yPosition += 8;

    addText(
        "Sub-indices (Qi) for each parameter are calculated based on permissible standards. Values are capped between [0, 300] to prevent extreme outliers from skewing the final index. Logarithmic scaling is applied to parameters like BOD and FC to handle wide variations.",
        11,
        false,
        "justify"
    );

    // ==================== 3. RESULTS ====================
    checkPageBreak(30);
    doc.setFontSize(14);
    doc.setFont("times", "bold");
    doc.text("3. Results Analysis", margin, yPosition);
    yPosition += 10;

    // ==================== 3.1. SPATIAL DISTRIBUTION ====================
    if (mapImage) {
        checkPageBreak(180); // Need substantial space for map + legend
        doc.setFontSize(12);
        doc.setFont("times", "bold");
        doc.text("3.1. Spatial Distribution Map", margin, yPosition);
        yPosition += 10;

        try {
            const mapImgData = mapImage.startsWith("data:image")
                ? mapImage
                : `data:image/png;base64,${mapImage}`;
            const mapImgType = getJsPdfImageType(mapImgData);
            const optimizedMapImage = await optimizeImageToJpeg(mapImgData, {
                maxWidthPx: 1900,
                maxHeightPx: 1400,
                quality: 0.62,
            });
            const optimizedMapType = getJsPdfImageType(optimizedMapImage);

            const mapWidth = 165;
            const mapHeight = 118;
            const mapX = (pageWidth - mapWidth) / 2;
            const mapTopY = yPosition;
            const mapBottomY = mapTopY + mapHeight;

            // Prefer optimized map for smaller PDFs; fall back to original image if needed.
            try {
                doc.addImage(optimizedMapImage, optimizedMapType, mapX, mapTopY, mapWidth, mapHeight, undefined, "MEDIUM");
            } catch (mapEmbedErr) {
                doc.addImage(mapImgData, mapImgType, mapX, mapTopY, mapWidth, mapHeight, undefined, "MEDIUM");
            }

            // Legend Image (if available) - PLACED BELOW MAP
            if (legendImage) {
                const legendImgData = legendImage.startsWith("data:image")
                    ? legendImage
                    : `data:image/png;base64,${legendImage}`;
                const optimizedLegendImage = await optimizeImageToJpeg(legendImgData, {
                    maxWidthPx: 1300,
                    maxHeightPx: 260,
                    quality: 0.68,
                });
                const optimizedLegendImageType = getJsPdfImageType(optimizedLegendImage);

                // Backend generates a wide horizontal legend (figsize=(6, 0.8))
                // Aspect ratio is approx 7.5 : 1
                // Let's use a width of 80mm, so height should be ~10-12mm
                const legendWidth = 100;
                const legendHeight = 15;
                const legendX = (pageWidth - legendWidth) / 2; // Center legend below map
                const legendY = mapBottomY + 5;

                doc.addImage(optimizedLegendImage, optimizedLegendImageType, legendX, legendY, legendWidth, legendHeight, undefined, "MEDIUM");
                yPosition = legendY + legendHeight + 10;
            } else {
                yPosition = mapBottomY + 10;
            }

        } catch (e) {
            console.error("Error adding map image to PDF", e);
            doc.setFontSize(10);
            doc.setTextColor(255, 0, 0);
            doc.text("Error: Could not render map image.", margin, yPosition);
            doc.setTextColor(0, 0, 0);
            yPosition += 10;
        }
    }

    if (chartImage) {
        checkPageBreak(130);
        doc.setFontSize(12);
        doc.setFont("times", "bold");
        doc.text("3.2. WQI Profile Plot", margin, yPosition);
        yPosition += 8;

        try {
            const plotWidth = 170;
            const plotHeight = 92;
            const plotX = (pageWidth - plotWidth) / 2;
            const optimizedChartImage = await optimizeImageToJpeg(chartImage, {
                maxWidthPx: 2000,
                maxHeightPx: 1080,
                quality: 0.64,
            });
            const optimizedChartImageType = getJsPdfImageType(optimizedChartImage);

            doc.addImage(optimizedChartImage, optimizedChartImageType, plotX, yPosition, plotWidth, plotHeight, undefined, "MEDIUM");
            yPosition += plotHeight + 10;
        } catch (e) {
            console.error("Error adding chart image to PDF", e);
            doc.setFontSize(10);
            doc.setTextColor(255, 0, 0);
            doc.text("Error: Could not render chart image.", margin, yPosition);
            doc.setTextColor(0, 0, 0);
            yPosition += 10;
        }
    }

    const summaryHeading = chartImage ? "3.3. Water Quality Summary" : "3.2. Water Quality Summary";
    const classificationHeading = chartImage ? "3.4. WQI Classification Profile" : "3.3. WQI Classification Profile";

    if (data.wqiSummary) {
        // Summary Table
        checkPageBreak(60);
        doc.setFontSize(12);
        doc.setFont("times", "bold");
        doc.text(summaryHeading, margin, yPosition);
        yPosition += 8;

        autoTable(doc, {
            startY: yPosition,
            head: [["Metric", "Value", "Classification"]],
            body: [
                ["Minimum WQI", data.wqiSummary.min.toFixed(2), getWqiClass(data.wqiSummary.min)],
                ["Maximum WQI", data.wqiSummary.max.toFixed(2), getWqiClass(data.wqiSummary.max)],
                ["Mean WQI", data.wqiSummary.mean.toFixed(2), getWqiClass(data.wqiSummary.mean)],
                ["Total Samples", data.totalPoints.toString(), "-"],
                ["Valid Samples", data.validPoints.toString(), "-"],
            ],
            styles: { font: "times", fontSize: 10, cellPadding: 3, halign: "center" },
            headStyles: { fillColor: [211, 211, 211], textColor: [0, 0, 0], fontStyle: "bold" },
            columnStyles: { 0: { halign: "left" } },
            margin: { left: margin, right: margin },
        });

        yPosition = (doc as any).lastAutoTable.finalY + 10;

        // Classification Distribution
        checkPageBreak(60);
        doc.setFontSize(12);
        doc.setFont("times", "bold");
        doc.text(classificationHeading, margin, yPosition);
        yPosition += 8;

        const distributionBody = Object.entries(data.wqiSummary.countByClass).map(([cls, count]) => [
            cls,
            count.toString(),
            ((count / data.validPoints) * 100).toFixed(1) + "%"
        ]);

        autoTable(doc, {
            startY: yPosition,
            head: [["Classification", "Count", "Percentage"]],
            body: distributionBody,
            styles: { font: "times", fontSize: 10, cellPadding: 3, halign: "center" },
            headStyles: { fillColor: [211, 211, 211], textColor: [0, 0, 0], fontStyle: "bold" },
            columnStyles: { 0: { halign: "left" } },
            margin: { left: margin, right: margin },
        });

        yPosition = (doc as any).lastAutoTable.finalY + 10;

        // Narrative
        checkPageBreak(30);
        const meanWqi = data.wqiSummary.mean;
        const status = getWqiClass(meanWqi);
        addText(
            `The overall water quality of the analyzed samples averages at a WQI of ${meanWqi}, placing it in the "${status}" category. ${meanWqi > 100
                ? "This indicates significant pollution levels, likely requiring immediate remedial attention."
                : "This indicates generally acceptable water quality levels."
            }`,
            11,
            false,
            "justify"
        );
    } else {
        addText("No WQI summary data available.", 11, false, "left");
    }

    // Save
    const dateStamp = new Date().toISOString().split("T")[0];
    const fileToken = sanitizeForFilename(selectedFile);
    const layerToken = sanitizeForFilename(analysisLayer);
    doc.save(`WQI_Report_${fileToken}_${layerToken}_${dateStamp}.pdf`);
};

// Helper for WQI Classification
const getWqiClass = (score: number): string => {
    if (score <= 50) return "Excellent";
    if (score <= 100) return "Good";
    if (score <= 200) return "Poor";
    if (score <= 300) return "Very Poor";
    return "Unsuitable";
};
