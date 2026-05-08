import React from "react";
import { View, Text } from "@react-pdf/renderer";

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

export const RainfallRunoffSection: React.FC = () => (
  <>
    <Text style={pdfStyles.subsectionTitle}>2.2. Rainfall-Runoff Modeling Framework</Text>

    <Text style={pdfStyles.paragraph}>
      Rainfall–runoff modeling provides a structured means to quantify how precipitation is partitioned into
      evapotranspiration, infiltration, soil water storage, and surface runoff, supporting consistent water balance
      estimation across heterogeneous terrain and land uses, even where direct flow records are sparse [5]. By integrating
      spatial inputs such as land use/land cover, soil texture, and topography, these models capture variability in
      hydrological responses and enable comparison between sub-basins or management units [6]. In the Varuna Basin, where
      pronounced seasonal variability and human pressures drive sharp contrasts in water supply, this framework is essential
      for diagnosing when and where water deficits are most likely to occur, and can be extended over multiple years or
      coupled with climate projections to explore future water availability scenarios. Embedding model outputs within the
      Decision Support System transforms gridded results into interactive maps and indicators, helping decision-makers
      prioritize rainwater harvesting, managed recharge, and irrigation scheduling based on seasonal runoff potential.
    </Text>

    <Text style={pdfStyles.pageNumber} render={({ pageNumber }) => `${pageNumber}`} fixed />
  </>
);