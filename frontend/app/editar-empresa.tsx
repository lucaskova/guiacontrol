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
  Switch,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { empresasAPI } from '../services/api';
import { useToast } from '../contexts/ToastContext';

export default function EditarEmpresaScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { showToast } = useToast();
  const empresaId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [portalToken, setPortalToken] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [form, setForm] = useState({
    razao_social: '',
    nome_fantasia: '',
    email: '',
    telefone: '',
    whatsapp: '',
    notificacoes_ativas: true,
    notificacoes_whatsapp: true,
    notificacoes_email: true,
  });

  useEffect(() => { loadEmpresa(); }, []);

  const loadEmpresa = async () => {
    try {
      const response = await empresasAPI.obter(empresaId);
      const emp = response.data;
      setPortalToken(emp.portal_token || null);
      setForm({
        razao_social: emp.razao_social || '',
        nome_fantasia: emp.nome_fantasia || '',
        email: emp.email || '',
        telefone: emp.telefone || '',
        whatsapp: emp.whatsapp || '',
        notificacoes_ativas: emp.notificacoes_ativas !== false,
        notificacoes_whatsapp: emp.notificacoes_whatsapp !== false,
        notificacoes_email: emp.notificacoes_email !== false,
      });
    } catch (error) {
      showToast('Erro ao carregar empresa', 'error');
      router.back();
    } finally { setLoading(false); }
  };

  const webAppBase = (() => {
    const fromEnv = process.env.EXPO_PUBLIC_WEB_APP_URL?.replace(/\/$/, '');
    if (fromEnv) return fromEnv;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return `${window.location.origin}`;
    }
    return '';
  })();

  const linkCliente =
    portalToken && webAppBase ? `${webAppBase}/cliente/${encodeURIComponent(portalToken)}` : '';

  const handleCopyLink = async () => {
    if (!linkCliente) {
      showToast(
        'Defina EXPO_PUBLIC_WEB_APP_URL no .env (URL do app) ou abra pelo navegador para copiar o link.',
        'error',
      );
      return;
    }
    await Clipboard.setStringAsync(linkCliente);
    showToast('Link copiado!', 'success');
  };

  const handleRegenerarLink = async () => {
    setRegenerating(true);
    try {
      const res = await empresasAPI.regenerarPortalToken(empresaId);
      setPortalToken(res.data.portal_token);
      showToast('Novo link gerado. Copie e envie de novo ao cliente.', 'success');
    } catch {
      showToast('Erro ao gerar novo link', 'error');
    } finally {
      setRegenerating(false);
    }
  };

  const handleSave = async () => {
    if (!form.razao_social.trim()) {
      showToast('Razão Social é obrigatória', 'error');
      return;
    }
    setSaving(true);
    try {
      await empresasAPI.editar(empresaId, form);
      showToast('Empresa atualizada com sucesso!', 'success');
      router.back();
    } catch (error) {
      showToast('Erro ao salvar empresa', 'error');
    } finally { setSaving(false); }
  };

  if (loading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#1E40AF" /></View>;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Editar Empresa</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>DADOS DA EMPRESA</Text>

            <Text style={styles.label}>Razão Social *</Text>
            <TextInput style={styles.input} value={form.razao_social} onChangeText={(t) => setForm({...form, razao_social: t})} placeholder="Razão Social" />

            <Text style={styles.label}>Nome Fantasia</Text>
            <TextInput style={styles.input} value={form.nome_fantasia} onChangeText={(t) => setForm({...form, nome_fantasia: t})} placeholder="Nome Fantasia" />
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>LINK DO CLIENTE (PORTAL)</Text>
            <Text style={styles.switchSub}>
              O cliente abre este endereço sem login e vê só as guias desta empresa (pendentes e pagas).
            </Text>
            {portalToken ? (
              <Text style={styles.linkPreview} numberOfLines={3} selectable>
                {linkCliente || `/cliente/${portalToken}`}
              </Text>
            ) : null}
            <View style={styles.linkRow}>
              <TouchableOpacity
                style={[styles.secondaryBtn, !linkCliente && { opacity: 0.5 }]}
                onPress={() => void handleCopyLink()}
                disabled={!linkCliente}
              >
                <Ionicons name="copy-outline" size={18} color="#1E40AF" />
                <Text style={styles.secondaryBtnText}>Copiar link</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dangerOutlineBtn, regenerating && { opacity: 0.6 }]}
                onPress={() => void handleRegenerarLink()}
                disabled={regenerating}
              >
                {regenerating ? (
                  <ActivityIndicator color="#B91C1C" />
                ) : (
                  <>
                    <Ionicons name="refresh" size={18} color="#B91C1C" />
                    <Text style={styles.dangerOutlineBtnText}>Novo link</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
            <Text style={styles.switchSub}>
              &quot;Novo link&quot; invalida o anterior (use se o link vazar).
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>CONTATO</Text>

            <Text style={styles.label}>Email</Text>
            <TextInput style={styles.input} value={form.email} onChangeText={(t) => setForm({...form, email: t})} placeholder="email@empresa.com" keyboardType="email-address" autoCapitalize="none" />

            <Text style={styles.label}>Telefone</Text>
            <TextInput style={styles.input} value={form.telefone} onChangeText={(t) => setForm({...form, telefone: t})} placeholder="(51) 99999-9999" keyboardType="phone-pad" />

            <Text style={styles.label}>WhatsApp</Text>
            <TextInput style={styles.input} value={form.whatsapp} onChangeText={(t) => setForm({...form, whatsapp: t})} placeholder="(51) 99999-9999" keyboardType="phone-pad" />
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>NOTIFICAÇÕES</Text>
            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchLabel}>Ativar notificações</Text>
                <Text style={styles.switchSub}>Receba alertas de vencimento automaticamente</Text>
              </View>
              <Switch value={form.notificacoes_ativas} onValueChange={(v) => setForm({...form, notificacoes_ativas: v, notificacoes_whatsapp: v ? form.notificacoes_whatsapp : false, notificacoes_email: v ? form.notificacoes_email : false})} trackColor={{ true: '#1E40AF', false: '#D1D5DB' }} />
            </View>

            {form.notificacoes_ativas && (
              <View style={styles.channelSection}>
                <View style={styles.channelDivider} />
                <View style={styles.switchRow}>
                  <View style={styles.channelIconRow}>
                    <View style={[styles.channelIcon, { backgroundColor: '#D1FAE5' }]}>
                      <Ionicons name="logo-whatsapp" size={16} color="#059669" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.switchLabel}>WhatsApp</Text>
                      <Text style={styles.switchSub}>{form.whatsapp ? `Enviar para ${form.whatsapp}` : 'Preencha o WhatsApp acima'}</Text>
                    </View>
                  </View>
                  <Switch value={form.notificacoes_whatsapp} onValueChange={(v) => setForm({...form, notificacoes_whatsapp: v})} trackColor={{ true: '#25D366', false: '#D1D5DB' }} disabled={!form.whatsapp && !form.telefone} />
                </View>

                <View style={styles.switchRow}>
                  <View style={styles.channelIconRow}>
                    <View style={[styles.channelIcon, { backgroundColor: '#EFF6FF' }]}>
                      <Ionicons name="mail" size={16} color="#1E40AF" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.switchLabel}>Email</Text>
                      <Text style={styles.switchSub}>{form.email ? `Enviar para ${form.email}` : 'Preencha o email acima'}</Text>
                    </View>
                  </View>
                  <Switch value={form.notificacoes_email} onValueChange={(v) => setForm({...form, notificacoes_email: v})} trackColor={{ true: '#1E40AF', false: '#D1D5DB' }} disabled={!form.email} />
                </View>
              </View>
            )}
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
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  switchLabel: { fontSize: 15, fontWeight: '600', color: '#111827' },
  switchSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  channelSection: { marginTop: 4 },
  channelDivider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 12 },
  channelIconRow: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
  channelIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  saveBtn: { backgroundColor: '#1E40AF', borderRadius: 12, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8 },
  saveBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  linkPreview: {
    marginTop: 10,
    fontSize: 13,
    color: '#111827',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 10,
  },
  linkRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  secondaryBtnText: { color: '#1E40AF', fontWeight: '700', fontSize: 14 },
  dangerOutlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  dangerOutlineBtnText: { color: '#B91C1C', fontWeight: '700', fontSize: 14 },
});
