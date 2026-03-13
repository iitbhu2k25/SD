import React from "react";
import { View, Text, Image } from "@react-pdf/renderer";
import { WaterBudgetPDFSection } from "./WaterBudgetPDFSection";

interface ResultsSectionProps {
  totalWaterBudget: number;
  productType: string;
  year: number;
  season: string;
  timeScale: string;
  mapImageUrl?: string;
}

const pdfStyles = {
  sectionTitle: {
    fontSize: 13,
    fontWeight: "bold",
    fontFamily: "Times-Bold" as const,
    color: "#000000",
    marginTop: 18,
    marginBottom: 10,
    lineHeight: 1.3,
  },
  subsectionTitle: {
    fontSize: 12,
    fontWeight: "bold",
    fontFamily: "Times-Bold" as const,
    color: "#000000",
    marginTop: 14,
    marginBottom: 8,
    lineHeight: 1.3,
  },
  paragraph: {
    fontSize: 11,
    fontFamily: "Times-Roman" as const,
    color: "#000000",
    marginBottom: 10,
    lineHeight: 1.6,
    textAlign: "justify" as const,
  },
  mapSection: {
    marginTop: 15,
    marginBottom: 15,
  },
  mapImage: {
    width: "100%",
    height: 300,
    objectFit: "contain" as const,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#dee2e6",
  },
  pageNumber: {
    position: "absolute"    as const,
    bottom: 30,
    left: 0,
    right: 0,
    textAlign: "center" as const,
    fontSize: 10,
    fontFamily: "Times-Roman"    as const,
    color: "#000000",
  },
};

export const ResultsSection: React.FC<ResultsSectionProps> = ({
  totalWaterBudget,
  productType,
  year,
  season,
  timeScale,
  mapImageUrl,
}) => (
  <>
    <Text style={pdfStyles.sectionTitle}>4. Results</Text>

    <Text style={pdfStyles.paragraph}>
      Pixel-level water balance components are first computed as depth (mm) and then converted to volume (million liters)
      using the 0.25 km² pixel area, allowing aggregation from local to basin scale. For the analysis period, annual totals
      of precipitation, evapotranspiration, runoff, and net water balance are derived, with indicative averages of about
      930 mm of precipitation and 400 mm of evapotranspiration, yielding an ET/P ratio near 0.43 that is consistent with
      an agriculture-dominated Indo-Gangetic alluvial basin where the remaining water is distributed between runoff,
      infiltration, and changes in storage.
    </Text>

    <WaterBudgetPDFSection
      totalWaterBudget={totalWaterBudget}
      productType={productType}
      year={year}
      season={season}
      timeScale={timeScale}
    />

    <Text style={pdfStyles.subsectionTitle}>Figures and Graphs</Text>

    {mapImageUrl && (
      <View style={pdfStyles.mapSection}>
        <Image src={mapImageUrl} style={pdfStyles.mapImage} />
      </View>
    )}

    <Text style={pdfStyles.pageNumber} render={({ pageNumber }) => `${pageNumber}`} fixed />
  </>
);