import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { ActivityIndicator, View } from 'react-native';
import { ToastProvider } from '../contexts/ToastContext';
import { setupPWA } from '../utils/pwa';

export default function RootLayout() {
  const [initializing, setInitializing] = useState(true);
  const isLoading = useAuthStore((state) => state.isLoading);
  const loadUser = useAuthStore((state) => state.loadUser);

  useEffect(() => {
    setupPWA();
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        await loadUser();
      } catch (error) {
        console.error('Error loading user:', error);
      } finally {
        setInitializing(false);
      }
    };
    
    init();
  }, [loadUser]);

  if (initializing || isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' }}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <ToastProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="login" />
        <Stack.Screen name="auth-callback" />
        <Stack.Screen name="importar-guias" />
        <Stack.Screen name="nova-guia" />
        <Stack.Screen name="adicionar-empresa" />
        <Stack.Screen name="guia-detalhes" />
        <Stack.Screen name="cliente/[token]" />
      </Stack>
    </ToastProvider>
  );
}