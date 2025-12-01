'use client';

import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  section: { marginBottom: 20 },
  title: { fontSize: 14, fontWeight: 'bold', marginBottom: 5 },
  text: { fontSize: 12, lineHeight: 1.4 }
});

const ConclusionSection = () => (
  <View style={styles.section}>
    <Text style={styles.title}>Conclusion</Text>
    <Text style={styles.text}>
      The basin demonstrates sustainable recharge patterns with effective
      groundwater–surface water interaction. Seasonal analysis indicates
      resilience against short-term climate stress within acceptable limits.
    </Text>
  </View>
);

export default ConclusionSection;
