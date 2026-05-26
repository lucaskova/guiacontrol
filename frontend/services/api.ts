import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

/** Base da API sem barra final. Em dev, cai em localhost:8000 se EXPO_PUBLIC_BACKEND_URL vier vazia. */
export function getBackendBaseUrl(): string {
  const u = process.env.EXPO_PUBLIC_BACKEND_URL?.trim().replace(/\/+$/, '');
  if (u) return u;
  const isDev =
    typeof __DEV__ !== 'undefined'
      ? __DEV__
      : process.env.NODE_ENV !== 'production';
  if (isDev) {
    console.warn(
      '[GuiaFlow] EXPO_PUBLIC_BACKEND_URL ausente — usando http://localhost:8000. Crie frontend/.env e reinicie o Expo (ex.: npx expo start -c).'
    );
    return 'http://localhost:8000';
  }
  return '';
}

const BACKEND_URL = getBackendBaseUrl();

const api = axios.create({
  baseURL: `${BACKEND_URL || 'http://localhost:8000'}/api`,
  // 60s para tolerar cold-start do Render Free na 1a request
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

function isPublicAuthRequest(config: { url?: string; baseURL?: string }): boolean {
  const rel = typeof config.url === 'string' ? config.url : '';
  const joined = `${config.baseURL || ''}${rel}`;
  return (
    rel.includes('/auth/register') ||
    rel.includes('/auth/login') ||
    rel.includes('/auth/session') ||
    joined.includes('/auth/register') ||
    joined.includes('/auth/login') ||
    joined.includes('/auth/session')
  );
}

// Interceptor: não envia Bearer em cadastro/login (token antigo pode quebrar o fluxo no browser).
api.interceptors.request.use(
  async (config) => {
    if (isPublicAuthRequest(config)) {
      delete config.headers.Authorization;
      return config;
    }
    const token = await AsyncStorage.getItem('session_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para tratar erros
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token inválido - limpar storage
      AsyncStorage.removeItem('session_token');
      AsyncStorage.removeItem('user_data');
    }
    return Promise.reject(error);
  }
);

export default api;

// Auth
export const authAPI = {
  createSession: (sessionId: string) =>
    api.post('/auth/session', null, {
      headers: { 'X-Session-ID': sessionId },
    }),
  loginPassword: (body: { email: string; password: string }) =>
    api.post('/auth/login', body),
  register: (body: { name: string; email: string; password: string }) =>
    api.post('/auth/register', body),
  getMe: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
};

// CNPJ
export const cnpjAPI = {
  buscar: (cnpj: string) => api.get(`/cnpj/${cnpj}`),
};

// Empresas
export const empresasAPI = {
  criar: (data: { cnpj: string }) => api.post('/empresas', data),
  listar: (params?: { search?: string }) => api.get('/empresas', { params }),
  obter: (empresaId: string) => api.get(`/empresas/${empresaId}`),
  editar: (empresaId: string, data: any) => api.patch(`/empresas/${empresaId}`, data),
  deletar: (empresaId: string) => api.delete(`/empresas/${empresaId}`),
  regenerarPortalToken: (empresaId: string) =>
    api.post(`/empresas/${empresaId}/regenerar-portal-token`),
};

/** Portal do cliente (sem sessão): requisição direta, sem cookie de contador. */
export function fetchPortalCliente(portalToken: string) {
  const base = getBackendBaseUrl();
  if (!base) {
    return Promise.reject(new Error('EXPO_PUBLIC_BACKEND_URL não definida'));
  }
  return axios.get(
    `${base}/api/public/cliente/${encodeURIComponent(portalToken)}`,
    { timeout: 30000 },
  );
}

/** Cliente marca guia como paga pelo link do portal (sem login). */
export function portalMarcarPaga(
  portalToken: string,
  guiaId: string,
  body?: { comprovante?: string | null },
) {
  const base = getBackendBaseUrl();
  if (!base) {
    return Promise.reject(new Error('EXPO_PUBLIC_BACKEND_URL não definida'));
  }
  const payload =
    body?.comprovante && String(body.comprovante).trim().length > 0
      ? { comprovante: body.comprovante }
      : {};
  return axios.post(
    `${base}/api/public/cliente/${encodeURIComponent(portalToken)}/guias/${encodeURIComponent(guiaId)}/marcar-paga`,
    payload,
    {
      timeout: 120000,
      headers: { 'Content-Type': 'application/json' },
    },
  );
}

// Guias
export const guiasAPI = {
  criar: (data: any) => api.post('/guias', data),
  listar: (params?: { status?: string; empresa_id?: string; sort?: string; vence_em?: string }) =>
    api.get('/guias', { params }),
  obter: (guiaId: string) => api.get(`/guias/${guiaId}`),
  atualizar: (guiaId: string, data: any) => api.put(`/guias/${guiaId}`, data),
  deletar: (guiaId: string) => api.delete(`/guias/${guiaId}`),
  marcarPaga: (guiaId: string, data?: { comprovante?: string }) =>
    api.post(`/guias/${guiaId}/marcar-paga`, data || {}),
  pagar: (guiaId: string, data?: { comprovante?: string }) =>
    api.patch(`/guias/${guiaId}/pagar`, data || {}),
  enviarLembrete: (
    guiaId: string,
    data?: { telefone?: string; mensagem_extra?: string },
  ) => api.post(`/guias/${guiaId}/enviar-lembrete`, data || {}),
};

// Dashboard
export const dashboardAPI = {
  getStats: () => api.get('/dashboard/stats'),
  getInsights: () => api.get('/dashboard/insights'),
};

// Logs
export const logsAPI = {
  listar: (params?: { entidade?: string; limit?: number }) =>
    api.get('/logs', { params }),
};

// Notificações
export const notificacoesAPI = {
  listar: (params?: { canal?: string; empresa_id?: string; limit?: number }) =>
    api.get('/notificacoes', { params }),
  enviarTeste: (data: { telefone: string; mensagem?: string }) =>
    api.post('/notificacoes/enviar-teste', data),
  executarJob: () => api.post('/notificacoes/executar-job'),
  /** Status do WhatsApp (APIBrasil). Mantém alias statusZAPI para compatibilidade. */
  statusWhatsApp: () => api.get('/notificacoes/status-whatsapp'),
  statusZAPI: () => api.get('/notificacoes/status-whatsapp'),
};

/** Conexão WhatsApp do contador (QR Code APIBrasil). */
export const whatsappAPI = {
  conectar: () => api.post('/whatsapp/conectar'),
  status: () => api.get('/whatsapp/status'),
  desconectar: () => api.post('/whatsapp/desconectar'),
};

// OCR
function isGatewayOrNetworkError(error: any): boolean {
  const status = error?.response?.status;
  const msg = String(error?.message || '');
  return (
    status === 502 ||
    status === 503 ||
    status === 504 ||
    msg.includes('Network Error') ||
    msg.includes('timeout')
  );
}

function normalizeDebugOCRPayload(debugData: any) {
  const d = debugData?.dados_extraidos || {};
  return {
    texto_completo: debugData?.texto_bruto || '',
    valor: d?.valor ?? null,
    data_vencimento: d?.data_vencimento ?? null,
    codigo_barras: d?.codigo_barras ?? null,
    qr_code_pix: d?.qr_code_pix ?? null,
    competencia: d?.competencia ?? null,
    tipo_documento: d?.tipo_documento ?? null,
    descricao_sugerida: d?.descricao_sugerida ?? null,
    cnpj: d?.cnpj ?? null,
  };
}

export const ocrAPI = {
  processar: async (imageBase64: string) => {
    try {
      return await api.post('/ocr/processar', { image_base64: imageBase64 }, { timeout: 180000 });
    } catch (error: any) {
      // Render + OCR externo podem retornar 502/503/504 em picos/cold-start.
      // Nesses casos, usamos /ocr/debug como fallback e mantemos o app operacional.
      if (!isGatewayOrNetworkError(error)) {
        throw error;
      }
      const debugRes = await api.post('/ocr/debug', { image_base64: imageBase64 }, { timeout: 180000 });
      if (debugRes?.data?.erro) {
        throw error;
      }
      return {
        ...debugRes,
        data: normalizeDebugOCRPayload(debugRes.data),
      };
    }
  },
  loteAnalisar: (itens: unknown[]) =>
    api.post('/ocr/lote/analisar', { itens }, { timeout: 90000 }),
  loteHash: (imageBase64: string) =>
    api.post('/ocr/lote/hash', { image_base64: imageBase64 }, { timeout: 60000 }),
};

export const guiasLoteAPI = {
  confirmar: (data: { itens: unknown[]; enviar_notificacoes?: boolean }) =>
    api.post('/guias/lote', data, { timeout: 300000 }),
};

// =============== ADMIN ===============
export const adminAPI = {
  /** Diz se o usuário logado é admin (200 sempre — flag no body). */
  me: () => api.get('/admin/me'),
  overview: () => api.get('/admin/overview'),
  listUsers: (params?: { search?: string }) => api.get('/admin/users', { params }),
  createUser: (body: {
    name: string;
    email: string;
    password: string;
    telefone_admin?: string;
  }) => api.post('/admin/users', body),
  patchUser: (
    userId: string,
    body: { telefone_admin?: string | null; bloqueado?: boolean; password?: string },
  ) => api.patch(`/admin/users/${userId}`, body),
  deleteUser: (userId: string) => api.delete(`/admin/users/${userId}`),
  impersonate: (userId: string) => api.post(`/admin/users/${userId}/impersonate`),
  listEmpresas: (params?: { search?: string; user_id?: string; limit?: number }) =>
    api.get('/admin/empresas', { params }),
  listGuias: (params?: { status?: string; user_id?: string; limit?: number }) =>
    api.get('/admin/guias', { params }),
  listLogsWhatsapp: (params?: { user_id?: string; sucesso?: boolean; limit?: number }) =>
    api.get('/admin/logs/whatsapp', { params }),
  getConfig: () => api.get('/admin/config'),
  patchConfig: (body: {
    maintenance_mode?: boolean;
    maintenance_message?: string;
    banner_message?: string;
    banner_active?: boolean;
  }) => api.patch('/admin/config', body),
};