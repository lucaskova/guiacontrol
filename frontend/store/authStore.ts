import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI } from '../services/api';
import type { AxiosResponse } from 'axios';

export interface User {
  user_id: string;
  email: string;
  name: string;
  picture?: string | null;
  created_at?: string;
}

export type AuthResponseBody = { user: User; session_token: string };

function parseAuthResponse(response: AxiosResponse<AuthResponseBody | User>): AuthResponseBody {
  const d = response.data as AuthResponseBody & User;
  if (d && typeof d === 'object' && 'session_token' in d && 'user' in d) {
    return { user: d.user, session_token: d.session_token };
  }
  throw new Error('Resposta de autenticação inválida');
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (sessionId: string) => Promise<void>;
  loginWithPassword: (email: string, password: string) => Promise<void>;
  registerWithPassword: (name: string, email: string, password: string) => Promise<void>;
  loadUser: () => Promise<void>;
  logout: () => Promise<void>;
}

async function persistAuth(response: AxiosResponse<AuthResponseBody | User>) {
  let parsed: AuthResponseBody;
  try {
    parsed = parseAuthResponse(response);
  } catch {
    const body = response?.data;
    const keys =
      body && typeof body === 'object' ? Object.keys(body as object).join(', ') : String(body);
    throw new Error(
      `Resposta de autenticação inválida (campos recebidos: ${keys}). Verifique se a URL da API está correta.`
    );
  }
  try {
    await AsyncStorage.setItem('session_token', parsed.session_token);
    await AsyncStorage.setItem('user_data', JSON.stringify(parsed.user));
  } catch (e) {
    console.error('AsyncStorage ao salvar sessão:', e);
    throw new Error('Não foi possível salvar a sessão neste dispositivo (armazenamento).');
  }
  return parsed.user;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (sessionId: string) => {
    try {
      const response = await authAPI.createSession(sessionId);
      const user = await persistAuth(response);
      set({
        user,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      console.error('Erro ao fazer login:', error);
      set({ isLoading: false });
      throw error;
    }
  },

  loginWithPassword: async (email: string, password: string) => {
    try {
      const response = await authAPI.loginPassword({ email, password });
      const user = await persistAuth(response);
      set({
        user,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      console.error('Erro ao fazer login:', error);
      set({ isLoading: false });
      throw error;
    }
  },

  registerWithPassword: async (name: string, email: string, password: string) => {
    try {
      const response = await authAPI.register({ name, email, password });
      const user = await persistAuth(response);
      set({
        user,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      console.error('Erro ao registrar:', error);
      set({ isLoading: false });
      throw error;
    }
  },

  loadUser: async () => {
    try {
      set({ isLoading: true });

      const response = await authAPI.getMe();
      const userData = response.data as User;

      await AsyncStorage.setItem('user_data', JSON.stringify(userData));

      set({
        user: userData,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch {
      await AsyncStorage.removeItem('user_data');
      await AsyncStorage.removeItem('session_token');
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },

  logout: async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    } finally {
      await AsyncStorage.removeItem('session_token');
      await AsyncStorage.removeItem('user_data');

      set({
        user: null,
        isAuthenticated: false,
      });
    }
  },
}));
