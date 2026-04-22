import React from "react";
import { View, Text } from "@react-pdf/renderer";
import { SWCIClassificationTable } from "./SWCIClassificationTable";

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
    fontFamily: "Times-Roman" as const,
    color: "#000000",
    marginBottom: 10,
    lineHeight: 1.6,
    textAlign: "justify" as const,
  },
  equationBox: {
    backgroundColor: "#ffffff",
    padding: 12,
    marginVertical: 10,
    textAlign: "center"     as const,
  },
  equation: {
    fontSize: 12,
    fontFamily: "Times-Italic"  as const,
    color: "#000000",
    lineHeight: 1.5,
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

export const SWCISection: React.FC = () => (
  <>
    <Text style={pdfStyles.subsectionTitle}>3.6 Soil Water Content Index (SWCI)</Text>

    <Text style={pdfStyles.paragraph}>
      The Soil Water Content Index (SWCI) is a standardized anomaly (z-score) of daily water balance, enabling
      classification of water availability conditions relative to long-term climatology:
    </Text>

    <View style={pdfStyles.equationBox}>
      <Text style={pdfStyles.equation}>
        SWCI = (WB_daily - mu_WB) / sigma_WB
      </Text>
    </View>

    <Text style={pdfStyles.paragraph}>
      where WB_daily is the daily-mean water balance for a given year or period, mu_WB is the long-term mean daily water
      balance, and sigma_WB is its standard deviation [12]. SWCI values are classified into ten categories ranging from
      Extremely Dry (Z {"<"} -2.0) through Mild Dry, Mild Surplus, to Extreme Surplus (Z {"<"} 2.0), as detailed in Table 2.
    </Text>

    <Text style={pdfStyles.tableCaption}>
      Table 2: SWCI classification scheme for water availability assessment
    </Text>

    <SWCIClassificationTable />

    <Text style={pdfStyles.pageNumber} render={({ pageNumber }) => `${pageNumber}`} fixed />
  </>
);