import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Platform, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatCurrency } from '../../utils/formatters';
import { premium } from '../../theme/premium';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

type Pend = {
  vencidas: { count: number; valor: number };
  hoje: { count: number; valor: number };
  aguardando: { count: number; valor: number };
  concluidas: { count: number; valor: number };
};

type PendKey = keyof Pend;

type Column = {
  key: PendKey;
  label: string;
  filterKey: string;
  icon: IoniconName;
  color: string;
  bg: string;
  hint: string;
};

const COLS: Column[] = [
  {
    key: 'vencidas',
    label: 'Vencidas',
    filterKey: 'vencida',
    icon: 'alert-circle',
    color: premium.status.vencida.main,
    bg: premium.status.vencida.bg,
    hint: 'risco de multa',
  },
  {
    key: 'hoje',
    label: 'Vencem hoje',
    filterKey: 'hoje',
    icon: 'flame',
    color: '#EA580C',
    bg: '#FFF7ED',
    hint: 'prioridade do dia',
  },
  {
    key: 'aguardando',
    label: 'Aguardando',
    filterKey: 'a_vencer',
    icon: 'time',
    color: premium.status.a_vencer.main,
    bg: premium.status.a_vencer.bg,
    hint: 'a vencer',
  },
  {
    key: 'concluidas',
    label: 'Concluídas',
    filterKey: 'paga',
    icon: 'checkmark-done',
    color: premium.status.paga.main,
    bg: premium.status.paga.bg,
    hint: 'no escopo do mês',
  },
];

export function PendenciasSection({
  pendencias,
  onFilter,
}: {
  pendencias: Pend;
  onFilter?: (key: string) => void;
}) {
  const total =
    (pendencias?.vencidas?.count ?? 0) +
    (pendencias?.hoje?.count ?? 0) +
    (pendencias?.aguardando?.count ?? 0);

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <View>
          <Text style={styles.title}>Central de pendências</Text>
          <Text style={styles.sub}>
            Visão operacional · {total} item{total === 1 ? '' : 's'} em aberto
          </Text>
        </View>
        <View style={styles.statusPill}>
          <View style={styles.dot} />
          <Text style={styles.statusText}>Sincronizado agora</Text>
        </View>
      </View>
      <View style={styles.grid}>
        {COLS.map((col) => {
          const data = pendencias[col.key] || { count: 0, valor: 0 };
          return (
            <PendCard
              key={col.key}
              col={col}
              count={data.count}
              valor={data.valor}
              onPress={() => onFilter?.(col.filterKey)}
            />
          );
        })}
      </View>
    </View>
  );
}

type PendCardProps = {
  col: Column;
  count: number;
  valor: number;
  onPress?: () => void;
};

function PendCard({ col, count, valor, onPress }: PendCardProps) {
  const [hovered, setHovered] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  const spring = (s: number, y: number) => {
    Animated.parallel([
      Animated.spring(scale, { toValue: s, useNativeDriver: true, friction: 6 }),
      Animated.spring(translateY, { toValue: y, useNativeDriver: true, friction: 6 }),
    ]).start();
  };

  const isWeb = Platform.OS === 'web';
  const webStyle: ViewStyle | undefined = isWeb
    ? ({
        // @ts-expect-error web-only
        cursor: onPress ? 'pointer' : 'default',
        transition: 'box-shadow 220ms ease, transform 220ms ease, border-color 220ms ease',
      } as ViewStyle)
    : undefined;

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
      onPressIn={() => spring(0.98, 0)}
      onPressOut={() => spring(1, hovered ? -2 : 0)}
      style={styles.cell}
    >
      <Animated.View
        style={[
          styles.card,
          { transform: [{ translateY }, { scale }] },
          webStyle,
          { borderLeftColor: col.color },
          hovered && {
            borderColor: col.color,
            ...Platform.select({
              web: { boxShadow: `0 12px 28px ${col.color}1F` } as any,
              default: {
                shadowColor: col.color,
                shadowOpacity: 0.18,
                shadowRadius: 16,
                shadowOffset: { width: 0, height: 8 },
                elevation: 6,
              },
            }),
          },
        ]}
      >
        <View style={styles.cardTop}>
          <View style={[styles.iconWrap, { backgroundColor: col.bg }]}>
            <Ionicons name={col.icon} size={14} color={col.color} />
          </View>
          <Ionicons
            name="arrow-forward"
            size={12}
            color={hovered ? col.color : '#94A3B8'}
          />
        </View>
        <Text style={styles.label}>{col.label}</Text>
        <Text style={[styles.count, { color: col.color }]}>{count}</Text>
        <Text style={styles.valor}>{formatCurrency(valor || 0)}</Text>
        <Text style={styles.hint}>{col.hint}</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20, paddingTop: 22 },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: { fontSize: 16, fontWeight: '800', color: premium.text, letterSpacing: -0.3 },
  sub: { fontSize: 11.5, color: premium.textMuted, marginTop: 2 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981' },
  statusText: { fontSize: 10, fontWeight: '800', color: '#047857', letterSpacing: 0.3 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 },
  cell: { width: '50%', paddingHorizontal: 5, paddingVertical: 5 },
  card: {
    backgroundColor: premium.surface,
    borderRadius: 13,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: premium.border,
    borderLeftWidth: 3,
    minHeight: 116,
    ...Platform.select({
      web: { boxShadow: '0 1px 2px rgba(15, 23, 42, 0.03)' } as any,
      default: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 3,
        elevation: 1,
      },
    }),
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 11, color: premium.textMuted, fontWeight: '700', marginTop: 8, letterSpacing: 0.2, textTransform: 'uppercase' },
  count: { fontSize: 24, fontWeight: '800', marginTop: 2, letterSpacing: -0.6 },
  valor: { fontSize: 12, color: premium.text, fontWeight: '700', marginTop: 1 },
  hint: { fontSize: 10.5, color: premium.textMuted, marginTop: 2, fontStyle: 'italic' },
});
