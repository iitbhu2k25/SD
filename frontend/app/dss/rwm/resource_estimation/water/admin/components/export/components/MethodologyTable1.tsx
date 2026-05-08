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
};

export const MethodologyTable1: React.FC = () => (
  <View style={pdfStyles.table}>
    <View style={pdfStyles.tableHeaderRow}>
      <Text style={[pdfStyles.tableHeaderCell, { flex: 1.2 }]}>
        Theoretical Variable
      </Text>
      <Text style={[pdfStyles.tableHeaderCell, { flex: 1 }]}>
        Implementation
      </Text>
      <Text style={[pdfStyles.tableHeaderCell, { flex: 1.2 }]}>
        Source Dataset
      </Text>
    </View>

    <View style={pdfStyles.tableRow}>
      <Text style={[pdfStyles.tableCell, { flex: 1.2 }]}>
        P_day (Precipitation)
      </Text>
      <Text style={[pdfStyles.tableCell, { flex: 1 }]}>P_corrected</Text>
      <Text style={[pdfStyles.tableCell, { flex: 1.2 }]}>
        TerraCLIMATE + IMD correction
      </Text>
    </View>

    <View style={pdfStyles.tableRow}>
      <Text style={[pdfStyles.tableCell, { flex: 1.2 }]}>
        E_a (Evapotranspiration)
      </Text>
      <Text style={[pdfStyles.tableCell, { flex: 1 }]}>ET_normalized</Text>
      <Text style={[pdfStyles.tableCell, { flex: 1.2 }]}>
        MODIS MOD16A2GF
      </Text>
    </View>

    <View style={pdfStyles.tableRow}>
      <Text style={[pdfStyles.tableCell, { flex: 1.2 }]}>
        Q_surf + Q_gw (Total runoff)
      </Text>
      <Text style={[pdfStyles.tableCell, { flex: 1 }]}>Q</Text>
      <Text style={[pdfStyles.tableCell, { flex: 1.2 }]}>
        TerraCLIMATE runoff
      </Text>
    </View>

    <View style={pdfStyles.tableRow}>
      <Text style={[pdfStyles.tableCell, { flex: 1.2 }]}>
        w_seep (Seepage)
      </Text>
      <Text style={[pdfStyles.tableCell, { flex: 1 }]}>
        0.12 x water budget
      </Text>
      <Text style={[pdfStyles.tableCell, { flex: 1.2, borderRightWidth: 0 }]}>
        Empirical (12% loss)
      </Text>
    </View>
  </View>
);