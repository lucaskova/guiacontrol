import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  ViewStyle,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { premium } from '../../theme/premium';
import { useIsAdmin } from '../../hooks/useIsAdmin';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

type StickyHeaderProps = {
  onOpenSearch: () => void;
  onOpenNotifications?: () => void;
  notificationsBadge?: boolean;
  userName?: string;
};

export function StickyHeader({
  onOpenSearch,
  onOpenNotifications,
  notificationsBadge,
  userName,
}: StickyHeaderProps) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWide = width >= 760;
  const { isAdmin } = useIsAdmin();

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = (e: KeyboardEvent) => {
      const isMod = e.ctrlKey || e.metaKey;
      if (isMod && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        onOpenSearch();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onOpenSearch]);

  return (
    <View style={[styles.wrap, Platform.OS === 'web' && (styles.wrapWeb as any)]}>
      <View style={styles.row}>
        <View style={styles.brandRow}>
          <View style={styles.brandIcon}>
            <Ionicons name="flash" size={16} color="#FFFFFF" />
          </View>
          {isWide ? (
            <View>
              <Text style={styles.brandName}>GuiaControl</Text>
              <Text style={styles.brandTag}>Automação fiscal</Text>
            </View>
          ) : null}
        </View>

        <Pressable
          onPress={onOpenSearch}
          style={({ hovered }: any) => [
            styles.search,
            hovered && styles.searchHover,
            Platform.OS === 'web' && (styles.searchWeb as any),
            !isWide && styles.searchCompact,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Buscar (Ctrl+K)"
        >
          <Ionicons name="search" size={15} color="#94A3B8" />
          <Text style={styles.searchPlaceholder} numberOfLines={1}>
            {isWide ? 'Buscar empresas, guias, ações...' : 'Buscar...'}
          </Text>
          {isWide ? (
            <View style={styles.kbd}>
              <Text style={styles.kbdText}>Ctrl</Text>
              <Text style={styles.kbdSep}>+</Text>
              <Text style={styles.kbdText}>K</Text>
            </View>
          ) : null}
        </Pressable>

        <View style={styles.actions}>
          {isAdmin ? (
            <Pressable
              onPress={() => router.push('/admin')}
              style={({ hovered }: any) => [
                styles.adminBtn,
                hovered && styles.adminBtnHover,
                Platform.OS === 'web' && (styles.btnWeb as any),
              ]}
              accessibilityRole="button"
              accessibilityLabel="Painel administrativo"
            >
              <Ionicons name="shield-checkmark" size={14} color="#FFFFFF" />
              {isWide ? <Text style={styles.adminBtnTxt}>Painel admin</Text> : null}
            </Pressable>
          ) : null}
          <IconButton
            icon="cloud-upload-outline"
            label="Upload rápido"
            onPress={() => router.push('/importar-guias')}
            tone="primary"
            compact={!isWide}
          />
          <IconButton
            icon="add-outline"
            label="Nova guia"
            onPress={() => router.push('/nova-guia')}
            tone="ghost"
            compact={!isWide}
          />
          <IconButton
            icon="notifications-outline"
            label="Alertas"
            onPress={onOpenNotifications}
            tone="ghost"
            compact
            badge={notificationsBadge}
          />
          <IconButton
            icon="person-circle-outline"
            label={userName ? userName.split(' ')[0] : 'Perfil'}
            onPress={() => router.push('/(tabs)/perfil' as any)}
            tone="ghost"
            compact={!isWide}
          />
        </View>
      </View>
    </View>
  );
}

type IconButtonProps = {
  icon: IoniconName;
  label: string;
  onPress?: () => void;
  tone: 'primary' | 'ghost';
  compact?: boolean;
  badge?: boolean;
};

function IconButton({ icon, label, onPress, tone, compact, badge }: IconButtonProps) {
  const isWeb = Platform.OS === 'web';
  const baseStyle = tone === 'primary' ? styles.btnPrimary : styles.btnGhost;
  const baseHover = tone === 'primary' ? styles.btnPrimaryHover : styles.btnGhostHover;
  const labelStyle = tone === 'primary' ? styles.btnPrimaryText : styles.btnGhostText;
  const iconColor = tone === 'primary' ? '#FFFFFF' : '#475569';

  return (
    <Pressable
      onPress={onPress}
      style={({ hovered }: any) => [
        styles.btn,
        baseStyle,
        compact && styles.btnCompact,
        isWeb && (styles.btnWeb as any),
        hovered && baseHover,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={styles.btnIconWrap}>
        <Ionicons name={icon} size={16} color={iconColor} />
        {badge ? <View style={styles.btnDot} /> : null}
      </View>
      {!compact ? <Text style={labelStyle}>{label}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderBottomWidth: 1,
    borderBottomColor: premium.border,
  },
  wrapWeb: {
    backdropFilter: 'saturate(180%) blur(12px)',
    WebkitBackdropFilter: 'saturate(180%) blur(12px)',
    position: 'sticky',
    top: 0,
    zIndex: 50,
  } as ViewStyle,
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
    maxWidth: 1280,
    alignSelf: 'center',
    width: '100%',
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: premium.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: { boxShadow: '0 6px 16px rgba(79, 70, 229, 0.32)' } as any,
      default: {
        shadowColor: premium.primary,
        shadowOpacity: 0.3,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 4,
      },
    }),
  },
  brandName: { fontSize: 14, fontWeight: '800', color: premium.text, letterSpacing: -0.3 },
  brandTag: { fontSize: 10, color: premium.textMuted, fontWeight: '600', marginTop: -1 },
  search: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: premium.border,
    minHeight: 36,
    maxWidth: 520,
  },
  searchCompact: { maxWidth: 220 },
  searchHover: {
    backgroundColor: '#FFFFFF',
    borderColor: '#C7D2FE',
  },
  searchWeb: {
    cursor: 'pointer',
    transition: 'background-color 200ms ease, border-color 200ms ease',
  } as ViewStyle,
  searchPlaceholder: {
    flex: 1,
    color: '#94A3B8',
    fontSize: 12.5,
    fontWeight: '500',
  },
  kbd: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 5,
    paddingVertical: 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: premium.border,
  },
  kbdText: { fontSize: 9.5, fontWeight: '800', color: '#64748B' },
  kbdSep: { fontSize: 9, color: '#CBD5E1' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 9,
    minHeight: 34,
  },
  btnCompact: { paddingHorizontal: 8 },
  btnWeb: { cursor: 'pointer', transition: 'background-color 200ms ease, color 200ms ease' } as ViewStyle,
  btnGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  btnGhostHover: { backgroundColor: '#F1F5F9', borderColor: premium.border },
  btnGhostText: { fontSize: 12.5, fontWeight: '700', color: '#475569' },
  btnPrimary: {
    backgroundColor: premium.primary,
  },
  btnPrimaryHover: { backgroundColor: premium.primaryDark },
  btnPrimaryText: { fontSize: 12.5, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.1 },
  btnIconWrap: { position: 'relative' },
  btnDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: premium.status.vencida.main,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  adminBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9,
    minHeight: 34,
    backgroundColor: '#0F766E',
    ...Platform.select({
      web: { boxShadow: '0 4px 12px rgba(15,118,110,0.30)' } as any,
      default: {
        shadowColor: '#0F766E',
        shadowOpacity: 0.3,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
        elevation: 3,
      },
    }),
  },
  adminBtnHover: { backgroundColor: '#115E59' },
  adminBtnTxt: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '800', letterSpacing: 0.1 },
});
