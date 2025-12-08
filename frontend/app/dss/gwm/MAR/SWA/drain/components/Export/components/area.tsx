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
    backgroundColor: '#1e3a8a',
    padding: 8,
    borderRadius: 4,
    marginBottom: 10,
  },
  headerText: {
    fontSize: 14,
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  text: {
    fontSize: 11,
    lineHeight: 1.5,
    marginBottom: 6,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#eef2ff',
    borderRadius: 5,
    padding: 8,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1e3a8a',
  },
  statLabel: {
    fontSize: 10,
    color: '#555',
  },
  listRow: {
    marginTop: 10,
  },
  listText: {
    fontSize: 10,
    color: '#333',
    textAlign: 'left',
    lineHeight: 1.4,
  },
  imageContainer: {
   // keeps enough space reserved for large image
  },
  image: {
    
  },
});

interface AreaSectionProps {
  selectedSubbasins: {
    sub: number;
    area?: number;
    image_base64?: string;
  }[];
}

const AreaSection: React.FC<AreaSectionProps> = ({ selectedSubbasins }) => {
  if (!selectedSubbasins || selectedSubbasins.length === 0) {
    return (
      <View style={styles.section}>
        <View style={styles.headerBar}>
          <Text style={styles.headerText}>Selected Subbasins</Text>
        </View>
        <Text style={styles.text}>No subbasins were selected.</Text>
      </View>
    );
  }

  const totalArea = selectedSubbasins.map((s) => s.area || 0).reduce((a, b) => a + b, 0);

  const subbasinList = selectedSubbasins
    .map((s) => `${s.sub}${s.area ? ` (${s.area.toFixed(2)} km²)` : ''}`)
    .join(', ');

  // Pick first available image_base64 from selected subbasins to render one combined image
  const combinedImageBase64 = selectedSubbasins.find((s) => s.image_base64)?.image_base64;

  return (
    <View style={styles.section}>
      <View style={styles.headerBar}>
        <Text style={styles.headerText}>Selected Subbasins Overview</Text>
      </View>
      <Text style={styles.text}>
        Below is a detailed summary of all subbasins included in this analysis.
      </Text>
      <View style={styles.statRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{selectedSubbasins.length}</Text>
          <Text style={styles.statLabel}>Total Subbasins</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{totalArea.toFixed(2)}</Text>
          <Text style={styles.statLabel}>Total Area (km²)</Text>
        </View>
      </View>
      <View style={styles.listRow}>
        <Text style={styles.listText}>
          <Text style={{ fontWeight: 'bold' }}>Subbasin IDs & Areas: </Text>
          {subbasinList}
        </Text>
      </View>
      {/* Render only one combined image, centered and large */}
      {combinedImageBase64 ? (
        <View style={styles.imageContainer}>
          <Image src={combinedImageBase64} style={styles.image} />
        </View>
      ) : null}
    </View>
  );
};

export default AreaSection;
