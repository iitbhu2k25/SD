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
    fontFamily: "Times-Italic" as const,
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

export const PrimaryDatasets: React.FC = () => (
  <>
    <Text style={pdfStyles.subsectionTitle}>3.3 Primary Datasets</Text>

    <Text style={pdfStyles.paragraph}>
      This sub-module relies on three complementary datasets that together enable a robust, satellite-driven
      characterization of water balance in the Varuna Basin. TerraCLIMATE provides global high-resolution (approximately
      4 km) monthly climate and climatic water balance data from 1958 onwards, combining WorldClim climatological normals
      with CRU TS 4.0 and JRA55 reanalysis within a modified Thornthwaite–Mather model, and supplies precipitation (p_r),
      actual evapotranspiration (a_et), and runoff (r_no) as millimeter-depth inputs for basin-scale assessments in data-scarce
      settings. The MODIS Terra Net Evapotranspiration product (MOD16A2GF Version 6.1) contributes gap-filled 8-day
      evapotranspiration at 500 m resolution, computed using the Penman–Monteith formulation.
    </Text>

    <View style={pdfStyles.equationBox}>
      <Text style={pdfStyles.equation}>
        ET = (Delta * (R_n - G) + rho_a * c_p * (e_s - e_a) / r_a) / (Delta + gamma * (1 + r_s / r_a))
      </Text>
    </View>

    <Text style={pdfStyles.paragraph}>
      where R_n is net radiation, G is soil heat flux, e_s - e_a is vapor pressure deficit, r_s is surface resistance,
      r_a is aerodynamic resistance, Delta is the slope of the saturation vapor pressure curve, and gamma is the psychrometric
      constant, with inputs derived from MODIS vegetation indices, albedo, land cover and meteorological reanalysis
      calibrated against FLUXNET observations. To reduce systematic bias in satellite-derived precipitation, TerraCLIMATE
      rainfall is further adjusted using Indian Meteorological Department gauge data through a linear bias-correction
    </Text>

    <View style={pdfStyles.equationBox}>
      <Text style={pdfStyles.equation}>
        P_corrected = a * P_TC + b
      </Text>
    </View>

    <Text style={pdfStyles.paragraph}>
      with slope a = 1.01 and intercept b = 10.12, thereby improving representation of intense, convective monsoon
      rainfall typical of the Indo-Gangetic plains.
    </Text>

    <Text style={pdfStyles.pageNumber} render={({ pageNumber }) => `${pageNumber}`} fixed />
  </>
);