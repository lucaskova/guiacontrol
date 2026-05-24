import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { calcRiskScore } from '../../theme/premium';

const cfg = {
  baixo: { label: 'Risco baixo', bg: '#ECFDF5', color: '#059669', dot: '🟢' },
  medio: { label: 'Risco médio', bg: '#FFFBEB', color: '#D97706', dot: '🟠' },
  alto: { label: 'Risco alto', bg: '#FEF2F2', color: '#DC2626', dot: '🔴' },
};

export function RiskBadge({ guia }: { guia: any }) {
  const level = calcRiskScore(guia);
  const c = cfg[level];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={styles.dot}>{c.dot}</Text>
      <Text style={[styles.text, { color: c.color }]}>{c.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
    marginTop: 6,
  },
  dot: { fontSize: 10 },
  text: { fontSize: 10, fontWeight: '700' },
});
