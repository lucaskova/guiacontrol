import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { adminAPI } from '../../services/api';
import { formatCNPJ } from '../../utils/formatters';

type Row = {
  empresa_id: string;
  cnpj: string;
  razao_social: string;
  nome_fantasia?: string | null;
  whatsapp?: string | null;
  telefone?: string | null;
  email?: string | null;
  user_id: string;
  owner_name?: string;
  owner_email?: string;
  created_at?: string;
};

export default function AdminEmpresas() {
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await adminAPI.listEmpresas(search ? { search } : undefined);
      setRows(r.data?.items ?? []);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <Text style={styles.h1}>Empresas (todas)</Text>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={14} color="#64748B" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Razão, fantasia, CNPJ"
            placeholderTextColor="#94A3B8"
            style={styles.searchInput}
            onSubmitEditing={load}
          />
          {search ? (
            <Pressable onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color="#94A3B8" />
            </Pressable>
          ) : null}
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color="#10B981" style={{ marginTop: 30 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {rows.length === 0 ? (
            <Text style={styles.empty}>Nenhuma empresa encontrada.</Text>
          ) : (
            rows.map((e) => (
              <View key={e.empresa_id} style={styles.row}>
                <View style={styles.iconBox}>
                  <Ionicons name="business" size={16} color="#0EA5E9" />
                </View>
                <View style={{ flex: 1, minWidth: 240 }}>
                  <Text style={styles.name}>{e.nome_fantasia || e.razao_social}</Text>
                  <Text style={styles.sub}>{e.razao_social} · CNPJ {formatCNPJ(e.cnpj || '')}</Text>
                  <View style={styles.metaRow}>
                    {e.email ? <Pill icon="mail" text={e.email} /> : null}
                    {(e.whatsapp || e.telefone) ? (
                      <Pill icon="logo-whatsapp" text={e.whatsapp || e.telefone || ''} color="#10B981" />
                    ) : null}
                  </View>
                </View>
                <View style={styles.owner}>
                  <Text style={styles.ownerLbl}>Contador</Text>
                  <Text style={styles.ownerName}>{e.owner_name || '—'}</Text>
                  <Text style={styles.ownerEmail}>{e.owner_email || ''}</Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

function Pill({ icon, text, color = '#475569' }: { icon: keyof typeof Ionicons.glyphMap; text: string; color?: string }) {
  return (
    <View style={[styles.pill, { borderColor: color + '30' }]}>
      <Ionicons name={icon} size={11} color={color} />
      <Text style={[styles.pillTxt, { color }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
    gap: 14,
    flexWrap: 'wrap',
  },
  h1: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    minWidth: 280,
  },
  searchInput: { flex: 1, color: '#0F172A', fontSize: 13 },
  list: { padding: 18, gap: 10, paddingBottom: 80 },
  empty: { color: '#64748B', textAlign: 'center', padding: 30 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexWrap: 'wrap',
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#0EA5E915',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontSize: 14.5, fontWeight: '800', color: '#0F172A' },
  sub: { fontSize: 12, color: '#64748B', marginTop: 2 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
  },
  pillTxt: { fontSize: 11, fontWeight: '700' },
  owner: {
    paddingLeft: 12,
    borderLeftWidth: 1,
    borderLeftColor: '#E2E8F0',
    minWidth: 180,
  },
  ownerLbl: { color: '#94A3B8', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  ownerName: { color: '#0F172A', fontSize: 13, fontWeight: '700', marginTop: 2 },
  ownerEmail: { color: '#64748B', fontSize: 11.5 },
});
