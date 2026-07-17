import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { notificacoesAPI, empresasAPI, whatsappAPI } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import { useRouter } from 'expo-router';

export default function NotificacoesScreen() {
  const { showToast } = useToast();
  const router = useRouter();
  const [notificacoes, setNotificacoes] = useState<any[]>([]);
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [executandoJob, setExecutandoJob] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [enviandoTeste, setEnviandoTeste] = useState(false);
  const [whatsappStatus, setWhatsappStatus] = useState<any>(null);
  const [tab, setTab] = useState<'historico' | 'config'>('historico');
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrUri, setQrUri] = useState<string | null>(null);
  const [conectandoWhatsapp, setConectandoWhatsapp] = useState(false);
  const [pollingWhatsapp, setPollingWhatsapp] = useState(false);

  const loadData = async () => {
    try {
      const [notifRes, statusRes, empRes] = await Promise.all([
        notificacoesAPI.listar({ limit: 50 }),
        notificacoesAPI.statusWhatsApp().catch(() => ({ data: { conectado: false } })),
        empresasAPI.listar().catch(() => ({ data: [] })),
      ]);
      setNotificacoes(notifRes.data);
      setWhatsappStatus(statusRes.data);
      setEmpresas(empRes.data || []);
    } catch (error) {
      console.error('Erro:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadData(); }, []);
  const onRefresh = () => { setRefreshing(true); loadData(); };

  const refreshWhatsappStatus = useCallback(async () => {
    try {
      const statusRes = await whatsappAPI.status();
      setWhatsappStatus(statusRes.data);
      return statusRes.data;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!showQrModal || !pollingWhatsapp) return;
    const tick = async () => {
      const st = await refreshWhatsappStatus();
      if (st?.conectado) {
        setPollingWhatsapp(false);
        setShowQrModal(false);
        setQrUri(null);
        showToast('WhatsApp conectado!', 'success');
      }
    };
    tick();
    const id = setInterval(tick, 3000);
    return () => clearInterval(id);
  }, [showQrModal, pollingWhatsapp, refreshWhatsappStatus, showToast]);

  const handleConectarWhatsapp = async () => {
    setConectandoWhatsapp(true);
    try {
      const res = await whatsappAPI.conectar();
      if (res.data.conectado) {
        showToast('WhatsApp já estava conectado.', 'success');
        await refreshWhatsappStatus();
        return;
      }
      if (res.data.qrcode_data_uri) {
        setQrUri(res.data.qrcode_data_uri);
        setShowQrModal(true);
        setPollingWhatsapp(true);
        showToast('Escaneie o QR no seu WhatsApp', 'info');
      } else {
        showToast(res.data.mensagem || 'Não foi possível gerar o QR Code', 'error');
      }
    } catch (e: any) {
      const msg = e?.response?.data?.detail || 'Erro ao conectar WhatsApp';
      const text = typeof msg === 'string' ? msg : 'Erro ao conectar';
      // Se a API Brasil disser que já está inChat, trate como sucesso e sincronize
      if (/inchat|já está conectado|ja esta conectado|already connected/i.test(text)) {
        showToast('WhatsApp já conectado na API Brasil. Sincronizando…', 'success');
        await refreshWhatsappStatus();
        await loadData();
      } else {
        showToast(text, 'error');
      }
    } finally {
      setConectandoWhatsapp(false);
    }
  };

  const handleDesconectarWhatsapp = async () => {
    try {
      await whatsappAPI.desconectar();
      showToast('WhatsApp desvinculado deste app', 'info');
      loadData();
    } catch {
      showToast('Erro ao desvincular', 'error');
    }
  };

  const handleExecutarJob = async () => {
    setExecutandoJob(true);
    try {
      const res = await notificacoesAPI.executarJob();
      const r = res.data.resultados;
      showToast(
        `Job executado: ${r.notificacoes_enviadas} enviada(s), ${r.vencidas} vencida(s), ${r.a_vencer_d2} a vencer`,
        r.notificacoes_enviadas > 0 ? 'success' : 'info'
      );
      loadData();
    } catch (error) {
      showToast('Erro ao executar job', 'error');
    } finally { setExecutandoJob(false); }
  };

  const handleEnviarTeste = async () => {
    if (!testPhone.trim()) {
      showToast('Digite um número de telefone', 'error');
      return;
    }
    setEnviandoTeste(true);
    try {
      const res = await notificacoesAPI.enviarTeste({
        telefone: testPhone,
        mensagem: '✅ Teste de notificação do GuiaControl! Se você recebeu esta mensagem, a integração WhatsApp está funcionando.',
      });
      if (res.data.sucesso) {
        showToast(
          res.data.mensagem || 'Mensagem de teste enviada! Confira o WhatsApp em alguns segundos.',
          'success'
        );
        setShowTestModal(false);
        setTestPhone('');
      } else {
        const msg =
          res.data.mensagem ||
          res.data.detalhes?.erro ||
          'Falha ao enviar. Verifique APIBrasil e o numero.';
        showToast(msg, 'error');
      }
      loadData();
    } catch (error: any) {
      const detail = error?.response?.data?.detail;
      const msg =
        typeof detail === 'string'
          ? detail
          : Array.isArray(detail)
            ? detail.map((d: any) => d?.msg).filter(Boolean).join(', ')
            : error?.message || 'Erro ao enviar teste';
      showToast(msg, 'error');
    } finally { setEnviandoTeste(false); }
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch { return dateStr; }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#1E40AF" /></View>;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notificações</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, tab === 'historico' && styles.tabActive]} onPress={() => setTab('historico')}>
          <Ionicons name="time-outline" size={16} color={tab === 'historico' ? '#1E40AF' : '#6B7280'} />
          <Text style={[styles.tabText, tab === 'historico' && styles.tabTextActive]}>Histórico</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === 'config' && styles.tabActive]} onPress={() => setTab('config')}>
          <Ionicons name="settings-outline" size={16} color={tab === 'config' ? '#1E40AF' : '#6B7280'} />
          <Text style={[styles.tabText, tab === 'config' && styles.tabTextActive]}>Configurações</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1E40AF" />}
      >
        {tab === 'config' ? (
          <View>
            {/* Status WhatsApp (APIBrasil) */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>WHATSAPP (APIBRASIL)</Text>
              <View style={styles.statusRow}>
                <View style={[styles.statusDot, { backgroundColor: whatsappStatus?.pronto_para_disparar || whatsappStatus?.conectado ? '#059669' : '#DC2626' }]} />
                <Text style={styles.statusText}>
                  {whatsappStatus?.configurado === false
                    ? 'Servidor sem credenciais APIBrasil (.env)'
                    : whatsappStatus?.pronto_para_disparar || whatsappStatus?.conectado
                      ? 'Escritório conectado — disparos usam este número'
                      : 'Não conectado — escaneie o QR com o celular do escritório'}
                </Text>
              </View>
              {whatsappStatus?.session ? (
                <Text style={styles.hintText}>Sessão: {whatsappStatus.session}</Text>
              ) : null}
              {whatsappStatus?.configurado !== false && !whatsappStatus?.conectado && (
                <TouchableOpacity
                  style={[styles.connectBtn, conectandoWhatsapp && { opacity: 0.6 }]}
                  onPress={handleConectarWhatsapp}
                  disabled={conectandoWhatsapp}
                >
                  {conectandoWhatsapp ? (
                    <ActivityIndicator color="#FFF" size="small" />
                  ) : (
                    <>
                      <Ionicons name="qr-code-outline" size={18} color="#FFF" />
                      <Text style={styles.connectBtnText}>Conectar WhatsApp do escritório</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
              {whatsappStatus?.conectado && (
                <TouchableOpacity style={styles.disconnectBtn} onPress={handleDesconectarWhatsapp}>
                  <Text style={styles.disconnectBtnText}>Desconectar WhatsApp</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.testBtn} onPress={() => setShowTestModal(true)}>
                <Ionicons name="paper-plane-outline" size={16} color="#1E40AF" />
                <Text style={styles.testBtnText}>Enviar mensagem de teste</Text>
              </TouchableOpacity>
            </View>

            {/* Email */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>EMAIL</Text>
              <View style={styles.statusRow}>
                <View style={[styles.statusDot, { backgroundColor: '#D97706' }]} />
                <Text style={styles.statusText}>Simulado (sem chave configurada)</Text>
              </View>
              <Text style={styles.hintText}>Quando uma chave SendGrid for configurada, os emails serão enviados de verdade.</Text>
            </View>

            {/* Job Manual */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>JOB DIÁRIO</Text>
              <Text style={styles.hintText}>Verifica guias vencidas e a vencer (D-2) e envia notificações automáticas para as empresas que têm WhatsApp ou email cadastrado.</Text>
              <TouchableOpacity
                style={[styles.jobBtn, executandoJob && { opacity: 0.5 }]}
                onPress={handleExecutarJob}
                disabled={executandoJob}
              >
                {executandoJob ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <><Ionicons name="play" size={18} color="#FFF" /><Text style={styles.jobBtnText}>Executar agora</Text></>
                )}
              </TouchableOpacity>
            </View>

            {/* Como funciona */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>COMO FUNCIONA</Text>
              <View style={styles.infoItem}>
                <Ionicons name="alert-circle" size={18} color="#DC2626" />
                <Text style={styles.infoText}>Guia vencida → Notificação imediata</Text>
              </View>
              <View style={styles.infoItem}>
                <Ionicons name="time" size={18} color="#D97706" />
                <Text style={styles.infoText}>Guia vence em 2 dias → Lembrete</Text>
              </View>
              <View style={styles.infoItem}>
                <Ionicons name="logo-whatsapp" size={18} color="#25D366" />
                <Text style={styles.infoText}>WhatsApp via APIBrasil (credenciais em app.apibrasil.io)</Text>
              </View>
              <View style={styles.infoItem}>
                <Ionicons name="mail" size={18} color="#6B7280" />
                <Text style={styles.infoText}>Email (simulado por enquanto)</Text>
              </View>
            </View>

            {/* Empresas configuradas */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>EMPRESAS CONFIGURADAS</Text>
              {empresas.length === 0 ? (
                <Text style={styles.hintText}>Nenhuma empresa cadastrada. Adicione uma empresa para configurar notificações.</Text>
              ) : (
                empresas.map((emp) => {
                  const hasWhatsapp = !!(emp.whatsapp || emp.telefone);
                  const hasEmail = !!emp.email;
                  const notifAtivas = emp.notificacoes_ativas !== false;
                  const whatsappAtivo = emp.notificacoes_whatsapp !== false && hasWhatsapp;
                  const emailAtivo = emp.notificacoes_email !== false && hasEmail;
                  return (
                    <TouchableOpacity
                      key={emp.empresa_id}
                      style={styles.empresaRow}
                      onPress={() => router.push(`/editar-empresa?id=${emp.empresa_id}`)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.empresaName} numberOfLines={1}>
                          {emp.nome_fantasia || emp.razao_social}
                        </Text>
                        <View style={styles.empresaBadges}>
                          {notifAtivas ? (
                            <>
                              {whatsappAtivo && (
                                <View style={[styles.channelBadge, { backgroundColor: '#D1FAE5' }]}>
                                  <Ionicons name="logo-whatsapp" size={11} color="#059669" />
                                  <Text style={[styles.channelBadgeText, { color: '#059669' }]}>WhatsApp</Text>
                                </View>
                              )}
                              {emailAtivo && (
                                <View style={[styles.channelBadge, { backgroundColor: '#EFF6FF' }]}>
                                  <Ionicons name="mail" size={11} color="#1E40AF" />
                                  <Text style={[styles.channelBadgeText, { color: '#1E40AF' }]}>Email</Text>
                                </View>
                              )}
                              {!whatsappAtivo && !emailAtivo && (
                                <View style={[styles.channelBadge, { backgroundColor: '#FEF3C7' }]}>
                                  <Ionicons name="warning" size={11} color="#D97706" />
                                  <Text style={[styles.channelBadgeText, { color: '#D97706' }]}>Sem canal</Text>
                                </View>
                              )}
                            </>
                          ) : (
                            <View style={[styles.channelBadge, { backgroundColor: '#FEE2E2' }]}>
                              <Ionicons name="notifications-off" size={11} color="#DC2626" />
                              <Text style={[styles.channelBadgeText, { color: '#DC2626' }]}>Desativadas</Text>
                            </View>
                          )}
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          </View>
        ) : (
          <View>
            {notificacoes.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="notifications-off-outline" size={48} color="#D1D5DB" />
                <Text style={styles.emptyText}>Nenhuma notificação enviada</Text>
                <Text style={styles.emptySubText}>Execute o job ou configure dados de contato nas empresas</Text>
              </View>
            ) : (
              notificacoes.map((n, idx) => (
                <View key={n.notificacao_id || idx} style={styles.notifCard}>
                  <View style={styles.notifHeader}>
                    <View style={[styles.canalBadge, { backgroundColor: n.canal === 'whatsapp' ? '#D1FAE5' : '#EFF6FF' }]}>
                      <Ionicons
                        name={n.canal === 'whatsapp' ? 'logo-whatsapp' : 'mail'}
                        size={14}
                        color={n.canal === 'whatsapp' ? '#059669' : '#1E40AF'}
                      />
                      <Text style={[styles.canalText, { color: n.canal === 'whatsapp' ? '#059669' : '#1E40AF' }]}>
                        {n.canal === 'whatsapp' ? 'WhatsApp' : 'Email'}
                      </Text>
                    </View>
                    <View style={[styles.resultBadge, { backgroundColor: n.sucesso ? '#D1FAE5' : '#FEE2E2' }]}>
                      <Ionicons name={n.sucesso ? 'checkmark' : 'close'} size={12} color={n.sucesso ? '#059669' : '#DC2626'} />
                      <Text style={[styles.resultText, { color: n.sucesso ? '#059669' : '#DC2626' }]}>
                        {n.sucesso ? 'Enviada' : 'Falha'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.notifDest}>{n.destinatario}</Text>
                  <Text style={styles.notifMsg} numberOfLines={2}>{n.mensagem}</Text>
                  <Text style={styles.notifDate}>{formatDate(n.created_at)}</Text>
                </View>
              ))
            )}
          </View>
        )}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Modal QR WhatsApp */}
      {showQrModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Conectar WhatsApp</Text>
            <Text style={styles.modalDesc}>
              No celular do escritorio: WhatsApp → Menu (⋮) → Aparelhos conectados → Conectar aparelho → escaneie o QR.
              Os disparos sairao deste numero.
            </Text>
            {qrUri ? (
              <Image source={{ uri: qrUri }} style={styles.qrImage} resizeMode="contain" />
            ) : (
              <ActivityIndicator size="large" color="#1E40AF" style={{ marginVertical: 24 }} />
            )}
            {pollingWhatsapp && (
              <Text style={styles.qrWaitText}>Aguardando leitura do QR...</Text>
            )}
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  setShowQrModal(false);
                  setPollingWhatsapp(false);
                  setQrUri(null);
                  refreshWhatsappStatus();
                }}
              >
                <Text style={styles.modalCancelText}>Fechar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSendBtn}
                onPress={async () => {
                  const st = await refreshWhatsappStatus();
                  if (st?.conectado) {
                    setShowQrModal(false);
                    setPollingWhatsapp(false);
                    showToast('Conectado!', 'success');
                  } else {
                    showToast('Ainda nao conectou. Escaneie o QR.', 'info');
                  }
                }}
              >
                <Text style={styles.modalSendText}>Ja escaneei</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Modal Teste WhatsApp */}
      {showTestModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Testar WhatsApp</Text>
            <Text style={styles.modalDesc}>Digite o número para enviar uma mensagem de teste</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="(51) 99999-9999"
              keyboardType="phone-pad"
              value={testPhone}
              onChangeText={setTestPhone}
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => { setShowTestModal(false); setTestPhone(''); }}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSendBtn, enviandoTeste && { opacity: 0.5 }]}
                onPress={handleEnviarTeste}
                disabled={enviandoTeste}
              >
                {enviandoTeste ? <ActivityIndicator color="#FFF" size="small" /> : (
                  <><Ionicons name="paper-plane" size={16} color="#FFF" /><Text style={styles.modalSendText}>Enviar</Text></>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F3F4F6' },
  header: { paddingHorizontal: 20, paddingVertical: 14, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#111827' },
  tabs: { flexDirection: 'row', backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingBottom: 8 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, gap: 6, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#1E40AF' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  tabTextActive: { color: '#1E40AF' },
  list: { flex: 1 },
  listContent: { padding: 16, paddingBottom: 110 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#F3F4F6' },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: '#6B7280', letterSpacing: 0.5, marginBottom: 12 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { fontSize: 14, fontWeight: '600', color: '#111827' },
  connectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
    marginBottom: 10,
  },
  connectBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  disconnectBtn: {
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 10,
  },
  disconnectBtnText: { fontSize: 13, fontWeight: '600', color: '#DC2626' },
  testBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#EFF6FF', paddingVertical: 10, borderRadius: 10, gap: 6, borderWidth: 1, borderColor: '#BFDBFE' },
  testBtnText: { fontSize: 14, fontWeight: '600', color: '#1E40AF' },
  qrImage: { width: 240, height: 240, alignSelf: 'center', marginVertical: 12, backgroundColor: '#FFF' },
  qrWaitText: { textAlign: 'center', fontSize: 13, color: '#6B7280', marginBottom: 8 },
  hintText: { fontSize: 13, color: '#6B7280', lineHeight: 18, marginBottom: 12 },
  jobBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1E40AF', paddingVertical: 12, borderRadius: 10, gap: 6, marginTop: 4 },
  jobBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  infoItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  infoText: { fontSize: 14, color: '#374151', flex: 1 },
  emptyBox: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#9CA3AF' },
  emptySubText: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', paddingHorizontal: 40 },
  notifCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#F3F4F6' },
  notifHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  canalBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, gap: 4 },
  canalText: { fontSize: 11, fontWeight: '700' },
  resultBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, gap: 3 },
  resultText: { fontSize: 11, fontWeight: '700' },
  notifDest: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 4 },
  notifMsg: { fontSize: 12, color: '#6B7280', lineHeight: 16, marginBottom: 6 },
  notifDate: { fontSize: 11, color: '#9CA3AF' },
  empresaRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', gap: 8 },
  empresaName: { fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 4 },
  empresaBadges: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  channelBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, gap: 3 },
  channelBadgeText: { fontSize: 10, fontWeight: '700' },
  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20, zIndex: 100 },
  modalContent: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 24, width: '100%', maxWidth: 340 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 6 },
  modalDesc: { fontSize: 13, color: '#6B7280', marginBottom: 16 },
  modalInput: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: '#111827', marginBottom: 16 },
  modalBtns: { flexDirection: 'row', gap: 12 },
  modalCancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center' },
  modalCancelText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  modalSendBtn: { flex: 1, flexDirection: 'row', paddingVertical: 12, borderRadius: 10, backgroundColor: '#25D366', alignItems: 'center', justifyContent: 'center', gap: 6 },
  modalSendText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
});
