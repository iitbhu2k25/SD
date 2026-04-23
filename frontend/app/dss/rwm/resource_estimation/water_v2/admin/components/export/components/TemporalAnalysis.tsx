import React from "react";
import { View, Text } from "@react-pdf/renderer";
import { OutputProductsTable } from "./OutputProductsTable";

const pdfStyles = {
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
    fontFamily: "Times-Roman"   as const,
    color: "#000000",
    marginBottom: 10,
    lineHeight: 1.6,
    textAlign: "justify" as const,
  },
  tableCaption: {
    fontSize: 11,
    fontFamily: "Times-Roman" as const,
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
    fontFamily: "Times-Roman" as const,
    color: "#000000",
  },
};

export const TemporalAnalysis: React.FC = () => (
  <>
    <Text style={pdfStyles.subsectionTitle}>3.7 Temporal Analysis Framework</Text>

    <Text style={pdfStyles.paragraph}>
      This module summarizes water balance at multiple time scales consistent with the monsoon-dominated hydrology of
      the Varuna Basin, including seasonal windows (winter, pre-monsoon, summer-monsoon, post-monsoon) and full annual
      totals. Long-term behavior is evaluated over study area and time during the last ten year period, enabling assessment
      of variability and trends in water availability under changing climate and land use. For each selected period, the
      GEE application provides four standardized outputs: a daily water budget (MLD), surplus and deficit masks indicating
      areas of positive or negative water balance, and a 1–10 SWCI-based index class that groups conditions from dry to
      surplus for management use.
    </Text>

    <Text style={pdfStyles.tableCaption}>
      Table 3: Primary output products from water availability assessment
    </Text>

    <OutputProductsTable />

    <Text style={pdfStyles.pageNumber} render={({ pageNumber }) => `${pageNumber}`} fixed />
  </>
);