'use client';

import React from 'react';
import { View, Text, StyleSheet, Image } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  section: {
    marginBottom: 20,
    padding: 15,
    border: '1pt solid #e0e0e0',
    borderRadius: 6,
    backgroundColor: '#fafafa',
  },
  headerBar: {
    backgroundColor: '#1a73e8',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 4,
    marginBottom: 10,
  },
  headerText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  introText: {
    fontSize: 11,
    color: '#333',
    lineHeight: 1.4,
    marginBottom: 10,
    textAlign: 'justify',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    width: '48%',
    backgroundColor: 'white',
    border: '0.7pt solid #d0d0d0',
    borderRadius: 6,
    marginBottom: 10,
    padding: 8,
    boxShadow: '0 1pt 2pt rgba(0,0,0,0.1)',
  },
  subHeader: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1a73e8',
    marginBottom: 4,
  },
  text: {
    fontSize: 10.5,
    lineHeight: 1.4,
    marginBottom: 4,
    color: '#444',
  },
  image: {
    width: '100%',
    height: 120,
    borderRadius: 4,
    marginTop: 6,
  },
  footerNote: {
    fontSize: 10,
    color: '#666',
    marginTop: 8,
    fontStyle: 'italic',
    textAlign: 'justify',
  },
});

interface FDCCurveProps {
  series: any[];
  hasData: boolean;
}

const FDCCurveSection: React.FC<FDCCurveProps> = ({ series, hasData }) => {
  if (!hasData || series.length === 0) {
    return (
      <View style={styles.section}>
        <View style={styles.headerBar}>
          <Text style={styles.headerText}>Flow Duration Curve (FDC) Summary</Text>
        </View>
        <Text style={styles.text}>No FDC data available for the selected subbasins.</Text>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <View style={styles.headerBar}>
        <Text style={styles.headerText}>Flow Duration Curve (FDC) Summary</Text>
      </View>

      <Text style={styles.introText}>
        The following section illustrates the <Text style={{ fontWeight: 'bold' }}>Flow Duration Curve (FDC)</Text> analysis across
        evaluated subbasins. Each chart below visualizes the relationship between flow and its exceedance probability. The Q25
        (25% exceedance) value is highlighted as an indicator of moderate to high flow conditions.
      </Text>

      <View style={styles.gridContainer}>
        {series.map((s, index) => {
          const closest = s.curve.reduce((prev: any, curr: any) =>
            Math.abs(curr.p - 25) < Math.abs(prev.p - 25) ? curr : prev
          );
          const q25 = closest.q.toFixed(3);

          return (
            <View key={index} style={styles.card}>
              <Text style={styles.subHeader}>Subbasin {s.sub}</Text>
              <Text style={styles.text}>Q25 Flow: {q25} m³/s</Text>
              {s.imageBase64 && (
                <Image
                  style={styles.image}
                  src={`data:image/png;base64,${s.imageBase64}`}
                />
              )}
            </View>
          );
        })}
      </View>

      <Text style={styles.footerNote}>
        These FDCs are generated using simulated runoff data and analyzed using exceedance probability methods to understand
        flow persistence and variability across regions.
      </Text>
    </View>
  );
};

export default FDCCurveSection;
