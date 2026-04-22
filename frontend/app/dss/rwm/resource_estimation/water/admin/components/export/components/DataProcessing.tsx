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

export const DataProcessing: React.FC = () => (
  <>
    <Text style={pdfStyles.subsectionTitle}>3.4 Data Processing and Integration Procedures</Text>

    <Text style={pdfStyles.paragraph}>
      This sub-module applies a five-step Google Earth Engine workflow to derive pixel-wise water balance in the Varuna
      Basin. First, monthly TerraCLIMATE and MODIS products are aggregated to seasonal or annual periods, and TerraCLIMATE
      precipitation is bias-corrected using IMD coefficients so that
    </Text>

    <View style={pdfStyles.equationBox}>
      <Text style={pdfStyles.equation}>
        P_corrected = a * P_TC + b
      </Text>
    </View>

    <Text style={pdfStyles.paragraph}>
      where a and b are the IMD-calibrated slope and intercept. MODIS evapotranspiration is then normalized to the
      TerraCLIMATE AET range by computing a basin-wide normalized field,
    </Text>

    <View style={pdfStyles.equationBox}>
      <Text style={pdfStyles.equation}>
        MODIS_norm = (MODIS - MODIS_min) / (MODIS_max - MODIS_min)
      </Text>
    </View>

    <Text style={pdfStyles.paragraph}>
      and rescaling it as
    </Text>

    <View style={pdfStyles.equationBox}>
      <Text style={pdfStyles.equation}>
        ET_normalized = MODIS_norm × (TC_max - TC_min) + TC_min
      </Text>
    </View>

    <Text style={pdfStyles.paragraph}>
      Corrected precipitation, normalized ET, and TerraCLIMATE runoff (Q) are summed over the analysis period, and the
      operational water balance per pixel is computed as
    </Text>

    <View style={pdfStyles.equationBox}>
      <Text style={pdfStyles.equation}>
        WB = (P_corrected - ET_normalized - Q) × 0.25 × 0.88
      </Text>
    </View>

    <Text style={pdfStyles.paragraph}>
      where 0.25 converts millimeter depth to volume at 500 m resolution (0.25 km² per pixel) and 0.88 allocates 88%
      of the budget to soil water in the root zone and 12% to seepage losses.
    </Text>

    <Text style={pdfStyles.pageNumber} render={({ pageNumber }) => `${pageNumber}`} fixed />
  </>
);