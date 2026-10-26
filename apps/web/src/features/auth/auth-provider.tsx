'use client';

import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { setUnauthorizedHandler } from '@/lib/api-client';
import { tokenStorage } from '@/lib/token-storage';
import type { AuthSession, SessionUser } from '@/types/api';
import { authApi, type RegisterInput } from './auth-api';

type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

interface AuthContextValue {
  status: AuthStatus;
  user: SessionUser | null;
  /** JWT atual (usado pelo Socket.IO no handshake). */
  token: string | null;
  login: (input: { email: string; password: string }) => Promise<SessionUser>;
  register: (input: RegisterInput) => Promise<SessionUser>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<SessionUser | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const applySession = useCallback(
    (session: AuthSession) => {
      tokenStorage.set(session.accessToken);
      setToken(session.accessToken);
      setUser(session.user);
      setStatus('authenticated');
      // Dados "por usuário" do usuário anterior não podem aparecer para o novo.
      queryClient.clear();
      return session.user;
    },
    [queryClient],
  );

  const logout = useCallback(() => {
    tokenStorage.clear();
    setToken(null);
    setUser(null);
    setStatus('anonymous');
    queryClient.clear();
  }, [queryClient]);

  // Restaura a sessão ao abrir o app.
  useEffect(() => {
    const stored = tokenStorage.get();
    if (!stored) {
      setStatus('anonymous');
      return;
    }
    let cancelled = false;
    setToken(stored);
    authApi
      .me()
      .then((me) => {
        if (cancelled) return;
        setUser(me);
        setStatus('authenticated');
      })
      .catch(() => {
        if (cancelled) return;
        tokenStorage.clear();
        setToken(null);
        setStatus('anonymous');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Sessão expirada em qualquer chamada autenticada: volta a ser visitante.
  useEffect(() => {
    setUnauthorizedHandler(logout);
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  const login = useCallback(async (input: { email: string; password: string }) => applySession(await authApi.login(input)), [applySession]);
  const register = useCallback(async (input: RegisterInput) => applySession(await authApi.register(input)), [applySession]);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, token, login, register, logout }),
    [status, user, token, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser usado dentro de <AuthProvider>');
  return context;
}
