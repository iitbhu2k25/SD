import React from "react";
import { View, Text } from "@react-pdf/renderer";
import { MethodologyTable1 } from "./MethodologyTable1";

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
  subsectionTitle: {
    fontSize: 12,
    fontWeight: "bold",
    fontFamily: "Times-Bold",
    color: "#000000",
    marginTop: 14,
    marginBottom: 8,
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
  equationBox: {
    backgroundColor: "#ffffff",
    padding: 12,
    marginVertical: 10,
    textAlign: "center" as const,
  },
  equation: {
    fontSize: 12,
    fontFamily: "Times-Italic",
    color: "#000000",
    lineHeight: 1.5,
  },
  tableCaption: {
    fontSize: 11,
    fontFamily: "Times-Roman",
    color: "#000000",
    marginTop: 10,
    marginBottom: 8,
    lineHeight: 1.4,
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

export const MethodologyTheory: React.FC = () => (
  <>
    <Text style={pdfStyles.sectionTitle}>3. Methodology</Text>

    <Text style={pdfStyles.subsectionTitle}>
      3.1 Theoretical Foundation: Water Balance Equation
    </Text>

    <Text style={pdfStyles.paragraph}>
      The fundamental water balance equation represents conservation of mass for the hydrological cycle over a
      defined spatial domain and time period:
    </Text>

    <View style={pdfStyles.equationBox}>
      <Text style={pdfStyles.equation}>Delta S = P - ET - Q - I</Text>
    </View>

    <Text style={pdfStyles.paragraph}>
      where Delta S represents change in storage (soil water, groundwater), P is precipitation, ET is evapotranspiration,
      Q is surface and subsurface runoff, and I is infiltration [5].
    </Text>

    <Text style={pdfStyles.paragraph}>
      The implemented water balance in Google Earth Engine adapts this framework to basin-scale satellite-based
      analysis at pixel level, as shown in Table 1.
    </Text>

    <Text style={pdfStyles.tableCaption}>
      Table 1: Correspondence between theoretical components and operational implementation
    </Text>

    <MethodologyTable1 />

    <Text style={pdfStyles.pageNumber} render={({ pageNumber }) => `${pageNumber}`} fixed />
  </>
);