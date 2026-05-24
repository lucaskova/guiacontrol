import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatCurrency } from '../utils/formatters';
import { premium } from '../theme/premium';

interface DashboardCardProps {
  title: string;
  count: number;
  value: number;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

export const DashboardCard: React.FC<DashboardCardProps> = ({
  title,
  count,
  value,
  icon,
  color,
}) => {
  return (
    <View style={[styles.card, Platform.OS === 'web' && ({ boxShadow: `0 4px 20px ${color}22` } as object)]}>
      <View style={styles.topRow}>
        <View style={[styles.iconCircle, { backgroundColor: color + '18' }]}>
          <Ionicons name={icon} size={22} color={color} />
        </View>
        <View style={[styles.countBadge, { backgroundColor: color + '18' }]}>
          <Text style={[styles.countText, { color }]}>{count}</Text>
        </View>
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={[styles.value, { color }]}>{formatCurrency(value)}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: premium.surface,
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: premium.border,
    ...premium.shadow,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  countText: {
    fontSize: 13,
    fontWeight: '800',
  },
  title: {
    fontSize: 13,
    color: premium.textMuted,
    fontWeight: '600',
    marginBottom: 4,
  },
  value: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
});
