import React from "react";
import { View, Text } from "@react-pdf/renderer";

const pdfStyles = {
  waterBudgetContainer: {
    marginTop: 15,
    marginBottom: 15,
    padding: 15,
    backgroundColor: "#f8f9fa",
    borderWidth: 1,
    borderColor: "#dee2e6",
    borderRadius: 4,
  },
  waterBudgetTitle: {
    fontSize: 12,
    fontWeight: "bold",
    fontFamily: "Times-Bold",
    color: "#000000",
    marginBottom: 8,
    lineHeight: 1.3,
  },
  valueCard: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dee2e6",
    borderRadius: 3,
    padding: 12,
    marginBottom: 10,
    textAlign: "center" as const,
  },
  mainValue: {
    fontSize: 24,
    fontWeight: "bold",
    fontFamily: "Times-Bold",
    color: "#000000",
    marginBottom: 5,
    lineHeight: 1.2,
  },
  unitText: {
    fontSize: 10,
    fontFamily: "Times-Roman",
    color: "#495057",
    lineHeight: 1.3,
  },
};

interface WaterBudgetPDFSectionProps {
  totalWaterBudget: number;
  productType: string;
  year: number;
  season: string;
  timeScale: string;
}

export const WaterBudgetPDFSection: React.FC<WaterBudgetPDFSectionProps> = ({
  totalWaterBudget,
  productType,
  year,
  season,
  timeScale,
}) => {
  return (
    <View style={pdfStyles.waterBudgetContainer}>
      <Text style={pdfStyles.waterBudgetTitle}>Water Budget Summary</Text>

      <View style={pdfStyles.valueCard}>
        <Text style={pdfStyles.mainValue}>
          {totalWaterBudget.toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </Text>
        <Text style={pdfStyles.unitText}>Million Liters per Day (MLD)</Text>
      </View>
    </View>
  );
};