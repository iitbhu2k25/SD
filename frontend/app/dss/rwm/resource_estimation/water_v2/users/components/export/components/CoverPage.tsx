import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  container: {
    height: "100%",
    flexDirection: "column",
    justifyContent: "space-between",
    paddingTop: 40,
    paddingBottom: 40,
  },

  header: {
    textAlign: "center",
    marginTop: 60,
  },

  title: {
    fontSize: 22,
    fontFamily: "Times-Bold",
    textAlign: "center",
    marginBottom: 12,
  },

  subtitle: {
    fontSize: 14,
    fontFamily: "Times-Roman",
    textAlign: "center",
    lineHeight: 1.5,
  },

  metaBlock: {
    marginTop: 60,
    fontSize: 12,
    lineHeight: 1.8,
  },

  metaRow: {
    marginBottom: 6,
  },

  footer: {
    textAlign: "center",
    fontSize: 11,
    color: "#444",
  },
});

export const CoverPage: React.FC = () => {
  return (
    <View style={styles.container}>
      {/* TOP SECTION */}
      <View style={styles.header}>
        <Text style={styles.title}>
          Comprehensive Report on Water Availability
        </Text>

        <Text style={styles.subtitle}>
          A Geospatial and Hydrological Analysis for Water Resource Assessment
        </Text>
      </View>

      {/* MIDDLE METADATA */}
      <View style={styles.metaBlock}>
        <Text style={styles.metaRow}>
          <Text style={{ fontFamily: "Times-Bold" }}>Prepared by: </Text>
          IIT (BHU), Varanasi
        </Text>

        <Text style={styles.metaRow}>
          <Text style={{ fontFamily: "Times-Bold" }}>Date: </Text>
            {new Date().toLocaleDateString()}
        </Text>

        <Text style={styles.metaRow}>
          <Text style={{ fontFamily: "Times-Bold" }}>Subject: </Text>
          Water Availability & Basin Analysis
        </Text>
      </View>

      {/* FOOTER */}
      <View style={styles.footer}>
        <Text>Department of Civil Engineering</Text>
        <Text>Indian Institute of Technology (BHU), Varanasi</Text>
      </View>
    </View>
  );
};
