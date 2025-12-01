// frontend/app/dss/gwm/MAR/SWA/drain/components/Export/components/climate.tsx
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
    backgroundColor: '#059669',
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
  scenarioSection: {
    marginBottom: 15,
    pageBreakBefore: false,
  },
  scenarioHeader: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#059669',
    marginBottom: 8,
    paddingBottom: 4,
    borderBottom: '0.7pt solid #a7f3d0',
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
    color: '#059669',
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
    height: 130,
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
  highlightBox: {
    backgroundColor: '#d1fae5',
    padding: 8,
    borderRadius: 4,
    marginBottom: 10,
    border: '0.7pt solid #6ee7b7',
  },
  highlightText: {
    fontSize: 10,
    color: '#065f46',
    fontWeight: 'bold',
    marginBottom: 2,
  },
  warningBox: {
    backgroundColor: '#fef3c7',
    padding: 8,
    borderRadius: 4,
    marginBottom: 10,
    border: '0.7pt solid #fbbf24',
  },
  warningText: {
    fontSize: 10,
    color: '#92400e',
    fontWeight: 'bold',
  },
  footerNote: {
    fontSize: 10,
    color: '#666',
    marginTop: 8,
    fontStyle: 'italic',
    textAlign: 'justify',
  },
});

interface ClimateData {
  subbasin_id: number;
  scenario: number;
  start_year: number;
  end_year: number;
  image_base64?: string;
  data?: {
    points: Array<{
      year: number;
      mon: number;
      flow_out: number;
    }>;
  };
}

interface ClimateSectionProps {
  climateResults?: Record<string, ClimateData>;
}

const ClimateSection: React.FC<ClimateSectionProps> = ({ climateResults }) => {
  if (!climateResults || Object.keys(climateResults).length === 0) {
    return (
      <View style={styles.section}>
        <View style={styles.headerBar}>
          <Text style={styles.headerText}>Climate Change Impact Analysis</Text>
        </View>
        <Text style={styles.text}>No climate change data available for the selected subbasins.</Text>
      </View>
    );
  }

  // Group results by scenario
  const scenarioMap: Record<number, ClimateData[]> = {};
  Object.values(climateResults).forEach((data) => {
    if (!scenarioMap[data.scenario]) {
      scenarioMap[data.scenario] = [];
    }
    scenarioMap[data.scenario].push(data);
  });

  // Scenario labels
  const scenarioLabels: Record<number, { name: string; description: string }> = {
    585: {
      name: 'RCP 8.5 (High Emissions)',
      description: 'Business-as-usual scenario with continued high greenhouse gas emissions.',
    },
    370: {
      name: 'RCP 6.0 (Moderate-High)',
      description: 'Stabilization scenario with emissions peaking around 2080.',
    },
    245: {
      name: 'RCP 4.5 (Moderate)',
      description: 'Stabilization scenario with emissions peaking around 2040.',
    },
    126: {
      name: 'RCP 2.6 (Low Emissions)',
      description: 'Aggressive mitigation scenario achieving net-zero by 2100.',
    },
  };

  // Calculate flow stats per scenario
  const scenarioStats: Record<number, { avgFlow: number; minFlow: number; maxFlow: number; subbasins: number }> = {};

  Object.entries(scenarioMap).forEach(([scenario, arr]) => {
    const allFlows: number[] = [];
    arr.forEach((data) =>
      data.data?.points?.forEach((p) => Number.isFinite(p.flow_out) && allFlows.push(p.flow_out))
    );

    if (allFlows.length > 0) {
      scenarioStats[Number(scenario)] = {
        avgFlow: allFlows.reduce((a, b) => a + b, 0) / allFlows.length,
        minFlow: Math.min(...allFlows),
        maxFlow: Math.max(...allFlows),
        subbasins: arr.length,
      };
    }
  });

  return (
    <View style={styles.section}>
      <View style={styles.headerBar}>
        <Text style={styles.headerText}>Climate Change Impact Analysis</Text>
      </View>

      <Text style={styles.introText}>
        Climate projections highlight potential shifts in flow under different greenhouse gas emission
        scenarios. These insights are crucial for resilient aquifer recharge and long-term water planning.
      </Text>

      <View style={styles.highlightBox}>
        <Text style={styles.highlightText}>Scenario Overview</Text>
        {Object.entries(scenarioMap).map(([scenario, arr]) => {
          const first = arr[0];
          const s = scenarioStats[Number(scenario)];
          return (
            <Text key={scenario} style={styles.text}>
              • {scenarioLabels[Number(scenario)]?.name || `Scenario ${scenario}`}: {first.start_year}–{first.end_year}
              {s && ` | Avg Flow: ${s.avgFlow.toFixed(2)} m³`}
            </Text>
          );
        })}
      </View>

      {Object.entries(scenarioMap).map(([scenario, arr], index) => {
        const info = scenarioLabels[Number(scenario)];
        return (
          <View
            key={scenario}
            style={[styles.scenarioSection, { marginBottom: index !== 0 ? '2rem' : '0' }]}
            wrap={true}
          >
            <Text style={styles.scenarioHeader}>{info?.name || `Scenario ${scenario}`}</Text>
            <Text style={[styles.text, { fontStyle: 'italic', marginBottom: 8 }]}>
              {info?.description || 'Climate projection scenario.'}
            </Text>

            <View style={styles.gridContainer}>
              {arr.map((data, i) => {
                const s = scenarioStats[Number(scenario)];
                return (
                  <View key={`${data.subbasin_id}_${i}`} style={styles.card} wrap={true}>
                    <Text style={styles.subHeader}>Subbasin {data.subbasin_id}</Text>

                    <View style={styles.statsRow}>
                      <Text style={styles.statLabel}>Period:</Text>
                      <Text style={styles.statValue}>
                        {data.start_year}–{data.end_year}
                      </Text>
                    </View>

                    {s && (
                      <>
                        <View style={styles.statsRow}>
                          <Text style={styles.statLabel}>Avg Flow:</Text>
                          <Text style={styles.statValue}>{s.avgFlow.toFixed(2)} m³</Text>
                        </View>
                        <View style={styles.statsRow}>
                          <Text style={styles.statLabel}>Range:</Text>
                          <Text style={styles.statValue}>
                            {s.minFlow.toFixed(1)}–{s.maxFlow.toFixed(1)} m³
                          </Text>
                        </View>
                      </>
                    )}

                    {data.image_base64 && (
                      <Image
                        style={styles.image}
                        src={`data:image/png;base64,${data.image_base64}`}
                      />
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        );
      })}

      <View style={styles.warningBox}>
        <Text style={styles.warningText}>Key Climate Considerations</Text>
        <Text style={styles.text}>• Higher emission (RCP 8.5) scenarios show greater flow variability.</Text>
        <Text style={styles.text}>• Recharge timing and seasonal distribution may shift significantly.</Text>
        <Text style={styles.text}>• Long-term strategies should consider extreme climate projections.</Text>
        <Text style={styles.text}>• Adaptation and monitoring are critical for sustainable management.</Text>
      </View>

      <Text style={styles.footerNote}>
        Data derived from CMIP6 climate models, downscaled for the study region. Monthly runoff values
        illustrate flow variations under each scenario, guiding climate-resilient MAR design.
      </Text>
    </View>
  );
};

export default ClimateSection;
