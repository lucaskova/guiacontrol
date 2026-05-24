import { Platform } from 'react-native';

export const premium = {
  bg: '#F4F6FB',
  surface: '#FFFFFF',
  surfaceMuted: '#F8FAFC',
  border: '#E8ECF4',
  text: '#0F172A',
  textMuted: '#64748B',
  primary: '#4F46E5',
  primaryDark: '#3730A3',
  accent: '#06B6D4',
  gradientStart: '#4F46E5',
  gradientEnd: '#7C3AED',
  colors: {
    bg: '#F4F6FB',
    surface: '#FFFFFF',
    surfaceMuted: '#F8FAFC',
    border: '#E8ECF4',
    text: '#0F172A',
    textMuted: '#64748B',
    primary: '#4F46E5',
    primaryDark: '#3730A3',
    accent: '#06B6D4',
    gradientStart: '#4F46E5',
    gradientEnd: '#7C3AED',
  },
  status: {
    vencida: {
      main: '#DC2626',
      bg: '#FEF2F2',
      glow: 'rgba(220, 38, 38, 0.18)',
      bar: '#EF4444',
    },
    a_vencer: {
      main: '#D97706',
      bg: '#FFFBEB',
      glow: 'rgba(217, 119, 6, 0.16)',
      bar: '#F59E0B',
    },
    paga: {
      main: '#059669',
      bg: '#ECFDF5',
      glow: 'rgba(5, 150, 105, 0.14)',
      bar: '#10B981',
    },
  },
  shadow: Platform.select({
    web: { boxShadow: '0 4px 24px rgba(15, 23, 42, 0.06)' },
    default: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 16,
      elevation: 4,
    },
  }),
  shadowLg: Platform.select({
    web: { boxShadow: '0 12px 40px rgba(79, 70, 229, 0.15)' },
    default: {
      shadowColor: '#4F46E5',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 24,
      elevation: 8,
    },
  }),
} as const;

export function getStatusPremium(status: string) {
  if (status === 'vencida') return premium.status.vencida;
  if (status === 'paga') return premium.status.paga;
  return premium.status.a_vencer;
}

export function calcRiskScore(guia: {
  status?: string;
  data_vencimento?: string;
}): 'baixo' | 'medio' | 'alto' {
  if (guia.status === 'paga') return 'baixo';
  if (guia.status === 'vencida') return 'alto';
  if (!guia.data_vencimento) return 'medio';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const parts = guia.data_vencimento.split('-');
  if (parts.length === 3) {
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    const diff = Math.ceil((d.getTime() - today.getTime()) / 86400000);
    if (diff <= 1) return 'alto';
    if (diff <= 7) return 'medio';
  }
  return 'baixo';
}
