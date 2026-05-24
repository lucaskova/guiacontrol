import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { empresasAPI } from '../../services/api';
import { formatCNPJ } from '../../utils/formatters';
import { useRouter } from 'expo-router';
import { useToast } from '../../contexts/ToastContext';
import { ConfirmModal } from '../../components/ConfirmModal';
import { useFocusEffect } from '@react-navigation/native';

export default function EmpresasScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);

  const loadEmpresas = async () => {
    try {
      const response = await empresasAPI.listar();
      setEmpresas(response.data);
    } catch (error) {
      console.error('Erro ao carregar empresas:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { loadEmpresas(); }, []));
  const onRefresh = () => { setRefreshing(true); loadEmpresas(); };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await empresasAPI.deletar(deleteTarget.empresa_id);
      const guiasMsg = res.data.guias_removidas > 0
        ? ` (${res.data.guias_removidas} guia(s) removida(s))`
        : '';
      showToast(`Empresa excluída${guiasMsg}`, 'success');
      setDeleteTarget(null);
      loadEmpresas();
    } catch (error) {
      showToast('Erro ao excluir empresa', 'error');
    } finally { setDeleting(false); }
  };

  const filteredEmpresas = empresas.filter((e) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (e.razao_social || '').toLowerCase().includes(q) ||
      (e.nome_fantasia || '').toLowerCase().includes(q) ||
      (e.cnpj || '').includes(q.replace(/\D/g, ''))
    );
  });

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#1E40AF" /></View>;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Empresas</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/adicionar-empresa')}>
          <Ionicons name="add" size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color="#9CA3AF" />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por nome ou CNPJ..."
          placeholderTextColor="#9CA3AF"
          value={search}
          onChangeText={setSearch}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1E40AF" />}
      >
        {filteredEmpresas.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="business-outline" size={48} color="#D1D5DB" />
            <Text style={styles.emptyText}>
              {search ? 'Nenhuma empresa encontrada' : 'Nenhuma empresa cadastrada'}
            </Text>
          </View>
        ) : (
          filteredEmpresas.map((empresa) => (
            <View key={empresa.empresa_id} style={styles.card}>
              <TouchableOpacity style={styles.cardMain} onPress={() => router.push(`/editar-empresa?id=${empresa.empresa_id}`)}>
                <View style={styles.cardIcon}>
                  <Ionicons name="business" size={22} color="#1E40AF" />
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardName} numberOfLines={1}>
                    {empresa.nome_fantasia || empresa.razao_social}
                  </Text>
                  <Text style={styles.cardCnpj}>{formatCNPJ(empresa.cnpj)}</Text>
                  {empresa.email ? (
                    <Text style={styles.cardContact} numberOfLines={1}>
                      <Ionicons name="mail-outline" size={11} color="#6B7280" /> {empresa.email}
                    </Text>
                  ) : null}
                </View>
              </TouchableOpacity>
              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => router.push(`/editar-empresa?id=${empresa.empresa_id}`)}
                >
                  <Ionicons name="create-outline" size={18} color="#1E40AF" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionBtnDanger]}
                  onPress={() => setDeleteTarget(empresa)}
                >
                  <Ionicons name="trash-outline" size={18} color="#DC2626" />
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
        title="Excluir Empresa"
        message={`Deseja excluir "${deleteTarget?.razao_social || deleteTarget?.nome_fantasia}"? Todas as guias vinculadas serão removidas.`}
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
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F3F4F6' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#111827' },
  addBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#1E40AF', alignItems: 'center', justifyContent: 'center' },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', marginHorizontal: 16, marginTop: 12, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: '#E5E7EB', gap: 8 },
  searchInput: { flex: 1, fontSize: 15, color: '#111827', padding: 0 },
  list: { flex: 1 },
  listContent: { padding: 16, paddingTop: 8, paddingBottom: 110 },
  emptyBox: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 15, color: '#9CA3AF', fontWeight: '500' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 14, marginBottom: 10, borderWidth: 1, borderColor: '#F3F4F6', overflow: 'hidden' },
  cardMain: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  cardIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  cardCnpj: { fontSize: 13, color: '#6B7280', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', marginTop: 2 },
  cardContact: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  cardActions: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  actionBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  actionBtnDanger: { borderLeftWidth: 1, borderLeftColor: '#F3F4F6' },
});
