import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { premium } from '../../theme/premium';

export function StatusChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <View style={styles.box}>
      <Text style={styles.title}>Status das guias</Text>
      {data.map((d) => (
        <View key={d.label} style={styles.row}>
          <Text style={styles.label}>{d.label}</Text>
          <View style={styles.barBg}>
            <View style={[styles.bar, { width: `${(d.value / max) * 100}%`, backgroundColor: d.color }]} />
          </View>
          <Text style={styles.val}>{d.value}</Text>
        </View>
      ))}
    </View>
  );
}

export function MonthlyChart({
  data,
}: {
  data: { month: string; pagas: number; abertas: number }[];
}) {
  const max = Math.max(...data.flatMap((d) => [d.pagas, d.abertas]), 1);
  return (
    <View style={styles.box}>
      <Text style={styles.title}>Evolução mensal</Text>
      <View style={styles.monthRow}>
        {data.map((d) => (
          <View key={d.month} style={styles.monthCol}>
            <View style={styles.barsCol}>
              <View
                style={[
                  styles.vBar,
                  { height: Math.max(8, (d.pagas / max) * 72), backgroundColor: premium.status.paga.bar },
                ]}
              />
              <View
                style={[
                  styles.vBar,
                  { height: Math.max(4, (d.abertas / max) * 72), backgroundColor: '#F59E0B', marginLeft: 4 },
                ]}
              />
            </View>
            <Text style={styles.monthLabel}>{d.month}</Text>
          </View>
        ))}
      </View>
      <View style={styles.legend}>
        <View style={styles.legItem}>
          <View style={[styles.dot, { backgroundColor: premium.status.paga.bar }]} />
          <Text style={styles.legText}>Pagas</Text>
        </View>
        <View style={styles.legItem}>
          <View style={[styles.dot, { backgroundColor: '#F59E0B' }]} />
          <Text style={styles.legText}>Em aberto</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: premium.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: premium.border,
    marginBottom: 12,
    ...premium.shadow,
  },
  title: { fontSize: 14, fontWeight: '800', color: premium.text, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  label: { width: 72, fontSize: 12, color: premium.textMuted },
  barBg: { flex: 1, height: 8, backgroundColor: '#F1F5F9', borderRadius: 4, overflow: 'hidden' },
  bar: { height: 8, borderRadius: 4 },
  val: { width: 28, fontSize: 12, fontWeight: '700', textAlign: 'right', color: premium.text },
  monthRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  monthCol: { alignItems: 'center', flex: 1 },
  barsCol: { flexDirection: 'row', alignItems: 'flex-end', height: 80 },
  vBar: { width: 10, borderRadius: 4 },
  monthLabel: { fontSize: 10, color: premium.textMuted, marginTop: 6 },
  legend: { flexDirection: 'row', gap: 16, marginTop: 12 },
  legItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legText: { fontSize: 11, color: premium.textMuted },
});
