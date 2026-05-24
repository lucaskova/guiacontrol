import { format, parseISO, isToday, isTomorrow, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export const formatCNPJ = (cnpj: string): string => {
  const cleaned = cnpj.replace(/\D/g, '');
  return cleaned.replace(
    /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
    '$1.$2.$3/$4-$5'
  );
};

export const formatDate = (dateString: string): string => {
  try {
    const date = parseISO(dateString);
    return format(date, "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return dateString;
  }
};

export const formatDateRelative = (dateString: string): string => {
  try {
    const date = parseISO(dateString);
    
    if (isToday(date)) {
      return 'Hoje';
    }
    
    if (isTomorrow(date)) {
      return 'Amanhã';
    }
    
    if (isPast(date)) {
      return `Venceu em ${format(date, "dd/MM/yyyy", { locale: ptBR })}`;
    }
    
    return format(date, "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return dateString;
  }
};

export const getStatusColor = (status: string): string => {
  switch (status) {
    case 'paga':
      return '#10B981'; // Verde
    case 'vencida':
      return '#EF4444'; // Vermelho
    case 'a_vencer':
      return '#F59E0B'; // Amarelo/Laranja
    default:
      return '#6B7280'; // Cinza
  }
};

export const getStatusText = (status: string): string => {
  switch (status) {
    case 'paga':
      return 'Paga';
    case 'vencida':
      return 'Vencida';
    case 'a_vencer':
      return 'A Vencer';
    default:
      return status;
  }
};