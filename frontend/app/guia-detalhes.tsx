import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Platform,
  Modal,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { guiasAPI } from '../services/api';
import { formatCurrency, formatDate, getStatusColor, getStatusText } from '../utils/formatters';
import { FileUpload } from '../components/FileUpload';
import { ConfirmModal } from '../components/ConfirmModal';
import { useToast } from '../contexts/ToastContext';
import * as Clipboard from 'expo-clipboard';
import { GuiaQrCode } from '../components/GuiaQrCode';

const statusConfig: Record<string, { bg: string; color: string; icon: string; lightBg: string }> = {
  paga: { bg: '#D1FAE5', color: '#059669', icon: 'checkmark-circle', lightBg: '#ECFDF5' },
  a_vencer: { bg: '#FEF3C7', color: '#D97706', icon: 'time', lightBg: '#FFFBEB' },
  vencida: { bg: '#FEE2E2', color: '#DC2626', icon: 'alert-circle', lightBg: '#FEF2F2' },
};

export default function GuiaDetalhesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { showToast } = useToast();
  const guiaId = params.id as string;

  const [guia, setGuia] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const [showComprovanteUpload, setShowComprovanteUpload] = useState(false);
  const [comprovante, setComprovante] = useState<string | null>(null);
  const [showPayModal, setShowPayModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showLembreteModal, setShowLembreteModal] = useState(false);
  const [mensagemExtra, setMensagemExtra] = useState('');
  const [enviandoLembrete, setEnviandoLembrete] = useState(false);

  useEffect(() => { loadGuia(); }, []);

  const loadGuia = async () => {
    try {
      const response = await guiasAPI.obter(guiaId);
      setGuia(response.data);
    } catch (error) {
      console.error('Erro ao carregar guia:', error);
      showToast('Não foi possível carregar a guia', 'error');
      router.back();
    } finally { setLoading(false); }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await Clipboard.setStringAsync(text);
      showToast(`${label} copiado!`, 'success');
    } catch (error) {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        showToast(`${label} copiado!`, 'success');
      } else {
        showToast('Não foi possível copiar', 'error');
      }
    }
  };

  const handleConfirmarPagamento = async () => {
    setMarking(true);
    try {
      await guiasAPI.pagar(guiaId, comprovante ? { comprovante } : undefined);
      showToast('Pagamento confirmado com sucesso!', 'success');
      setShowPayModal(false);
      setShowComprovanteUpload(false);
      loadGuia();
    } catch (error: any) {
      const msg = error?.response?.data?.detail || 'Erro ao confirmar pagamento';
      showToast(msg, 'error');
    } finally { setMarking(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await guiasAPI.deletar(guiaId);
      showToast('Guia excluída com sucesso', 'success');
      setShowDeleteModal(false);
      router.back();
    } catch (error) {
      showToast('Erro ao excluir guia', 'error');
    } finally { setDeleting(false); }
  };

  const handleEnviarLembrete = async () => {
    setEnviandoLembrete(true);
    try {
      const response = await guiasAPI.enviarLembrete(guiaId, {
        mensagem_extra: mensagemExtra.trim() || undefined,
      });
      const data = response.data || {};
      if (data.sucesso) {
        const tel = data.telefone ? ` para ${data.telefone}` : '';
        showToast(`Lembrete enviado${tel}.`, 'success');
        setShowLembreteModal(false);
        setMensagemExtra('');
      } else {
        showToast(data.mensagem || 'Falha ao enviar lembrete.', 'error');
      }
    } catch (error: any) {
      const msg = error?.response?.data?.detail || 'Falha ao enviar lembrete.';
      showToast(msg, 'error');
    } finally {
      setEnviandoLembrete(false);
    }
  };

  if (loading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#1E40AF" /></View>;
  if (!guia) return null;

  const cfg = statusConfig[guia.status] || statusConfig['a_vencer'];
  const statusText = getStatusText(guia.status);
  const isValidada = guia.status === 'paga';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Detalhes da Guia</Text>
        <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn}>
          <Ionicons name="trash-outline" size={20} color="#EF4444" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView}>
        {/* Status Hero */}
        <View style={[styles.statusCard, { backgroundColor: cfg.lightBg }]}>
          <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
            <Ionicons name={cfg.icon as any} size={16} color={cfg.color} />
            <Text style={[styles.statusText, { color: cfg.color }]}>{statusText}</Text>
          </View>
          <Text style={styles.tipo}>{guia.tipo}</Text>
          <Text style={styles.descricao}>{guia.descricao}</Text>
          <Text style={[styles.valor, { color: cfg.color }]}>{formatCurrency(guia.valor)}</Text>
          {/* Validation badge */}
          <View style={[styles.validBadge, isValidada ? styles.validOk : styles.validPending]}>
            <Ionicons name={isValidada ? 'checkmark-circle' : 'time'} size={14} color={isValidada ? '#059669' : '#D97706'} />
            <Text style={{ fontSize: 12, fontWeight: '600', color: isValidada ? '#059669' : '#D97706' }}>
              {isValidada ? 'Validado pelo contador' : 'Aguardando validação'}
            </Text>
          </View>
        </View>

        {/* Vencida Alert */}
        {guia.status === 'vencida' && (
          <View style={styles.alertBox}>
            <Ionicons name="warning" size={18} color="#DC2626" />
            <View style={{ flex: 1 }}>
              <Text style={styles.alertTitle}>Guia vencida - Regularize agora</Text>
              <Text style={styles.alertSub}>Evite multas e atrasos. Confirme o pagamento abaixo.</Text>
            </View>
          </View>
        )}

        {/* Lembrete WhatsApp manual (apenas quando não paga) */}
        {guia.status !== 'paga' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>LEMBRETE AO CLIENTE</Text>
            <View style={styles.card}>
              <View style={styles.lembreteRow}>
                <View style={styles.lembreteIcon}>
                  <Ionicons name="logo-whatsapp" size={20} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.lembreteTitle}>Enviar lembrete via WhatsApp</Text>
                  <Text style={styles.lembreteSub}>
                    O cliente recebe valor, vencimento (dd/mm/aaaa) e o link da página dele.
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.whatsBtn}
                onPress={() => setShowLembreteModal(true)}
                accessibilityRole="button"
                accessibilityLabel="Enviar lembrete por WhatsApp"
              >
                <Ionicons name="logo-whatsapp" size={18} color="#FFFFFF" />
                <Text style={styles.whatsBtnText}>Enviar lembrete agora</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Info Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>INFORMAÇÕES</Text>
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <Ionicons name="calendar" size={18} color="#1E40AF" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Data de Vencimento</Text>
                <Text style={styles.infoValue}>{formatDate(guia.data_vencimento)}</Text>
              </View>
            </View>
            {guia.data_pagamento && (
              <View style={styles.infoRow}>
                <Ionicons name="checkmark-circle" size={18} color="#059669" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Data de Pagamento</Text>
                  <Text style={styles.infoValue}>{formatDate(guia.data_pagamento)}</Text>
                </View>
              </View>
            )}
            {guia.observacoes && (
              <View style={styles.infoRow}>
                <Ionicons name="document-text" size={18} color="#6B7280" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Observaç\u00f5es</Text>
                  <Text style={styles.infoValue}>{guia.observacoes}</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Código de Barras */}
        {guia.codigo_barras && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>CÓDIGO DE BARRAS</Text>
            <View style={styles.card}>
              <View style={styles.barcodeBox}>
                <Ionicons name="barcode" size={32} color="#1E40AF" />
                <Text style={styles.barcodeText} selectable={true}>
                  {guia.codigo_barras.replace(/(\d{12})/g, '$1 ').trim()}
                </Text>
              </View>
              <TouchableOpacity style={styles.copyBtn} onPress={() => copyToClipboard(guia.codigo_barras, 'Código de barras')}>
                <Ionicons name="copy-outline" size={18} color="#FFFFFF" />
                <Text style={styles.copyBtnText}>Copiar código</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* QR Code PIX */}
        {guia.qr_code_pix && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>PAGAMENTO PIX</Text>
            <View style={styles.card}>
              <View style={styles.pixBox}>
                {/* QR Code real renderizado */}
                <View style={styles.qrCodeContainer}>
                  <GuiaQrCode
                    value={guia.qr_code_pix}
                    size={180}
                    color="#111827"
                    backgroundColor="#FFFFFF"
                  />
                </View>
                <Text style={styles.pixTitle}>Escaneie o QR Code</Text>
                <Text style={styles.pixSafe}>
                  <Ionicons name="shield-checkmark" size={13} color="#059669" /> Pagamento seguro via PIX
                </Text>
              </View>

              {/* Mostrar texto PIX truncado */}
              <View style={styles.pixTextBox}>
                <Text style={styles.pixTextLabel}>PIX Copia e Cola</Text>
                <Text style={styles.pixTextValue} numberOfLines={2} selectable={true}>
                  {guia.qr_code_pix}
                </Text>
              </View>

              <TouchableOpacity style={styles.copyBtn} onPress={() => copyToClipboard(guia.qr_code_pix, 'Código PIX')}>
                <Ionicons name="copy-outline" size={18} color="#FFFFFF" />
                <Text style={styles.copyBtnText}>Copiar código PIX</Text>
              </TouchableOpacity>
              <Text style={styles.confirmNote}>Confirme os dados antes de pagar</Text>
            </View>
          </View>
        )}

        {/* Comprovante Upload */}
        {guia.status !== 'paga' && showComprovanteUpload && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ANEXAR COMPROVANTE</Text>
            <View style={styles.card}>
              <FileUpload label="Selecione o comprovante" onFileSelect={(b64) => setComprovante(b64)} currentFile={comprovante || undefined} />
              <TouchableOpacity style={[styles.confirmBtn, (!comprovante || marking) && styles.confirmBtnDisabled]} onPress={handleAnexarComprovante} disabled={marking || !comprovante}>
                {marking ? <ActivityIndicator color="#FFFFFF" /> : (<><Ionicons name="checkmark-circle" size={20} color="#FFFFFF" /><Text style={styles.confirmBtnText}>Confirmar pagamento</Text></>)}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Comprovante Anexado */}
        {guia.comprovante && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>COMPROVANTE</Text>
            <View style={styles.card}>
              {guia.comprovante.includes('image') ? (
                <Image source={{ uri: guia.comprovante }} style={styles.comprovanteImg} />
              ) : (
                <View style={styles.pdfPreview}>
                  <Ionicons name="document" size={40} color="#059669" />
                  <Text style={styles.pdfText}>Comprovante Anexado</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Trust footer */}
        <View style={styles.trustFooter}>
          <View style={styles.trustItem}><Ionicons name="shield-checkmark" size={14} color="#059669" /><Text style={styles.trustText}>Seus dados estão protegidos</Text></View>
        </View>
      </ScrollView>

      {/* Bottom Actions */}
      <View style={styles.footer}>
        <View style={styles.footerActions}>
          <TouchableOpacity style={styles.editBtn} onPress={() => router.push(`/editar-guia?id=${guiaId}`)}>
            <Ionicons name="create-outline" size={20} color="#1E40AF" />
            <Text style={styles.editBtnText}>Editar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteBtnAction} onPress={() => setShowDeleteModal(true)}>
            <Ionicons name="trash-outline" size={20} color="#DC2626" />
            <Text style={styles.deleteBtnActionText}>Excluir</Text>
          </TouchableOpacity>
          {guia.status !== 'paga' ? (
            <TouchableOpacity style={[styles.payBtn, marking && styles.payBtnDisabled]} onPress={() => setShowPayModal(true)} disabled={marking}>
              <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
              <Text style={styles.payBtnText}>Pagar</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.paidBadge}>
              <Ionicons name="checkmark-circle" size={20} color="#059669" />
              <Text style={styles.paidBadgeText}>Paga</Text>
            </View>
          )}
        </View>
      </View>

      {/* Modal: Confirmar Pagamento */}
      <ConfirmModal
        visible={showPayModal}
        title="Confirmar Pagamento"
        message={`Deseja confirmar o pagamento de ${formatCurrency(guia.valor)}? Esta ação não pode ser desfeita.`}
        confirmText="Confirmar Pagamento"
        type="success"
        onConfirm={handleConfirmarPagamento}
        onCancel={() => setShowPayModal(false)}
        loading={marking}
      />

      {/* Modal: Confirmar Exclusão */}
      <ConfirmModal
        visible={showDeleteModal}
        title="Excluir Guia"
        message={`Deseja excluir esta guia de ${formatCurrency(guia.valor)}? Esta ação não pode ser desfeita.`}
        confirmText="Excluir"
        type="danger"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteModal(false)}
        loading={deleting}
      />

      {/* Modal: Enviar Lembrete WhatsApp */}
      <Modal
        visible={showLembreteModal}
        transparent
        animationType="fade"
        onRequestClose={() => (enviandoLembrete ? null : setShowLembreteModal(false))}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.lembreteModal}>
            <View style={styles.lembreteModalHeader}>
              <View style={styles.lembreteIcon}>
                <Ionicons name="logo-whatsapp" size={20} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.lembreteModalTitle}>Enviar lembrete</Text>
                <Text style={styles.lembreteModalSub}>
                  Mensagem padrão com valor, vencimento e link do cliente.
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => !enviandoLembrete && setShowLembreteModal(false)}
                disabled={enviandoLembrete}
                style={styles.lembreteCloseBtn}
              >
                <Ionicons name="close" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.lembretePreview}>
              <Text style={styles.lembretePreviewLabel}>Resumo da guia</Text>
              <Text style={styles.lembretePreviewLine}>
                {guia.tipo} — {formatCurrency(guia.valor)}
              </Text>
              <Text style={styles.lembretePreviewLine}>
                Vencimento: {formatDate(guia.data_vencimento)}
              </Text>
            </View>

            <Text style={styles.lembreteFieldLabel}>Recado opcional do escritório</Text>
            <TextInput
              style={styles.lembreteTextarea}
              placeholder="Ex.: já enviei o boleto também por e-mail. Qualquer dúvida, me chame."
              placeholderTextColor="#9CA3AF"
              value={mensagemExtra}
              onChangeText={setMensagemExtra}
              multiline
              maxLength={400}
              editable={!enviandoLembrete}
            />
            <Text style={styles.lembreteHint}>
              {mensagemExtra.length}/400 — opcional. Se preenchido, vai junto da mensagem.
            </Text>

            <View style={styles.lembreteActions}>
              <TouchableOpacity
                style={styles.lembreteCancelBtn}
                onPress={() => setShowLembreteModal(false)}
                disabled={enviandoLembrete}
              >
                <Text style={styles.lembreteCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.whatsBtn, enviandoLembrete && styles.whatsBtnDisabled]}
                onPress={handleEnviarLembrete}
                disabled={enviandoLembrete}
              >
                {enviandoLembrete ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="logo-whatsapp" size={18} color="#FFFFFF" />
                    <Text style={styles.whatsBtnText}>Enviar agora</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  deleteBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center' },
  scrollView: { flex: 1 },
  statusCard: { padding: 24, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, gap: 6, marginBottom: 14 },
  statusText: { fontSize: 13, fontWeight: '700' },
  tipo: { fontSize: 22, fontWeight: '800', color: '#111827', marginBottom: 4, letterSpacing: -0.5 },
  descricao: { fontSize: 14, color: '#6B7280', marginBottom: 14, textAlign: 'center' },
  valor: { fontSize: 34, fontWeight: '800', letterSpacing: -1, marginBottom: 14 },
  validBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  validOk: { backgroundColor: '#ECFDF5' },
  validPending: { backgroundColor: '#FFFBEB' },
  alertBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF2F2', marginHorizontal: 20, marginTop: 12, padding: 14, borderRadius: 14, gap: 10, borderWidth: 1, borderColor: '#FECACA' },
  alertTitle: { fontSize: 14, fontWeight: '700', color: '#DC2626' },
  alertSub: { fontSize: 12, color: '#991B1B', marginTop: 1 },
  section: { paddingHorizontal: 20, paddingTop: 20 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#9CA3AF', marginBottom: 10, letterSpacing: 1 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#F3F4F6' },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 },
  infoContent: { flex: 1, marginLeft: 12 },
  infoLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '500', marginBottom: 2 },
  infoValue: { fontSize: 15, fontWeight: '600', color: '#111827' },
  barcodeBox: { backgroundColor: '#F0F4FF', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 14, gap: 10 },
  barcodeText: { fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: '#1E40AF', textAlign: 'center', fontWeight: '600' },
  copyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1E40AF', paddingVertical: 12, borderRadius: 10, gap: 8 },
  copyBtnText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  pixBox: { alignItems: 'center', paddingVertical: 20, marginBottom: 14 },
  qrCodeContainer: { padding: 16, backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 2, borderColor: '#E5E7EB', marginBottom: 16, alignItems: 'center', justifyContent: 'center' },
  pixTitle: { fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 4 },
  pixSafe: { fontSize: 13, color: '#059669', fontWeight: '600' },
  pixTextBox: { backgroundColor: '#F0F4FF', borderRadius: 10, padding: 12, marginBottom: 14 },
  pixTextLabel: { fontSize: 11, fontWeight: '700', color: '#6B7280', marginBottom: 4, letterSpacing: 0.5 },
  pixTextValue: { fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: '#1E40AF', lineHeight: 16 },
  confirmNote: { fontSize: 12, color: '#6B7280', textAlign: 'center', marginTop: 10, fontStyle: 'italic' },
  comprovanteImg: { width: '100%', height: 280, resizeMode: 'contain', backgroundColor: '#F3F4F6', borderRadius: 8 },
  pdfPreview: { width: '100%', height: 140, backgroundColor: '#D1FAE5', alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  pdfText: { fontSize: 13, color: '#059669', marginTop: 6, fontWeight: '600' },
  trustFooter: { alignItems: 'center', paddingVertical: 20 },
  trustItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  trustText: { fontSize: 12, color: '#059669', fontWeight: '500' },
  footer: { padding: 16, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  footerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  editBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#EFF6FF', paddingVertical: 14, borderRadius: 12, gap: 6, borderWidth: 1, borderColor: '#BFDBFE' },
  editBtnText: { fontSize: 14, fontWeight: '700', color: '#1E40AF' },
  deleteBtnAction: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FEF2F2', paddingVertical: 14, borderRadius: 12, gap: 6, borderWidth: 1, borderColor: '#FECACA' },
  deleteBtnActionText: { fontSize: 14, fontWeight: '700', color: '#DC2626' },
  payBtn: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#059669', paddingVertical: 14, borderRadius: 12, gap: 6 },
  payBtnDisabled: { opacity: 0.5 },
  payBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  paidBadge: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#D1FAE5', paddingVertical: 14, borderRadius: 12, gap: 6 },
  paidBadgeText: { fontSize: 15, fontWeight: '700', color: '#059669' },
  lembreteRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 12 },
  lembreteIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#25D366',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lembreteTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  lembreteSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  whatsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#25D366',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 10,
    gap: 8,
    alignSelf: 'stretch',
  },
  whatsBtnDisabled: { opacity: 0.6 },
  whatsBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  lembreteModal: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
  },
  lembreteModalHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  lembreteModalTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },
  lembreteModalSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  lembreteCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lembretePreview: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    marginBottom: 14,
  },
  lembretePreviewLabel: {
    fontSize: 11,
    color: '#059669',
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  lembretePreviewLine: { fontSize: 13, color: '#065F46', fontWeight: '600' },
  lembreteFieldLabel: { fontSize: 12, fontWeight: '700', color: '#374151', marginBottom: 6 },
  lembreteTextarea: {
    minHeight: 90,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#111827',
    textAlignVertical: 'top',
    backgroundColor: '#F9FAFB',
  },
  lembreteHint: { fontSize: 11, color: '#9CA3AF', marginTop: 6 },
  lembreteActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  lembreteCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  lembreteCancelText: { fontSize: 14, fontWeight: '700', color: '#374151' },
});
