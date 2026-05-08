import React from "react";
import { View, Text } from "@react-pdf/renderer";

const pdfStyles = {
  table: {
    marginTop: 10,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#000000",
  },
  tableRow: {
    flexDirection: "row" as const,
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
  },
  tableHeaderRow: {
    flexDirection: "row" as const,
    backgroundColor: "#f8f9fa",
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
  },
  tableCell: {
    flex: 1,
    padding: 8,
    fontSize: 10,
    fontFamily: "Times-Roman",
    borderRightWidth: 1,
    borderRightColor: "#000000",
    lineHeight: 1.4,
    textAlign: "left" as const,
  },
  tableHeaderCell: {
    flex: 1,
    padding: 8,
    fontSize: 10,
    fontWeight: "bold",
    fontFamily: "Times-Bold",
    color: "#000000",
    borderRightWidth: 1,
    borderRightColor: "#000000",
    lineHeight: 1.4,
    textAlign: "left" as const,
  },
} as const;

export const OutputProductsTable: React.FC = () => (
  <View style={pdfStyles.table}>
    <View style={pdfStyles.tableHeaderRow}>
      <Text style={[pdfStyles.tableHeaderCell, { flex: 1 }]}>Product</Text>
      <Text style={[pdfStyles.tableHeaderCell, { flex: 2 }]}>Definition</Text>
      <Text style={[pdfStyles.tableHeaderCell, { flex: 0.8 }]}>Units</Text>
    </View>
    <View style={pdfStyles.tableRow}>
      <Text style={[pdfStyles.tableCell, { flex: 1 }]}>Water Budget</Text>
      <Text style={[pdfStyles.tableCell, { flex: 2 }]}>
        Daily water balance (P - ET - Q)
      </Text>
      <Text style={[pdfStyles.tableCell, { flex: 0.8, borderRightWidth: 0 }]}>
        MLD
      </Text>
    </View>
    <View style={pdfStyles.tableRow}>
      <Text style={[pdfStyles.tableCell, { flex: 1 }]}>Surplus</Text>
      <Text style={[pdfStyles.tableCell, { flex: 2 }]}>
        Positive water balance (water availability)
      </Text>
      <Text style={[pdfStyles.tableCell, { flex: 0.8, borderRightWidth: 0 }]}>
        Binary mask
      </Text>
    </View>
    <View style={pdfStyles.tableRow}>
      <Text style={[pdfStyles.tableCell, { flex: 1 }]}>Deficit</Text>
      <Text style={[pdfStyles.tableCell, { flex: 2 }]}>
        Negative water balance (water stress)
      </Text>
      <Text style={[pdfStyles.tableCell, { flex: 0.8, borderRightWidth: 0 }]}>
        Binary mask
      </Text>
    </View>
    <View style={pdfStyles.tableRow}>
      <Text style={[pdfStyles.tableCell, { flex: 1 }]}>Index Class</Text>
      <Text style={[pdfStyles.tableCell, { flex: 2 }]}>
        Classified water availability category
      </Text>
      <Text style={[pdfStyles.tableCell, { flex: 0.8, borderRightWidth: 0 }]}>
        Ordinal (1-10)
      </Text>
    </View>
  </View>
);