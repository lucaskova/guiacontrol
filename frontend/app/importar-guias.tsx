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
  cnpj_novo?: boolean;
  empresa_hint?: string;
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

function onlyDigits(v?: string | null) {
  return (v || '').replace(/\D/g, '');
}

function formatCnpj(digits: string) {
  if (digits.length !== 14) return undefined;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

function validarCnpj(cnpj: string): boolean {
  const c = onlyDigits(cnpj);
  if (c.length !== 14 || c === c[0].repeat(14)) return false;
  const calc = (nums: string, pesos: number[]) => {
    const s = nums.split('').reduce((acc, n, i) => acc + Number(n) * pesos[i], 0);
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const p1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const p2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  if (calc(c.slice(0, 12), p1) !== Number(c[12])) return false;
  if (calc(c.slice(0, 13), p2) !== Number(c[13])) return false;
  return true;
}

function hintsFromFilename(filename?: string) {
  if (!filename) return {} as Record<string, string>;
  const base = filename.replace(/\.[^.]+$/, '').toUpperCase();
  const hints: Record<string, string> = {};
  for (const tipo of ['ICMS', 'DAS', 'DARF', 'ISS', 'INSS', 'FGTS', 'GPS', 'GRU', 'GARE', 'DAE']) {
    if (base.includes(tipo)) {
      hints.tipo_documento = tipo;
      break;
    }
  }
  if (base.includes('PARCELAMENTO')) {
    hints.tipo_documento = 'PARCELAMENTO';
    hints.descricao_sugerida = 'Parcelamento';
  }
  const comp = base.match(/\b(\d{2})[\./](\d{4})\b/);
  if (comp) hints.competencia = `${comp[1]}/${comp[2]}`;
  return hints;
}

function normalizeName(s: string) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const STOP_TOKENS = new Set([
  'LTDA', 'ME', 'EPP', 'EIRELI', 'SA', 'CIA', 'DE', 'DA', 'DO', 'DOS', 'DAS', 'E',
  'INDUSTRIA', 'COMERCIO', 'COM', 'IND', 'EQUIP', 'EQUIPAMENTOS',
]);

function significantTokens(name: string): string[] {
  return normalizeName(name)
    .split(' ')
    .filter((t) => t.length >= 3 && !STOP_TOKENS.has(t));
}

function extractCompanyFromFilename(filename?: string) {
  if (!filename) return '';
  return filename
    .replace(/\.[^.]+$/i, '')
    .replace(/^GUIA\s+(ICMS\s*A?\s*|PARCELAMENTO\s*\d+\s*)/i, '')
    .replace(/\s+\d{2}[./]\d{4}\s*$/i, '')
    .trim();
}

function matchEmpresaLocal(
  empresasList: any[],
  item: Pick<LoteItem, 'cnpj' | 'filename' | 'texto_completo'>,
) {
  const cnpjDigits = onlyDigits(item.cnpj);
  if (cnpjDigits.length === 14) {
    const emp = empresasList.find((e) => onlyDigits(e.cnpj) === cnpjDigits);
    if (emp) return { emp, conf: 'alta' as const };
  }

  const textoNorm = normalizeName(`${item.filename || ''} ${item.texto_completo || ''}`);
  const nomeArquivo = extractCompanyFromFilename(item.filename);
  const nomeArquivoNorm = normalizeName(nomeArquivo);
  const fileTokens = significantTokens(nomeArquivo || item.filename || '');

  let best: any = null;
  let bestScore = 0;

  for (const emp of empresasList) {
    for (const campo of [emp.nome_fantasia, emp.razao_social]) {
      if (!campo) continue;
      const nomeNorm = normalizeName(campo);
      if (nomeNorm.length < 5) continue;

      if (textoNorm.includes(nomeNorm) && nomeNorm.length >= 8) {
        return { emp, conf: 'alta' as const };
      }

      if (nomeArquivoNorm.length >= 5) {
        if (nomeNorm.includes(nomeArquivoNorm) || nomeArquivoNorm.includes(nomeNorm)) {
          const score = Math.min(nomeNorm.length, nomeArquivoNorm.length) / Math.max(nomeNorm.length, nomeArquivoNorm.length);
          if (score > bestScore) {
            best = emp;
            bestScore = score;
          }
        }
      }

      const empTokens = significantTokens(campo);
      if (empTokens.length >= 2 && fileTokens.length >= 2) {
        const hits = empTokens.filter((t) => fileTokens.includes(t)).length;
        const score = hits / empTokens.length;
        if (hits >= 2 && score >= 0.45 && score > bestScore) {
          best = emp;
          bestScore = score;
        }
      }
    }
  }

  if (best && bestScore >= 0.45) {
    return { emp: best, conf: bestScore >= 0.75 ? ('alta' as const) : ('media' as const) };
  }
  return { emp: null, conf: 'nenhuma' as const };
}

function agruparItensLocal(itens: LoteItem[]) {
  const map = new Map<string, LoteItem[]>();
  for (const it of itens) {
    const key = it.empresa_id || '_sem_empresa';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(it);
  }
  return Array.from(map.entries()).map(([empId, lista]) => ({
    empresa_id: empId === '_sem_empresa' ? null : empId,
    empresa_nome:
      lista[0]?.empresa_nome ||
      extractCompanyFromFilename(lista[0]?.filename) ||
      'Identificar empresa',
    quantidade: lista.length,
    itens: lista.map((x) => x.temp_id),
  }));
}

function analisarLoteLocal(items: LoteItem[], empresasList: any[]) {
  const hashesVistos = new Set<string>();

  const processados = items.map((item) => {
    const hints = hintsFromFilename(item.filename);
    const tipo = item.tipo || item.tipo_documento || hints.tipo_documento || 'OUTROS';
    const competencia = item.competencia || hints.competencia;
    const cnpjDigits = onlyDigits(item.cnpj);
    const nomeArquivo = extractCompanyFromFilename(item.filename);

    const match = matchEmpresaLocal(empresasList, item);
    let empresa_id = item.empresa_id || match.emp?.empresa_id;
    let empresa_nome = item.empresa_nome || match.emp?.nome_fantasia || match.emp?.razao_social;
    let match_confianca = match.conf;

    let arquivo_repetido_lote = false;
    if (item.file_hash) {
      if (hashesVistos.has(item.file_hash)) arquivo_repetido_lote = true;
      else hashesVistos.add(item.file_hash);
    }

    const updated: LoteItem = {
      ...item,
      tipo,
      competencia,
      descricao_sugerida: item.descricao_sugerida || hints.descricao_sugerida || tipo,
      tipo_documento: item.tipo_documento || hints.tipo_documento,
      empresa_id,
      empresa_nome,
      match_confianca,
      cnpj_exibicao: formatCnpj(cnpjDigits),
      cnpj_novo: Boolean(!empresa_id && cnpjDigits.length === 14 && validarCnpj(cnpjDigits)),
      alertas_duplicidade: arquivo_repetido_lote ? ['Arquivo duplicado no mesmo lote.'] : [],
      tem_duplicidade: arquivo_repetido_lote,
      ja_cadastrada: item.ja_cadastrada || false,
      arquivo_repetido_lote,
      steps: {
        ...item.steps,
        empresa: Boolean(empresa_id),
        tipo: Boolean(tipo && tipo !== 'OUTROS'),
      },
    };
    updated.pronto = Boolean(
      updated.empresa_id && updated.valor && (updated.data_vencimento_iso || updated.data_vencimento),
    );
    updated.selected = Boolean(
      updated.pronto && !updated.arquivo_repetido_lote && !updated.ja_cadastrada,
    );
    if (!updated.empresa_id && nomeArquivo) {
      updated.empresa_hint = nomeArquivo;
    }
    return updated;
  });

  const cnpjsNovos = new Set(
    processados.filter((i) => i.cnpj_novo && i.cnpj).map((i) => onlyDigits(i.cnpj)),
  );

  return {
    itens: processados,
    grupos: agruparItensLocal(processados),
    resumo: {
      total: processados.length,
      prontos: processados.filter((i) => i.pronto).length,
      duplicatas: processados.filter((i) => i.tem_duplicidade).length,
      sem_empresa: processados.filter((i) => !i.empresa_id).length,
      ja_cadastradas: processados.filter((i) => i.ja_cadastrada).length,
      cnpjs_novos_unicos: cnpjsNovos.size,
    },
  };
}

function empresasSugeridasParaItem(item: LoteItem, empresasList: any[]) {
  const match = matchEmpresaLocal(empresasList, item);
  if (!match.emp) return empresasList;
  return [
    match.emp,
    ...empresasList.filter((e) => e.empresa_id !== match.emp!.empresa_id),
  ];
}

async function loteAnalisarComRetry(payload: unknown[], retries = 2) {
  let lastErr: any;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await ocrAPI.loteAnalisar(payload);
    } catch (e: any) {
      lastErr = e;
      const status = e?.response?.status;
      const retryable =
        !status ||
        status >= 502 ||
        e?.code === 'ECONNABORTED' ||
        e?.message === 'Network Error';
      if (attempt < retries && retryable) {
        await sleep(2500 * (attempt + 1));
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
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
  const [creatingCnpjs, setCreatingCnpjs] = useState<Set<string>>(new Set());
  const [creatingAll, setCreatingAll] = useState(false);

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
    let empresasList: any[] = [];
    try {
      const empRes = await empresasAPI.listar();
      empresasList = empRes.data || [];
      setEmpresas(empresasList);
    } catch {
      showToast('Não foi possível carregar empresas — vincule manualmente se necessário', 'info');
    }
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
        const [hashRes, ocrRes] = await Promise.all([
          ocrAPI.loteHash(it.base64),
          ocrAPI.processar(it.base64),
        ]);
        const d = ocrRes.data;
        const hints = hintsFromFilename(it.filename);
        await sleep(200);

        const tipoDoc = d.tipo_documento || hints.tipo_documento;
        const competencia = d.competencia || hints.competencia;

        const steps: Record<StepKey, boolean> = {
          empresa: false,
          valor: Boolean(d.valor),
          vencimento: Boolean(d.data_vencimento),
          tipo: Boolean(tipoDoc),
          cnpj: Boolean(d.cnpj),
          barcode: Boolean(d.codigo_barras),
        };

        let cur = { ...it, file_hash: hashRes.data.file_hash };
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
          competencia,
          tipo_documento: tipoDoc,
          descricao_sugerida: d.descricao_sugerida || hints.descricao_sugerida,
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

    const local = analisarLoteLocal(ocrResults, empresasList);
    setItems(local.itens);
    setGrupos(local.grupos);
    setResumo(local.resumo);
    setPhase('review');
    setProcessing(false);

  // Refino opcional no servidor (duplicidade no banco etc.) — não bloqueia a tela.
    void (async () => {
      try {
        const payload = ocrResults.map((r) => ({
          temp_id: r.temp_id,
          filename: r.filename,
          file_hash: r.file_hash,
          texto_completo: (r.texto_completo || '').slice(0, 4000),
          valor: r.valor ?? null,
          data_vencimento: r.data_vencimento ?? null,
          codigo_barras: r.codigo_barras ?? null,
          qr_code_pix: r.qr_code_pix ?? null,
          competencia: r.competencia ?? null,
          tipo_documento: r.tipo_documento ?? null,
          descricao_sugerida: r.descricao_sugerida ?? null,
          cnpj: r.cnpj ?? null,
          empresa_id: r.empresa_id ?? null,
        }));
        const analise = await loteAnalisarComRetry(payload, 1);
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
            cnpj_novo: row.cnpj_novo,
            arquivo_repetido_lote: row.arquivo_repetido_lote,
            selected: Boolean(
              row.pronto && !row.arquivo_repetido_lote && !row.ja_cadastrada,
            ),
          };
        });
        setItems(merged);
        setGrupos(analise.data.grupos || []);
        setResumo(analise.data.resumo);
      } catch {
        // Revisão local já está na tela — falha silenciosa.
      }
    })();
  };

  const updateItem = (tempId: string, patch: Partial<LoteItem>) => {
    setItems((prev) =>
      prev.map((i) => (i.temp_id === tempId ? { ...i, ...patch, pronto: undefined } : i)),
    );
  };

  const recalcPronto = (it: LoteItem) =>
    Boolean(it.empresa_id && it.valor && (it.data_vencimento_iso || it.data_vencimento));

  // CNPJs únicos detectados pelo OCR que ainda não estão cadastrados
  const cnpjsNovosUnicos = useMemo(() => {
    const map = new Map<string, { cnpj: string; cnpj_exibicao?: string; count: number }>();
    items.forEach((i) => {
      if (!i.cnpj_novo || !i.cnpj) return;
      const key = onlyDigits(i.cnpj);
      if (!key) return;
      const cur = map.get(key);
      if (cur) cur.count += 1;
      else map.set(key, { cnpj: i.cnpj, cnpj_exibicao: i.cnpj_exibicao, count: 1 });
    });
    return Array.from(map.values());
  }, [items]);

  const aplicarEmpresaNasLinhasDoCnpj = (cnpjDigits: string, empresa: any) => {
    setItems((prev) =>
      prev.map((row) => {
        if (onlyDigits(row.cnpj) !== cnpjDigits) return row;
        const updated: LoteItem = {
          ...row,
          empresa_id: empresa.empresa_id,
          empresa_nome: empresa.nome_fantasia || empresa.razao_social,
          match_confianca: 'alta',
          cnpj_novo: false,
          steps: { ...row.steps, empresa: true },
        };
        updated.pronto = recalcPronto(updated);
        if (updated.pronto && !updated.tem_duplicidade && !updated.arquivo_repetido_lote) {
          updated.selected = true;
        }
        return updated;
      }),
    );
  };

  const cadastrarEmpresaPorCnpj = useCallback(
    async (cnpjBruto: string): Promise<{ ok: boolean; empresa?: any; erro?: string }> => {
      const digits = onlyDigits(cnpjBruto);
      if (digits.length !== 14) {
        return { ok: false, erro: 'CNPJ inválido' };
      }
      setCreatingCnpjs((prev) => new Set(prev).add(digits));
      try {
        const res = await empresasAPI.criar({ cnpj: digits });
        const emp = res.data;
        setEmpresas((prev) => {
          if (prev.some((e) => e.empresa_id === emp.empresa_id)) return prev;
          return [...prev, emp];
        });
        aplicarEmpresaNasLinhasDoCnpj(digits, emp);
        return { ok: true, empresa: emp };
      } catch (e: any) {
        // Se já existia (erro 400 "Empresa já cadastrada"), tenta achar pela lista atualizada
        const detail: string = e?.response?.data?.detail || '';
        if (e?.response?.status === 400 && /j[aá] cadastrada/i.test(detail)) {
          try {
            const lista = await empresasAPI.listar();
            const arr = lista.data || [];
            setEmpresas(arr);
            const found = arr.find((x: any) => onlyDigits(x.cnpj) === digits);
            if (found) {
              aplicarEmpresaNasLinhasDoCnpj(digits, found);
              return { ok: true, empresa: found };
            }
          } catch {}
        }
        return { ok: false, erro: detail || 'Erro ao cadastrar empresa' };
      } finally {
        setCreatingCnpjs((prev) => {
          const n = new Set(prev);
          n.delete(digits);
          return n;
        });
      }
    },
    [],
  );

  const handleCadastrarUmCnpj = async (cnpj: string) => {
    const r = await cadastrarEmpresaPorCnpj(cnpj);
    if (r.ok && r.empresa) {
      const nome = r.empresa.nome_fantasia || r.empresa.razao_social || 'Empresa';
      showToast(`${nome} cadastrada e vinculada`, 'success');
    } else {
      showToast(r.erro || 'Não foi possível cadastrar a empresa', 'error');
    }
  };

  const handleCadastrarTodasEmpresasNovas = async () => {
    if (!cnpjsNovosUnicos.length) return;
    setCreatingAll(true);
    try {
      const results = await Promise.all(
        cnpjsNovosUnicos.map((c) => cadastrarEmpresaPorCnpj(c.cnpj)),
      );
      const ok = results.filter((r) => r.ok).length;
      const fail = results.length - ok;
      if (ok && !fail) {
        showToast(`${ok} empresa(s) cadastrada(s) e vinculada(s)`, 'success');
      } else if (ok && fail) {
        showToast(`${ok} cadastrada(s), ${fail} falharam`, 'info');
      } else {
        showToast('Não foi possível cadastrar as empresas novas', 'error');
      }
    } finally {
      setCreatingAll(false);
    }
  };

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

            {cnpjsNovosUnicos.length > 0 && (
              <View style={styles.cnpjBanner}>
                <View style={styles.cnpjBannerIcon}>
                  <Ionicons name="sparkles" size={20} color="#047857" />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.cnpjBannerTitle}>
                    {cnpjsNovosUnicos.length === 1
                      ? '1 empresa nova detectada'
                      : `${cnpjsNovosUnicos.length} empresas novas detectadas`}
                  </Text>
                  <Text style={styles.cnpjBannerSub}>
                    O OCR identificou {cnpjsNovosUnicos.length === 1 ? 'um CNPJ válido' : 'CNPJs válidos'} que ainda não está
                    {cnpjsNovosUnicos.length === 1 ? '' : 'ão'} na sua base. Cadastre em 1 clique — os dados (razão social, nome fantasia) vêm da Receita.
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.cnpjBannerBtn, creatingAll && { opacity: 0.6 }]}
                  onPress={handleCadastrarTodasEmpresasNovas}
                  disabled={creatingAll}
                >
                  {creatingAll ? (
                    <ActivityIndicator color="#FFF" size="small" />
                  ) : (
                    <>
                      <Ionicons name="add-circle" size={16} color="#FFF" />
                      <Text style={styles.cnpjBannerBtnText}>
                        {cnpjsNovosUnicos.length === 1 ? 'Cadastrar' : 'Cadastrar todas'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
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
                    {item.empresa_nome || item.filename || '—'}
                  </Text>
                  {(() => {
                    const ocrVazio =
                      !item.cnpj &&
                      !item.valor &&
                      !item.data_vencimento &&
                      !item.codigo_barras;
                    if (ocrVazio && item.status !== 'error') {
                      return (
                        <Text style={styles.warnText}>
                          Não conseguimos ler este arquivo automaticamente. Preencha manualmente.
                        </Text>
                      );
                    }
                    if (item.cnpj_exibicao) {
                      return <Text style={styles.cnpjText}>CNPJ: {item.cnpj_exibicao}</Text>;
                    }
                    if (item.cnpj) {
                      return <Text style={styles.cnpjText}>CNPJ detectado (revise)</Text>;
                    }
                    return null;
                  })()}
                  {item.empresa_id && item.match_confianca === 'media' && (
                    <Text style={styles.linkedText}>Empresa sugerida pelo nome do arquivo</Text>
                  )}
                  {!item.empresa_id && item.empresa_hint && (
                    <Text style={styles.hintText}>Pelo arquivo: {item.empresa_hint}</Text>
                  )}
                  {item.ja_cadastrada && item.empresa_nome && (
                    <Text style={styles.linkedText}>Empresa vinculada pela guia existente</Text>
                  )}
                  {item.tem_duplicidade && (
                    <Text style={styles.dupText}>
                      {item.alertas_duplicidade?.[0] || 'Possível duplicada'}
                    </Text>
                  )}
                  {!item.empresa_id && item.cnpj_novo && item.cnpj && (() => {
                    const digits = onlyDigits(item.cnpj);
                    const loading = creatingCnpjs.has(digits);
                    return (
                      <TouchableOpacity
                        style={[styles.addEmpBtn, loading && { opacity: 0.6 }]}
                        onPress={() => handleCadastrarUmCnpj(item.cnpj!)}
                        disabled={loading || creatingAll}
                      >
                        {loading ? (
                          <ActivityIndicator size="small" color="#FFF" />
                        ) : (
                          <>
                            <Ionicons name="add-circle" size={14} color="#FFF" />
                            <Text style={styles.addEmpBtnText}>Cadastrar empresa pelo CNPJ</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    );
                  })()}
                  {!item.empresa_id && empresas.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {empresasSugeridasParaItem(item, empresas).slice(0, 8).map((e, idx) => (
                        <TouchableOpacity
                          key={e.empresa_id}
                          style={[styles.empChip, idx === 0 && styles.empChipSuggest]}
                          onPress={() =>
                            updateItem(item.temp_id, {
                              empresa_id: e.empresa_id,
                              empresa_nome: e.nome_fantasia || e.razao_social,
                              match_confianca: idx === 0 ? 'media' : 'nenhuma',
                              steps: { ...item.steps, empresa: true },
                            })
                          }
                        >
                          <Text style={[styles.empChipText, idx === 0 && styles.empChipTextSuggest]} numberOfLines={1}>
                            {(e.nome_fantasia || e.razao_social).slice(0, 22)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  )}
                </View>
                <TextInput
                  style={[styles.cellInput, { flex: 0.6 }]}
                  value={item.tipo || item.tipo_documento || ''}
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
  warnText: { fontSize: 11, color: '#B45309', marginTop: 2, fontWeight: '600' },
  hintText: { fontSize: 11, color: '#0369A1', marginTop: 2, fontWeight: '600' },
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
  empChipSuggest: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#6EE7B7',
  },
  empChipText: { fontSize: 11, color: '#4F46E5', fontWeight: '600' },
  empChipTextSuggest: { color: '#047857' },
  cnpjBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ECFDF5',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  cnpjBannerIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cnpjBannerTitle: { fontWeight: '800', color: '#065F46', fontSize: 14 },
  cnpjBannerSub: { fontSize: 12, color: '#047857', marginTop: 2, lineHeight: 16 },
  cnpjBannerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#059669',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  cnpjBannerBtnText: { color: '#FFF', fontWeight: '800', fontSize: 12 },
  addEmpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: '#059669',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 6,
  },
  addEmpBtnText: { color: '#FFF', fontWeight: '700', fontSize: 11 },
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
