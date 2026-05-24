import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { adminAPI } from '../../services/api';

type Overview = {
  users: {
    total: number;
    ativos: number;
    inativos: number;
    conversao_pct: number;
    novos_24h: number;
    novos_7d: number;
    novos_30d: number;
    crescimento_30d_pct: number;
  };
  acessos: {
    ativos_24h: number;
    ativos_7d: number;
    ativos_30d: number;
    sessoes_7d: number;
  };
  empresas: { total: number; novas_30d: number };
  guias: {
    total: number;
    pagas: number;
    vencidas: number;
    a_vencer: number;
    novas_30d: number;
    valor_em_aberto: number;
    valor_pago: number;
  };
  notificacoes: {
    total: number;
    sucesso: number;
    erro: number;
    ultimos_24h: number;
    ultimos_7d: number;
    taxa_sucesso_pct: number;
  };
  graficos: {
    users_por_mes: { label: string; total: number }[];
    guias_por_mes: { label: string; total: number }[];
    acessos_por_dia: { label: string; total: number }[];
  };
  top_contadores: { user_id: string; name: string; email: string; total: number; empresas: number }[];
  ultimos_cadastros: { user_id: string; name: string; email: string; created_at?: string }[];
  generated_at: string;
};

const fmtBRL = (n: number) =>
  Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });

const fmtNumber = (n: number) =>
  Number(n || 0).toLocaleString('pt-BR');

const fmtRelative = (iso?: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min} min atrás`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h atrás`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days} d atrás`;
  return d.toLocaleDateString('pt-BR');
};

export default function AdminOverview() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  const load = useCallback(async () => {
    try {
      setErr(null);
      const r = await adminAPI.overview();
      setData(r.data);
    } catch (e: any) {
      setErr(e?.response?.data?.detail || 'Erro ao carregar métricas.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }
  if (!data) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{err || 'Sem dados.'}</Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />
      }
    >
      {/* HERO */}
      <View style={styles.hero}>
        <View style={{ flex: 1 }}>
          <Text style={styles.heroKicker}>PAINEL DO DONO · GUIACONTROL</Text>
          <Text style={styles.heroTitle}>Visão geral do negócio</Text>
          <Text style={styles.heroSub}>
            {data.users.total} contadores · {data.empresas.total} empresas atendidas · {fmtBRL(data.guias.valor_pago + data.guias.valor_em_aberto)} sob gestão
          </Text>
        </View>
        <View style={styles.heroBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.heroBadgeTxt}>Tempo real</Text>
        </View>
      </View>

      {err ? <Text style={styles.errorBanner}>{err}</Text> : null}

      {/* KPIs principais */}
      <View style={styles.grid}>
        <KPI
          icon="people"
          tint="#10B981"
          label="Contadores"
          value={fmtNumber(data.users.total)}
          delta={data.users.crescimento_30d_pct}
          hint={`${data.users.novos_30d} novos em 30d`}
        />
        <KPI
          icon="flash"
          tint="#0EA5E9"
          label="Ativos (24h)"
          value={fmtNumber(data.acessos.ativos_24h)}
          hint={`${data.acessos.ativos_7d} nos últimos 7d · ${data.acessos.ativos_30d} em 30d`}
        />
        <KPI
          icon="trending-up"
          tint="#8B5CF6"
          label="Conversão"
          value={`${data.users.conversao_pct}%`}
          hint={`${data.users.ativos} ativos / ${data.users.inativos} inativos`}
        />
        <KPI
          icon="cash"
          tint="#F59E0B"
          label="Sob gestão"
          value={fmtBRL(data.guias.valor_em_aberto + data.guias.valor_pago)}
          hint={`${fmtBRL(data.guias.valor_em_aberto)} em aberto`}
        />
      </View>

      {/* Linha 2: Acessos / Notificações */}
      <View style={styles.row2}>
        {/* ACESSOS */}
        <Card style={{ flex: 1, minWidth: 320 }}>
          <CardHeader icon="pulse" tint="#0EA5E9" title="Acessos por dia (14 dias)" />
          <BarChart
            data={data.graficos.acessos_por_dia}
            color="#0EA5E9"
            empty="Sem acessos registrados ainda."
          />
          <View style={styles.miniRow}>
            <Mini label="Hoje" value={data.acessos.ativos_24h} color="#0EA5E9" />
            <Mini label="Sessões 7d" value={data.acessos.sessoes_7d} color="#10B981" />
            <Mini label="Ativos 30d" value={data.acessos.ativos_30d} color="#8B5CF6" />
          </View>
        </Card>

        {/* NOTIFICAÇÕES */}
        <Card style={{ flex: 1, minWidth: 320 }}>
          <CardHeader icon="logo-whatsapp" tint="#10B981" title="Notificações WhatsApp" />
          <View style={styles.successCircle}>
            <Text style={styles.successPct}>{data.notificacoes.taxa_sucesso_pct}%</Text>
            <Text style={styles.successLbl}>taxa de sucesso</Text>
          </View>
          <View style={styles.miniRow}>
            <Mini label="Total" value={data.notificacoes.total} color="#0F172A" />
            <Mini label="Sucesso" value={data.notificacoes.sucesso} color="#10B981" />
            <Mini label="Falhas" value={data.notificacoes.erro} color="#EF4444" />
          </View>
          <Pressable style={styles.cardLink} onPress={() => router.push('/admin/logs')}>
            <Text style={styles.cardLinkTxt}>Ver logs detalhados</Text>
            <Ionicons name="arrow-forward" size={12} color="#0EA5E9" />
          </Pressable>
        </Card>
      </View>

      {/* Linha 3: Crescimento */}
      <View style={styles.row2}>
        <Card style={{ flex: 1, minWidth: 320 }}>
          <CardHeader icon="people" tint="#10B981" title="Cadastros de contadores (6 meses)" />
          <BarChart
            data={data.graficos.users_por_mes}
            color="#10B981"
            empty="Nenhum cadastro nos últimos 6 meses."
          />
        </Card>
        <Card style={{ flex: 1, minWidth: 320 }}>
          <CardHeader icon="document-text" tint="#8B5CF6" title="Guias geradas (6 meses)" />
          <BarChart
            data={data.graficos.guias_por_mes}
            color="#8B5CF6"
            empty="Nenhuma guia gerada ainda."
          />
        </Card>
      </View>

      {/* Linha 4: Top contadores + últimos cadastros */}
      <View style={styles.row2}>
        <Card style={{ flex: 1, minWidth: 320 }}>
          <CardHeader icon="trophy" tint="#F59E0B" title="Top contadores por uso" />
          {data.top_contadores.length === 0 ? (
            <Text style={styles.muted}>Ainda não há ranking.</Text>
          ) : (
            data.top_contadores.map((t, i) => (
              <Pressable
                key={t.user_id}
                style={styles.topRow}
                onPress={() => router.push('/admin/users')}
              >
                <View style={[styles.rank, i < 3 && styles.rankPodium]}>
                  <Text style={[styles.rankTxt, i < 3 && { color: '#92400E' }]}>{i + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.topName}>{t.name}</Text>
                  <Text style={styles.topEmail}>{t.email}</Text>
                </View>
                <View style={styles.topMeta}>
                  <Text style={styles.topVal}>{fmtNumber(t.total)}</Text>
                  <Text style={styles.topLbl}>guias · {t.empresas} emp.</Text>
                </View>
              </Pressable>
            ))
          )}
        </Card>

        <Card style={{ flex: 1, minWidth: 320 }}>
          <CardHeader icon="time" tint="#0EA5E9" title="Últimos cadastros" />
          {data.ultimos_cadastros.length === 0 ? (
            <Text style={styles.muted}>Nenhum cadastro recente.</Text>
          ) : (
            data.ultimos_cadastros.map((u) => (
              <Pressable
                key={u.user_id}
                style={styles.lastRow}
                onPress={() => router.push('/admin/users')}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarTxt}>
                    {(u.name || u.email || '?').slice(0, 1).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.topName}>{u.name || '—'}</Text>
                  <Text style={styles.topEmail}>{u.email}</Text>
                </View>
                <Text style={styles.relative}>{fmtRelative(u.created_at)}</Text>
              </Pressable>
            ))
          )}
          <Pressable style={styles.cardLink} onPress={() => router.push('/admin/users')}>
            <Text style={styles.cardLinkTxt}>Ver todos os contadores</Text>
            <Ionicons name="arrow-forward" size={12} color="#0EA5E9" />
          </Pressable>
        </Card>
      </View>

      {/* Linha 5: Status guias */}
      <Card>
        <CardHeader icon="document-text" tint="#0F172A" title="Status das guias do sistema" />
        <View style={styles.statusGrid}>
          <StatusCard label="Pagas" value={data.guias.pagas} color="#10B981" valor={fmtBRL(data.guias.valor_pago)} />
          <StatusCard label="A vencer" value={data.guias.a_vencer} color="#F59E0B" />
          <StatusCard label="Vencidas" value={data.guias.vencidas} color="#EF4444" />
          <StatusCard label="Total" value={data.guias.total} color="#0F172A" hint={`+${data.guias.novas_30d} em 30d`} />
        </View>
      </Card>

      <Text style={styles.footnote}>
        Atualizado em {new Date(data.generated_at).toLocaleString('pt-BR')} · Puxe pra atualizar
      </Text>
    </ScrollView>
  );
}

// ============== Componentes auxiliares ==============

function Card({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

function CardHeader({
  icon,
  tint,
  title,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  title: string;
}) {
  return (
    <View style={styles.cardHeader}>
      <View style={[styles.cardIcon, { backgroundColor: tint + '15' }]}>
        <Ionicons name={icon} size={14} color={tint} />
      </View>
      <Text style={styles.cardTitle}>{title}</Text>
    </View>
  );
}

function KPI({
  icon,
  tint,
  label,
  value,
  hint,
  delta,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  label: string;
  value: string;
  hint: string;
  delta?: number;
}) {
  const positive = (delta ?? 0) >= 0;
  return (
    <View style={styles.kpi}>
      <View style={[styles.kpiIcon, { backgroundColor: tint + '15' }]}>
        <Ionicons name={icon} size={18} color={tint} />
      </View>
      <Text style={styles.kpiLabel}>{label}</Text>
      <View style={styles.kpiRow}>
        <Text style={styles.kpiValue}>{value}</Text>
        {typeof delta === 'number' ? (
          <View style={[styles.delta, positive ? styles.deltaUp : styles.deltaDown]}>
            <Ionicons
              name={positive ? 'trending-up' : 'trending-down'}
              size={11}
              color={positive ? '#047857' : '#991B1B'}
            />
            <Text style={[styles.deltaTxt, positive ? { color: '#047857' } : { color: '#991B1B' }]}>
              {positive ? '+' : ''}
              {delta}%
            </Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.kpiHint}>{hint}</Text>
    </View>
  );
}

function Mini({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.mini}>
      <Text style={[styles.miniValue, { color }]}>{fmtNumber(value)}</Text>
      <Text style={styles.miniLabel}>{label}</Text>
    </View>
  );
}

function StatusCard({
  label,
  value,
  color,
  valor,
  hint,
}: {
  label: string;
  value: number;
  color: string;
  valor?: string;
  hint?: string;
}) {
  return (
    <View style={[styles.statusCard, { borderColor: color + '30' }]}>
      <Text style={styles.statusLabel}>{label}</Text>
      <Text style={[styles.statusValue, { color }]}>{fmtNumber(value)}</Text>
      {valor ? <Text style={styles.statusHint}>{valor}</Text> : null}
      {hint ? <Text style={styles.statusHint}>{hint}</Text> : null}
    </View>
  );
}

function BarChart({
  data,
  color,
  empty,
}: {
  data: { label: string; total: number }[];
  color: string;
  empty: string;
}) {
  const max = useMemo(() => Math.max(1, ...data.map((d) => d.total)), [data]);
  if (!data || data.length === 0) {
    return <Text style={styles.muted}>{empty}</Text>;
  }
  return (
    <View style={styles.chart}>
      {data.map((d, i) => {
        const h = Math.max(4, (d.total / max) * 90);
        return (
          <View key={`${d.label}-${i}`} style={styles.bar}>
            <Text style={styles.barValue}>{d.total}</Text>
            <View style={[styles.barFill, { height: h, backgroundColor: color }]} />
            <Text style={styles.barLabel}>{d.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 18, gap: 16, paddingBottom: 80 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC' },
  error: { color: '#991B1B', fontWeight: '700' },
  errorBanner: {
    backgroundColor: '#FEF2F2',
    color: '#991B1B',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
  },

  // HERO
  hero: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    padding: 20,
    backgroundColor: '#0A1F1A',
    borderRadius: 16,
    flexWrap: 'wrap',
  },
  heroKicker: { color: '#10B981', fontSize: 11, fontWeight: '800', letterSpacing: 2 },
  heroTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', marginTop: 4 },
  heroSub: { color: '#A7F3D0', fontSize: 12.5, marginTop: 4 },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: 'rgba(16,185,129,0.15)',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.4)',
  },
  liveDot: { width: 7, height: 7, borderRadius: 999, backgroundColor: '#10B981' },
  heroBadgeTxt: { color: '#A7F3D0', fontSize: 11, fontWeight: '800' },

  // KPI grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  kpi: {
    flexBasis: 220,
    flexGrow: 1,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  kpiIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  kpiLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  kpiRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  kpiValue: { color: '#0F172A', fontSize: 24, fontWeight: '800' },
  kpiHint: { color: '#94A3B8', fontSize: 12 },
  delta: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 },
  deltaUp: { backgroundColor: '#ECFDF5' },
  deltaDown: { backgroundColor: '#FEF2F2' },
  deltaTxt: { fontSize: 11, fontWeight: '800' },

  // Cards
  row2: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    gap: 12,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { color: '#0F172A', fontSize: 14, fontWeight: '800' },
  cardLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  cardLinkTxt: { color: '#0EA5E9', fontSize: 12, fontWeight: '700' },

  miniRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  mini: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    minWidth: 90,
  },
  miniValue: { fontSize: 16, fontWeight: '800' },
  miniLabel: { fontSize: 10.5, color: '#64748B', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },

  // Success circle
  successCircle: {
    alignSelf: 'center',
    width: 130,
    height: 130,
    borderRadius: 999,
    borderWidth: 8,
    borderColor: '#A7F3D0',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 6,
  },
  successPct: { fontSize: 26, fontWeight: '900', color: '#047857' },
  successLbl: { fontSize: 10.5, color: '#047857', fontWeight: '700', textTransform: 'uppercase' },

  // Bar chart
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    minHeight: 130,
    paddingTop: 10,
  },
  bar: { flex: 1, alignItems: 'center', gap: 4, minWidth: 24 },
  barFill: { width: '70%', borderTopLeftRadius: 6, borderTopRightRadius: 6, minHeight: 4 },
  barLabel: { fontSize: 9.5, color: '#64748B', fontWeight: '700' },
  barValue: { fontSize: 10, color: '#0F172A', fontWeight: '700' },

  // Lists
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  rank: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankPodium: { backgroundColor: '#FEF3C7' },
  rankTxt: { fontSize: 11, fontWeight: '800', color: '#475569' },
  topName: { color: '#0F172A', fontSize: 13, fontWeight: '700' },
  topEmail: { color: '#64748B', fontSize: 11 },
  topMeta: { alignItems: 'flex-end' },
  topVal: { color: '#0F172A', fontSize: 13, fontWeight: '800' },
  topLbl: { color: '#94A3B8', fontSize: 10.5 },

  lastRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#0F766E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTxt: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  relative: { color: '#64748B', fontSize: 11, fontWeight: '700' },

  // Status grid
  statusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statusCard: {
    flexBasis: 130,
    flexGrow: 1,
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
  },
  statusLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusValue: { fontSize: 22, fontWeight: '800', marginTop: 2 },
  statusHint: { color: '#94A3B8', fontSize: 11, marginTop: 2 },

  muted: { color: '#94A3B8', fontSize: 12.5, paddingVertical: 16, textAlign: 'center' },
  footnote: { color: '#94A3B8', fontSize: 11, textAlign: 'center' },
});
