import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { guiasAPI } from '../services/api';
import { useToast } from '../contexts/ToastContext';

export default function EditarGuiaScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { showToast } = useToast();
  const guiaId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    tipo: '',
    descricao: '',
    valor: '',
    data_vencimento: '',
    codigo_barras: '',
    qr_code_pix: '',
    competencia: '',
    observacoes: '',
  });

  useEffect(() => { loadGuia(); }, []);

  const loadGuia = async () => {
    try {
      const response = await guiasAPI.obter(guiaId);
      const g = response.data;
      setForm({
        tipo: g.tipo || '',
        descricao: g.descricao || '',
        valor: g.valor ? String(g.valor) : '',
        data_vencimento: g.data_vencimento || '',
        codigo_barras: g.codigo_barras || '',
        qr_code_pix: g.qr_code_pix || '',
        competencia: g.competencia || '',
        observacoes: g.observacoes || '',
      });
    } catch (error) {
      showToast('Erro ao carregar guia', 'error');
      router.back();
    } finally { setLoading(false); }
  };

  const handleSave = async () => {
    if (!form.valor.trim()) {
      showToast('Valor é obrigatório', 'error');
      return;
    }
    if (!form.data_vencimento.trim()) {
      showToast('Data de vencimento é obrigatória', 'error');
      return;
    }

    setSaving(true);
    try {
      const data: any = { ...form };
      data.valor = parseFloat(form.valor.replace(',', '.'));
      if (isNaN(data.valor)) {
        showToast('Valor inválido', 'error');
        setSaving(false);
        return;
      }
      await guiasAPI.atualizar(guiaId, data);
      showToast('Guia atualizada com sucesso!', 'success');
      router.back();
    } catch (error) {
      showToast('Erro ao salvar guia', 'error');
    } finally { setSaving(false); }
  };

  if (loading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#1E40AF" /></View>;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Editar Guia</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>DADOS DA GUIA</Text>

            <Text style={styles.label}>Tipo</Text>
            <TextInput style={styles.input} value={form.tipo} onChangeText={(t) => setForm({...form, tipo: t})} placeholder="DAS, GA, DARF..." />

            <Text style={styles.label}>Descrição</Text>
            <TextInput style={styles.input} value={form.descricao} onChangeText={(t) => setForm({...form, descricao: t})} placeholder="Descrição da guia" />

            <Text style={styles.label}>Competência</Text>
            <TextInput style={styles.input} value={form.competencia} onChangeText={(t) => setForm({...form, competencia: t})} placeholder="MM/AAAA" />
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>VALORES E DATAS</Text>

            <Text style={styles.label}>Valor (R$) *</Text>
            <TextInput style={styles.input} value={form.valor} onChangeText={(t) => setForm({...form, valor: t})} placeholder="0.00" keyboardType="decimal-pad" />

            <Text style={styles.label}>Data de Vencimento *</Text>
            <TextInput style={styles.input} value={form.data_vencimento} onChangeText={(t) => setForm({...form, data_vencimento: t})} placeholder="DD/MM/AAAA" />
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>CÓDIGOS DE PAGAMENTO</Text>

            <Text style={styles.label}>Código de Barras</Text>
            <TextInput style={[styles.input, styles.monoInput]} value={form.codigo_barras} onChangeText={(t) => setForm({...form, codigo_barras: t})} placeholder="Código de barras" multiline />

            <Text style={styles.label}>PIX Copia e Cola</Text>
            <TextInput style={[styles.input, styles.monoInput]} value={form.qr_code_pix} onChangeText={(t) => setForm({...form, qr_code_pix: t})} placeholder="Código PIX" multiline />
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>OBSERVAÇÕES</Text>
            <TextInput style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]} value={form.observacoes} onChangeText={(t) => setForm({...form, observacoes: t})} placeholder="Observações adicionais" multiline />
          </View>

          <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#FFF" /> : <><Ionicons name="checkmark" size={20} color="#FFF" /><Text style={styles.saveBtnText}>Salvar Alterações</Text></>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F3F4F6' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  backBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: '#6B7280', letterSpacing: 0.5, marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 8 },
  input: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#111827' },
  monoInput: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 12 },
  saveBtn: { backgroundColor: '#1E40AF', borderRadius: 12, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8 },
  saveBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
