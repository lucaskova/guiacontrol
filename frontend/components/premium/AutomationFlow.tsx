import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { premium } from '../../theme/premium';

const STEPS = [
  { icon: 'cloud-upload', label: 'Upload' },
  { icon: 'scan', label: 'Leitura IA' },
  { icon: 'business', label: 'Empresa' },
  { icon: 'calendar', label: 'Vencimento' },
  { icon: 'send', label: 'Envio auto' },
  { icon: 'logo-whatsapp', label: 'Lembretes' },
  { icon: 'wallet', label: 'Pagamento' },
  { icon: 'checkmark-done', label: 'Confirmação' },
];

export function AutomationFlow({ tagline }: { tagline?: string }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.badge}>
        <Ionicons name="flash" size={14} color={premium.primary} />
        <Text style={styles.badgeText}>Automação inteligente</Text>
      </View>
      <Text style={styles.quote}>
        {tagline || 'O contador sobe a guia e o GuiaControl faz o resto.'}
      </Text>
      <View style={styles.flow}>
        {STEPS.map((s, i) => (
          <View key={s.label} style={styles.stepWrap}>
            <View style={styles.step}>
              <Ionicons name={s.icon as any} size={16} color={premium.primary} />
            </View>
            <Text style={styles.stepLabel} numberOfLines={1}>
              {s.label}
            </Text>
            {i < STEPS.length - 1 && <View style={styles.connector} />}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 20,
    marginTop: 8,
    backgroundColor: '#EEF2FF',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#FFF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 10,
  },
  badgeText: { fontSize: 11, fontWeight: '800', color: premium.primary },
  quote: { fontSize: 15, fontWeight: '700', color: premium.text, lineHeight: 22, marginBottom: 14 },
  flow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  stepWrap: { alignItems: 'center', width: '23%', marginBottom: 8, position: 'relative' },
  step: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...premium.shadow,
  },
  stepLabel: { fontSize: 9, color: premium.textMuted, marginTop: 4, textAlign: 'center', fontWeight: '600' },
  connector: { display: 'none' },
});
