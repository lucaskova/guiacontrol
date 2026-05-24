import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Platform, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { premium } from '../../theme/premium';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

type Severity = 'critical' | 'warning' | 'success' | 'info' | string;

type Alert = {
  id: string;
  severity: Severity;
  icon: string;
  message: string;
};

const SEVERITY = {
  critical: {
    label: 'Crítico',
    bg: '#FEF2F2',
    border: '#FECACA',
    accent: '#DC2626',
    glow: 'rgba(220, 38, 38, 0.18)',
    icon: 'alert-circle' as IoniconName,
  },
  warning: {
    label: 'Atenção',
    bg: '#FFFBEB',
    border: '#FDE68A',
    accent: '#B45309',
    glow: 'rgba(180, 83, 9, 0.16)',
    icon: 'warning-outline' as IoniconName,
  },
  success: {
    label: 'Concluído',
    bg: '#ECFDF5',
    border: '#A7F3D0',
    accent: '#047857',
    glow: 'rgba(5, 150, 105, 0.14)',
    icon: 'checkmark-circle-outline' as IoniconName,
  },
  info: {
    label: 'Info',
    bg: '#EFF6FF',
    border: '#BFDBFE',
    accent: '#1D4ED8',
    glow: 'rgba(29, 78, 216, 0.14)',
    icon: 'information-circle-outline' as IoniconName,
  },
} as const;

function pickSeverity(sev: Severity) {
  if (sev === 'critical') return SEVERITY.critical;
  if (sev === 'warning') return SEVERITY.warning;
  if (sev === 'success') return SEVERITY.success;
  return SEVERITY.info;
}

function pickIcon(custom: string | undefined, fallback: IoniconName): IoniconName {
  if (!custom) return fallback;
  return custom as IoniconName;
}

export function AlertCenter({
  alerts,
  onPress,
}: {
  alerts: Alert[];
  onPress?: (alert: Alert) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  if (!alerts?.length) return null;

  const counts = alerts.reduce<Record<string, number>>((acc, a) => {
    acc[a.severity] = (acc[a.severity] || 0) + 1;
    return acc;
  }, {});

  const ranked = [...alerts].sort((a, b) => severityWeight(b.severity) - severityWeight(a.severity));

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => setCollapsed((c) => !c)}
        style={({ hovered }: any) => [styles.head, hovered && styles.headHover, Platform.OS === 'web' && (styles.headWeb as any)]}
        accessibilityRole="button"
        accessibilityLabel={collapsed ? 'Expandir alertas' : 'Recolher alertas'}
      >
        <View style={styles.headIcon}>
          <Ionicons name="pulse" size={16} color={premium.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Alertas inteligentes</Text>
          <Text style={styles.subtitle}>
            {ranked.length} ativo{ranked.length === 1 ? '' : 's'}
            {counts.critical ? ` · ${counts.critical} crítico${counts.critical === 1 ? '' : 's'}` : ''}
            {counts.warning ? ` · ${counts.warning} atenção` : ''}
          </Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{ranked.length}</Text>
        </View>
        <Ionicons
          name={collapsed ? 'chevron-down' : 'chevron-up'}
          size={16}
          color={premium.textMuted}
        />
      </Pressable>

      {!collapsed && (
        <View style={styles.list}>
          {ranked.map((a) => (
            <AlertRow key={a.id} alert={a} onPress={onPress} />
          ))}
        </View>
      )}
    </View>
  );
}

function severityWeight(sev: Severity): number {
  if (sev === 'critical') return 4;
  if (sev === 'warning') return 3;
  if (sev === 'info') return 2;
  return 1;
}

type AlertRowProps = {
  alert: Alert;
  onPress?: (alert: Alert) => void;
};

function AlertRow({ alert, onPress }: AlertRowProps) {
  const cfg = pickSeverity(alert.severity);
  const icon = pickIcon(alert.icon, cfg.icon);
  const [hovered, setHovered] = useState(false);
  const translateX = useRef(new Animated.Value(0)).current;

  const isWeb = Platform.OS === 'web';
  const webStyle: ViewStyle | undefined = isWeb
    ? ({
        // @ts-expect-error web-only
        cursor: onPress ? 'pointer' : 'default',
        transition: 'box-shadow 200ms ease, transform 200ms ease, border-color 200ms ease',
      } as ViewStyle)
    : undefined;

  return (
    <Pressable
      onPress={() => onPress?.(alert)}
      onHoverIn={() => {
        setHovered(true);
        Animated.spring(translateX, { toValue: 2, useNativeDriver: true, friction: 6 }).start();
      }}
      onHoverOut={() => {
        setHovered(false);
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true, friction: 6 }).start();
      }}
    >
      <Animated.View
        style={[
          styles.row,
          { backgroundColor: cfg.bg, borderColor: cfg.border, transform: [{ translateX }] },
          webStyle,
          hovered && { borderColor: cfg.accent, ...Platform.select({ web: { boxShadow: `0 8px 22px ${cfg.glow}` } as any, default: {} }) },
        ]}
      >
        <View style={[styles.severityBar, { backgroundColor: cfg.accent }]} />
        <View style={[styles.rowIconWrap, { backgroundColor: `${cfg.accent}1A` }]}>
          <Ionicons name={icon} size={16} color={cfg.accent} />
        </View>
        <View style={styles.rowMain}>
          <Text style={[styles.severityTag, { color: cfg.accent }]}>
            {cfg.label.toUpperCase()}
          </Text>
          <Text style={styles.rowMessage} numberOfLines={2}>
            {alert.message}
          </Text>
        </View>
        {onPress ? (
          <View style={styles.rowAction}>
            <Text style={[styles.rowActionText, { color: cfg.accent }]}>Resolver</Text>
            <Ionicons name="arrow-forward" size={13} color={cfg.accent} />
          </View>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: 20, marginTop: 18 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: premium.surface,
    borderWidth: 1,
    borderColor: premium.border,
  },
  headHover: { borderColor: '#C7D2FE' },
  headWeb: { cursor: 'pointer', transition: 'border-color 200ms ease' },
  headIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF2FF',
  },
  title: { fontSize: 14, fontWeight: '800', color: premium.text, letterSpacing: -0.2 },
  subtitle: { fontSize: 11.5, color: premium.textMuted, marginTop: 1 },
  badge: {
    minWidth: 26,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: premium.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  list: { marginTop: 8, gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  severityBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
  rowIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  rowMain: { flex: 1 },
  severityTag: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.7, marginBottom: 1 },
  rowMessage: { fontSize: 12.5, color: premium.text, fontWeight: '600', lineHeight: 17 },
  rowAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  rowActionText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.2 },
});
