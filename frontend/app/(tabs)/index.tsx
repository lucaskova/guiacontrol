import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Platform,
  Pressable,
  Animated,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { DashboardCard } from '../../components/DashboardCard';
import { GuiaCard } from '../../components/GuiaCard';
import { dashboardAPI, guiasAPI } from '../../services/api';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { formatCurrency } from '../../utils/formatters';
import { premium } from '../../theme/premium';
import { DashboardSkeleton } from '../../components/premium/Skeleton';
import { AlertCenter } from '../../components/premium/AlertCenter';
import { PendenciasSection } from '../../components/premium/PendenciasSection';
import { MetricWidgets, MetricWidgetKey } from '../../components/premium/MetricWidgets';
import { StatusChart, MonthlyChart } from '../../components/premium/MiniCharts';
import { QuickActionsCenter } from '../../components/premium/QuickActionsCenter';
import { ClientInsights } from '../../components/premium/ClientInsights';
import { StickyHeader } from '../../components/premium/StickyHeader';
import { CommandPalette } from '../../components/premium/CommandPalette';

export default function HomeScreen() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [insights, setInsights] = useState<any>(null);
  const [guiasUrgentes, setGuiasUrgentes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [statsRes, insightsRes, vencidasRes, aVencerRes] = await Promise.all([
        dashboardAPI.getStats(),
        dashboardAPI.getInsights().catch(() => ({ data: null })),
        guiasAPI.listar({ status: 'vencida' }),
        guiasAPI.listar({ status: 'a_vencer' }),
      ]);
      setStats(statsRes.data);
      setInsights(insightsRes.data);
      setGuiasUrgentes([...vencidasRes.data, ...aVencerRes.data].slice(0, 5));
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const goGuias = (status?: string) => {
    router.push(status ? `/(tabs)/guias?status=${status}` as any : '/(tabs)/guias');
  };

  const handleMetricPress = (key: MetricWidgetKey) => {
    switch (key) {
      case 'aberto':
        goGuias();
        break;
      case 'vencidas':
        goGuias('vencida');
        break;
      case 'pagas':
        goGuias('paga');
        break;
      case 'prox':
        goGuias('a_vencer');
        break;
      case 'atraso':
        router.push('/(tabs)/empresas' as any);
        break;
      case 'recup':
      case 'eco':
        goGuias('paga');
        break;
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <DashboardSkeleton />
      </SafeAreaView>
    );
  }

  const widgets = insights?.widgets || {};
  const totalPendente = widgets.total_aberto ?? (stats?.valor_total_a_vencer || 0) + (stats?.valor_total_vencido || 0);
  const temVencidas = (stats?.guias_vencidas || 0) > 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StickyHeader
        userName={user?.name}
        notificationsBadge={temVencidas}
        onOpenSearch={() => setSearchOpen(true)}
        onOpenNotifications={() => goGuias('vencida')}
      />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 110 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={premium.primary} />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Olá, {user?.name?.split(' ')[0]}</Text>
            <Text style={styles.greetingSub}>Central inteligente de automação fiscal</Text>
          </View>
          <View style={styles.headerLivePill}>
            <View style={styles.headerLiveDot} />
            <Text style={styles.headerLiveText}>Operação em tempo real</Text>
          </View>
        </View>

        {temVencidas && (
          <TouchableOpacity style={styles.alertBanner} onPress={() => goGuias('vencida')}>
            <Ionicons name="warning" size={18} color={premium.status.vencida.main} />
            <View style={{ flex: 1 }}>
              <Text style={styles.alertTitle}>
                {stats?.guias_vencidas} guia(s) vencida(s)
              </Text>
              <Text style={styles.alertSub}>Reduza multas com ação imediata</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={premium.status.vencida.main} />
          </TouchableOpacity>
        )}

        <BalanceCard
          totalPendente={totalPendente}
          guiasVencidas={stats?.guias_vencidas || 0}
          guiasAVencer={stats?.guias_a_vencer || 0}
          guiasPagas={stats?.guias_pagas || 0}
          onPress={() => goGuias()}
          onPressVencidas={() => goGuias('vencida')}
          onPressAVencer={() => goGuias('a_vencer')}
          onPressPagas={() => goGuias('paga')}
        />

        <QuickActionsCenter
          vencendoCount={stats?.guias_vencidas || 0}
          tagline={insights?.automation_tagline}
        />

        <MetricWidgets widgets={widgets} onPressItem={handleMetricPress} />

        <AlertCenter alerts={insights?.alerts || []} onPress={() => goGuias()} />


        {insights?.pendencias && (
          <PendenciasSection pendencias={insights.pendencias} onFilter={(s) => goGuias(s)} />
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Resumo financeiro</Text>
          <DashboardCard
            title="Vencidas"
            count={stats?.guias_vencidas || 0}
            value={stats?.valor_total_vencido || 0}
            icon="alert-circle-outline"
            color={premium.status.vencida.main}
          />
          <DashboardCard
            title="A vencer"
            count={stats?.guias_a_vencer || 0}
            value={stats?.valor_total_a_vencer || 0}
            icon="time-outline"
            color={premium.status.a_vencer.main}
          />
          <DashboardCard
            title="Pagas"
            count={stats?.guias_pagas || 0}
            value={stats?.valor_total_pago || 0}
            icon="checkmark-circle-outline"
            color={premium.status.paga.main}
          />
        </View>

        {insights?.chart_status?.length ? (
          <View style={styles.section}>
            <StatusChart data={insights.chart_status} />
            {insights.chart_monthly?.length ? (
              <MonthlyChart data={insights.chart_monthly} />
            ) : null}
          </View>
        ) : null}

        {insights?.empresas_insights && <ClientInsights insights={insights.empresas_insights} />}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={{ flex: 1 }}>
              <View style={styles.priorityTitleRow}>
                <Text style={styles.sectionTitleCompact}>Prioridade agora</Text>
                <View style={styles.automationPulse}>
                  <View style={styles.automationPulseDot} />
                  <Text style={styles.automationPulseText}>IA monitorando</Text>
                </View>
              </View>
              <Text style={styles.prioritySub}>
                Fluxo automático de cobrança, vencimento e comprovação
              </Text>
            </View>
            <TouchableOpacity onPress={() => goGuias()}>
              <Text style={styles.seeAll}>Ver todas</Text>
            </TouchableOpacity>
          </View>
          {guiasUrgentes.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="checkmark-circle" size={48} color={premium.status.paga.main} />
              <Text style={styles.emptyTitle}>Tudo em dia</Text>
              <Text style={styles.emptyText}>Automação mantendo o escritório organizado</Text>
            </View>
          ) : (
            guiasUrgentes.map((guia) => (
              <GuiaCard
                key={guia.guia_id}
                guia={guia}
                showTimeline
                onPress={() => router.push(`/guia-detalhes?id=${guia.guia_id}`)}
              />
            ))
          )}
        </View>

        <View style={styles.trustFooter}>
          <Text style={styles.versionText}>GuiaControl — Central de automação fiscal</Text>
        </View>
      </ScrollView>
      <CommandPalette visible={searchOpen} onClose={() => setSearchOpen(false)} />
    </SafeAreaView>
  );
}

type BalanceCardProps = {
  totalPendente: number;
  guiasVencidas: number;
  guiasAVencer: number;
  guiasPagas: number;
  onPress: () => void;
  onPressVencidas: () => void;
  onPressAVencer: () => void;
  onPressPagas: () => void;
};

function BalanceCard({
  totalPendente,
  guiasVencidas,
  guiasAVencer,
  guiasPagas,
  onPress,
  onPressVencidas,
  onPressAVencer,
  onPressPagas,
}: BalanceCardProps) {
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
  const webStyle: ViewStyle | undefined = isWeb
    ? ({
        // @ts-expect-error web-only style props
        cursor: 'pointer',
        transition: 'box-shadow 180ms ease, transform 180ms ease',
      } as ViewStyle)
    : undefined;

  const stopPropagation = (e: any) => {
    if (e?.stopPropagation) e.stopPropagation();
  };

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
      onPressIn={() => spring(0.985, 0)}
      onPressOut={() => spring(1, hovered ? -2 : 0)}
      accessibilityRole="button"
      accessibilityLabel="Total em aberto. Toque para ver todas as guias."
    >
      <Animated.View
        style={[
          styles.balanceCard,
          webStyle,
          hovered && styles.balanceCardHover,
          { transform: [{ translateY }, { scale }] },
        ]}
      >
        <View style={styles.balanceTop}>
          <Text style={styles.balanceLabel}>Total em aberto</Text>
          <View style={styles.balanceTopRight}>
            <View style={styles.secureBadge}>
              <Ionicons name="sparkles" size={11} color="#E0E7FF" />
              <Text style={styles.secureText}>IA ativa</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#E0E7FF" />
          </View>
        </View>
        <Text style={styles.balanceValue}>{formatCurrency(totalPendente)}</Text>
        <View style={styles.balanceStats}>
          <Pressable
            onPress={(e) => {
              stopPropagation(e);
              onPressVencidas();
            }}
            style={({ hovered: h }: any) => [styles.bStat, h && styles.bStatHover, isWeb && (styles.bStatWeb as any)]}
            accessibilityRole="button"
            accessibilityLabel={`${guiasVencidas} guias vencidas`}
          >
            <View style={[styles.sDot, { backgroundColor: '#FCA5A5' }]} />
            <Text style={styles.bStatText}>{guiasVencidas} vencidas</Text>
          </Pressable>
          <Pressable
            onPress={(e) => {
              stopPropagation(e);
              onPressAVencer();
            }}
            style={({ hovered: h }: any) => [styles.bStat, h && styles.bStatHover, isWeb && (styles.bStatWeb as any)]}
            accessibilityRole="button"
            accessibilityLabel={`${guiasAVencer} guias a vencer`}
          >
            <View style={[styles.sDot, { backgroundColor: '#FCD34D' }]} />
            <Text style={styles.bStatText}>{guiasAVencer} a vencer</Text>
          </Pressable>
          <Pressable
            onPress={(e) => {
              stopPropagation(e);
              onPressPagas();
            }}
            style={({ hovered: h }: any) => [styles.bStat, h && styles.bStatHover, isWeb && (styles.bStatWeb as any)]}
            accessibilityRole="button"
            accessibilityLabel={`${guiasPagas} guias pagas`}
          >
            <View style={[styles.sDot, { backgroundColor: '#6EE7B7' }]} />
            <Text style={styles.bStatText}>{guiasPagas} pagas</Text>
          </Pressable>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: premium.colors.bg },
  scrollView: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: premium.surface,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: premium.border,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  brandRow: { flexDirection: 'row', alignItems: 'center' },
  brandIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: premium.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  brandName: { fontSize: 20, fontWeight: '800', color: premium.text, letterSpacing: -0.5 },
  brandTag: { fontSize: 11, color: premium.textMuted, fontWeight: '600' },
  notifButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: premium.status.vencida.main,
  },
  greeting: { fontSize: 17, fontWeight: '800', color: premium.text, letterSpacing: -0.3 },
  greetingSub: { fontSize: 12, color: premium.textMuted, marginTop: 2 },
  headerLivePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  headerLiveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981' },
  headerLiveText: { fontSize: 10.5, color: '#047857', fontWeight: '800', letterSpacing: 0.2 },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: premium.status.vencida.bg,
    marginHorizontal: 20,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  alertTitle: { fontSize: 13, fontWeight: '700', color: premium.status.vencida.main },
  alertSub: { fontSize: 11.5, color: '#991B1B', marginTop: 1 },
  balanceCard: {
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 16,
    backgroundColor: premium.primary,
    ...premium.shadowLg,
  },
  balanceCardHover: {
    backgroundColor: '#4F46E5',
  },
  balanceTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  balanceTopRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  balanceLabel: { fontSize: 12, color: '#E0E7FF', fontWeight: '500' },
  secureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 4,
  },
  secureText: { fontSize: 10, color: '#E0E7FF', fontWeight: '600' },
  balanceValue: { fontSize: 26, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.6, marginBottom: 10 },
  balanceStats: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  bStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  bStatHover: { backgroundColor: 'rgba(255,255,255,0.18)' },
  bStatWeb: { cursor: 'pointer', transition: 'background-color 160ms ease' },
  sDot: { width: 7, height: 7, borderRadius: 4 },
  bStatText: { fontSize: 11.5, color: '#E0E7FF', fontWeight: '500' },
  section: { paddingHorizontal: 20, paddingTop: 18 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: premium.text, marginBottom: 14 },
  sectionTitleCompact: { fontSize: 16, fontWeight: '800', color: premium.text, letterSpacing: -0.3 },
  priorityTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  prioritySub: { fontSize: 11.5, color: premium.textMuted, marginTop: 2 },
  automationPulse: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EEF2FF',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  automationPulseDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: premium.primary },
  automationPulseText: { fontSize: 10, fontWeight: '800', color: premium.primary, letterSpacing: 0.2 },
  seeAll: { fontSize: 13, color: premium.primary, fontWeight: '700', marginBottom: 14 },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 28,
    backgroundColor: premium.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: premium.border,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: premium.status.paga.main, marginTop: 10 },
  emptyText: { fontSize: 13, color: premium.textMuted, marginTop: 4 },
  trustFooter: { alignItems: 'center', paddingVertical: 28, paddingBottom: 40 },
  versionText: { fontSize: 11, color: premium.textMuted },
});
