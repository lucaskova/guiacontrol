import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Platform,
  useWindowDimensions,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { premium } from '../../theme/premium';
import { useToast } from '../../contexts/ToastContext';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

type QuickActionId =
  | 'upload'
  | 'ocr'
  | 'empresas'
  | 'vencendo'
  | 'automacao'
  | 'lembretes'
  | 'pagamentos'
  | 'relatorios';

type QuickAction = {
  id: QuickActionId;
  title: string;
  description: string;
  icon: IoniconName;
  iconBg: string;
  iconColor: string;
  badge?: string;
  badgeColor?: string;
};

const ACTIONS: QuickAction[] = [
  {
    id: 'upload',
    title: 'Upload de guia',
    description: 'Cadastrar manualmente',
    icon: 'cloud-upload-outline',
    iconBg: '#EEF2FF',
    iconColor: '#4F46E5',
  },
  {
    id: 'ocr',
    title: 'OCR IA',
    description: 'Leitura inteligente em lote',
    icon: 'sparkles-outline',
    iconBg: '#F5F3FF',
    iconColor: '#7C3AED',
    badge: 'IA',
    badgeColor: '#7C3AED',
  },
  {
    id: 'empresas',
    title: 'Empresas',
    description: 'Gerenciar clientes',
    icon: 'business-outline',
    iconBg: '#ECFEFF',
    iconColor: '#0891B2',
  },
  {
    id: 'vencendo',
    title: 'Guias vencendo',
    description: 'Atenção imediata',
    icon: 'alarm-outline',
    iconBg: '#FFF1F2',
    iconColor: '#E11D48',
  },
  {
    id: 'automacao',
    title: 'Automação',
    description: 'Fluxos e disparos',
    icon: 'flash-outline',
    iconBg: '#ECFDF5',
    iconColor: '#059669',
  },
  {
    id: 'lembretes',
    title: 'Lembretes',
    description: 'Alertas e notificações',
    icon: 'notifications-outline',
    iconBg: '#FFFBEB',
    iconColor: '#D97706',
  },
  {
    id: 'pagamentos',
    title: 'Pagamentos',
    description: 'Conciliar e dar baixa',
    icon: 'card-outline',
    iconBg: '#F0FDF4',
    iconColor: '#16A34A',
  },
  {
    id: 'relatorios',
    title: 'Relatórios',
    description: 'Visão analítica',
    icon: 'stats-chart-outline',
    iconBg: '#EFF6FF',
    iconColor: '#2563EB',
    badge: 'Em breve',
    badgeColor: '#64748B',
  },
];

type QuickActionsCenterProps = {
  vencendoCount?: number;
  tagline?: string;
};

export function QuickActionsCenter({ vencendoCount, tagline }: QuickActionsCenterProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const { width } = useWindowDimensions();

  const columns = useMemo(() => {
    if (width >= 1100) return 4;
    if (width >= 760) return 4;
    if (width >= 520) return 3;
    return 2;
  }, [width]);

  const handlePress = (id: QuickActionId) => {
    switch (id) {
      case 'upload':
        router.push('/nova-guia');
        return;
      case 'ocr':
        router.push('/importar-guias');
        return;
      case 'empresas':
        router.push('/(tabs)/empresas');
        return;
      case 'vencendo':
        router.push('/(tabs)/guias?status=vencida' as any);
        return;
      case 'automacao':
        router.push('/(tabs)/notificacoes');
        return;
      case 'lembretes':
        router.push('/(tabs)/notificacoes');
        return;
      case 'pagamentos':
        router.push('/(tabs)/guias?status=paga' as any);
        return;
      case 'relatorios':
        showToast('Relatórios em breve no GuiaControl', 'info');
        return;
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerBadge}>
            <Ionicons name="flash" size={12} color={premium.primary} />
            <Text style={styles.headerBadgeText}>Central de ações</Text>
          </View>
          <Text style={styles.headerTitle}>O que você quer fazer agora?</Text>
          {tagline ? (
            <Text style={styles.headerSub} numberOfLines={1}>
              {tagline}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.grid}>
        {ACTIONS.map((action) => {
          const showCount = action.id === 'vencendo' && (vencendoCount || 0) > 0;
          return (
            <ActionCard
              key={action.id}
              action={action}
              widthPct={`${100 / columns}%`}
              countBadge={showCount ? String(vencendoCount) : undefined}
              onPress={() => handlePress(action.id)}
            />
          );
        })}
      </View>
    </View>
  );
}

type ActionCardProps = {
  action: QuickAction;
  widthPct: string;
  countBadge?: string;
  onPress: () => void;
};

function ActionCard({ action, widthPct, countBadge, onPress }: ActionCardProps) {
  const [hovered, setHovered] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  const spring = (toScale: number, toY: number) => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: toScale,
        useNativeDriver: true,
        speed: 40,
        bounciness: 4,
      }),
      Animated.spring(translateY, {
        toValue: toY,
        useNativeDriver: true,
        speed: 40,
        bounciness: 4,
      }),
    ]).start();
  };

  const isWeb = Platform.OS === 'web';

  const cardWebStyle: ViewStyle | undefined = isWeb
    ? ({
        transition:
          'transform 220ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 220ms cubic-bezier(0.4, 0, 0.2, 1), border-color 220ms ease',
        cursor: 'pointer',
      } as unknown as ViewStyle)
    : undefined;

  return (
    <View style={[styles.cell, { width: widthPct as any }]}>
      <Pressable
        onPress={onPress}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        onPressIn={() => spring(0.97, 0)}
        onPressOut={() => spring(1, hovered ? -2 : 0)}
        accessibilityRole="button"
        accessibilityLabel={`${action.title} — ${action.description}`}
      >
        <Animated.View
          style={[
            styles.card,
            cardWebStyle,
            hovered && styles.cardHover,
            { transform: [{ translateY }, { scale }] },
          ]}
        >
          <View style={styles.cardTop}>
            <View
              style={[
                styles.iconWrap,
                { backgroundColor: action.iconBg },
                hovered && styles.iconWrapHover,
              ]}
            >
              <Ionicons name={action.icon} size={16} color={action.iconColor} />
            </View>
            <View style={styles.badges}>
              {countBadge ? (
                <View style={[styles.miniBadge, styles.countBadge]}>
                  <Text style={styles.countBadgeText}>{countBadge}</Text>
                </View>
              ) : null}
              {action.badge ? (
                <View
                  style={[
                    styles.miniBadge,
                    { backgroundColor: `${action.badgeColor || '#64748B'}1A` },
                  ]}
                >
                  <Text style={[styles.miniBadgeText, { color: action.badgeColor || '#64748B' }]}>
                    {action.badge}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          <Text style={styles.title} numberOfLines={1}>
            {action.title}
          </Text>
          <Text style={styles.description} numberOfLines={2}>
            {action.description}
          </Text>

          <View style={styles.footer}>
            <Text
              style={[
                styles.footerLabel,
                hovered && { color: action.iconColor },
              ]}
            >
              Abrir
            </Text>
            <Ionicons
              name="arrow-forward"
              size={12}
              color={hovered ? action.iconColor : '#94A3B8'}
            />
          </View>
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 20,
    marginTop: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerLeft: { flex: 1 },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 6,
  },
  headerBadgeText: { fontSize: 10.5, fontWeight: '800', color: premium.primary, letterSpacing: 0.2 },
  headerTitle: { fontSize: 16, fontWeight: '800', color: premium.text, letterSpacing: -0.3 },
  headerSub: { fontSize: 12, color: premium.textMuted, marginTop: 2 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  cell: {
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  card: {
    backgroundColor: premium.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: premium.border,
    minHeight: 96,
    justifyContent: 'space-between',
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
  cardHover: {
    borderColor: '#C7D2FE',
    backgroundColor: '#FAFBFF',
    ...Platform.select({
      web: { boxShadow: '0 10px 24px rgba(79, 70, 229, 0.12)' } as any,
      default: {
        shadowColor: '#4F46E5',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.1,
        shadowRadius: 14,
        elevation: 5,
      },
    }),
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: { transition: 'transform 220ms ease, background-color 220ms ease' } as any,
      default: {},
    }),
  },
  iconWrapHover: {
    transform: [{ scale: 1.08 }],
  },
  badges: { flexDirection: 'row', gap: 5, alignItems: 'center' },
  miniBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 999,
  },
  miniBadgeText: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.2 },
  countBadge: { backgroundColor: '#FEE2E2' },
  countBadgeText: { fontSize: 9.5, fontWeight: '800', color: '#B91C1C', letterSpacing: 0.2 },
  title: {
    fontSize: 12.5,
    fontWeight: '700',
    color: premium.text,
    letterSpacing: -0.15,
  },
  description: {
    fontSize: 10.5,
    color: premium.textMuted,
    marginTop: 2,
    lineHeight: 13.5,
  },
  footer: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    ...Platform.select({
      web: { transition: 'color 220ms ease' } as any,
      default: {},
    }),
  },
});
