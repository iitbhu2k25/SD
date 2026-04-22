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
    fontFamily: "Times-Roman" as const,
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
    fontFamily: "Times-Bold" as const   ,
    color: "#000000",
    borderRightWidth: 1,
    borderRightColor: "#000000",
    lineHeight: 1.4,
    textAlign: "left" as const,
  },
};

export const SWCIClassificationTable: React.FC = () => (
  <View style={pdfStyles.table}>
    <View style={pdfStyles.tableHeaderRow}>
      <Text style={[pdfStyles.tableHeaderCell, { flex: 0.6 }]}>Class Code</Text>
      <Text style={[pdfStyles.tableHeaderCell, { flex: 1 }]}>SWCI Range</Text>
      <Text style={[pdfStyles.tableHeaderCell, { flex: 1 }]}>Class Name</Text>
    </View>

    <View style={pdfStyles.tableRow}>
      <Text style={[pdfStyles.tableCell, { flex: 0.6 }]}>1</Text>
      <Text style={[pdfStyles.tableCell, { flex: 1 }]}>Z {"<"} -2.0</Text>
      <Text style={[pdfStyles.tableCell, { flex: 1, borderRightWidth: 0 }]}>
        Extremely Dry
      </Text>
    </View>

    <View style={pdfStyles.tableRow}>
      <Text style={[pdfStyles.tableCell, { flex: 0.6 }]}>2</Text>
      <Text style={[pdfStyles.tableCell, { flex: 1 }]}>
        -2.0 {"<="} Z {"<"} -1.5
      </Text>
      <Text style={[pdfStyles.tableCell, { flex: 1, borderRightWidth: 0 }]}>
        Severely Dry
      </Text>
    </View>

    <View style={pdfStyles.tableRow}>
      <Text style={[pdfStyles.tableCell, { flex: 0.6 }]}>3</Text>
      <Text style={[pdfStyles.tableCell, { flex: 1 }]}>
        -1.5 {"<="} Z {"<"} -1.0
      </Text>
      <Text style={[pdfStyles.tableCell, { flex: 1, borderRightWidth: 0 }]}>
        Highly Dry
      </Text>
    </View>

    <View style={pdfStyles.tableRow}>
      <Text style={[pdfStyles.tableCell, { flex: 0.6 }]}>4</Text>
      <Text style={[pdfStyles.tableCell, { flex: 1 }]}>
        -1.0 {"<="} Z {"<"} -0.5
      </Text>
      <Text style={[pdfStyles.tableCell, { flex: 1, borderRightWidth: 0 }]}>
        Moderately Dry
      </Text>
    </View>

    <View style={pdfStyles.tableRow}>
      <Text style={[pdfStyles.tableCell, { flex: 0.6 }]}>5</Text>
      <Text style={[pdfStyles.tableCell, { flex: 1 }]}>
        -0.5 {"<="} Z {"<"} 0
      </Text>
      <Text style={[pdfStyles.tableCell, { flex: 1, borderRightWidth: 0 }]}>
        Mild Dry
      </Text>
    </View>

    <View style={pdfStyles.tableRow}>
      <Text style={[pdfStyles.tableCell, { flex: 0.6 }]}>6</Text>
      <Text style={[pdfStyles.tableCell, { flex: 1 }]}>
        0 {"<="} Z {"<"} 0.5
      </Text>
      <Text style={[pdfStyles.tableCell, { flex: 1, borderRightWidth: 0 }]}>
        Mild Surplus
      </Text>
    </View>

    <View style={pdfStyles.tableRow}>
      <Text style={[pdfStyles.tableCell, { flex: 0.6 }]}>7</Text>
      <Text style={[pdfStyles.tableCell, { flex: 1 }]}>
        0.5 {"<="} Z {"<"} 1.0
      </Text>
      <Text style={[pdfStyles.tableCell, { flex: 1, borderRightWidth: 0 }]}>
        Moderate Surplus
      </Text>
    </View>

    <View style={pdfStyles.tableRow}>
      <Text style={[pdfStyles.tableCell, { flex: 0.6 }]}>8</Text>
      <Text style={[pdfStyles.tableCell, { flex: 1 }]}>
        1.0 {"<="} Z {"<"} 1.5
      </Text>
      <Text style={[pdfStyles.tableCell, { flex: 1, borderRightWidth: 0 }]}>
        High Surplus
      </Text>
    </View>

    <View style={pdfStyles.tableRow}>
      <Text style={[pdfStyles.tableCell, { flex: 0.6 }]}>9</Text>
      <Text style={[pdfStyles.tableCell, { flex: 1 }]}>
        1.5 {"<="} Z {"<"} 2.0
      </Text>
      <Text style={[pdfStyles.tableCell, { flex: 1, borderRightWidth: 0 }]}>
        Abundant
      </Text>
    </View>

    <View style={pdfStyles.tableRow}>
      <Text style={[pdfStyles.tableCell, { flex: 0.6 }]}>10</Text>
      <Text style={[pdfStyles.tableCell, { flex: 1 }]}>
        Z {">="} 2.0
      </Text>
      <Text style={[pdfStyles.tableCell, { flex: 1, borderRightWidth: 0 }]}>
        Extreme Surplus
      </Text>
    </View>
  </View>
);