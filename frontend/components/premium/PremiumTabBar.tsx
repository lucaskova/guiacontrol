import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  Platform,
  ViewStyle,
  useWindowDimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { premium } from '../../theme/premium';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_META: Record<string, { label: string; icon: IoniconName; iconActive: IoniconName }> = {
  index: { label: 'Início', icon: 'home-outline', iconActive: 'home' },
  guias: { label: 'Guias', icon: 'document-text-outline', iconActive: 'document-text' },
  empresas: { label: 'Empresas', icon: 'business-outline', iconActive: 'business' },
  notificacoes: { label: 'Alertas', icon: 'notifications-outline', iconActive: 'notifications' },
  perfil: { label: 'Perfil', icon: 'person-outline', iconActive: 'person' },
};

export function PremiumTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { width } = useWindowDimensions();
  const isWide = width >= 720;

  return (
    <View pointerEvents="box-none" style={styles.outer}>
      <View style={styles.shadow} pointerEvents="none" />
      <BlurView
        intensity={Platform.OS === 'web' ? 30 : 60}
        tint="light"
        style={[styles.bar, isWide && styles.barWide]}
      >
        <View style={styles.row}>
          {state.routes.map((route, index) => {
            const meta = TAB_META[route.name];
            if (!meta) return null;

            const isActive = state.index === index;
            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!isActive && !event.defaultPrevented) {
                navigation.navigate(route.name as never, route.params as never);
              }
            };

            return (
              <TabItem
                key={route.key}
                label={meta.label}
                icon={isActive ? meta.iconActive : meta.icon}
                isActive={isActive}
                onPress={onPress}
                accessibilityLabel={descriptors[route.key]?.options?.tabBarAccessibilityLabel}
              />
            );
          })}
        </View>
      </BlurView>
    </View>
  );
}

type TabItemProps = {
  label: string;
  icon: IoniconName;
  isActive: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
};

function TabItem({ label, icon, isActive, onPress, accessibilityLabel }: TabItemProps) {
  const scale = useRef(new Animated.Value(isActive ? 1 : 0.92)).current;
  const opacity = useRef(new Animated.Value(isActive ? 1 : 0)).current;
  const translateY = useRef(new Animated.Value(isActive ? -2 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: isActive ? 1 : 0.94,
        useNativeDriver: true,
        speed: 30,
        bounciness: 6,
      }),
      Animated.timing(opacity, {
        toValue: isActive ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: isActive ? -2 : 0,
        useNativeDriver: true,
        speed: 30,
        bounciness: 6,
      }),
    ]).start();
  }, [isActive, scale, opacity, translateY]);

  const isWeb = Platform.OS === 'web';
  const webStyle: ViewStyle | undefined = isWeb
    ? ({
        // @ts-expect-error web-only
        cursor: 'pointer',
        transition: 'background-color 200ms ease',
      } as ViewStyle)
    : undefined;

  return (
    <Pressable
      onPress={onPress}
      style={styles.itemPressable}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ selected: isActive }}
    >
      <Animated.View
        style={[
          styles.item,
          webStyle,
          { transform: [{ translateY }, { scale }] },
        ]}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.activePill,
            { opacity },
          ]}
        />
        <View style={styles.itemInner}>
          <Ionicons
            name={icon}
            size={20}
            color={isActive ? '#FFFFFF' : '#94A3B8'}
          />
          <Text
            numberOfLines={1}
            style={[
              styles.label,
              { color: isActive ? '#FFFFFF' : '#64748B', fontWeight: isActive ? '700' : '600' },
            ]}
          >
            {label}
          </Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  outer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 14,
    paddingBottom: Platform.OS === 'ios' ? 22 : 12,
    paddingTop: 4,
    alignItems: 'center',
  },
  shadow: {
    position: 'absolute',
    left: 14,
    right: 14,
    top: 4,
    bottom: Platform.OS === 'ios' ? 22 : 12,
    borderRadius: 22,
    ...Platform.select({
      web: { boxShadow: '0 14px 38px rgba(15, 23, 42, 0.14)' } as any,
      default: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.18,
        shadowRadius: 24,
        elevation: 12,
      },
    }),
  },
  bar: {
    width: '100%',
    maxWidth: 720,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor:
      Platform.OS === 'web' ? 'rgba(255,255,255,0.78)' : 'rgba(255,255,255,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.9)',
  },
  barWide: { alignSelf: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    paddingVertical: 6,
    gap: 4,
  },
  itemPressable: {
    flex: 1,
    minHeight: 52,
  },
  item: {
    flex: 1,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 8,
    overflow: 'hidden',
  },
  activePill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    backgroundColor: premium.primary,
    ...Platform.select({
      web: { boxShadow: '0 8px 20px rgba(79, 70, 229, 0.42)' } as any,
      default: {
        shadowColor: premium.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.45,
        shadowRadius: 14,
        elevation: 6,
      },
    }),
  },
  itemInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  label: {
    fontSize: 11.5,
    letterSpacing: 0.1,
  },
});
