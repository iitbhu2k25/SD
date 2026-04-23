import React from "react";
import { View, Text } from "@react-pdf/renderer";

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
  paragraph: {
    fontSize: 11,
    fontFamily: "Times-Roman"   as const,
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

export const BasinContext: React.FC = () => (
  <>
    <Text style={pdfStyles.sectionTitle}>2. Basin and Water Availability Challenges</Text>

    <Text style={pdfStyles.paragraph}>
      Water availability in the Varuna Basin is governed by intertwined climatic, geomorphic, and anthropogenic factors
      that complicate reliable assessment and management of surface water resources. As a rain-fed tributary of the Ganga,
      the basin depends heavily on monsoonal precipitation, which supplies most of the annual inflow and creates pronounced
      contrasts between surplus conditions during the monsoon and acute shortages in the pre-monsoon months. These dynamics
      highlight the need for basin-scale monitoring and forecasting frameworks that can track both seasonal variability and
      long-term trends. Natural controls play a central role in shaping hydrological responses. The basin's alluvial geology
      exhibits spatially variable infiltration potential, influencing how rainfall is partitioned among surface runoff,
      groundwater recharge, and soil moisture storage. Steeper upper reaches promote rapid runoff and limited retention,
      while gentler downstream areas favor stagnation and sediment deposition; clay-rich soils restrict infiltration and
      enhance overland flow, whereas sandy and mixed textures support recharge but can deplete quickly. Human pressures
      compound these vulnerabilities. Expansion of irrigated agriculture, especially rice–wheat systems, has raised water
      demand and altered infiltration and runoff pathways, and urbanization around Varanasi has replaced permeable surfaces
      with built-up areas, increasing runoff and reducing recharge. Inadequate drainage and industrial effluents further
      degrade water quality, so scarcity increasingly reflects misaligned demand and pollution as much as limited natural
      supply, making robust, integrated water availability frameworks indispensable.
    </Text>

    <Text style={pdfStyles.pageNumber} render={({ pageNumber }) => `${pageNumber}`} fixed />
  </>
);