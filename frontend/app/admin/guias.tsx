import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { adminAPI } from '../../services/api';

type Row = {
  guia_id: string;
  tipo: string;
  descricao?: string;
  valor: number;
  status: 'paga' | 'a_vencer' | 'vencida' | string;
  data_vencimento: string;
  data_pagamento?: string | null;
  user_id: string;
  empresa_id: string;
  owner_name?: string;
  owner_email?: string;
  empresa_nome?: string;
  empresa_cnpj?: string;
};

const FILTERS: { key: string; label: string; color: string }[] = [
  { key: '', label: 'Todas', color: '#0F172A' },
  { key: 'a_vencer', label: 'A vencer', color: '#F59E0B' },
  { key: 'vencida', label: 'Vencidas', color: '#EF4444' },
  { key: 'paga', label: 'Pagas', color: '#10B981' },
];

const fmtBRL = (n: number) =>
  Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtDate = (s: string) => {
  if (!s) return '—';
  const [y, m, d] = s.split('T')[0].split('-');
  return `${d}/${m}/${y}`;
};

const STATUS_STYLE: Record<string, { bg: string; fg: string; label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  paga: { bg: '#ECFDF5', fg: '#047857', label: 'Paga', icon: 'checkmark-circle' },
  a_vencer: { bg: '#FFFBEB', fg: '#B45309', label: 'A vencer', icon: 'time' },
  vencida: { bg: '#FEF2F2', fg: '#991B1B', label: 'Vencida', icon: 'alert-circle' },
};

export default function AdminGuias() {
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await adminAPI.listGuias(status ? { status } : undefined);
      setRows(r.data?.items ?? []);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <Text style={styles.h1}>Guias (auditoria global)</Text>
        <View style={styles.filtersRow}>
          {FILTERS.map((f) => {
            const active = status === f.key;
            return (
              <Pressable
                key={f.key || 'all'}
                style={[styles.filter, active && { backgroundColor: f.color + '15', borderColor: f.color }]}
                onPress={() => setStatus(f.key)}
              >
                <Text style={[styles.filterTxt, active && { color: f.color }]}>{f.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color="#10B981" style={{ marginTop: 30 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {rows.length === 0 ? (
            <Text style={styles.empty}>Nenhuma guia encontrada para o filtro atual.</Text>
          ) : (
            rows.map((g) => {
              const st = STATUS_STYLE[g.status] || STATUS_STYLE.a_vencer;
              return (
                <View key={g.guia_id} style={styles.row}>
                  <View style={[styles.statusBox, { backgroundColor: st.bg }]}>
                    <Ionicons name={st.icon} size={14} color={st.fg} />
                  </View>
                  <View style={{ flex: 1, minWidth: 220 }}>
                    <Text style={styles.title}>
                      {g.tipo} · {g.empresa_nome || 'Empresa removida'}
                    </Text>
                    <Text style={styles.sub}>
                      Vencimento {fmtDate(g.data_vencimento)} · {g.descricao || 'sem descrição'}
                    </Text>
                    <Text style={styles.sub}>
                      Contador: {g.owner_name || '—'}
                      {g.owner_email ? `  ·  ${g.owner_email}` : ''}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', minWidth: 130 }}>
                    <Text style={styles.value}>{fmtBRL(g.valor)}</Text>
                    <View style={[styles.statusPill, { backgroundColor: st.bg }]}>
                      <Text style={[styles.statusTxt, { color: st.fg }]}>{st.label}</Text>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  headerBar: { padding: 18, gap: 12 },
  h1: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
  filtersRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  filter: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterTxt: { fontSize: 12, fontWeight: '700', color: '#475569' },
  list: { padding: 18, gap: 10, paddingBottom: 80 },
  empty: { color: '#64748B', textAlign: 'center', padding: 30 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexWrap: 'wrap',
  },
  statusBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 13.5, fontWeight: '800', color: '#0F172A' },
  sub: { fontSize: 11.5, color: '#64748B', marginTop: 2 },
  value: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  statusPill: {
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  statusTxt: { fontSize: 10.5, fontWeight: '800', textTransform: 'uppercase' },
});
