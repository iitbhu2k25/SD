// frontend/app/dss/gwm/MAR/SWA/drain/components/Export/components/surfacewater.tsx
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
  fullWidthCard: {
    width: '100%',
    backgroundColor: 'white',
    border: '0.7pt solid #d0d0d0',
    borderRadius: 6,
    marginBottom: 10,
    padding: 10,
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
  largeImage: {
    width: '100%',
    height: 180,
    borderRadius: 4,
    marginTop: 6,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 9,
    color: '#666',
  },
  statValue: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#333',
  },
  footerNote: {
    fontSize: 10,
    color: '#666',
    marginTop: 8,
    fontStyle: 'italic',
    textAlign: 'justify',
  },
  highlightBox: {
    backgroundColor: '#e3f2fd',
    padding: 8,
    borderRadius: 4,
    marginBottom: 10,
    border: '0.7pt solid #90caf9',
  },
  highlightText: {
    fontSize: 11,
    color: '#1565c0',
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

interface SurfaceWaterSectionProps {
  mergedSeries: { day: number; flow: number; surplus: number }[];
  q25: number | null;
  subbasinResults?: Array<{
    subbasin: number;
    years: number[];
    Q25_cms?: number;
    image_base64?: string;
    timeseries: { day: number; flow: number }[];
  }>;
}

const SurfaceWaterSection: React.FC<SurfaceWaterSectionProps> = ({ 
  mergedSeries, 
  q25,
  subbasinResults 
}) => {
  // Calculate overall statistics
  const totalDays = mergedSeries.length;
  const avgFlow = mergedSeries.reduce((sum, d) => sum + d.flow, 0) / totalDays || 0;
  const maxFlow = Math.max(...mergedSeries.map(d => d.flow), 0);
  const minFlow = Math.min(...mergedSeries.map(d => d.flow), 0);
  const totalSurplus = mergedSeries.reduce((sum, d) => sum + d.surplus, 0);
  const daysAboveQ25 = mergedSeries.filter(d => d.flow > (q25 || 0)).length;

  // Check if we have any subbasin results with images
  const hasSubbasinData = subbasinResults && subbasinResults.length > 0;

  if (!hasSubbasinData) {
    return (
      <View style={styles.section}>
        <View style={styles.headerBar}>
          <Text style={styles.headerText}>Surface Water Surplus Analysis</Text>
        </View>
        <Text style={styles.text}>No surface water data available for the selected subbasins.</Text>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <View style={styles.headerBar}>
        <Text style={styles.headerText}>Surface Water Surplus Analysis</Text>
      </View>

      <Text style={styles.introText}>
        The following section presents the <Text style={{ fontWeight: 'bold' }}>Surface Water Surplus Analysis</Text> for
        each evaluated subbasin. The charts visualize daily flow patterns and highlight the Q25 threshold (flow exceeded 25%
        of the time). Flow above Q25 indicates surplus water available for potential extraction or storage.
      </Text>

      {/* Overall Summary */}
      {q25 !== null && (
        <View style={styles.highlightBox}>
          <Text style={styles.highlightText}>
            Total Surplus Water Available: {totalSurplus.toFixed(2)} cms-days
          </Text>
          <Text style={[styles.highlightText, { fontSize: 9, marginTop: 3 }]}>
            Overall Q25 Threshold: {q25.toFixed(3)} cms | Days Above Q25: {daysAboveQ25} of {totalDays} ({((daysAboveQ25/totalDays)*100).toFixed(1)}%)
          </Text>
        </View>
      )}

      {/* Subbasin Cards with Images */}
      <View style={styles.gridContainer}>
        {subbasinResults.map((result, index) => {
          const subQ25 = result.Q25_cms || 0;
          const years = result.years?.join(', ') || 'N/A';
          const avgSubFlow = result.timeseries?.length 
            ? result.timeseries.reduce((sum, d) => sum + d.flow, 0) / result.timeseries.length 
            : 0;
          const surplusFlow = result.timeseries
            ?.filter(d => d.flow > subQ25)
            .reduce((sum, d) => sum + (d.flow - subQ25), 0) || 0;

          return (
            <View key={index} style={styles.card}>
              <Text style={styles.subHeader}>Subbasin {result.subbasin}</Text>
              
              <View style={styles.statsRow}>
                <Text style={styles.statLabel}>Years:</Text>
                <Text style={styles.statValue}>{years}</Text>
              </View>
              
              <View style={styles.statsRow}>
                <Text style={styles.statLabel}>Q25 Flow:</Text>
                <Text style={styles.statValue}>{subQ25.toFixed(3)} cms</Text>
              </View>
              
              <View style={styles.statsRow}>
                <Text style={styles.statLabel}>Avg Flow:</Text>
                <Text style={styles.statValue}>{avgSubFlow.toFixed(3)} cms</Text>
              </View>
              
              <View style={styles.statsRow}>
                <Text style={styles.statLabel}>Total Surplus:</Text>
                <Text style={styles.statValue}>{surplusFlow.toFixed(2)} cms-days</Text>
              </View>

              {result.image_base64 && (
                <Image
                  style={styles.image}
                  src={`data:image/png;base64,${result.image_base64}`}
                />
              )}
            </View>
          );
        })}
      </View>

  

      <Text style={styles.footerNote}>
        These flow patterns are generated from SWAT+ simulated runoff data. The Q25 threshold represents flow conditions
        exceeded 25% of the time, indicating reliable surplus water availability. Surplus water above Q25 can be considered
        for managed aquifer recharge or other water resource applications.
      </Text>
    </View>
  );
};

export default SurfaceWaterSection;