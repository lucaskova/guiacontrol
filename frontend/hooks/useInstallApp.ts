import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

/**
 * Detecta capacidade de instalação PWA e expõe um trigger para o prompt.
 *
 * Retorno:
 *  - canInstall: navegador suporta + evento já capturado (botão deve aparecer)
 *  - isStandalone: app já instalado/aberto como app
 *  - isIOS: iOS não suporta prompt — mostrar instruções manuais
 *  - install(): dispara o prompt nativo do navegador
 */
export function useInstallApp() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const ua = navigator.userAgent || '';
    const iOS = /iPad|iPhone|iPod/.test(ua) && !('MSStream' in window);
    setIsIOS(iOS);

    const checkStandalone = () => {
      const mq = window.matchMedia?.('(display-mode: standalone)').matches;
      const iosStandalone =
        // @ts-expect-error: navigator.standalone existe somente em iOS
        typeof navigator !== 'undefined' && navigator.standalone === true;
      setIsStandalone(Boolean(mq || iosStandalone));
    };
    checkStandalone();

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
      checkStandalone();
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    const mq = window.matchMedia?.('(display-mode: standalone)');
    mq?.addEventListener?.('change', checkStandalone);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
      mq?.removeEventListener?.('change', checkStandalone);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferred) return { outcome: 'dismissed' as const };
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === 'accepted') setDeferred(null);
      return choice;
    } catch {
      return { outcome: 'dismissed' as const };
    }
  }, [deferred]);

  return {
    canInstall: !!deferred && !isStandalone && !installed,
    isStandalone: isStandalone || installed,
    isIOS,
    install,
  };
}
