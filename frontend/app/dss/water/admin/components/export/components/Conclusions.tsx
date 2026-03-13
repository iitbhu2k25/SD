import React from "react";
import { View, Text } from "@react-pdf/renderer";

const pdfStyles = {
  sectionTitle: {
    fontSize: 13,
    fontWeight: "bold",
    fontFamily: "Times-Bold",
    color: "#000000",
    marginTop: 18,
    marginBottom: 10,
    lineHeight: 1.3,
  },
  paragraph: {
    fontSize: 11,
    fontFamily: "Times-Roman",
    color: "#000000",
    marginBottom: 10,
    lineHeight: 1.6,
    textAlign: "justify" as const,
  },
  pageNumber: {
    position: "absolute"    as const,
    bottom: 30,
    left: 0,
    right: 0,
    textAlign: "center" as const,
    fontSize: 10,
    fontFamily: "Times-Roman" as const,
    color: "#000000",
  },
};

export const Conclusions: React.FC = () => (
  <>
    <Text style={pdfStyles.sectionTitle}>6. Conclusions</Text>

    <Text style={pdfStyles.paragraph}>
      This module provides a basin-scale assessment of surface water availability using satellite-based precipitation,
      evapotranspiration, and runoff, adjusted with ground observations where available. It generates 500 m resolution
      water balance and Soil Water Content Index (SWCI) layers across seasons and multi-year periods, highlighting spatial
      and temporal patterns of surplus and deficit to support planning for irrigation, urban supply, and ecosystem needs.
      Results are presented as static summary products for the Varuna Basin, designed for screening, prioritization, and
      scenario exploration in the DSS, rather than for real-time forecasting or parcel-scale water accounting.
    </Text>

    <Text style={pdfStyles.pageNumber} render={({ pageNumber }) => `${pageNumber}`} fixed />
  </>
);