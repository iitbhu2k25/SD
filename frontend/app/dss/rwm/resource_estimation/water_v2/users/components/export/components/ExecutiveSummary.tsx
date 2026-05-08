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
    position: "absolute" as const,
    bottom: 30,
    left: 0,
    right: 0,
    textAlign: "center" as const,
    fontSize: 10,
    fontFamily: "Times-Roman",
    color: "#000000",
  },
};

export const ExecutiveSummary: React.FC = () => (
  <>
    <Text style={pdfStyles.sectionTitle}>1. Executive Summary</Text>

    <Text style={pdfStyles.paragraph}>
      The Water Availability sub-module estimates surface water quantity generated and sustained within the
      Varuna Basin through basin-scale rainfall-runoff modeling embedded in decision support system. This framework
      translates climatic inputs and land-surface interactions into spatially explicit measures of runoff, infiltration,
      and discharge at 500 m resolution, providing quantitative foundations for water resource planning within the decision
      making. Water availability represents a central concern in the Varuna Basin, where rainfall variability, land use change,
      and population growth increasingly pressure local water resources. The operational monitoring framework captures these
      dynamics through integration of multiple Earth observation datasets viz., TerraClimate (precipitation & runoff) and
      MODIS evapotranspiration, to generate comprehensive water budget assessments incorporating bias-corrected precipitation
      against Indian Meteorological Department (IMD) observations and accounting for physical losses through seepage. Key
      outcomes include basin-wide quantification of surface water availability, computed through water balance equation.
      Outputs are resolved spatially at 500 m through pixel-level mapping and temporally at seasonal and annual scales.
      This resolution enables identification of water-deficit hotspots and prioritization of interventions for agricultural,
      urban, and ecosystem needs, moving beyond isolated measurements toward dynamic basin-scale assessments that support
      data-driven water governance.
    </Text>

    <Text style={pdfStyles.pageNumber} render={({ pageNumber }) => `${pageNumber}`} fixed />
  </>
);