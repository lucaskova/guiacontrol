import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  formatCurrency,
  formatDateRelative,
  getStatusText,
} from '../utils/formatters';
import { getStatusPremium, premium } from '../theme/premium';
import { GuiaTimeline } from './premium/GuiaTimeline';
import { RiskBadge } from './premium/RiskBadge';

interface GuiaCardProps {
  guia: any;
  onPress: () => void;
  empresaNome?: string;
  showTimeline?: boolean;
}

export const GuiaCard: React.FC<GuiaCardProps> = ({
  guia,
  onPress,
  empresaNome,
  showTimeline = false,
}) => {
  const [hovered, setHovered] = useState(false);
  const statusText = getStatusText(guia.status);
  const st = getStatusPremium(guia.status);
  const isValidada = guia.status === 'paga';

  const statusIcons: Record<string, string> = {
    paga: 'checkmark-circle',
    a_vencer: 'time',
    vencida: 'alert-circle',
  };

  const webHover =
    Platform.OS === 'web' && hovered
      ? ({ transform: [{ translateY: -2 }], boxShadow: `0 8px 28px ${st.glow}` } as object)
      : {};

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          borderColor: st.main + '33',
          backgroundColor: premium.surface,
        },
        Platform.OS === 'web' && ({ boxShadow: `0 4px 20px ${st.glow}` } as object),
        webHover,
      ]}
      onPress={onPress}
      activeOpacity={0.88}
      onMouseEnter={Platform.OS === 'web' ? () => setHovered(true) : undefined}
      onMouseLeave={Platform.OS === 'web' ? () => setHovered(false) : undefined}
    >
      <View style={[styles.statusBar, { backgroundColor: st.bar }]} />

      <View style={styles.inner}>
        <View style={styles.header}>
          <View style={styles.typeRow}>
            <View style={[styles.typeIcon, { backgroundColor: st.bg }]}>
              <Ionicons name="receipt" size={18} color={st.main} />
            </View>
            <View style={styles.typeInfo}>
              {empresaNome ? (
                <Text style={styles.empresa} numberOfLines={1}>
                  {empresaNome}
                </Text>
              ) : null}
              <Text style={styles.tipo}>{guia.tipo}</Text>
              <Text style={styles.descricao} numberOfLines={1}>
                {guia.descricao}
              </Text>
            </View>
          </View>
          <View style={[styles.badge, { backgroundColor: st.bg, borderColor: st.main + '40' }]}>
            <Ionicons name={(statusIcons[guia.status] || 'time') as any} size={13} color={st.main} />
            <Text style={[styles.badgeText, { color: st.main }]}>{statusText}</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>VALOR</Text>
            <Text style={styles.infoValue}>{formatCurrency(guia.valor)}</Text>
          </View>
          <View style={styles.infoBlockRight}>
            <Text style={styles.infoLabel}>VENCIMENTO</Text>
            <Text style={[styles.infoDate, guia.status === 'vencida' && { color: st.main }]}>
              {formatDateRelative(guia.data_vencimento)}
            </Text>
          </View>
        </View>

        <RiskBadge guia={guia} />

        {showTimeline ? <GuiaTimeline guia={guia} /> : null}

        <View style={styles.footer}>
          <View
            style={[
              styles.validationBadge,
              isValidada ? styles.validationOk : styles.validationPending,
            ]}
          >
            <Ionicons
              name={isValidada ? 'checkmark-circle' : 'sparkles'}
              size={13}
              color={isValidada ? premium.status.paga.main : premium.status.a_vencer.main}
            />
            <Text
              style={[
                styles.validationText,
                { color: isValidada ? premium.status.paga.main : premium.status.a_vencer.main },
              ]}
            >
              {isValidada ? 'Confirmada automaticamente' : 'Automação em andamento'}
            </Text>
          </View>
          <View style={{ flex: 1 }} />
          <View style={styles.viewRow}>
            <Text style={styles.viewText}>Detalhes</Text>
            <Ionicons name="chevron-forward" size={14} color={premium.primary} />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    overflow: 'hidden',
    flexDirection: 'row',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: { elevation: 3 },
    }),
  },
  statusBar: { width: 4 },
  inner: { flex: 1, padding: 13 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  typeRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  typeIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  typeInfo: { flex: 1 },
  empresa: { fontSize: 11, fontWeight: '700', color: premium.textMuted, marginBottom: 2 },
  tipo: { fontSize: 14, fontWeight: '800', color: premium.text, letterSpacing: -0.2 },
  descricao: { fontSize: 11.5, color: premium.textMuted, marginTop: 1 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 4,
    marginLeft: 6,
    borderWidth: 1,
  },
  badgeText: { fontSize: 11, fontWeight: '800' },
  infoRow: {
    flexDirection: 'row',
    backgroundColor: premium.surfaceMuted,
    borderRadius: 12,
    padding: 10,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: premium.border,
  },
  infoBlock: { flex: 1 },
  infoBlockRight: { flex: 1, alignItems: 'flex-end' },
  infoLabel: {
    fontSize: 10,
    color: premium.textMuted,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  infoValue: { fontSize: 17, fontWeight: '800', color: premium.text, letterSpacing: -0.5 },
  infoDate: { fontSize: 13, fontWeight: '700', color: premium.text },
  footer: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  validationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  validationOk: { backgroundColor: premium.status.paga.bg },
  validationPending: { backgroundColor: premium.status.a_vencer.bg },
  validationText: { fontSize: 11, fontWeight: '600' },
  viewRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  viewText: { fontSize: 12, color: premium.primary, fontWeight: '700' },
});
