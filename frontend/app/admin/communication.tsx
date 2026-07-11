import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { communicationAPI } from '../../services/api';

type Dash = {
  success_rate?: number;
  queue?: { backend?: string; queued?: number; delayed?: number; processing?: number };
  events_by_status?: Record<string, number>;
  logs_by_status?: Record<string, { count?: number; avg_latency_ms?: number }>;
  recent_logs?: Array<{
    id?: string;
    status?: string;
    phone?: string;
    template?: string;
    error?: string;
    created_at?: string;
    latency_ms?: number;
  }>;
};

function Metric({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      {hint ? <Text style={styles.metricHint}>{hint}</Text> : null}
    </View>
  );
}

export default function AdminCommunication() {
  const [data, setData] = useState<Dash | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await communicationAPI.dashboardAdmin();
      setData(r.data);
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || 'Falha ao carregar dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#10B981" size="large" />
      </View>
    );
  }

  const q = data?.queue || {};
  const logs = data?.logs_by_status || {};
  const events = data?.events_by_status || {};

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Central de Comunicação</Text>
          <Text style={styles.sub}>Fila · eventos · templates · APIBrasil (transporte)</Text>
        </View>
        <Pressable style={styles.refresh} onPress={load}>
          <Ionicons name="refresh" size={16} color="#047857" />
          <Text style={styles.refreshText}>Atualizar</Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.grid}>
        <Metric label="Taxa de sucesso" value={`${data?.success_rate ?? 0}%`} />
        <Metric label="Fila" value={q.queued ?? 0} hint={`backend: ${q.backend || '-'}`} />
        <Metric label="Delayed" value={q.delayed ?? 0} />
        <Metric label="Processing" value={q.processing ?? 0} />
        <Metric label="Enviadas" value={logs.sent?.count ?? 0} />
        <Metric label="Falhas" value={logs.failed?.count ?? 0} />
        <Metric label="Canceladas" value={logs.cancelled?.count ?? 0} />
        <Metric label="Eventos pending" value={events.pending ?? 0} />
      </View>

      <Text style={styles.section}>Logs recentes</Text>
      {(data?.recent_logs || []).slice(0, 40).map((log, i) => (
        <View key={log.id || String(i)} style={styles.row}>
          <View style={[styles.dot, { backgroundColor: log.status === 'sent' ? '#10B981' : log.status === 'failed' ? '#EF4444' : '#94A3B8' }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>
              {(log.status || '—').toUpperCase()} · {log.phone || 'sem telefone'}
            </Text>
            <Text style={styles.rowMeta}>
              {log.template || 'sem template'}
              {log.latency_ms != null ? ` · ${Math.round(log.latency_ms)}ms` : ''}
              {log.error ? ` · ${log.error}` : ''}
            </Text>
          </View>
        </View>
      ))}
      {!data?.recent_logs?.length ? <Text style={styles.empty}>Nenhum log ainda.</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 18, paddingBottom: 40, gap: 10 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
  sub: { fontSize: 12.5, color: '#64748B', marginTop: 2 },
  refresh: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  refreshText: { color: '#047857', fontWeight: '700', fontSize: 12.5 },
  error: { color: '#B91C1C', backgroundColor: '#FEF2F2', padding: 10, borderRadius: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metric: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  metricLabel: { color: '#64748B', fontSize: 12, fontWeight: '600' },
  metricValue: { color: '#0F172A', fontSize: 22, fontWeight: '800', marginTop: 4 },
  metricHint: { color: '#94A3B8', fontSize: 11, marginTop: 2 },
  section: { marginTop: 14, marginBottom: 4, fontSize: 14, fontWeight: '800', color: '#0F172A' },
  row: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dot: { width: 8, height: 8, borderRadius: 99, marginTop: 6 },
  rowTitle: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  rowMeta: { fontSize: 12, color: '#64748B', marginTop: 2 },
  empty: { color: '#94A3B8', fontSize: 13 },
});
