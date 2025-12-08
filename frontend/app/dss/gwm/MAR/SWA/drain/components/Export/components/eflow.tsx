// frontend/app/dss/gwm/MAR/SWA/drain/components/Export/components/eflow.tsx
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
    backgroundColor: '#7c3aed',
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
  methodSection: {
    marginBottom: 15,
  },
  methodHeader: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#7c3aed',
    marginBottom: 8,
    paddingBottom: 4,
    borderBottom: '0.7pt solid #c4b5fd',
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
    color: '#7c3aed',
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
  tableContainer: {
    marginTop: 10,
    border: '0.7pt solid #e0e0e0',
    borderRadius: 4,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderBottom: '0.7pt solid #d1d5db',
    padding: 6,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '0.5pt solid #e5e7eb',
    padding: 6,
  },
  tableCell: {
    flex: 1,
    fontSize: 9,
    color: '#374151',
    textAlign: 'center',
  },
  tableCellHeader: {
    flex: 1,
    fontSize: 9,
    fontWeight: 'bold',
    color: '#1f2937',
    textAlign: 'center',
  },
  footerNote: {
    fontSize: 10,
    color: '#666',
    marginTop: 8,
    fontStyle: 'italic',
    textAlign: 'justify',
  },
  highlightBox: {
    backgroundColor: '#ede9fe',
    padding: 8,
    borderRadius: 4,
    marginBottom: 10,
    border: '0.7pt solid #c4b5fd',
  },
  highlightText: {
    fontSize: 10,
    color: '#5b21b6',
    fontWeight: 'bold',
    marginBottom: 3,
  },
});

interface EFlowSectionProps {
  eflowResults?: Record<number, {
    summary: Record<string, number>;
    curves: Record<string, {
      days: number[];
      flows: number[];
      threshold: number;
      image_base64?: string;
    }>;
  }>;
}

const EFlowSection: React.FC<EFlowSectionProps> = ({ eflowResults }) => {
  if (!eflowResults || Object.keys(eflowResults).length === 0) {
    return (
      <View style={styles.section}>
        <View style={styles.headerBar}>
          <Text style={styles.headerText}>Environmental Flow (E-Flow) Analysis</Text>
        </View>
        <Text style={styles.text}>No environmental flow data available for the selected subbasins.</Text>
      </View>
    );
  }

  // Get all available methods from the first subbasin
  const firstSubbasin = Object.values(eflowResults)[0];
  const availableMethods = firstSubbasin ? Object.keys(firstSubbasin.curves) : [];

  // Methods to display with their descriptions
  const methodDescriptions: Record<string, string> = {
    'FDC-Q90': 'Flow Duration Curve - Q90 (10% exceedance)',
    'FDC-Q95': 'Flow Duration Curve - Q95 (5% exceedance)',
    'Tennant-10%': 'Tennant Method - 10% of Mean Annual Flow',
    'Tennant-30%': 'Tennant Method - 30% of Mean Annual Flow',
    'Tennant-60%': 'Tennant Method - 60% of Mean Annual Flow',
    'Smakhtin': 'Smakhtin Method - 20% of Mean Annual Flow',
    'Tessmann': 'Tessmann Method - Monthly variable requirement',
  };

  return (
    <View style={styles.section}>
      <View style={styles.headerBar}>
        <Text style={styles.headerText}>Environmental Flow (E-Flow) Analysis</Text>
      </View>

      <Text style={styles.introText}>
        Environmental flow (E-flow) requirements represent the minimum flow needed to maintain ecosystem health.
        This analysis compares multiple established methods including Flow Duration Curve (FDC), Tennant,
        Smakhtin, and Tessmann approaches. Each method provides monthly flow requirements that must be
        maintained to protect aquatic ecosystems while allowing surplus water extraction.
      </Text>

      {/* Summary Comparison Table */}
      <View style={styles.fullWidthCard}>
        <Text style={styles.subHeader}>Surplus Volume Comparison (Mm³/year)</Text>
        <View style={styles.tableContainer}>
          <View style={styles.tableHeader}>
            <Text style={styles.tableCellHeader}>Subbasin</Text>
            {availableMethods.map((method) => (
              <Text key={method} style={styles.tableCellHeader}>{method}</Text>
            ))}
          </View>
          {Object.entries(eflowResults).map(([subId, data]) => (
            <View key={subId} style={styles.tableRow}>
              <Text style={styles.tableCell}>{subId}</Text>
              {availableMethods.map((method) => (
                <Text key={method} style={styles.tableCell}>
                  {data.summary[method] != null
                    ? Number(data.summary[method]).toFixed(3)
                    : '—'}
                </Text>
              ))}
            </View>
          ))}
        </View>
      </View>

      {/* Method-wise Charts */}
      {availableMethods.slice(0, 4).map((method) => (
        <View key={method} style={styles.methodSection}>

          <Text style={styles.methodHeader}>
            {method}: {methodDescriptions[method] || method}
          </Text>

          <View style={styles.gridContainer}>
            {Object.entries(eflowResults).map(([subId, data]) => {
              const curve = data.curves[method];
              if (!curve) return null;

              return (
                <View key={`${subId}-${method}`} style={styles.card}>
                  <Text style={styles.subHeader}>Subbasin {subId}</Text>

                  <View style={styles.statsRow}>
                    <Text style={styles.statLabel}>Threshold:</Text>
                    <Text style={styles.statValue}>
                      {curve.threshold?.toFixed(3) || 'N/A'} cms
                    </Text>
                  </View>

                  <View style={styles.statsRow}>
                    <Text style={styles.statLabel}>Surplus:</Text>
                    <Text style={styles.statValue}>
                      {data.summary[method]?.toFixed(3) || 'N/A'} Mm³/yr
                    </Text>
                  </View>

                  {curve.image_base64 && (
                    <Image
                      style={styles.image}
                      src={`data:image/png;base64,${curve.image_base64}`}
                    />
                  )}
                </View>
              );
            })}
          </View>
        </View>
      ))}

      <Text style={styles.footerNote}>
        E-flow analysis uses simulated monthly flow data to determine sustainable extraction limits.
        The surplus volume represents water available beyond environmental requirements. Conservative
        methods (FDC-Q95, Tennant-60%) provide higher protection but lower surplus, while liberal
        methods (FDC-Q90, Tennant-10%) allow greater extraction with reduced ecosystem protection.
      </Text>
    </View>
  );
};

export default EFlowSection;