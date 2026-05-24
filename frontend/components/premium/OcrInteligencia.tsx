import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { premium } from '../../theme/premium';

const STEPS = [
  { key: 'empresa', label: 'Empresa identificada', icon: 'business' as const },
  { key: 'valor', label: 'Valor identificado', icon: 'cash' as const },
  { key: 'vencimento', label: 'Vencimento identificado', icon: 'calendar' as const },
  { key: 'tipo', label: 'Tipo de guia identificado', icon: 'document-text' as const },
];

type Props = {
  active: boolean;
  done?: Record<string, boolean>;
  onComplete?: () => void;
};

export function OcrInteligencia({ active, done = {}, onComplete }: Props) {
  const [phase, setPhase] = useState<'reading' | 'results'>('reading');

  useEffect(() => {
    if (!active) {
      setPhase('reading');
      return;
    }
    const t = setTimeout(() => {
      setPhase('results');
      onComplete?.();
    }, 1400);
    return () => clearTimeout(t);
  }, [active, onComplete]);

  if (!active) return null;

  return (
    <View style={styles.box}>
      <View style={styles.header}>
        <View style={styles.aiIcon}>
          <Ionicons name="sparkles" size={18} color={premium.primary} />
        </View>
        <View style={{ flex: 1 }}>
          {phase === 'reading' ? (
            <>
              <Text style={styles.title}>Lendo guia automaticamente…</Text>
              <Text style={styles.sub}>IA fiscal extraindo dados do documento</Text>
            </>
          ) : (
            <Text style={styles.title}>Leitura concluída</Text>
          )}
        </View>
        {phase === 'reading' && <ActivityIndicator color={premium.primary} />}
      </View>
      {phase === 'results' && (
        <View style={styles.steps}>
          {STEPS.map((s) => {
            const ok = done[s.key] !== false;
            return (
              <View key={s.key} style={styles.stepRow}>
                <Ionicons
                  name={ok ? 'checkmark-circle' : 'ellipse-outline'}
                  size={18}
                  color={ok ? premium.status.paga.main : '#CBD5E1'}
                />
                <Text style={[styles.stepLabel, ok && styles.stepOk]}>{s.label}</Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: premium.surface,
    borderRadius: 16,
    padding: 16,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: premium.border,
    ...premium.shadow,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  aiIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 15, fontWeight: '700', color: premium.text },
  sub: { fontSize: 12, color: premium.textMuted, marginTop: 2 },
  steps: { marginTop: 14, gap: 8 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepLabel: { fontSize: 13, color: premium.textMuted },
  stepOk: { color: premium.text, fontWeight: '600' },
});
