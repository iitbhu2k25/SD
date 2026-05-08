import React from "react";
import { View, Text } from "@react-pdf/renderer";

const pdfStyles = {
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

export const OperationalEquations: React.FC = () => (
  <>
    <Text style={pdfStyles.subsectionTitle}>3.5 Combined Operational Water Balance Equations</Text>

    <Text style={pdfStyles.paragraph}>
      The final operational formula integrates all corrections and adjustments:
    </Text>
    <View style={pdfStyles.equationBox}>
      <Text style={pdfStyles.equation}>
        WB = (P_corrected - ET_normalized - Q) × 0.25 × 0.88
      </Text>
    </View>

    <Text style={pdfStyles.paragraph}>
      where P_corrected is IMD-corrected precipitation (mm), E_normalized is MODIS ET rescaled to TerraCLIMATE range (mm),
      Q is TerraCLIMATE runoff (mm), 0.25 is the pixel area conversion factor (to km²), and 0.88 is the seepage loss
      compensation factor.
    </Text>

    <Text style={pdfStyles.paragraph}>
      Daily water balance is derived through temporal disaggregation:
    </Text>
    <View style={pdfStyles.equationBox}>
      <Text style={pdfStyles.equation}>
        W_daily = W_b / n_days
      </Text>
    </View>

    <Text style={pdfStyles.paragraph}>
      where ndays is the number of days in the analysis period.
    </Text>

    <Text style={pdfStyles.pageNumber} render={({ pageNumber }) => `${pageNumber}`} fixed />
  </>
);