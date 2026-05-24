import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { premium } from '../../theme/premium';

type Step = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  done: boolean;
  active?: boolean;
};

export function buildGuiaTimeline(guia: {
  status?: string;
  created_at?: string;
  data_pagamento?: string | null;
}): Step[] {
  const paga = guia.status === 'paga';
  return [
    { key: 'enviada', label: 'Guia cadastrada', icon: 'cloud-upload', done: true },
    { key: 'lembrete', label: 'Lembrete enviado', icon: 'logo-whatsapp', done: !paga },
    { key: 'visualizou', label: 'Cliente visualizou', icon: 'eye', done: false, active: !paga },
    { key: 'pagamento', label: 'Pagamento identificado', icon: 'wallet', done: paga },
    { key: 'confirmada', label: 'Confirmada', icon: 'checkmark-done', done: paga, active: paga },
  ];
}

export function GuiaTimeline({ guia }: { guia: any }) {
  const steps = buildGuiaTimeline(guia);
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Automação</Text>
      {steps.map((s, i) => (
        <View key={s.key} style={styles.row}>
          <View style={styles.lineCol}>
            <View
              style={[
                styles.dot,
                s.done && styles.dotDone,
                s.active && styles.dotActive,
              ]}
            >
              <Ionicons
                name={s.icon}
                size={12}
                color={s.done || s.active ? '#FFF' : '#94A3B8'}
              />
            </View>
            {i < steps.length - 1 && (
              <View style={[styles.line, s.done && styles.lineDone]} />
            )}
          </View>
          <Text style={[styles.label, s.done && styles.labelDone]}>{s.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: premium.surfaceMuted,
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: premium.border,
  },
  title: {
    fontSize: 10,
    fontWeight: '800',
    color: premium.textMuted,
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  row: { flexDirection: 'row', minHeight: 36 },
  lineCol: { width: 28, alignItems: 'center' },
  dot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: { backgroundColor: premium.status.paga.main },
  dotActive: { backgroundColor: premium.primary },
  line: {
    width: 2,
    flex: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 2,
  },
  lineDone: { backgroundColor: '#A7F3D0' },
  label: { flex: 1, fontSize: 12, color: premium.textMuted, paddingTop: 3 },
  labelDone: { color: premium.text, fontWeight: '600' },
});
