'use client';

import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  section: { marginBottom: 20 },
  title: { fontSize: 14, fontWeight: 'bold', marginBottom: 5 },
  text: { fontSize: 12, lineHeight: 1.4 }
});

const ReferenceSection = () => (
  <View style={styles.section}>
    <Text style={styles.title}>References</Text>
    <Text style={styles.text}>
      1. Central Water Commission (CWC) Guidelines, 2021{"\n"}
      2. National Institute of Hydrology Reports{"\n"}
      3. Integrated Watershed Management Program{"\n"}
      4. Groundwater Manual, Ministry of Jal Shakti, 2023
    </Text>
  </View>
);

export default ReferenceSection;
