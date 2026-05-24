import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { adminAPI } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

type Row = {
  user_id: string;
  email: string;
  name: string;
  picture?: string | null;
  created_at?: string;
  telefone?: string | null;
  telefone_admin?: string | null;
  whatsapp_telefone?: string | null;
  bloqueado: boolean;
  is_admin: boolean;
  empresas_count: number;
  guias_count: number;
  guias_pagas: number;
  guias_vencidas: number;
  last_session_at?: string;
};

function digitsOnly(s: string) {
  return (s || '').replace(/\D/g, '');
}

function whatsappLink(numberDigits: string, text?: string) {
  const num = digitsOnly(numberDigits);
  const t = text ? `?text=${encodeURIComponent(text)}` : '';
  return `https://wa.me/${num}${t}`;
}

export default function AdminUsers() {
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Row | null>(null);
  const [phoneInput, setPhoneInput] = useState('');
  const [waModal, setWaModal] = useState<Row | null>(null);
  const [waText, setWaText] = useState('Olá! Aqui é do GuiaControl, posso te ajudar?');
  const router = useRouter();
  const me = useAuthStore((s) => s.user);
  const loadUser = useAuthStore((s) => s.loadUser);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const r = await adminAPI.listUsers(search ? { search } : undefined);
      setRows(r.data?.items ?? []);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    void load();
  }, [load]);

  const onToggleBlock = async (u: Row) => {
    const action = u.bloqueado ? 'Desbloquear' : 'Bloquear';
    const confirmed = Platform.OS === 'web'
      ? window.confirm(`${action} a conta de ${u.name}?`)
      : await new Promise<boolean>((res) =>
          Alert.alert(action, `${action} a conta de ${u.name}?`, [
            { text: 'Cancelar', onPress: () => res(false), style: 'cancel' },
            { text: 'Confirmar', onPress: () => res(true) },
          ]),
        );
    if (!confirmed) return;
    await adminAPI.patchUser(u.user_id, { bloqueado: !u.bloqueado });
    await load();
  };

  const onDelete = async (u: Row) => {
    if (u.is_admin) {
      window.alert?.('Não é possível excluir outro administrador.');
      return;
    }
    const ok = Platform.OS === 'web'
      ? window.confirm(`Excluir ${u.name} e TODOS os dados (empresas, guias, notificações)? Essa ação é irreversível.`)
      : false;
    if (!ok) return;
    await adminAPI.deleteUser(u.user_id);
    await load();
  };

  const onImpersonate = async (u: Row) => {
    if (u.user_id === me?.user_id) return;
    const ok = Platform.OS === 'web'
      ? window.confirm(`Logar como ${u.name}? Sua sessão atual será substituída.`)
      : false;
    if (!ok) return;
    try {
      const r = await adminAPI.impersonate(u.user_id);
      const token = r.data?.session_token;
      if (token) await AsyncStorage.setItem('session_token', token);
      await loadUser();
      router.replace('/(tabs)');
    } catch (e: any) {
      window.alert?.(e?.response?.data?.detail || 'Erro ao impersonar.');
    }
  };

  const openEdit = (u: Row) => {
    setEditing(u);
    setPhoneInput(u.telefone_admin || '');
  };

  const savePhone = async () => {
    if (!editing) return;
    try {
      await adminAPI.patchUser(editing.user_id, { telefone_admin: phoneInput || '' });
      setEditing(null);
      setPhoneInput('');
      await load();
    } catch (e: any) {
      window.alert?.(e?.response?.data?.detail || 'Erro ao salvar.');
    }
  };

  const openWhatsapp = (u: Row) => {
    setWaModal(u);
    setWaText(`Olá ${u.name?.split(' ')[0] || ''}! Aqui é do GuiaControl, posso te ajudar?`);
  };

  const sendWhatsapp = () => {
    if (!waModal) return;
    const phone = waModal.telefone || '';
    if (!phone) return;
    const url = whatsappLink(phone, waText);
    setWaModal(null);
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      void Linking.openURL(url);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <Text style={styles.h1}>Contadores</Text>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={14} color="#64748B" />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar por nome ou e-mail"
            placeholderTextColor="#94A3B8"
            onSubmitEditing={load}
          />
          {search ? (
            <Pressable onPress={() => { setSearch(''); }}>
              <Ionicons name="close-circle" size={16} color="#94A3B8" />
            </Pressable>
          ) : null}
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color="#10B981" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {rows.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={36} color="#94A3B8" />
              <Text style={styles.emptyText}>Nenhum contador encontrado.</Text>
            </View>
          ) : (
            rows.map((u) => (
              <View key={u.user_id} style={[styles.row, u.bloqueado && styles.rowBlocked]}>
                <View style={styles.rowLeft}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarTxt}>{(u.name || u.email || '?').slice(0, 1).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.nameRow}>
                      <Text style={styles.name}>{u.name || '—'}</Text>
                      {u.is_admin ? (
                        <View style={styles.adminBadge}>
                          <Ionicons name="shield-checkmark" size={10} color="#047857" />
                          <Text style={styles.adminBadgeTxt}>ADMIN</Text>
                        </View>
                      ) : null}
                      {u.bloqueado ? (
                        <View style={styles.blockedBadge}>
                          <Ionicons name="ban" size={10} color="#991B1B" />
                          <Text style={styles.blockedTxt}>BLOQUEADO</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.email}>{u.email}</Text>
                    <View style={styles.metaRow}>
                      <Meta icon="business" v={u.empresas_count} label="empresas" />
                      <Meta icon="document-text" v={u.guias_count} label="guias" />
                      <Meta icon="checkmark-circle" v={u.guias_pagas} label="pagas" color="#10B981" />
                      <Meta icon="alert-circle" v={u.guias_vencidas} label="vencidas" color="#EF4444" />
                    </View>
                    {u.telefone ? (
                      <Text style={styles.phoneTxt}>
                        <Ionicons name="logo-whatsapp" size={11} color="#10B981" /> {u.telefone}
                      </Text>
                    ) : (
                      <Text style={styles.phoneMissing}>WhatsApp não cadastrado — use "Editar" para adicionar.</Text>
                    )}
                  </View>
                </View>

                <View style={styles.actions}>
                  <ActionBtn
                    icon="logo-whatsapp"
                    color={u.telefone ? '#10B981' : '#9CA3AF'}
                    onPress={() => (u.telefone ? openWhatsapp(u) : openEdit(u))}
                    label={u.telefone ? 'Mensagem' : 'Adicionar WhatsApp'}
                  />
                  <ActionBtn icon="create-outline" color="#0EA5E9" onPress={() => openEdit(u)} label="Editar" />
                  {u.user_id !== me?.user_id ? (
                    <ActionBtn icon="enter-outline" color="#8B5CF6" onPress={() => onImpersonate(u)} label="Logar como" />
                  ) : null}
                  <ActionBtn
                    icon={u.bloqueado ? 'lock-open-outline' : 'lock-closed-outline'}
                    color={u.bloqueado ? '#10B981' : '#F59E0B'}
                    onPress={() => onToggleBlock(u)}
                    label={u.bloqueado ? 'Desbloquear' : 'Bloquear'}
                  />
                  {!u.is_admin ? (
                    <ActionBtn icon="trash-outline" color="#EF4444" onPress={() => onDelete(u)} label="Excluir" />
                  ) : null}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* Edit phone modal */}
      <Modal transparent visible={!!editing} animationType="fade" onRequestClose={() => setEditing(null)}>
        <Pressable style={styles.overlay} onPress={() => setEditing(null)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>Editar contador</Text>
            <Text style={styles.sheetSub}>{editing?.name} · {editing?.email}</Text>
            <Text style={styles.label}>WhatsApp (com DDI/DDD, ex.: 5555996580352)</Text>
            <TextInput
              style={styles.input}
              value={phoneInput}
              onChangeText={setPhoneInput}
              placeholder="55..."
              keyboardType="phone-pad"
              placeholderTextColor="#94A3B8"
            />
            {editing?.whatsapp_telefone && !editing.telefone_admin ? (
              <Text style={styles.hint}>
                Já temos {editing.whatsapp_telefone} do setup do WhatsApp dele. Você pode salvar um número alternativo.
              </Text>
            ) : null}
            <View style={styles.sheetActions}>
              <TouchableOpacity style={styles.btnGhost} onPress={() => setEditing(null)}>
                <Text style={styles.btnGhostTxt}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnPrimary} onPress={savePhone}>
                <Text style={styles.btnPrimaryTxt}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* WhatsApp message modal */}
      <Modal transparent visible={!!waModal} animationType="fade" onRequestClose={() => setWaModal(null)}>
        <Pressable style={styles.overlay} onPress={() => setWaModal(null)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>Enviar WhatsApp</Text>
            <Text style={styles.sheetSub}>Para {waModal?.name} · {waModal?.telefone}</Text>
            <Text style={styles.label}>Mensagem inicial (opcional)</Text>
            <TextInput
              style={[styles.input, { minHeight: 90, textAlignVertical: 'top' }]}
              value={waText}
              onChangeText={setWaText}
              multiline
              placeholderTextColor="#94A3B8"
            />
            <Text style={styles.hint}>Abre uma nova aba no wa.me com a mensagem pré-preenchida.</Text>
            <View style={styles.sheetActions}>
              <TouchableOpacity style={styles.btnGhost} onPress={() => setWaModal(null)}>
                <Text style={styles.btnGhostTxt}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btnPrimary, { backgroundColor: '#10B981' }]} onPress={sendWhatsapp}>
                <Ionicons name="logo-whatsapp" size={14} color="#FFFFFF" />
                <Text style={styles.btnPrimaryTxt}>Abrir WhatsApp</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function Meta({
  icon,
  v,
  label,
  color = '#475569',
}: {
  icon: keyof typeof Ionicons.glyphMap;
  v: number;
  label: string;
  color?: string;
}) {
  return (
    <View style={metaStyles.wrap}>
      <Ionicons name={icon} size={11} color={color} />
      <Text style={[metaStyles.txt, { color }]}>
        {v} <Text style={metaStyles.lbl}>{label}</Text>
      </Text>
    </View>
  );
}

function ActionBtn({
  icon,
  color,
  onPress,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  onPress: () => void;
  label: string;
}) {
  return (
    <Pressable
      style={({ hovered }: any) => [
        actionStyles.btn,
        { borderColor: color + '40', backgroundColor: hovered ? color + '12' : '#FFFFFF' },
      ]}
      onPress={onPress}
    >
      <Ionicons name={icon} size={13} color={color} />
      <Text style={[actionStyles.txt, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
    gap: 14,
    flexWrap: 'wrap',
  },
  h1: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    minWidth: 280,
  },
  searchInput: { flex: 1, color: '#0F172A', fontSize: 13 },
  loadingWrap: { padding: 30, alignItems: 'center' },
  list: { padding: 18, gap: 10, paddingBottom: 80 },
  empty: { alignItems: 'center', padding: 30, gap: 6 },
  emptyText: { color: '#64748B' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexWrap: 'wrap',
  },
  rowBlocked: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  rowLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, flex: 1, minWidth: 280 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#0F766E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTxt: { color: '#FFFFFF', fontWeight: '800' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  name: { color: '#0F172A', fontSize: 14.5, fontWeight: '800' },
  email: { color: '#475569', fontSize: 12.5, marginTop: 1 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  phoneTxt: { color: '#0F766E', fontSize: 12, fontWeight: '700', marginTop: 6 },
  phoneMissing: { color: '#94A3B8', fontStyle: 'italic', fontSize: 11.5, marginTop: 6 },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: '#ECFDF5',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  adminBadgeTxt: { color: '#047857', fontSize: 9.5, fontWeight: '800', letterSpacing: 0.5 },
  blockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: '#FEF2F2',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  blockedTxt: { color: '#991B1B', fontSize: 9.5, fontWeight: '800', letterSpacing: 0.5 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginLeft: 'auto' },

  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  sheet: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 18, width: '100%', maxWidth: 460, gap: 8 },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  sheetSub: { fontSize: 12, color: '#64748B', marginBottom: 8 },
  label: { fontSize: 12, fontWeight: '700', color: '#475569', marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
  },
  hint: { fontSize: 11.5, color: '#94A3B8', marginTop: 4 },
  sheetActions: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end', marginTop: 14 },
  btnGhost: { paddingHorizontal: 14, paddingVertical: 10 },
  btnGhostTxt: { color: '#475569', fontWeight: '700' },
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0F766E',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  btnPrimaryTxt: { color: '#FFFFFF', fontWeight: '800' },
});

const metaStyles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  txt: { fontSize: 11.5, fontWeight: '700' },
  lbl: { color: '#94A3B8', fontWeight: '600' },
});

const actionStyles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  txt: { fontSize: 11.5, fontWeight: '700' },
});
