import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Platform } from 'react-native';
import { premium } from '../../theme/premium';

export function Skeleton({ width = '100%', height = 16, style }: { width?: number | string; height?: number; style?: object }) {
  const opacity = useRef(new Animated.Value(0.35)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.75, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.35, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return (
    <Animated.View
      style={[
        styles.base,
        { width, height, opacity },
        Platform.OS === 'web' && ({ width, height } as object),
        style,
      ]}
    />
  );
}

export function DashboardSkeleton() {
  return (
    <View style={styles.wrap}>
      <Skeleton height={120} style={{ borderRadius: 20, marginBottom: 16 }} />
      <View style={styles.row}>
        <Skeleton height={80} style={{ flex: 1, borderRadius: 14 }} />
        <Skeleton height={80} style={{ flex: 1, borderRadius: 14, marginLeft: 10 }} />
      </View>
      <Skeleton height={200} style={{ borderRadius: 16, marginTop: 16 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: '#E2E8F0', borderRadius: 8 },
  wrap: { padding: 20 },
  row: { flexDirection: 'row' },
});
