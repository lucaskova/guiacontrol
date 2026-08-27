import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

type PwaInstallBag = {
  deferred: BeforeInstallPromptEvent | null;
};

declare global {
  interface Window {
    __pwaInstall?: PwaInstallBag;
  }
}

function readDeferred(): BeforeInstallPromptEvent | null {
  if (typeof window === 'undefined') return null;
  return window.__pwaInstall?.deferred ?? null;
}

function detectIOS(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // iPadOS 13+ se passa por Mac
  return /Mac/.test(ua) && navigator.maxTouchPoints > 1;
}

function detectInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /WhatsApp|FBAN|FBAV|Instagram|Line\/|Twitter|TikTok|; wv\)|WebView/i.test(ua);
}

/**
 * Detecta capacidade de instalação PWA e expõe um trigger para o prompt nativo.
 * O evento beforeinstallprompt costuma disparar antes do React — o bootstrap em +html.tsx
 * guarda em window.__pwaInstall.deferred.
 */
export function useInstallApp() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(readDeferred);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [inAppBrowser, setInAppBrowser] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    setIsIOS(detectIOS());
    setInAppBrowser(detectInAppBrowser());
    setDeferred(readDeferred());

    const checkStandalone = () => {
      const mq = window.matchMedia?.('(display-mode: standalone)').matches;
      const iosStandalone =
        // @ts-expect-error: navigator.standalone existe somente em iOS
        typeof navigator !== 'undefined' && navigator.standalone === true;
      setIsStandalone(Boolean(mq || iosStandalone));
    };
    checkStandalone();

    const onAvailable = () => setDeferred(readDeferred());
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      window.__pwaInstall = window.__pwaInstall || { deferred: null };
      window.__pwaInstall.deferred = e as BeforeInstallPromptEvent;
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
      if (window.__pwaInstall) window.__pwaInstall.deferred = null;
      checkStandalone();
    };

    window.addEventListener('pwa-install-available', onAvailable);
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    const mq = window.matchMedia?.('(display-mode: standalone)');
    mq?.addEventListener?.('change', checkStandalone);

    return () => {
      window.removeEventListener('pwa-install-available', onAvailable);
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
      mq?.removeEventListener?.('change', checkStandalone);
    };
  }, []);

  const install = useCallback(async () => {
    const promptEvent = deferred || readDeferred();
    if (!promptEvent) return { outcome: 'unavailable' as const };
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === 'accepted') {
        setDeferred(null);
        if (window.__pwaInstall) window.__pwaInstall.deferred = null;
      }
      return choice;
    } catch {
      return { outcome: 'dismissed' as const };
    }
  }, [deferred]);

  const openInChrome = useCallback(() => {
    if (typeof window === 'undefined') return;
    const url = window.location.href;
    const hostPath = window.location.host + window.location.pathname + window.location.search;
    const intent = `intent://${hostPath}#Intent;scheme=https;package=com.android.chrome;end`;
    window.location.href = intent;
    setTimeout(() => {
      window.open(url, '_blank');
    }, 400);
  }, []);

  return {
    canInstall: !!deferred && !isStandalone && !installed,
    isStandalone: isStandalone || installed,
    isIOS,
    inAppBrowser,
    install,
    openInChrome,
  };
}
