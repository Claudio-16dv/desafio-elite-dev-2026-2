import { afterEach, describe, expect, it, vi } from 'vitest';
import { getApiUrl } from './env';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('getApiUrl', () => {
  it('usa localhost:4000 quando nada foi configurado', () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', '');
    expect(getApiUrl()).toBe('http://localhost:4000');
  });

  it('usa NEXT_PUBLIC_API_URL (embutida no build) quando não há configuração de runtime', () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.build.example/');
    expect(getApiUrl()).toBe('https://api.build.example');
  });

  it('a configuração de runtime (window.__APP_CONFIG__) tem prioridade e dispensa rebuild', () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.build.example');
    vi.stubGlobal('window', { __APP_CONFIG__: { apiUrl: 'https://api.runtime.example///' } });
    expect(getApiUrl()).toBe('https://api.runtime.example');
  });

  it('runtime vazio cai para o valor do build', () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.build.example');
    vi.stubGlobal('window', { __APP_CONFIG__: { apiUrl: '' } });
    expect(getApiUrl()).toBe('https://api.build.example');
  });
});
