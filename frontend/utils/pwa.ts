import { Platform } from 'react-native';

function clienteManifestUrl(pathname: string): string | null {
  const path = pathname || '/';
  if (path.indexOf('/cliente/') !== 0) return null;
  const parts = path.split('/').filter(Boolean);
  const token = parts[1] || '';
  if (!token) return null;
  return `/api/public/cliente/${encodeURIComponent(token)}/pwa-manifest`;
}

/**
 * Injeta tags de PWA no <head> e registra o Service Worker.
 * No portal do cliente usa manifest real (API), não blob — o Chrome só dispara
 * beforeinstallprompt com manifest same-origin.
 */
export function setupPWA(pathname?: string) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;

  const head = document.head;
  if (!head) return;

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
    const sel =
      rel === 'manifest'
        ? 'link[rel="manifest"]'
        : `link[rel="${rel}"]${attrs.sizes ? `[sizes="${attrs.sizes}"]` : ''}`;
    let el = head.querySelector(sel) as HTMLLinkElement | null;
    if (!el) {
      el = document.createElement('link');
      el.setAttribute('rel', rel);
      if (rel === 'manifest') el.id = 'app-manifest';
      head.appendChild(el);
    }
    el.setAttribute('href', href);
    Object.entries(attrs).forEach(([k, v]) => el!.setAttribute(k, v));
  };

  const path = pathname || window.location.pathname || '/';
  const isCliente = path.indexOf('/cliente/') === 0;
  const clienteManifest = clienteManifestUrl(path);

  const manifestHref = clienteManifest || '/manifest.webmanifest';
  setLink('manifest', manifestHref);

  if (isCliente) {
    document.title = 'Minhas Guias';
  } else if (!document.title || document.title === 'GuiaControl' || document.title === 'GuiaFlow') {
    document.title = 'GuiaControl — Automação fiscal inteligente';
  }

  setMeta('theme-color', '#0F766E');
  setMeta(
    'description',
    isCliente
      ? 'Acesse suas guias, pague pelo PIX e envie comprovantes.'
      : 'Automação fiscal para escritórios contábeis. OCR Inteligente, lembretes e acompanhamento em tempo real.'
  );
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
