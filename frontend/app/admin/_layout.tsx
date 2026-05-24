import React, { useEffect } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useIsAdmin } from '../../hooks/useIsAdmin';
import { SafeAreaView } from 'react-native-safe-area-context';

const TABS = [
  { key: 'index', label: 'Visão geral', icon: 'speedometer-outline' as const, href: '/admin' },
  { key: 'users', label: 'Contadores', icon: 'people-outline' as const, href: '/admin/users' },
  { key: 'empresas', label: 'Empresas', icon: 'business-outline' as const, href: '/admin/empresas' },
  { key: 'guias', label: 'Guias', icon: 'document-text-outline' as const, href: '/admin/guias' },
  { key: 'logs', label: 'Logs WhatsApp', icon: 'chatbubble-ellipses-outline' as const, href: '/admin/logs' },
  { key: 'config', label: 'Configuração', icon: 'settings-outline' as const, href: '/admin/config' },
];

export default function AdminLayout() {
  const { isAdmin, loading } = useIsAdmin();
  const router = useRouter();
  const segments = useSegments();
  const current = (segments[1] as string) || 'index';

  useEffect(() => {
    if (loading) return;
    if (isAdmin === false) {
      router.replace('/(tabs)');
    }
  }, [isAdmin, loading, router]);

  if (loading || isAdmin !== true) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#10B981" />
        <Text style={styles.loadingText}>Verificando acesso de administrador…</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topbar}>
        <Pressable style={styles.brandRow} onPress={() => router.replace('/admin')}>
          <View style={styles.brandIcon}>
            <Ionicons name="shield-checkmark" size={16} color="#FFFFFF" />
          </View>
          <Text style={styles.brandText}>
            Guia<Text style={{ color: '#10B981' }}>Control</Text>
            <Text style={styles.brandKicker}>  ·  ADMIN</Text>
          </Text>
        </Pressable>
        <Pressable style={styles.exitBtn} onPress={() => router.replace('/(tabs)')}>
          <Ionicons name="arrow-back" size={14} color="#0F172A" />
          <Text style={styles.exitText}>Voltar ao app</Text>
        </Pressable>
      </View>

      <View style={styles.tabsRow}>
        {TABS.map((t) => {
          const active = current === t.key || (t.key === 'index' && (current === '' || current === 'admin'));
          return (
            <Pressable key={t.key} style={[styles.tab, active && styles.tabActive]} onPress={() => router.push(t.href as any)}>
              <Ionicons name={t.icon} size={14} color={active ? '#10B981' : '#475569'} />
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#F8FAFC' },
          animation: Platform.OS === 'web' ? 'none' : 'fade',
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#0A1F1A',
  },
  loadingText: { color: '#A7F3D0', fontSize: 13.5, fontWeight: '600' },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: '#0A1F1A',
    borderBottomWidth: 1,
    borderBottomColor: '#0F2A24',
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
  },
  brandText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
  brandKicker: { color: '#9CA3AF', fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  exitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  exitText: { color: '#0F172A', fontSize: 12.5, fontWeight: '700' },

  tabsRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    overflow: 'scroll',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
  },
  tabActive: { backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0' },
  tabText: { color: '#475569', fontSize: 12.5, fontWeight: '700' },
  tabTextActive: { color: '#047857' },
});
