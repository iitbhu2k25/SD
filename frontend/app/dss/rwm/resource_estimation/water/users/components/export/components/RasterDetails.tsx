import React from "react";
import { View, Text } from "@react-pdf/renderer";

interface RasterData {
  layer_name: string;
  volume_MLD?: number;
  year?: number;
  [key: string]: any;
}

interface RasterDetailsProps {
  clippedRasters: RasterData[];
}

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
  rasterCard: {
    marginBottom: 10,
    padding: 10,
    backgroundColor: "#f8f9fa",
    borderRadius: 3,
    borderWidth: 1,
    borderColor: "#dee2e6",
  },
  rasterTitle: {
    fontSize: 10,
    fontWeight: "bold",
    fontFamily: "Times-Bold" as const,
    color: "#000000",
    marginBottom: 5,
    lineHeight: 1.3,
  },
  rasterDetail: {
    fontSize: 9,
    fontFamily: "Times-Roman" as const,
    color: "#495057",
    marginBottom: 3,
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

export const RasterDetails: React.FC<RasterDetailsProps> = ({ clippedRasters }) => (
  <>
    <Text style={pdfStyles.subsectionTitle}>Processed Raster Layers</Text>

    {clippedRasters.map((raster, index) => (
      <View key={index} style={pdfStyles.rasterCard}>
        <Text style={pdfStyles.rasterTitle}>
          Layer {index + 1}: {raster.layer_name}
        </Text>
        <Text style={pdfStyles.rasterDetail}>
          Volume:{" "}
          {raster.volume_MLD
            ? `${raster.volume_MLD.toLocaleString("en-IN", {
                maximumFractionDigits: 2,
              })} MLD`
            : "N/A"}
        </Text>
        <Text style={pdfStyles.rasterDetail}>
          Year: {raster.year || "N/A"}
        </Text>
      </View>
    ))}

    <Text style={pdfStyles.pageNumber} render={({ pageNumber }) => `${pageNumber}`} fixed />
  </>
);