/**
 * Configuração central da landing.
 * Edite SOMENTE este arquivo para trocar destinos de CTAs, número de WhatsApp,
 * vídeo de demonstração e URL do app.
 */
export const SITE_CONFIG = {
  /**
   * WhatsApp do escritório/comercial em formato internacional.
   * Apenas dígitos. Exemplo: 5511999998888 (55 = Brasil, 11 = DDD).
   * TROQUE pelo seu número antes de publicar em produção.
   */
  whatsappNumber: '5555996580352',

  /** Mensagem pré-preenchida no botão "Solicitar demonstração". */
  whatsappMessageDemo:
    'Olá! Vi a landing do GuiaControl e quero agendar uma demonstração para o meu escritório contábil.',

  /** Mensagem pré-preenchida no botão "Testar grátis". */
  whatsappMessageTrial:
    'Olá! Quero testar o GuiaControl grátis no meu escritório. Pode me ajudar a começar?',

  /**
   * URL base do app GuiaControl (sem barra no final).
   *   - Em DEV (Expo web local):  http://localhost:8081
   *   - Em PROD (após deploy):   https://app.GuiaControl.com
   * Usada pelos botões "Entrar" e (opcionalmente) "Testar grátis".
   */
  appUrl: 'http://localhost:8081',

  /**
   * Se true, "Testar grátis" também abre o app (rota /login).
   * Se false, "Testar grátis" abre o WhatsApp comercial (recomendado para captação).
   */
  trialOpensApp: false,

  /**
   * URL do vídeo de demonstração para o botão "Ver demonstração".
   * Suportado:
   *   - YouTube embed:   https://www.youtube.com/embed/VIDEO_ID
   *   - MP4 local:       /demo.mp4   (arquivo em landing/public/)
   *   - MP4 externo:     https://cdn.seu-site.com/demo.mp4
   * Deixe em branco ('') para exibir o placeholder "Vídeo em produção".
   */
  demoVideoUrl: '',
} as const;

/** Monta o link do WhatsApp com mensagem pré-preenchida. */
export function whatsappLink(message: string) {
  const num = SITE_CONFIG.whatsappNumber.replace(/\D/g, '');
  return `https://wa.me/${num}?text=${encodeURIComponent(message)}`;
}

/** Tela de login do app. */
export const loginHref = `${SITE_CONFIG.appUrl.replace(/\/$/, '')}/login`;

/** Destino do botão "Solicitar demonstração". */
export const demoHref = whatsappLink(SITE_CONFIG.whatsappMessageDemo);

/** Destino do botão "Testar grátis". */
export const trialHref = SITE_CONFIG.trialOpensApp
  ? loginHref
  : whatsappLink(SITE_CONFIG.whatsappMessageTrial);
