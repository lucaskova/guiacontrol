import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  visible: boolean;
  onHide: () => void;
}

export const Toast: React.FC<ToastProps> = ({
  message,
  type = 'success',
  visible,
  onHide,
}) => {
  const opacity = new Animated.Value(0);

  useEffect(() => {
    if (visible) {
      // Fade in
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      // Auto hide após 3 segundos
      const timer = setTimeout(() => {
        // Fade out
        Animated.timing(opacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          onHide();
        });
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [visible]);

  if (!visible) return null;

  const config = {
    success: {
      icon: 'checkmark-circle' as const,
      color: '#10B981',
      bg: '#D1FAE5',
    },
    error: {
      icon: 'close-circle' as const,
      color: '#EF4444',
      bg: '#FEE2E2',
    },
    info: {
      icon: 'information-circle' as const,
      color: '#3B82F6',
      bg: '#DBEAFE',
    },
  };

  const { icon, color, bg } = config[type];

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: bg, opacity },
      ]}
    >
      <Ionicons name={icon} size={24} color={color} />
      <Text style={[styles.message, { color }]}>{message}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    zIndex: 9999,
    gap: 12,
    ...Platform.select({
      web: { boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.3)' },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: { elevation: 8 },
    }),
  },
  message: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
});
