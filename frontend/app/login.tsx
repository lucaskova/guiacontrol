import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ScrollView,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import * as WebBrowser from 'expo-web-browser';
import { useToast } from '../contexts/ToastContext';

const ENABLE_GOOGLE_AUTH = process.env.EXPO_PUBLIC_ENABLE_GOOGLE_AUTH === 'true';

function formatApiError(error: unknown): string {
  const err = error as {
    message?: string;
    code?: string;
    response?: { data?: { detail?: unknown } };
  };
  if (err?.message === 'Network Error' || err?.code === 'ERR_NETWORK') {
    return 'Sem resposta do servidor. Verifique se a API está rodando, se EXPO_PUBLIC_BACKEND_URL está correta e se o CORS do backend inclui esta origem (ex.: http://localhost:8081).';
  }
  const d = err?.response?.data?.detail;
  if (typeof d === 'string') return d;
  if (Array.isArray(d)) {
    return d
      .map((x: { msg?: string }) => x?.msg)
      .filter(Boolean)
      .join(', ');
  }
  if (typeof err?.message === 'string' && err.message.length > 0) {
    return err.message;
  }
  return 'Não foi possível concluir. Tente de novo.';
}

export default function LoginScreen() {
  const router = useRouter();
  const { isAuthenticated, loginWithPassword, registerWithPassword } = useAuthStore();
  const { showToast } = useToast();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated]);

  const handleGoogleLogin = async () => {
    const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
    const redirectUrl = `${BACKEND_URL}/auth-callback`;
    const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(
      redirectUrl
    )}`;
    if (Platform.OS === 'web') {
      window.location.href = authUrl;
    } else {
      await WebBrowser.openBrowserAsync(authUrl);
    }
  };

  const handleEmailAuth = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !password) {
      showToast('Preencha e-mail e senha.', 'error');
      return;
    }
    if (mode === 'signup') {
      if (name.trim().length < 2) {
        showToast('Informe seu nome (pelo menos 2 caracteres).', 'error');
        return;
      }
      if (password.length < 8) {
        showToast('A senha deve ter pelo menos 8 caracteres.', 'error');
        return;
      }
    }
    setSubmitting(true);
    try {
      if (mode === 'signin') {
        await loginWithPassword(trimmedEmail, password);
      } else {
        await registerWithPassword(name.trim(), trimmedEmail, password);
      }
      router.replace('/(tabs)');
    } catch (e) {
      showToast(formatApiError(e), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Brand */}
        <View style={styles.brandArea}>
          <View style={styles.logoRow}>
            <View style={styles.logoIcon}>
              <Ionicons name="shield-checkmark" size={28} color="#FFFFFF" />
            </View>
            <Text style={styles.brandName}>GuiaControl</Text>
          </View>
          <Text style={styles.tagline}>Central de guias empresariais</Text>
          <View style={styles.subtitleBadge}>
            <Ionicons name="briefcase" size={14} color="#1E40AF" />
            <Text style={styles.subtitleText}>Sistema inspirado em DDA para empresas</Text>
          </View>
        </View>

        {/* Hero */}
        <View style={styles.heroCard}>
          <View style={styles.heroIconContainer}>
            <Ionicons name="bar-chart" size={40} color="#1E40AF" />
          </View>
          <Text style={styles.heroTitle}>Todas as suas guias em um só lugar com segurança</Text>
          <Text style={styles.heroSubtitle}>Evite multas e atrasos. Controle total das suas obrigações fiscais.</Text>
        </View>

        {/* Features */}
        <View style={styles.features}>
          <View style={styles.feature}>
            <View style={[styles.featureIcon, { backgroundColor: '#D1FAE5' }]}>
              <Ionicons name="calendar" size={18} color="#059669" />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Controle de vencimentos</Text>
              <Text style={styles.featureDesc}>Evite multas e atrasos</Text>
            </View>
          </View>
          <View style={styles.feature}>
            <View style={[styles.featureIcon, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="notifications" size={18} color="#D97706" />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Alertas automáticos</Text>
              <Text style={styles.featureDesc}>Lembrete antes do vencimento</Text>
            </View>
          </View>
          <View style={styles.feature}>
            <View style={[styles.featureIcon, { backgroundColor: '#DBEAFE' }]}>
              <Ionicons name="scan" size={18} color="#1E40AF" />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Leitura automática (OCR)</Text>
              <Text style={styles.featureDesc}>Escaneie e preencha automaticamente</Text>
            </View>
          </View>
          <View style={styles.feature}>
            <View style={[styles.featureIcon, { backgroundColor: '#EDE9FE' }]}>
              <Ionicons name="checkmark-done" size={18} color="#7C3AED" />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Validação pelo contador</Text>
              <Text style={styles.featureDesc}>Sistema gerenciado por contador</Text>
            </View>
          </View>
        </View>

        {/* E-mail e senha */}
        <Text style={styles.formTitle}>{mode === 'signin' ? 'Entrar' : 'Criar conta'}</Text>
        {mode === 'signup' && (
          <View style={styles.field}>
            <Text style={styles.label}>Nome</Text>
            <TextInput
              style={styles.input}
              placeholder="Seu nome"
              placeholderTextColor="#9CA3AF"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              editable={!submitting}
            />
          </View>
        )}
        <View style={styles.field}>
          <Text style={styles.label}>E-mail</Text>
          <TextInput
            style={styles.input}
            placeholder="voce@empresa.com.br"
            placeholderTextColor="#9CA3AF"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!submitting}
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Senha</Text>
          <TextInput
            style={styles.input}
            placeholder={mode === 'signup' ? 'Mínimo 8 caracteres' : 'Sua senha'}
            placeholderTextColor="#9CA3AF"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={!submitting}
          />
        </View>

        <TouchableOpacity
          style={[styles.loginButton, submitting && styles.loginButtonDisabled]}
          onPress={handleEmailAuth}
          activeOpacity={0.8}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="log-in-outline" size={20} color="#FFFFFF" />
              <Text style={styles.loginButtonText}>
                {mode === 'signin' ? 'Entrar' : 'Criar conta e entrar'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin');
            setPassword('');
          }}
          style={styles.switchMode}
          disabled={submitting}
        >
          <Text style={styles.switchModeText}>
            {mode === 'signin' ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Entrar'}
          </Text>
        </TouchableOpacity>

        {ENABLE_GOOGLE_AUTH && (
          <>
            <View style={styles.dividerRow}>
              <View style={styles.divider} />
              <Text style={styles.dividerText}>ou</Text>
              <View style={styles.divider} />
            </View>
            <TouchableOpacity style={styles.googleButton} onPress={handleGoogleLogin} activeOpacity={0.8} disabled={submitting}>
              <Ionicons name="logo-google" size={20} color="#1F2937" />
              <Text style={styles.googleButtonText}>Entrar com Google</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Trust */}
        <View style={styles.trustRow}>
          <View style={styles.trustBadge}>
            <Ionicons name="lock-closed" size={13} color="#059669" />
            <Text style={styles.trustText}>Ambiente seguro</Text>
          </View>
          <View style={styles.trustBadge}>
            <Ionicons name="shield-checkmark" size={13} color="#059669" />
            <Text style={styles.trustText}>Dados protegidos</Text>
          </View>
        </View>
        <View style={styles.trustRow}>
          <View style={styles.trustBadge}>
            <Ionicons name="people" size={13} color="#1E40AF" />
            <Text style={[styles.trustText, { color: '#1E40AF' }]}>Gerenciado por contador</Text>
          </View>
        </View>

        <Text style={styles.disclaimer}>
          Ao entrar, você concorda com nossos Termos de Serviço e Política de Privacidade
        </Text>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: { padding: 24, paddingTop: 16 },
  brandArea: { alignItems: 'center', marginBottom: 24 },
  logoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  logoIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#1E40AF', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  brandName: { fontSize: 34, fontWeight: '800', color: '#111827', letterSpacing: -1 },
  tagline: { fontSize: 15, color: '#6B7280', marginBottom: 8 },
  subtitleBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#EFF6FF', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  subtitleText: { fontSize: 12, color: '#1E40AF', fontWeight: '600' },
  heroCard: { backgroundColor: '#F0F4FF', borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 24, borderWidth: 1, borderColor: '#DBEAFE' },
  heroIconContainer: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  heroTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 6, textAlign: 'center' },
  heroSubtitle: { fontSize: 13, color: '#6B7280', textAlign: 'center' },
  features: { marginBottom: 24, gap: 14 },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  featureContent: { flex: 1 },
  featureTitle: { fontSize: 14, fontWeight: '600', color: '#111827' },
  featureDesc: { fontSize: 12, color: '#9CA3AF', marginTop: 1 },
  formTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 14 },
  field: { marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'web' ? 12 : 14,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#F9FAFB',
  },
  loginButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1E40AF', paddingVertical: 16, borderRadius: 12, marginTop: 8, marginBottom: 12, gap: 10, ...Platform.select({ web: { boxShadow: '0px 4px 8px rgba(30, 64, 175, 0.3)' }, ios: { shadowColor: '#1E40AF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }, android: { elevation: 6 } }) },
  loginButtonDisabled: { opacity: 0.7 },
  loginButtonText: { fontSize: 17, fontWeight: '700', color: '#FFFFFF' },
  switchMode: { alignItems: 'center', marginBottom: 20 },
  switchModeText: { fontSize: 14, color: '#1E40AF', fontWeight: '600' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 10 },
  divider: { flex: 1, height: 1, backgroundColor: '#E5E7EB' },
  dividerText: { fontSize: 12, color: '#9CA3AF', fontWeight: '500' },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  googleButtonText: { fontSize: 16, fontWeight: '600', color: '#1F2937' },
  trustRow: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginBottom: 8 },
  trustBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  trustText: { fontSize: 12, color: '#059669', fontWeight: '500' },
  disclaimer: { fontSize: 11, color: '#9CA3AF', textAlign: 'center', paddingHorizontal: 24, marginTop: 8 },
});
