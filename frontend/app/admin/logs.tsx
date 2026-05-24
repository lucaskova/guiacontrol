import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { adminAPI } from '../../services/api';

type Log = {
  user_id: string;
  empresa_id?: string;
  guia_id?: string;
  canal: string;
  destinatario: string;
  mensagem: string;
  sucesso: boolean;
  detalhes?: any;
  created_at?: string;
  owner_name?: string;
  owner_email?: string;
};

const FILTERS: { key: 'all' | 'ok' | 'err'; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'ok', label: 'Sucesso' },
  { key: 'err', label: 'Falhas' },
];

export default function AdminLogs() {
  const [items, setItems] = useState<Log[]>([]);
  const [filter, setFilter] = useState<'all' | 'ok' | 'err'>('all');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { limit: 200 };
      if (filter === 'ok') params.sucesso = true;
      if (filter === 'err') params.sucesso = false;
      const r = await adminAPI.listLogsWhatsapp(params);
      setItems(r.data?.items ?? []);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <Text style={styles.h1}>Logs WhatsApp</Text>
        <View style={styles.filters}>
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <Pressable key={f.key} style={[styles.filter, active && styles.filterActive]} onPress={() => setFilter(f.key)}>
                <Text style={[styles.filterTxt, active && styles.filterTxtActive]}>{f.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color="#10B981" style={{ marginTop: 30 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {items.length === 0 ? (
            <Text style={styles.empty}>Nenhum log encontrado.</Text>
          ) : (
            items.map((l, i) => (
              <View key={i} style={[styles.row, !l.sucesso && styles.rowError]}>
                <View style={[styles.iconBox, { backgroundColor: l.sucesso ? '#ECFDF5' : '#FEF2F2' }]}>
                  <Ionicons
                    name={l.sucesso ? 'checkmark-circle' : 'close-circle'}
                    size={16}
                    color={l.sucesso ? '#047857' : '#991B1B'}
                  />
                </View>
                <View style={{ flex: 1, minWidth: 240 }}>
                  <Text style={styles.dest}>
                    Para {l.destinatario || '—'} · {l.owner_name || 'contador'}
                  </Text>
                  <Text style={styles.msg} numberOfLines={3}>
                    {l.mensagem}
                  </Text>
                  <Text style={styles.meta}>
                    {l.created_at ? new Date(l.created_at).toLocaleString('pt-BR') : ''}
                    {l.detalhes?.erro ? `  ·  Erro: ${l.detalhes.erro}` : ''}
                  </Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  headerBar: { padding: 18, gap: 10 },
  h1: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
  filters: { flexDirection: 'row', gap: 6 },
  filter: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0' },
  filterActive: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
  filterTxt: { color: '#475569', fontWeight: '700', fontSize: 12 },
  filterTxtActive: { color: '#047857' },
  list: { padding: 18, gap: 8, paddingBottom: 80 },
  empty: { color: '#64748B', textAlign: 'center', padding: 30 },
  row: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  rowError: { borderColor: '#FECACA', backgroundColor: '#FFF5F5' },
  iconBox: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  dest: { fontSize: 12.5, fontWeight: '800', color: '#0F172A' },
  msg: { fontSize: 12, color: '#475569', marginTop: 2 },
  meta: { fontSize: 11, color: '#94A3B8', marginTop: 4 },
});
