import React, { useRef, useState } from 'react';
import { Text, StyleSheet, ScrollView, Pressable, Animated, Platform, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatCurrency } from '../../utils/formatters';
import { premium } from '../../theme/premium';

export type MetricWidgetKey =
  | 'aberto'
  | 'vencidas'
  | 'pagas'
  | 'prox'
  | 'atraso'
  | 'recup'
  | 'eco';

type Widget = {
  key: MetricWidgetKey;
  label: string;
  value: string | number;
  sub?: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
};

type MetricWidgetsProps = {
  widgets: Record<string, number>;
  onPressItem?: (key: MetricWidgetKey) => void;
};

export function MetricWidgets({ widgets, onPressItem }: MetricWidgetsProps) {
  const items: Widget[] = [
    {
      key: 'aberto',
      label: 'Total em aberto',
      value: formatCurrency(widgets.total_aberto || 0),
      icon: 'wallet-outline',
      color: premium.primary,
      bg: '#EEF2FF',
    },
    {
      key: 'vencidas',
      label: 'Vencidas',
      value: widgets.guias_vencidas || 0,
      sub: 'guias',
      icon: 'alert-circle',
      color: premium.status.vencida.main,
      bg: premium.status.vencida.bg,
    },
    {
      key: 'pagas',
      label: 'Pagas',
      value: widgets.guias_pagas || 0,
      sub: 'guias',
      icon: 'checkmark-circle',
      color: premium.status.paga.main,
      bg: premium.status.paga.bg,
    },
    {
      key: 'prox',
      label: 'Próx. 7 dias',
      value: widgets.proximos_vencimentos || 0,
      sub: 'guias',
      icon: 'calendar',
      color: '#7C3AED',
      bg: '#F5F3FF',
    },
    {
      key: 'atraso',
      label: 'Clientes em atraso',
      value: widgets.clientes_em_atraso || 0,
      sub: 'empresas',
      icon: 'people',
      color: '#DC2626',
      bg: '#FEF2F2',
    },
    {
      key: 'recup',
      label: 'Recuperado (30d)',
      value: formatCurrency(widgets.total_recuperado || 0),
      icon: 'trending-up',
      color: premium.status.paga.main,
      bg: premium.status.paga.bg,
    },
    {
      key: 'eco',
      label: 'Economia multas',
      value: formatCurrency(widgets.economia_multas || 0),
      icon: 'shield-checkmark',
      color: '#0891B2',
      bg: '#ECFEFF',
    },
  ];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scroll}
      style={styles.wrap}
    >
      {items.map((w) => (
        <MetricCard key={w.key} widget={w} onPress={onPressItem ? () => onPressItem(w.key) : undefined} />
      ))}
    </ScrollView>
  );
}

type MetricCardProps = {
  widget: Widget;
  onPress?: () => void;
};

function MetricCard({ widget, onPress }: MetricCardProps) {
  const [hovered, setHovered] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  const spring = (toScale: number, toY: number) => {
    Animated.parallel([
      Animated.spring(scale, { toValue: toScale, useNativeDriver: true, friction: 6 }),
      Animated.spring(translateY, { toValue: toY, useNativeDriver: true, friction: 6 }),
    ]).start();
  };

  const isWeb = Platform.OS === 'web';
  const interactive = !!onPress;
  const webStyle: ViewStyle | undefined = isWeb && interactive
    ? ({
        // @ts-expect-error web-only style props
        cursor: 'pointer',
        transition: 'box-shadow 160ms ease, transform 160ms ease',
      } as ViewStyle)
    : undefined;

  const inner = (
    <Animated.View
      style={[
        styles.card,
        { backgroundColor: widget.bg },
        webStyle,
        hovered && interactive && styles.cardHover,
        interactive && { transform: [{ translateY }, { scale }] },
      ]}
    >
      <Ionicons name={widget.icon} size={20} color={widget.color} />
      <Text style={styles.label}>{widget.label}</Text>
      <Text style={[styles.value, { color: widget.color }]} numberOfLines={1}>
        {widget.value}
      </Text>
      {widget.sub ? <Text style={styles.sub}>{widget.sub}</Text> : null}
    </Animated.View>
  );

  if (!interactive) {
    return inner;
  }

  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => {
        setHovered(true);
        spring(1, -2);
      }}
      onHoverOut={() => {
        setHovered(false);
        spring(1, 0);
      }}
      onPressIn={() => spring(0.97, 0)}
      onPressOut={() => spring(1, hovered ? -2 : 0)}
      accessibilityRole="button"
      accessibilityLabel={`${widget.label} ${widget.value}`}
    >
      {inner}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 16 },
  scroll: { paddingHorizontal: 20, gap: 10 },
  card: {
    width: 140,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: premium.border,
    ...premium.shadow,
  },
  cardHover: {
    borderColor: '#C7D2FE',
    ...premium.shadowLg,
  },
  label: { fontSize: 11, color: premium.textMuted, marginTop: 8, fontWeight: '600' },
  value: { fontSize: 18, fontWeight: '800', marginTop: 4 },
  sub: { fontSize: 10, color: premium.textMuted },
});
