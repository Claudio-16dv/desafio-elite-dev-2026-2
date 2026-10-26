import { apiRequest } from '@/lib/api-client';
import type { AuthSession, Role, SessionUser } from '@/types/api';

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  role: Role;
}

export const authApi = {
  login: (input: { email: string; password: string }) =>
    apiRequest<AuthSession>('/auth/login', { method: 'POST', body: input, auth: false }),
  register: (input: RegisterInput) =>
    apiRequest<AuthSession>('/auth/register', { method: 'POST', body: input, auth: false }),
  me: () => apiRequest<SessionUser>('/auth/me'),
};
