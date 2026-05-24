import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { useRouter } from 'expo-router';
import { InstallAppButton } from '../../components/InstallAppButton';
import { useIsAdmin } from '../../hooks/useIsAdmin';

export default function PerfilScreen() {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const { isAdmin } = useIsAdmin();

  const handleLogout = () => {
    const executeLogout = async () => {
      await logout();
      router.replace('/login');
    };

    if (Platform.OS === 'web') {
      const confirmed = window.confirm('Deseja realmente sair da sua conta?');
      if (confirmed) {
        void executeLogout();
      }
      return;
    }

    Alert.alert('Sair', 'Deseja realmente sair da sua conta?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: () => {
          void executeLogout();
        },
      },
    ]);
  };

  const MenuItem = ({
    icon,
    title,
    subtitle,
    onPress,
    showArrow = true,
    iconBg = '#EFF6FF',
    iconColor = '#1E40AF',
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    subtitle?: string;
    onPress?: () => void;
    showArrow?: boolean;
    iconBg?: string;
    iconColor?: string;
  }) => (
    <TouchableOpacity
      style={styles.menuItem}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={[styles.menuIconContainer, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <View style={styles.menuContent}>
        <Text style={styles.menuTitle}>{title}</Text>
        {subtitle && <Text style={styles.menuSubtitle}>{subtitle}</Text>}
      </View>
      {showArrow && (
        <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={{ paddingBottom: 110 }}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Perfil</Text>
        </View>

        {/* User Card */}
        <View style={styles.userCard}>
          <View style={styles.avatarRow}>
            {user?.picture ? (
              <Image source={{ uri: user.picture }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={32} color="#FFFFFF" />
              </View>
            )}
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{user?.name}</Text>
              <Text style={styles.userEmail}>{user?.email}</Text>
            </View>
          </View>
          <View style={styles.trustBadge}>
            <Ionicons name="shield-checkmark" size={14} color="#059669" />
            <Text style={styles.trustText}>Conta verificada</Text>
          </View>
        </View>

        {/* Instalar app (PWA) — aparece só no web quando suportado */}
        <View style={styles.installWrap}>
          <InstallAppButton
            label="Instalar GuiaControl"
            subtitle="Acesso rápido e funciona offline"
            color="#1E40AF"
          />
        </View>

        {/* Menu */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>GERENCIAR</Text>
          <View style={styles.menuCard}>
            <MenuItem
              icon="business-outline"
              title="Empresas Cadastradas"
              subtitle="Gerenciar empresas"
              onPress={() => router.push('/(tabs)/empresas')}
            />
            <View style={styles.divider} />
            <MenuItem
              icon="document-text-outline"
              title="Todas as Guias"
              subtitle="Visualizar e gerenciar"
              onPress={() => router.push('/(tabs)/guias')}
            />
          </View>
        </View>

        {isAdmin ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ADMINISTRAÇÃO</Text>
            <View style={styles.menuCard}>
              <MenuItem
                icon="shield-checkmark"
                title="Painel administrativo"
                subtitle="Contadores, métricas globais e configurações"
                iconBg="#ECFDF5"
                iconColor="#047857"
                onPress={() => router.push('/admin')}
              />
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SOBRE</Text>
          <View style={styles.menuCard}>
            <MenuItem
              icon="information-circle-outline"
              title="Versão do App"
              subtitle="GuiaControl 1.0.0"
              showArrow={false}
              iconBg="#F3F4F6"
              iconColor="#6B7280"
            />
            <View style={styles.divider} />
            <MenuItem
              icon="lock-closed-outline"
              title="Privacidade e Segurança"
              subtitle="Seus dados estão protegidos"
              iconBg="#D1FAE5"
              iconColor="#059669"
            />
            <View style={styles.divider} />
            <MenuItem
              icon="help-circle-outline"
              title="Ajuda e Suporte"
              iconBg="#FEF3C7"
              iconColor="#D97706"
            />
          </View>
        </View>

        {/* Logout */}
        <View style={styles.logoutSection}>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color="#DC2626" />
            <Text style={styles.logoutText}>Sair da Conta</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.footerBrand}>
            <View style={styles.footerIcon}>
              <Ionicons name="shield-checkmark" size={14} color="#FFFFFF" />
            </View>
            <Text style={styles.footerBrandText}>GuiaControl</Text>
          </View>
          <Text style={styles.footerText}>Gestão inteligente de guias tributárias</Text>
          <Text style={styles.footerCopy}>Evite multas e atrasos</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.5,
  },
  userCard: {
    backgroundColor: '#FFFFFF',
    margin: 20,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    ...Platform.select({
      web: {
        boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.06)',
      },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 16,
    marginRight: 14,
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#1E40AF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  userEmail: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  trustText: {
    fontSize: 13,
    color: '#059669',
    fontWeight: '600',
  },
  installWrap: {
    paddingHorizontal: 20,
    marginTop: 4,
    marginBottom: 8,
  },
  section: {
    marginTop: 8,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9CA3AF',
    marginBottom: 8,
    letterSpacing: 1,
  },
  menuCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    overflow: 'hidden',
    marginBottom: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  menuSubtitle: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 1,
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginLeft: 68,
  },
  logoutSection: {
    paddingHorizontal: 20,
    marginTop: 16,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#FECACA',
    gap: 8,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#DC2626',
  },
  footer: {
    alignItems: 'center',
    padding: 24,
    paddingBottom: 32,
  },
  footerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  footerIcon: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: '#1E40AF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerBrandText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  footerText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  footerCopy: {
    fontSize: 11,
    color: '#D1D5DB',
    marginTop: 4,
  },
});
