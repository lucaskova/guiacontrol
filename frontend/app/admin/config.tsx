import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { adminAPI } from '../../services/api';

type Cfg = {
  maintenance_mode: boolean;
  maintenance_message: string;
  banner_message: string;
  banner_active: boolean;
  apibrasil_configured: boolean;
  admin_emails: string[];
};

export default function AdminConfig() {
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await adminAPI.getConfig();
      setCfg(r.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!cfg) return;
    setSaving(true);
    setFeedback(null);
    try {
      await adminAPI.patchConfig({
        maintenance_mode: cfg.maintenance_mode,
        maintenance_message: cfg.maintenance_message,
        banner_message: cfg.banner_message,
        banner_active: cfg.banner_active,
      });
      setFeedback('Configurações salvas com sucesso.');
    } catch (e: any) {
      setFeedback(e?.response?.data?.detail || 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !cfg) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#10B981" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={styles.h1}>Configuração global</Text>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="warning" size={16} color="#B45309" />
          <Text style={styles.cardTitle}>Modo manutenção</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Ativar manutenção (mostra aviso global)</Text>
          <Switch
            value={cfg.maintenance_mode}
            onValueChange={(v) => setCfg({ ...cfg, maintenance_mode: v })}
            thumbColor={Platform.OS === 'web' ? undefined : '#10B981'}
            trackColor={{ true: '#A7F3D0', false: '#CBD5E1' }}
          />
        </View>
        <Text style={styles.sub}>Mensagem mostrada para os usuários</Text>
        <TextInput
          style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
          value={cfg.maintenance_message}
          onChangeText={(t) => setCfg({ ...cfg, maintenance_message: t })}
          placeholder="Estamos em manutenção. Voltamos em instantes."
          placeholderTextColor="#94A3B8"
          multiline
        />
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="megaphone" size={16} color="#0EA5E9" />
          <Text style={styles.cardTitle}>Banner / aviso</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Exibir banner na dashboard</Text>
          <Switch
            value={cfg.banner_active}
            onValueChange={(v) => setCfg({ ...cfg, banner_active: v })}
            thumbColor={Platform.OS === 'web' ? undefined : '#0EA5E9'}
            trackColor={{ true: '#BAE6FD', false: '#CBD5E1' }}
          />
        </View>
        <TextInput
          style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]}
          value={cfg.banner_message}
          onChangeText={(t) => setCfg({ ...cfg, banner_message: t })}
          placeholder="Ex.: Nova versão disponível! Confira em /novidades."
          placeholderTextColor="#94A3B8"
          multiline
        />
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="key" size={16} color="#10B981" />
          <Text style={styles.cardTitle}>Integrações</Text>
        </View>
        <View style={styles.statusRow}>
          <Text style={styles.label}>API Brasil (WhatsApp)</Text>
          <View style={[styles.badge, cfg.apibrasil_configured ? styles.badgeOk : styles.badgeErr]}>
            <Ionicons
              name={cfg.apibrasil_configured ? 'checkmark-circle' : 'close-circle'}
              size={12}
              color={cfg.apibrasil_configured ? '#047857' : '#991B1B'}
            />
            <Text style={[styles.badgeTxt, cfg.apibrasil_configured ? { color: '#047857' } : { color: '#991B1B' }]}>
              {cfg.apibrasil_configured ? 'Configurada' : 'Não configurada'}
            </Text>
          </View>
        </View>
        <Text style={styles.sub}>
          As credenciais (Bearer / Device Token) ficam no .env do backend. Edite lá e reinicie o servidor para aplicar.
        </Text>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="shield-checkmark" size={16} color="#0F766E" />
          <Text style={styles.cardTitle}>Administradores autorizados</Text>
        </View>
        <Text style={styles.sub}>Whitelist em ADMIN_EMAILS no backend/.env. Reinicie o servidor após editar.</Text>
        <View style={styles.adminList}>
          {cfg.admin_emails.length === 0 ? (
            <Text style={styles.warn}>⚠ Nenhum admin configurado.</Text>
          ) : (
            cfg.admin_emails.map((e) => (
              <View key={e} style={styles.adminItem}>
                <Ionicons name="person" size={12} color="#0F766E" />
                <Text style={styles.adminEmail}>{e}</Text>
              </View>
            ))
          )}
        </View>
      </View>

      {feedback ? (
        <View style={[styles.feedback, feedback.includes('Erro') && styles.feedbackErr]}>
          <Text style={[styles.feedbackTxt, feedback.includes('Erro') && { color: '#991B1B' }]}>{feedback}</Text>
        </View>
      ) : null}

      <View style={styles.saveRow}>
        <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={saving}>
          {saving ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="save" size={14} color="#FFFFFF" />}
          <Text style={styles.saveTxt}>{saving ? 'Salvando…' : 'Salvar configurações'}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 18, gap: 14, paddingBottom: 80 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC' },
  h1: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
  card: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontSize: 13, color: '#475569', fontWeight: '600' },
  sub: { fontSize: 12, color: '#94A3B8' },
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13.5,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeOk: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
  badgeErr: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  badgeTxt: { fontSize: 11, fontWeight: '800' },
  adminList: { gap: 4 },
  adminItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  adminEmail: { color: '#0F172A', fontSize: 13, fontWeight: '600' },
  warn: { color: '#B45309', fontSize: 12.5, fontWeight: '700' },
  feedback: {
    padding: 12,
    backgroundColor: '#ECFDF5',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  feedbackErr: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  feedbackTxt: { color: '#047857', fontWeight: '700' },
  saveRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0F766E',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
  },
  saveTxt: { color: '#FFFFFF', fontWeight: '800' },
});
