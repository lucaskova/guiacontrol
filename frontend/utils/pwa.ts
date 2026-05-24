import { Platform } from 'react-native';

/**
 * Injeta tags de PWA no <head> em runtime e registra o Service Worker.
 *
 * Roda apenas no web. Detecta se a URL atual é da Área do Cliente
 * (/cliente/<token>) e gera um manifest dinâmico — assim o cliente instala
 * um app "Minhas Guias" e o contador instala "GuiaFlow".
 */
export function setupPWA() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;

  const head = document.head;
  if (!head || head.dataset.pwaReady === '1') return;

  const setMeta = (name: string, content: string, useProperty = false) => {
    const attr = useProperty ? 'property' : 'name';
    let el = head.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attr, name);
      head.appendChild(el);
    }
    el.setAttribute('content', content);
  };

  const setLink = (rel: string, href: string, attrs: Record<string, string> = {}) => {
    const sel = `link[rel="${rel}"]${attrs.sizes ? `[sizes="${attrs.sizes}"]` : ''}`;
    let el = head.querySelector(sel) as HTMLLinkElement | null;
    if (!el) {
      el = document.createElement('link');
      el.setAttribute('rel', rel);
      head.appendChild(el);
    }
    el.setAttribute('href', href);
    Object.entries(attrs).forEach(([k, v]) => el!.setAttribute(k, v));
  };

  const path = window.location.pathname || '/';
  const isCliente = path.indexOf('/cliente/') === 0;

  // Manifest dinâmico para a área do cliente
  let manifestHref = '/manifest.webmanifest';
  if (isCliente) {
    const parts = path.split('/').filter(Boolean);
    const token = parts[1] || '';
    const manifest = {
      name: 'Minhas Guias — GuiaControl',
      short_name: 'Minhas Guias',
      description:
        'Suas guias fiscais — acesse, pague e envie comprovantes.',
      start_url: '/cliente/' + token,
      scope: '/cliente/',
      display: 'standalone',
      orientation: 'portrait',
      background_color: '#FFFFFF',
      theme_color: '#0F766E',
      lang: 'pt-BR',
      icons: [
        { src: '/icon.svg', type: 'image/svg+xml', sizes: 'any', purpose: 'any' },
        { src: '/icon-192.png', type: 'image/png', sizes: '192x192', purpose: 'any' },
        { src: '/icon-512.png', type: 'image/png', sizes: '512x512', purpose: 'any' },
        {
          src: '/icon-maskable-512.png',
          type: 'image/png',
          sizes: '512x512',
          purpose: 'maskable',
        },
      ],
    };
    try {
      const blob = new Blob([JSON.stringify(manifest)], {
        type: 'application/manifest+json',
      });
      manifestHref = URL.createObjectURL(blob);
      document.title = 'Minhas Guias';
    } catch {
      // mantém manifest padrão
    }
  } else {
    if (!document.title || document.title === 'GuiaControl' || document.title === 'GuiaFlow') {
      document.title = 'GuiaControl — Automação fiscal inteligente';
    }
  }

  setLink('manifest', manifestHref);

  setMeta('theme-color', '#0F766E');
  setMeta('description', isCliente
    ? 'Acesse suas guias, pague pelo PIX e envie comprovantes.'
    : 'Automação fiscal para escritórios contábeis. OCR Inteligente, lembretes e acompanhamento em tempo real.');
  setMeta('application-name', isCliente ? 'Minhas Guias' : 'GuiaControl');
  setMeta('apple-mobile-web-app-capable', 'yes');
  setMeta('mobile-web-app-capable', 'yes');
  setMeta('apple-mobile-web-app-status-bar-style', 'black-translucent');
  setMeta('apple-mobile-web-app-title', isCliente ? 'Minhas Guias' : 'GuiaControl');
  setMeta('format-detection', 'telephone=no');

  setLink('icon', '/icon.svg', { type: 'image/svg+xml' });
  setLink('icon', '/favicon-32.png', { type: 'image/png', sizes: '32x32' });
  setLink('apple-touch-icon', '/apple-touch-icon.png', { sizes: '180x180' });
  setLink('mask-icon', '/icon.svg', { color: '#0F766E' });

  head.dataset.pwaReady = '1';

  // Registro do Service Worker (offline shell)
  if ('serviceWorker' in navigator) {
    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* ignora — algumas configs locais bloqueiam SW */
      });
    };
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }
}
