import React, { useEffect, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '../store/authStore';

export default function AuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { login } = useAuthStore();
  const hasProcessed = useRef(false);

  useEffect(() => {
    const processAuth = async () => {
      // Evitar processamento duplo
      if (hasProcessed.current) return;
      hasProcessed.current = true;

      try {
        // Extrair session_id do hash
        let sessionId = params.session_id as string;

        // Se não vier nos params, tentar pegar do hash (web)
        if (!sessionId && typeof window !== 'undefined') {
          const hash = window.location.hash;
          const match = hash.match(/session_id=([^&]+)/);
          if (match) {
            sessionId = match[1];
          }
        }

        if (!sessionId) {
          console.error('Session ID não encontrado');
          router.replace('/login');
          return;
        }

        // Fazer login
        await login(sessionId);

        // Redirecionar para home
        router.replace('/(tabs)');
      } catch (error) {
        console.error('Erro no callback de autenticação:', error);
        router.replace('/login');
      }
    };

    processAuth();
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#3B82F6" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
});