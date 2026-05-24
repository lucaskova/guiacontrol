import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { empresasAPI, guiasAPI } from '../../services/api';
import { formatCurrency } from '../../utils/formatters';
import { premium } from '../../theme/premium';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

type Result = {
  id: string;
  group: 'Ações rápidas' | 'Empresas' | 'Guias';
  label: string;
  hint?: string;
  icon: IoniconName;
  color: string;
  onSelect: () => void;
};

export function CommandPalette({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const inputRef = useRef<TextInput | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [guias, setGuias] = useState<any[]>([]);

  useEffect(() => {
    if (!visible) {
      setQuery('');
      return;
    }

    setLoading(true);
    Promise.all([
      empresasAPI.listar().catch(() => ({ data: [] })),
      guiasAPI.listar().catch(() => ({ data: [] })),
    ])
      .then(([empRes, guiaRes]) => {
        setEmpresas(empRes.data || []);
        setGuias(guiaRes.data || []);
      })
      .finally(() => setLoading(false));

    setTimeout(() => inputRef.current?.focus(), 80);
  }, [visible]);

  const quickActions = useMemo<Result[]>(
    () => [
      {
        id: 'nova-guia',
        group: 'Ações rápidas',
        label: 'Nova guia',
        hint: 'Cadastrar manualmente',
        icon: 'add-circle-outline',
        color: premium.primary,
        onSelect: () => router.push('/nova-guia'),
      },
      {
        id: 'ocr',
        group: 'Ações rápidas',
        label: 'Importar com OCR IA',
        hint: 'Leitura em lote',
        icon: 'sparkles-outline',
        color: '#7C3AED',
        onSelect: () => router.push('/importar-guias'),
      },
      {
        id: 'vencidas',
        group: 'Ações rápidas',
        label: 'Guias vencidas',
        hint: 'Atenção imediata',
        icon: 'alert-circle-outline',
        color: '#DC2626',
        onSelect: () => router.push('/(tabs)/guias?status=vencida' as any),
      },
      {
        id: 'empresas',
        group: 'Ações rápidas',
        label: 'Empresas',
        hint: 'Gerenciar clientes',
        icon: 'business-outline',
        color: '#0891B2',
        onSelect: () => router.push('/(tabs)/empresas' as any),
      },
      {
        id: 'automacao',
        group: 'Ações rápidas',
        label: 'Notificações e automação',
        hint: 'Lembretes, QR Code e disparos',
        icon: 'notifications-outline',
        color: '#D97706',
        onSelect: () => router.push('/(tabs)/notificacoes' as any),
      },
    ],
    [router],
  );

  const results = useMemo<Result[]>(() => {
    const empresaResults = empresas.slice(0, 30).map((e) => ({
      id: `empresa-${e.empresa_id}`,
      group: 'Empresas' as const,
      label: e.nome_fantasia || e.razao_social || 'Empresa',
      hint: e.cnpj || e.razao_social,
      icon: 'business-outline' as IoniconName,
      color: '#0891B2',
      onSelect: () => router.push(`/empresa-detalhes?id=${e.empresa_id}` as any),
    }));

    const guiaResults = guias.slice(0, 40).map((g) => ({
      id: `guia-${g.guia_id}`,
      group: 'Guias' as const,
      label: `${g.tipo || 'Guia'} · ${formatCurrency(g.valor || 0)}`,
      hint: g.data_vencimento ? `Vencimento ${formatDateBR(g.data_vencimento)}` : undefined,
      icon: 'document-text-outline' as IoniconName,
      color: premium.primary,
      onSelect: () => router.push(`/guia-detalhes?id=${g.guia_id}` as any),
    }));

    return [...quickActions, ...empresaResults, ...guiaResults];
  }, [empresas, guias, quickActions, router]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return quickActions;
    return results.filter((r) => {
      const text = `${r.group} ${r.label} ${r.hint || ''}`.toLowerCase();
      return text.includes(term);
    });
  }, [query, quickActions, results]);

  const grouped = useMemo(() => {
    const map = new Map<Result['group'], Result[]>();
    filtered.forEach((result) => {
      map.set(result.group, [...(map.get(result.group) || []), result]);
    });
    return Array.from(map.entries());
  }, [filtered]);

  const select = (result: Result) => {
    onClose();
    setTimeout(result.onSelect, 60);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.dialog} onPress={() => undefined}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={16} color="#94A3B8" />
            <TextInput
              ref={inputRef}
              value={query}
              onChangeText={setQuery}
              placeholder="Buscar empresas, guias, ações rápidas..."
              placeholderTextColor="#94A3B8"
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.kbd}>
              <Text style={styles.kbdText}>ESC</Text>
            </View>
          </View>

          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {loading && (
              <View style={styles.stateBox}>
                <ActivityIndicator color={premium.primary} />
                <Text style={styles.stateText}>Carregando índice...</Text>
              </View>
            )}

            {!loading && filtered.length === 0 && (
              <View style={styles.stateBox}>
                <Ionicons name="search" size={28} color="#CBD5E1" />
                <Text style={styles.emptyTitle}>Nada encontrado</Text>
                <Text style={styles.stateText}>Tente buscar por empresa, guia ou ação.</Text>
              </View>
            )}

            {grouped.map(([group, items]) => (
              <View key={group} style={styles.group}>
                <Text style={styles.groupLabel}>{group}</Text>
                {items.map((result) => (
                  <ResultRow key={result.id} result={result} onPress={() => select(result)} />
                ))}
              </View>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ResultRow({ result, onPress }: { result: Result; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ hovered }: any) => [
        styles.row,
        hovered && styles.rowHover,
        Platform.OS === 'web' && (styles.rowWeb as any),
      ]}
      accessibilityRole="button"
      accessibilityLabel={result.label}
    >
      <View style={[styles.rowIcon, { backgroundColor: `${result.color}1A` }]}>
        <Ionicons name={result.icon} size={15} color={result.color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {result.label}
        </Text>
        {result.hint ? (
          <Text style={styles.rowHint} numberOfLines={1}>
            {result.hint}
          </Text>
        ) : null}
      </View>
      <Ionicons name="arrow-forward" size={14} color="#CBD5E1" />
    </Pressable>
  );
}

function formatDateBR(value: string): string {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return value;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    paddingHorizontal: 16,
    paddingTop: 80,
  },
  dialog: {
    width: '100%',
    maxWidth: 560,
    maxHeight: 520,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: premium.border,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      web: { boxShadow: '0 30px 80px rgba(15, 23, 42, 0.28)' } as any,
      default: {
        elevation: 12,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.28,
        shadowRadius: 32,
      },
    }),
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: premium.border,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: premium.text,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },
  kbd: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
  },
  kbdText: { fontSize: 10, fontWeight: '800', color: '#64748B' },
  list: { maxHeight: 440 },
  listContent: { paddingVertical: 8 },
  group: { marginTop: 2 },
  groupLabel: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 10,
  },
  rowHover: { backgroundColor: '#EEF2FF' },
  rowWeb: { cursor: 'pointer', transition: 'background-color 140ms ease' } as ViewStyle,
  rowIcon: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
  },
  rowTitle: { color: premium.text, fontSize: 13, fontWeight: '800' },
  rowHint: { marginTop: 1, color: premium.textMuted, fontSize: 11.5 },
  stateBox: { alignItems: 'center', gap: 8, paddingVertical: 34 },
  emptyTitle: { color: premium.text, fontSize: 14, fontWeight: '800' },
  stateText: { color: premium.textMuted, fontSize: 12 },
});
