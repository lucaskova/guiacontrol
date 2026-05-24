import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { guiasAPI, empresasAPI } from '../../services/api';
import { formatCurrency } from '../../utils/formatters';
import { GuiaCard } from '../../components/GuiaCard';
import { premium } from '../../theme/premium';
import { useRouter } from 'expo-router';
import { useToast } from '../../contexts/ToastContext';
import { ConfirmModal } from '../../components/ConfirmModal';
import { useFocusEffect } from '@react-navigation/native';

const statusFilters = [
  { key: '', label: 'Todas', icon: 'list', color: '#6B7280' },
  { key: 'a_vencer', label: 'Pendentes', icon: 'time', color: '#D97706' },
  { key: 'vencida', label: 'Vencidas', icon: 'alert-circle', color: '#DC2626' },
  { key: 'paga', label: 'Pagas', icon: 'checkmark-circle', color: '#059669' },
];

/** Janela de vencimento (API: vence_em). Exclui pagas no backend. */
const horizonFilters = [
  { key: '', label: 'Qualquer prazo', icon: 'calendar-outline', color: '#6B7280' },
  { key: 'hoje', label: 'Hoje', icon: 'alarm-outline', color: '#B45309' },
  { key: '7', label: '7 dias', icon: 'hourglass-outline', color: '#1E40AF' },
  { key: '30', label: '30 dias', icon: 'calendar-outline', color: '#4338CA' },
];

export default function GuiasScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const [guias, setGuias] = useState<any[]>([]);
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [horizonFilter, setHorizonFilter] = useState('');
  const [empresaFilter, setEmpresaFilter] = useState('');
  const [sortAsc, setSortAsc] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      if (empresaFilter) params.empresa_id = empresaFilter;
      if (horizonFilter) params.vence_em = horizonFilter;

      const [guiasRes, empRes] = await Promise.all([
        guiasAPI.listar(params),
        empresasAPI.listar(),
      ]);
      setGuias(guiasRes.data);
      setEmpresas(empRes.data);
    } catch (error) {
      console.error('Erro:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, empresaFilter, horizonFilter]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData]),
  );

  const selectStatusFilter = (key: string) => {
    setStatusFilter(key);
    if (key === 'vencida' || key === 'paga') setHorizonFilter('');
  };

  const selectHorizonFilter = (key: string) => {
    setHorizonFilter(key);
    if (key && (statusFilter === 'vencida' || statusFilter === 'paga')) {
      setStatusFilter('');
    }
  };
  const onRefresh = () => { setRefreshing(true); loadData(); };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await guiasAPI.deletar(deleteTarget.guia_id);
      showToast('Guia excluída com sucesso', 'success');
      setDeleteTarget(null);
      loadData();
    } catch (error) {
      showToast('Erro ao excluir guia', 'error');
    } finally { setDeleting(false); }
  };

  const getEmpresaNome = (empresaId: string) => {
    const emp = empresas.find((e) => e.empresa_id === empresaId);
    return emp ? (emp.nome_fantasia || emp.razao_social) : '';
  };

  const sortedGuias = [...guias].sort((a, b) => {
    const dateA = a.data_vencimento || '';
    const dateB = b.data_vencimento || '';
    return sortAsc ? dateA.localeCompare(dateB) : dateB.localeCompare(dateA);
  });

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#1E40AF" /></View>;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={styles.headerTitle}>Guias</Text>
          <Text style={styles.headerSub}>
            Foque por vencimento ou por empresa. Lista completa pode ser grande — use os atalhos de prazo.
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.importBtn}
            onPress={() => router.push('/importar-guias')}
          >
            <Ionicons name="sparkles" size={18} color="#4F46E5" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/nova-guia')}>
            <Ionicons name="add" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Prazo de vencimento */}
      <View style={styles.sectionLabelRow}>
        <Text style={styles.sectionLabel}>Vencimento</Text>
        {horizonFilter ? (
          <Text style={styles.sectionHint}>só não pagas nesta janela</Text>
        ) : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterContent}>
        {horizonFilters.map((f) => (
          <TouchableOpacity
            key={f.key || 'all-h'}
            style={[styles.filterPill, horizonFilter === f.key && { backgroundColor: f.color }]}
            onPress={() => selectHorizonFilter(f.key)}
          >
            <Ionicons name={f.icon as any} size={14} color={horizonFilter === f.key ? '#FFFFFF' : f.color} />
            <Text style={[styles.filterText, horizonFilter === f.key && { color: '#FFFFFF' }]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Status */}
      <View style={styles.sectionLabelRow}>
        <Text style={styles.sectionLabel}>Status</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterContent}>
        {statusFilters.map((f) => (
          <TouchableOpacity
            key={f.key || 'all-s'}
            style={[styles.filterPill, statusFilter === f.key && { backgroundColor: f.color }]}
            onPress={() => selectStatusFilter(f.key)}
          >
            <Ionicons name={f.icon as any} size={14} color={statusFilter === f.key ? '#FFFFFF' : f.color} />
            <Text style={[styles.filterText, statusFilter === f.key && { color: '#FFFFFF' }]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Empresa Filter + Sort */}
      <View style={styles.sectionLabelRow}>
        <Text style={styles.sectionLabel}>Empresa</Text>
      </View>
      <View style={styles.subFilterRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
          <TouchableOpacity
            style={[styles.empresaPill, !empresaFilter && styles.empresaPillActive]}
            onPress={() => setEmpresaFilter('')}
          >
            <Text style={[styles.empresaPillText, !empresaFilter && styles.empresaPillTextActive]}>Todas</Text>
          </TouchableOpacity>
          {empresas.map((e) => (
            <TouchableOpacity
              key={e.empresa_id}
              style={[styles.empresaPill, empresaFilter === e.empresa_id && styles.empresaPillActive]}
              onPress={() => setEmpresaFilter(e.empresa_id)}
            >
              <Text
                style={[styles.empresaPillText, empresaFilter === e.empresa_id && styles.empresaPillTextActive]}
                numberOfLines={1}
              >
                {e.nome_fantasia || e.razao_social}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TouchableOpacity style={styles.sortBtn} onPress={() => setSortAsc(!sortAsc)}>
          <Ionicons name={sortAsc ? 'arrow-up' : 'arrow-down'} size={16} color="#1E40AF" />
          <Text style={styles.sortText}>Venc.</Text>
        </TouchableOpacity>
      </View>

      {sortedGuias.length > 0 ? (
        <Text style={styles.resultCount}>{sortedGuias.length} guia(s) nesta seleção</Text>
      ) : null}

      {/* Lista */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1E40AF" />}
      >
        {sortedGuias.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="document-text-outline" size={48} color="#D1D5DB" />
            <Text style={styles.emptyText}>Nenhuma guia encontrada</Text>
          </View>
        ) : (
          sortedGuias.map((guia) => (
            <View key={guia.guia_id}>
              <GuiaCard
                guia={guia}
                empresaNome={getEmpresaNome(guia.empresa_id)}
                onPress={() => router.push(`/guia-detalhes?id=${guia.guia_id}`)}
              />
              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={styles.cardActionBtn}
                  onPress={() => router.push(`/editar-guia?id=${guia.guia_id}`)}
                >
                  <Ionicons name="create-outline" size={16} color={premium.primary} />
                  <Text style={styles.cardActionText}>Editar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.cardActionBtn} onPress={() => setDeleteTarget(guia)}>
                  <Ionicons name="trash-outline" size={16} color={premium.status.vencida.main} />
                  <Text style={[styles.cardActionText, { color: premium.status.vencida.main }]}>Excluir</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Modal de exclusão */}
      <ConfirmModal
        visible={!!deleteTarget}
        title="Excluir Guia"
        message={`Excluir ${deleteTarget?.tipo || 'guia'} de ${formatCurrency(deleteTarget?.valor || 0)}?`}
        confirmText="Excluir"
        type="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: premium.bg },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: -4,
    marginBottom: 12,
    paddingRight: 4,
  },
  cardActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
  cardActionText: { fontSize: 12, fontWeight: '600', color: premium.primary },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F3F4F6' },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#111827' },
  headerSub: { fontSize: 12, color: '#6B7280', marginTop: 4, lineHeight: 17, maxWidth: 280 },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 4,
    backgroundColor: '#FFFFFF',
  },
  sectionLabel: { fontSize: 11, fontWeight: '800', color: '#9CA3AF', letterSpacing: 0.6 },
  sectionHint: { fontSize: 10, color: '#D97706', fontWeight: '600' },
  resultCount: { fontSize: 12, fontWeight: '600', color: '#6B7280', paddingHorizontal: 20, paddingBottom: 6, backgroundColor: '#FFFFFF' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  importBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  addBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#1E40AF', alignItems: 'center', justifyContent: 'center' },
  filterRow: { backgroundColor: '#FFFFFF', maxHeight: 48 },
  filterContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  filterPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F3F4F6', gap: 6, marginRight: 8 },
  filterText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  subFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    paddingBottom: 10,
    gap: 8,
    backgroundColor: '#FFFFFF',
  },
  empresaPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#FFFFFF', marginRight: 6, borderWidth: 1, borderColor: '#E5E7EB' },
  empresaPillActive: { backgroundColor: '#1E40AF', borderColor: '#1E40AF' },
  empresaPillText: { fontSize: 12, fontWeight: '600', color: '#6B7280', maxWidth: 120 },
  empresaPillTextActive: { color: '#FFFFFF' },
  sortBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, gap: 4 },
  sortText: { fontSize: 12, fontWeight: '600', color: '#1E40AF' },
  list: { flex: 1 },
  listContent: { padding: 16, paddingTop: 4, paddingBottom: 110 },
  emptyBox: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 15, color: '#9CA3AF', fontWeight: '500' },
});
