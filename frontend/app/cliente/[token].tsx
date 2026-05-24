import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { fetchPortalCliente, portalMarcarPaga } from '../../services/api';
import { FileUpload } from '../../components/FileUpload';
import { formatCurrency, formatDate, formatCNPJ, getStatusColor, getStatusText } from '../../utils/formatters';
import { GuiaQrCode } from '../../components/GuiaQrCode';
import { useToast } from '../../contexts/ToastContext';
import { premium, getStatusPremium } from '../../theme/premium';
import { GuiaTimeline } from '../../components/premium/GuiaTimeline';
import { InstallAppButton } from '../../components/InstallAppButton';

type EmpresaPub = { razao_social?: string; nome_fantasia?: string; cnpj?: string };
type GuiaPub = {
  guia_id: string;
  tipo: string;
  descricao: string;
  valor: number;
  data_vencimento: string;
  status: string;
  data_pagamento?: string | null;
  codigo_barras?: string | null;
  qr_code_pix?: string | null;
  observacoes?: string | null;
};

function portalPayError(error: unknown): string {
  const d = (error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  if (typeof d === 'string') return d;
  if (Array.isArray(d)) {
    return d
      .map((x: { msg?: string }) => x?.msg)
      .filter(Boolean)
      .join(', ');
  }
  return 'Não foi possível registrar o pagamento.';
}

export default function ClientePortalScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const { token } = useLocalSearchParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [empresa, setEmpresa] = useState<EmpresaPub | null>(null);
  const [guias, setGuias] = useState<GuiaPub[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [comprovanteB64, setComprovanteB64] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);

  useEffect(() => {
    setComprovanteB64(null);
  }, [expandedId]);

  const copyText = async (text: string, label: string) => {
    try {
      await Clipboard.setStringAsync(text);
      showToast(`${label} copiado.`, 'success');
    } catch {
      showToast('Não foi possível copiar.', 'error');
    }
  };

  const marcarComoPaga = async (g: GuiaPub) => {
    if (!token || typeof token !== 'string') return;
    setMarkingId(g.guia_id);
    try {
      const res = await portalMarcarPaga(token, g.guia_id, {
        comprovante: comprovanteB64 || undefined,
      });
      const msg = (res.data as { message?: string })?.message;
      showToast(msg || 'Pagamento informado ao escritório.', 'success');
      setExpandedId(null);
      await load();
    } catch (e) {
      showToast(portalPayError(e), 'error');
    } finally {
      setMarkingId(null);
    }
  };

  const load = useCallback(async () => {
    if (!token || typeof token !== 'string') {
      setError('Link inválido');
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const res = await fetchPortalCliente(token);
      setEmpresa(res.data.empresa ?? null);
      setGuias(res.data.guias ?? []);
    } catch (e: any) {
      const msg =
        e?.response?.status === 404
          ? 'Este link não existe mais ou foi atualizado pelo escritório.'
          : 'Não foi possível carregar as guias. Tente de novo.';
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    void load();
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1E40AF" />
        <Text style={styles.muted}>Carregando…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          {Platform.OS !== 'web' ? (
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color="#111827" />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 40 }} />
          )}
          <Text style={styles.headerTitle}>GuiaControl</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color="#DC2626" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const tituloEmpresa = empresa?.nome_fantasia || empresa?.razao_social || 'Sua empresa';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        {Platform.OS !== 'web' ? (
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#111827" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
        <Text style={styles.headerTitle}>Minhas guias</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1E40AF" />}
      >
        <View style={styles.hero}>
          <View style={styles.heroBadge}>
            <Ionicons name="wallet" size={14} color={premium.primary} />
            <Text style={styles.heroKicker}>Portal financeiro</Text>
          </View>
          <Text style={styles.heroTitle}>{tituloEmpresa}</Text>
          {empresa?.cnpj ? (
            <Text style={styles.heroSub}>CNPJ {formatCNPJ(empresa.cnpj)}</Text>
          ) : null}
          <View style={styles.heroPills}>
            <View style={styles.pill}>
              <Ionicons name="time" size={12} color={premium.primary} />
              <Text style={styles.pillText}>Histórico completo</Text>
            </View>
            <View style={styles.pill}>
              <Ionicons name="logo-whatsapp" size={12} color="#25D366" />
              <Text style={styles.pillText}>Lembretes WhatsApp</Text>
            </View>
            <View style={styles.pill}>
              <Ionicons name="download" size={12} color={premium.primary} />
              <Text style={styles.pillText}>Download rápido</Text>
            </View>
          </View>
          <Text style={styles.heroHint}>
            Consulte guias, pague por boleto ou PIX, envie comprovante e acompanhe o status em tempo real — tudo em um
            só lugar, com acompanhamento automático do escritório.
          </Text>

          <View style={styles.installSlot}>
            <InstallAppButton
              label="Instalar como app"
              subtitle="Acesse mais rápido pela tela inicial"
              color="#1E40AF"
            />
          </View>
        </View>

        {guias.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="document-text-outline" size={40} color="#9CA3AF" />
            <Text style={styles.emptyText}>Nenhuma guia cadastrada ainda.</Text>
          </View>
        ) : (
          guias.map((g) => {
            const open = expandedId === g.guia_id;
            const st = getStatusPremium(g.status);
            const hasPay =
              !!(g.codigo_barras && String(g.codigo_barras).trim()) ||
              !!(g.qr_code_pix && String(g.qr_code_pix).trim());
            return (
              <View
                key={g.guia_id}
                style={[
                  styles.card,
                  open && styles.cardOpen,
                  { borderLeftColor: st.bar, borderLeftWidth: 4 },
                  Platform.OS === 'web' && ({ boxShadow: `0 4px 16px ${st.glow}` } as object),
                ]}
              >
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() => setExpandedId(open ? null : g.guia_id)}
                >
                  <View style={styles.cardTop}>
                    <View style={[styles.badge, { backgroundColor: st.bg, borderColor: st.main + '44' }]}>
                      <Text style={[styles.badgeText, { color: st.main }]}>
                        {getStatusText(g.status)}
                      </Text>
                    </View>
                    <Text style={styles.valor}>{formatCurrency(g.valor)}</Text>
                  </View>
                  <Text style={styles.tipo}>{g.tipo}</Text>
                  <Text style={styles.desc}>{g.descricao}</Text>
                  <View style={styles.row}>
                    <Ionicons name="calendar-outline" size={16} color="#6B7280" />
                    <Text style={styles.meta}>Vencimento {formatDate(g.data_vencimento)}</Text>
                  </View>
                  {g.status === 'paga' && g.data_pagamento ? (
                    <View style={styles.row}>
                      <Ionicons name="checkmark-done" size={16} color="#059669" />
                      <Text style={[styles.meta, { color: '#059669' }]}>Pago em {formatDate(g.data_pagamento)}</Text>
                    </View>
                  ) : null}

                  <View style={styles.tapHint}>
                    <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color="#1E40AF" />
                    <Text style={styles.tapHintText}>
                      {open
                        ? 'Toque para fechar'
                        : hasPay
                          ? 'Toque para ver como pagar (código de barras / PIX)'
                          : 'Toque para ver detalhes'}
                    </Text>
                  </View>
                </TouchableOpacity>

                {open ? (
                  <View style={styles.expand}>
                    <GuiaTimeline guia={g} />
                    {g.observacoes ? (
                      <View style={styles.block}>
                        <Text style={styles.blockTitle}>Observações</Text>
                        <Text style={styles.blockBody}>{g.observacoes}</Text>
                      </View>
                    ) : null}

                    {g.codigo_barras ? (
                      <View style={styles.block}>
                        <Text style={styles.blockTitle}>Linha digitável</Text>
                        <Text style={styles.barcode} selectable>
                          {String(g.codigo_barras).replace(/(\d{12})/g, '$1 ').trim()}
                        </Text>
                        <TouchableOpacity
                          style={styles.copyBtn}
                          onPress={() => void copyText(String(g.codigo_barras), 'Código de barras')}
                        >
                          <Ionicons name="copy-outline" size={18} color="#FFFFFF" />
                          <Text style={styles.copyBtnText}>Copiar para pagar no banco</Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}

                    {g.qr_code_pix ? (
                      <View style={styles.block}>
                        <Text style={styles.blockTitle}>PIX</Text>
                        <View style={styles.qrWrap}>
                          <GuiaQrCode value={String(g.qr_code_pix)} size={168} />
                        </View>
                        <Text style={styles.pixHint}>Escaneie no app do seu banco ou copie o código abaixo.</Text>
                        <Text style={styles.pixCopia} selectable numberOfLines={3}>
                          {g.qr_code_pix}
                        </Text>
                        <TouchableOpacity
                          style={styles.copyBtn}
                          onPress={() => void copyText(String(g.qr_code_pix), 'PIX copia e cola')}
                        >
                          <Ionicons name="copy-outline" size={18} color="#FFFFFF" />
                          <Text style={styles.copyBtnText}>Copiar PIX copia e cola</Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}

                    {!g.codigo_barras && !g.qr_code_pix ? (
                      <Text style={styles.noPayData}>
                        O contador ainda não cadastrou código de barras nem PIX nesta guia. Entre em contato com o
                        escritório para pagar ou receber o boleto.
                      </Text>
                    ) : null}

                    {g.status !== 'paga' ? (
                      <View style={styles.payBlock}>
                        <Text style={styles.blockTitle}>Informar pagamento</Text>
                        <Text style={styles.payHint}>
                          Marque quando o valor já tiver saído da sua conta. O contador confere depois no sistema.
                        </Text>
                        <FileUpload
                          key={`comp-${g.guia_id}`}
                          label="Anexar comprovante (opcional)"
                          onFileSelect={(b64) => setComprovanteB64(b64)}
                          currentFile={comprovanteB64 || undefined}
                          enableOCR={false}
                        />
                        <TouchableOpacity
                          style={[styles.confirmPayBtn, markingId === g.guia_id && styles.confirmPayBtnDisabled]}
                          onPress={() => void marcarComoPaga(g)}
                          disabled={markingId === g.guia_id}
                          activeOpacity={0.85}
                        >
                          {markingId === g.guia_id ? (
                            <ActivityIndicator color="#FFFFFF" />
                          ) : (
                            <>
                              <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                              <Text style={styles.confirmPayText}>Já paguei — avisar o escritório</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: premium.bg },
  heroBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  heroPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, marginBottom: 8 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: premium.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: premium.border,
  },
  pillText: { fontSize: 11, fontWeight: '600', color: premium.textMuted },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#F3F4F6' },
  muted: { marginTop: 12, color: '#6B7280', fontSize: 14 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  hero: {
    backgroundColor: '#1E3A8A',
    borderRadius: 14,
    padding: 18,
    marginBottom: 16,
  },
  heroKicker: { color: '#BFDBFE', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  heroTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', marginTop: 6 },
  heroSub: { color: '#E0E7FF', fontSize: 14, marginTop: 4 },
  heroHint: { color: '#C7D2FE', fontSize: 12, marginTop: 10, lineHeight: 18 },
  installSlot: { marginTop: 14 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardOpen: {
    borderColor: '#93C5FD',
    borderWidth: 2,
  },
  tapHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  tapHintText: { flex: 1, fontSize: 12, fontWeight: '600', color: '#1E40AF' },
  expand: { marginTop: 12 },
  block: { marginBottom: 16 },
  blockTitle: { fontSize: 11, fontWeight: '800', color: '#6B7280', letterSpacing: 0.6, marginBottom: 8 },
  blockBody: { fontSize: 14, color: '#374151', lineHeight: 20 },
  barcode: {
    fontSize: 13,
    color: '#111827',
    fontFamily: Platform.select({ web: 'monospace', default: undefined }),
    lineHeight: 20,
    marginBottom: 10,
  },
  qrWrap: { alignItems: 'center', marginVertical: 8 },
  pixHint: { fontSize: 12, color: '#6B7280', textAlign: 'center', marginBottom: 8 },
  pixCopia: { fontSize: 11, color: '#374151', marginBottom: 10 },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1E40AF',
    paddingVertical: 12,
    borderRadius: 10,
  },
  copyBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  noPayData: { fontSize: 13, color: '#6B7280', lineHeight: 20 },
  payBlock: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  payHint: { fontSize: 12, color: '#6B7280', lineHeight: 18, marginBottom: 12 },
  confirmPayBtn: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#059669',
    paddingVertical: 14,
    borderRadius: 12,
  },
  confirmPayBtnDisabled: { opacity: 0.7 },
  confirmPayText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  valor: { fontSize: 18, fontWeight: '800', color: '#111827' },
  tipo: { fontSize: 13, fontWeight: '700', color: '#1E40AF', marginBottom: 4 },
  desc: { fontSize: 15, color: '#374151', marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  meta: { fontSize: 13, color: '#6B7280' },
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { marginTop: 12, color: '#6B7280', fontSize: 15 },
  errorText: { marginTop: 16, textAlign: 'center', color: '#374151', fontSize: 16, lineHeight: 24 },
});
