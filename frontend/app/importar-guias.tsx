import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Switch,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { BulkUploadZone, PickedBulkFile } from '../components/bulk/BulkUploadZone';
import { empresasAPI, guiasLoteAPI, ocrAPI } from '../services/api';
import { useToast } from '../contexts/ToastContext';

type StepKey =
  | 'empresa'
  | 'valor'
  | 'vencimento'
  | 'tipo'
  | 'cnpj'
  | 'barcode';

type LoteItem = {
  temp_id: string;
  filename: string;
  file_hash: string;
  base64: string;
  fileType: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  currentLabel: string;
  steps: Record<StepKey, boolean>;
  texto_completo?: string;
  valor?: number;
  data_vencimento?: string;
  data_vencimento_iso?: string;
  codigo_barras?: string;
  qr_code_pix?: string;
  competencia?: string;
  tipo?: string;
  tipo_documento?: string;
  descricao?: string;
  descricao_sugerida?: string;
  cnpj?: string;
  empresa_id?: string;
  empresa_nome?: string;
  match_confianca?: string;
  alertas_duplicidade?: string[];
  tem_duplicidade?: boolean;
  pronto?: boolean;
  ja_cadastrada?: boolean;
  cnpj_exibicao?: string;
  arquivo_repetido_lote?: boolean;
  selected: boolean;
  ignorar_duplicidade: boolean;
  erro?: string;
};

const STEP_LABELS: { key: StepKey; label: string; icon: string }[] = [
  { key: 'empresa', label: 'Empresa identificada', icon: 'business' },
  { key: 'valor', label: 'Valor identificado', icon: 'cash' },
  { key: 'vencimento', label: 'Vencimento identificado', icon: 'calendar' },
  { key: 'tipo', label: 'Tipo de imposto identificado', icon: 'document-text' },
  { key: 'cnpj', label: 'CNPJ identificado', icon: 'finger-print' },
  { key: 'barcode', label: 'Código de barras', icon: 'barcode' },
];

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Gera um hash determinístico do arquivo no próprio navegador.
 * Não precisa coincidir com o hash do backend — serve apenas para
 * o backend detectar arquivos repetidos *dentro do mesmo lote*.
 * Isso evita uma chamada extra a /api/ocr/lote/hash que falhava
 * no cold-start do Render free.
 */
async function computeLocalHash(dataUrl: string): Promise<string> {
  const payload = dataUrl.includes(',') ? dataUrl.split(',', 2)[1] : dataUrl;
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as any).crypto?.subtle) {
      const enc = new TextEncoder().encode(payload);
      const buf = await (globalThis as any).crypto.subtle.digest('SHA-256', enc);
      const arr = Array.from(new Uint8Array(buf));
      return arr.map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
    }
  } catch {
    // segue para o fallback djb2
  }
  let h = 5381;
  for (let i = 0; i < payload.length; i++) {
    h = ((h * 33) ^ payload.charCodeAt(i)) >>> 0;
  }
  return `loc${h.toString(16).padStart(8, '0')}${payload.length.toString(16)}`.slice(0, 32);
}

/** Tenta o OCR com 1 retry — cobre cold-start do Render. */
async function ocrComRetry(base64: string) {
  try {
    return await ocrAPI.processar(base64);
  } catch (err: any) {
    const msg = String(err?.message || '');
    const status = err?.response?.status;
    const isTimeoutOuRede =
      msg.includes('timeout') || msg.includes('Network') || status === 502 || status === 503 || status === 504;
    if (!isTimeoutOuRede) throw err;
    await sleep(1500);
    return await ocrAPI.processar(base64);
  }
}

export default function ImportarGuiasScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const [phase, setPhase] = useState<'upload' | 'processing' | 'review' | 'done'>('upload');
  const [items, setItems] = useState<LoteItem[]>([]);
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [grupos, setGrupos] = useState<any[]>([]);
  const [resumo, setResumo] = useState<any>(null);
  const [processing, setProcessing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [enviarNotificacoes, setEnviarNotificacoes] = useState(true);
  const [resultado, setResultado] = useState<any>(null);

  const progressPct = useMemo(() => {
    if (!items.length) return 0;
    const done = items.filter((i) => i.status === 'done' || i.status === 'error').length;
    return Math.round((done / items.length) * 100);
  }, [items]);

  const selectedCount = items.filter((i) => i.selected && i.pronto).length;

  const loadEmpresas = useCallback(async () => {
    const res = await empresasAPI.listar();
    setEmpresas(res.data || []);
  }, []);

  const processFiles = async (files: PickedBulkFile[]) => {
    await loadEmpresas();
    const initial: LoteItem[] = files.map((f) => ({
      temp_id: f.id,
      filename: f.name,
      file_hash: '',
      base64: f.base64,
      fileType: f.fileType,
      status: 'pending',
      currentLabel: 'Na fila...',
      steps: {
        empresa: false,
        valor: false,
        vencimento: false,
        tipo: false,
        cnpj: false,
        barcode: false,
      },
      selected: true,
      ignorar_duplicidade: false,
    }));
    setItems(initial);
    setPhase('processing');
    setProcessing(true);

    const ocrResults: LoteItem[] = [];

    for (let idx = 0; idx < initial.length; idx++) {
      const it = { ...initial[idx], status: 'processing' as const, currentLabel: 'Lendo guia...' };
      setItems((prev) => prev.map((p) => (p.temp_id === it.temp_id ? it : p)));

      try {
        const [fileHash, ocrRes] = await Promise.all([
          computeLocalHash(it.base64),
          ocrComRetry(it.base64),
        ]);
        const d = ocrRes.data;
        await sleep(200);

        const steps: Record<StepKey, boolean> = {
          empresa: false,
          valor: Boolean(d.valor),
          vencimento: Boolean(d.data_vencimento),
          tipo: Boolean(d.tipo_documento),
          cnpj: Boolean(d.cnpj),
          barcode: Boolean(d.codigo_barras),
        };

        let cur = { ...it, file_hash: fileHash };
        for (const s of STEP_LABELS) {
          cur = { ...cur, currentLabel: s.label };
          setItems((prev) => prev.map((p) => (p.temp_id === cur.temp_id ? { ...cur, steps: { ...steps } } : p)));
          await sleep(280);
        }

        ocrResults.push({
          ...cur,
          status: 'done',
          currentLabel: 'Leitura concluída',
          steps,
          texto_completo: d.texto_completo,
          valor: d.valor,
          data_vencimento: d.data_vencimento,
          codigo_barras: d.codigo_barras,
          qr_code_pix: d.qr_code_pix,
          competencia: d.competencia,
          tipo_documento: d.tipo_documento,
          descricao_sugerida: d.descricao_sugerida,
          cnpj: d.cnpj,
        });
        setItems((prev) =>
          prev.map((p) =>
            p.temp_id === cur.temp_id
              ? ocrResults[ocrResults.length - 1]
              : p,
          ),
        );
      } catch (e: any) {
        const err = e?.response?.data?.detail || 'Erro no OCR';
        ocrResults.push({
          ...it,
          status: 'error',
          currentLabel: err,
          erro: String(err),
          selected: false,
        });
        setItems((prev) => prev.map((p) => (p.temp_id === it.temp_id ? ocrResults[ocrResults.length - 1] : p)));
      }
    }

    try {
      const analise = await ocrAPI.loteAnalisar(
        ocrResults.map((r) => ({
          temp_id: r.temp_id,
          filename: r.filename,
          file_hash: r.file_hash,
          texto_completo: r.texto_completo,
          valor: r.valor,
          data_vencimento: r.data_vencimento,
          codigo_barras: r.codigo_barras,
          qr_code_pix: r.qr_code_pix,
          competencia: r.competencia,
          tipo_documento: r.tipo_documento,
          descricao_sugerida: r.descricao_sugerida,
          cnpj: r.cnpj,
          empresa_id: r.empresa_id,
        })),
      );
      const merged = (analise.data.itens || []).map((row: any) => {
        const src = ocrResults.find((o) => o.temp_id === row.temp_id)!;
        return {
          ...src,
          ...row,
          steps: {
            ...src.steps,
            empresa: Boolean(row.empresa_id),
          },
          pronto: row.pronto,
          ja_cadastrada: row.ja_cadastrada,
          cnpj_exibicao: row.cnpj_exibicao,
          arquivo_repetido_lote: row.arquivo_repetido_lote,
          selected: Boolean(
            row.pronto && !row.arquivo_repetido_lote && !row.ja_cadastrada,
          ),
        };
      });
      setItems(merged);
      setGrupos(analise.data.grupos || []);
      setResumo(analise.data.resumo);
      setPhase('review');
    } catch {
      // Fallback: análise do lote falhou (ex.: cold-start ou timeout do Render).
      // Garante que os dados já lidos pelo OCR não se percam — o usuário
      // pode revisar e vincular a empresa manualmente.
      const fallback = ocrResults.map((r) => ({
        ...r,
        tipo: r.tipo_documento || r.tipo,
        descricao: r.descricao_sugerida || r.tipo_documento || 'Guia',
        pronto: false,
        ja_cadastrada: false,
        arquivo_repetido_lote: false,
        tem_duplicidade: false,
        alertas_duplicidade: [],
        cnpj_exibicao:
          r.cnpj && r.cnpj.length === 14
            ? `${r.cnpj.slice(0, 2)}.${r.cnpj.slice(2, 5)}.${r.cnpj.slice(5, 8)}/${r.cnpj.slice(8, 12)}-${r.cnpj.slice(12)}`
            : undefined,
        selected: false,
      }));
      setItems(fallback);
      setGrupos([]);
      setResumo({
        total: fallback.length,
        prontos: 0,
        duplicatas: 0,
        sem_empresa: fallback.length,
        ja_cadastradas: 0,
      });
      showToast(
        'Os dados foram lidos, mas a análise automática falhou. Revise e vincule a empresa manualmente.',
        'error',
      );
      setPhase('review');
    } finally {
      setProcessing(false);
    }
  };

  const updateItem = (tempId: string, patch: Partial<LoteItem>) => {
    setItems((prev) =>
      prev.map((i) => (i.temp_id === tempId ? { ...i, ...patch, pronto: undefined } : i)),
    );
  };

  const recalcPronto = (it: LoteItem) =>
    Boolean(it.empresa_id && it.valor && (it.data_vencimento_iso || it.data_vencimento));

  const handleConfirm = async () => {
    const toSend = items.filter((i) => i.selected && recalcPronto(i));
    if (!toSend.length) {
      showToast('Selecione ao menos uma guia válida', 'error');
      return;
    }
    setConfirming(true);
    try {
      const payload = {
        enviar_notificacoes: enviarNotificacoes,
        itens: toSend.map((i) => ({
          temp_id: i.temp_id,
          empresa_id: i.empresa_id,
          tipo: i.tipo || i.tipo_documento || 'OUTROS',
          descricao: i.descricao || i.descricao_sugerida || i.tipo || 'Guia',
          valor: i.valor,
          data_vencimento: i.data_vencimento_iso || i.data_vencimento,
          codigo_barras: i.codigo_barras,
          qr_code_pix: i.qr_code_pix,
          competencia: i.competencia,
          arquivo_guia: i.base64,
          nome_arquivo_guia: i.filename,
          tipo_arquivo_guia: i.fileType,
          ignorar_duplicidade: i.ignorar_duplicidade,
        })),
      };
      const res = await guiasLoteAPI.confirmar(payload);
      setResultado(res.data);
      setPhase('done');
      showToast(`${res.data.criadas} guia(s) cadastrada(s)`, 'success');
    } catch (e: any) {
      showToast(e?.response?.data?.detail || 'Erro ao confirmar lote', 'error');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1E1B4B" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Importação IA</Text>
          <Text style={styles.headerSub}>Envie várias guias — o sistema organiza tudo</Text>
        </View>
        <View style={styles.aiBadge}>
          <Ionicons name="sparkles" size={14} color="#4F46E5" />
          <Text style={styles.aiBadgeText}>IA</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {phase === 'upload' && (
          <BulkUploadZone onFilesPicked={processFiles} loading={processing} />
        )}

        {phase === 'processing' && (
          <View>
            <View style={styles.progressCard}>
              <Text style={styles.progressTitle}>Processando com inteligência artificial</Text>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${progressPct}%` }]} />
              </View>
              <Text style={styles.progressPct}>{progressPct}%</Text>
            </View>
            {items.map((item) => (
              <View key={item.temp_id} style={styles.procCard}>
                <View style={styles.procHeader}>
                  <Ionicons name="document" size={20} color="#4F46E5" />
                  <Text style={styles.procName} numberOfLines={1}>{item.filename}</Text>
                  {item.status === 'processing' && (
                    <ActivityIndicator size="small" color="#4F46E5" />
                  )}
                  {item.status === 'done' && (
                    <Ionicons name="checkmark-circle" size={22} color="#059669" />
                  )}
                  {item.status === 'error' && (
                    <Ionicons name="alert-circle" size={22} color="#DC2626" />
                  )}
                </View>
                <Text style={styles.procStatus}>{item.currentLabel}</Text>
                <View style={styles.stepsCol}>
                  {STEP_LABELS.map((s) => (
                    <View key={s.key} style={styles.stepRow}>
                      <Ionicons
                        name={item.steps[s.key] ? 'checkmark-circle' : 'ellipse-outline'}
                        size={16}
                        color={item.steps[s.key] ? '#059669' : '#CBD5E1'}
                      />
                      <Text
                        style={[
                          styles.stepText,
                          item.steps[s.key] && styles.stepTextDone,
                        ]}
                      >
                        {s.label}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}

        {phase === 'review' && (
          <View>
            {resumo && (
              <>
                <View style={styles.summaryRow}>
                  <SummaryChip label="Total" value={String(resumo.total)} />
                  <SummaryChip label="Prontas" value={String(resumo.prontos)} color="#059669" />
                  <SummaryChip label="Duplicatas" value={String(resumo.duplicatas)} color="#D97706" />
                  <SummaryChip label="Sem empresa" value={String(resumo.sem_empresa)} color="#DC2626" />
                </View>
                {(resumo.ja_cadastradas > 0 || resumo.duplicatas > 0) && (
                  <View style={styles.infoBanner}>
                    <Ionicons name="information-circle" size={20} color="#1E40AF" />
                    <Text style={styles.infoBannerText}>
                      {resumo.ja_cadastradas > 0
                        ? `${resumo.ja_cadastradas} guia(s) já existem no sistema (mesmo código de barras). A empresa foi vinculada automaticamente. Para testar de novo, use arquivos novos ou exclua as guias antigas.`
                        : 'Alguns itens parecem repetidos neste lote.'}
                    </Text>
                  </View>
                )}
              </>
            )}

            {grupos.length > 0 && (
              <View style={styles.groupCard}>
                <Text style={styles.groupTitle}>Agrupamento automático</Text>
                {grupos.map((g) => (
                  <Text key={g.empresa_id || 'x'} style={styles.groupLine}>
                    • {g.empresa_nome} — {g.quantidade} guia(s)
                  </Text>
                ))}
              </View>
            )}

            <View style={styles.notifyRow}>
              <Text style={styles.notifyLabel}>Enviar ao cliente após confirmar</Text>
              <Switch value={enviarNotificacoes} onValueChange={setEnviarNotificacoes} />
            </View>

            <View style={styles.tableHead}>
              <Text style={[styles.th, { flex: 0.4 }]} />
              <Text style={[styles.th, { flex: 1.2 }]}>Empresa</Text>
              <Text style={[styles.th, { flex: 0.6 }]}>Tipo</Text>
              <Text style={[styles.th, { flex: 0.7 }]}>Valor</Text>
              <Text style={[styles.th, { flex: 0.8 }]}>Venc.</Text>
            </View>

            {items.map((item) => (
              <View
                key={item.temp_id}
                style={[
                  styles.row,
                  item.tem_duplicidade && styles.rowDup,
                  !item.pronto && styles.rowWarn,
                ]}
              >
                <TouchableOpacity
                  style={styles.checkCol}
                  onPress={() => updateItem(item.temp_id, { selected: !item.selected })}
                >
                  <Ionicons
                    name={item.selected ? 'checkbox' : 'square-outline'}
                    size={22}
                    color={item.selected ? '#4F46E5' : '#94A3B8'}
                  />
                </TouchableOpacity>
                <View style={{ flex: 1.2 }}>
                  <Text style={styles.cellTitle} numberOfLines={1}>
                    {item.empresa_nome || '—'}
                  </Text>
                  {item.cnpj_exibicao ? (
                    <Text style={styles.cnpjText}>CNPJ: {item.cnpj_exibicao}</Text>
                  ) : item.cnpj ? (
                    <Text style={styles.cnpjText}>CNPJ detectado (revise)</Text>
                  ) : null}
                  {item.ja_cadastrada && item.empresa_nome && (
                    <Text style={styles.linkedText}>Empresa vinculada pela guia existente</Text>
                  )}
                  {item.tem_duplicidade && (
                    <Text style={styles.dupText}>
                      {item.alertas_duplicidade?.[0] || 'Possível duplicada'}
                    </Text>
                  )}
                  {!item.empresa_id && empresas.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {empresas.slice(0, 5).map((e) => (
                        <TouchableOpacity
                          key={e.empresa_id}
                          style={styles.empChip}
                          onPress={() =>
                            updateItem(item.temp_id, {
                              empresa_id: e.empresa_id,
                              empresa_nome: e.nome_fantasia || e.razao_social,
                            })
                          }
                        >
                          <Text style={styles.empChipText} numberOfLines={1}>
                            {(e.nome_fantasia || e.razao_social).slice(0, 18)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  )}
                </View>
                <TextInput
                  style={[styles.cellInput, { flex: 0.6 }]}
                  value={item.tipo || ''}
                  onChangeText={(t) => updateItem(item.temp_id, { tipo: t.toUpperCase() })}
                />
                <TextInput
                  style={[styles.cellInput, { flex: 0.7 }]}
                  value={item.valor != null ? String(item.valor).replace('.', ',') : ''}
                  onChangeText={(t) => {
                    const v = parseFloat(t.replace(',', '.'));
                    updateItem(item.temp_id, { valor: isNaN(v) ? undefined : v });
                  }}
                  keyboardType="decimal-pad"
                />
                <TextInput
                  style={[styles.cellInput, { flex: 0.8 }]}
                  value={item.data_vencimento || item.data_vencimento_iso || ''}
                  onChangeText={(t) =>
                    updateItem(item.temp_id, {
                      data_vencimento: t,
                      data_vencimento_iso: undefined,
                    })
                  }
                  placeholder="DD/MM/AAAA"
                />
                {item.tem_duplicidade && (
                  <TouchableOpacity
                    style={styles.ignoreDup}
                    onPress={() =>
                      updateItem(item.temp_id, {
                        ignorar_duplicidade: !item.ignorar_duplicidade,
                        selected: true,
                      })
                    }
                  >
                    <Text style={styles.ignoreDupText}>
                      {item.ignorar_duplicidade ? 'Duplicata ignorada' : 'Importar mesmo assim'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}

            <TouchableOpacity
              style={[styles.confirmBtn, confirming && { opacity: 0.6 }]}
              onPress={handleConfirm}
              disabled={confirming}
            >
              {confirming ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Ionicons name="checkmark-done" size={20} color="#FFF" />
                  <Text style={styles.confirmBtnText}>
                    Confirmar {selectedCount} guia(s)
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {phase === 'done' && resultado && (
          <View style={styles.doneCard}>
            <Ionicons name="checkmark-circle" size={56} color="#059669" />
            <Text style={styles.doneTitle}>Lote importado</Text>
            <Text style={styles.doneSub}>
              {resultado.criadas} guia(s) criada(s)
              {resultado.notificacoes_enviadas
                ? ` · ${resultado.notificacoes_enviadas} WhatsApp enviado(s)`
                : ''}
            </Text>
            {resultado.erros?.length > 0 && (
              <Text style={styles.doneErr}>{resultado.erros.length} item(ns) com erro</Text>
            )}
            <TouchableOpacity style={styles.confirmBtn} onPress={() => router.replace('/(tabs)/guias')}>
              <Text style={styles.confirmBtnText}>Ver guias</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryChip({
  label,
  value,
  color = '#1E1B4B',
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <View style={styles.chip}>
      <Text style={[styles.chipVal, { color }]}>{value}</Text>
      <Text style={styles.chipLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 8,
  },
  backBtn: { padding: 6 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#1E1B4B' },
  headerSub: { fontSize: 12, color: '#64748B' },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  aiBadgeText: { fontSize: 12, fontWeight: '800', color: '#4F46E5' },
  scroll: { padding: 16, paddingBottom: 40 },
  progressCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  progressTitle: { fontSize: 16, fontWeight: '700', color: '#1E1B4B', marginBottom: 12 },
  progressBarBg: {
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#4F46E5',
    borderRadius: 4,
  },
  progressPct: { marginTop: 8, fontSize: 13, color: '#64748B', textAlign: 'right' },
  procCard: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  procHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  procName: { flex: 1, fontWeight: '600', color: '#334155' },
  procStatus: { fontSize: 13, color: '#4F46E5', marginBottom: 10, fontWeight: '600' },
  stepsCol: { gap: 4 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepText: { fontSize: 12, color: '#94A3B8' },
  stepTextDone: { color: '#059669', fontWeight: '600' },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: {
    backgroundColor: '#FFF',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    minWidth: 72,
    alignItems: 'center',
  },
  chipVal: { fontSize: 18, fontWeight: '800' },
  chipLabel: { fontSize: 11, color: '#64748B' },
  infoBanner: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  infoBannerText: { flex: 1, fontSize: 13, color: '#1E3A8A', lineHeight: 18 },
  cnpjText: { fontSize: 11, color: '#64748B', marginTop: 2 },
  linkedText: { fontSize: 11, color: '#059669', marginTop: 2, fontWeight: '600' },
  groupCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  groupTitle: { fontWeight: '700', color: '#166534', marginBottom: 8 },
  groupLine: { fontSize: 13, color: '#15803D', marginBottom: 4 },
  notifyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
  },
  notifyLabel: { fontSize: 14, fontWeight: '600', color: '#334155', flex: 1 },
  tableHead: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    marginBottom: 8,
    gap: 4,
  },
  th: { fontSize: 10, fontWeight: '700', color: '#64748B', textTransform: 'uppercase' },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  rowDup: { borderColor: '#FCD34D', backgroundColor: '#FFFBEB' },
  rowWarn: { borderColor: '#FECACA' },
  checkCol: { width: 32, alignItems: 'center' },
  cellTitle: { fontSize: 13, fontWeight: '600', color: '#1E293B' },
  dupText: { fontSize: 11, color: '#B45309', marginTop: 2 },
  cellInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: Platform.OS === 'web' ? 8 : 6,
    fontSize: 12,
    minWidth: 56,
  },
  empChip: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 4,
    marginRight: 4,
  },
  empChipText: { fontSize: 11, color: '#4F46E5', fontWeight: '600' },
  ignoreDup: { width: '100%', marginTop: 4 },
  ignoreDupText: { fontSize: 11, color: '#4F46E5', fontWeight: '600' },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#4F46E5',
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 16,
  },
  confirmBtnText: { color: '#FFF', fontWeight: '800', fontSize: 16 },
  doneCard: { alignItems: 'center', padding: 32, backgroundColor: '#FFF', borderRadius: 16 },
  doneTitle: { fontSize: 22, fontWeight: '800', color: '#1E1B4B', marginTop: 16 },
  doneSub: { fontSize: 14, color: '#64748B', marginTop: 8, textAlign: 'center' },
  doneErr: { fontSize: 13, color: '#DC2626', marginTop: 8 },
});
