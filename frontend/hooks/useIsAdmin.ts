import { useCallback, useEffect, useState } from 'react';
import { adminAPI } from '../services/api';
import { useAuthStore } from '../store/authStore';

/**
 * Verifica no backend se o usuário logado é admin (whitelist ADMIN_EMAILS).
 * Revalida sempre que a sessão mudar (login/logout).
 */
export function useIsAdmin() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const userEmail = useAuthStore((s) => s.user?.email);

  const check = useCallback(async () => {
    if (!isAuthenticated) {
      setIsAdmin(false);
      return;
    }
    try {
      const r = await adminAPI.me();
      setIsAdmin(Boolean(r.data?.is_admin));
    } catch {
      setIsAdmin(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    let cancelled = false;
    setIsAdmin(null);
    (async () => {
      if (!isAuthenticated) {
        if (!cancelled) setIsAdmin(false);
        return;
      }
      try {
        const r = await adminAPI.me();
        if (!cancelled) setIsAdmin(Boolean(r.data?.is_admin));
      } catch {
        if (!cancelled) setIsAdmin(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, userEmail]);

  return { isAdmin, loading: isAdmin === null, refresh: check };
}
