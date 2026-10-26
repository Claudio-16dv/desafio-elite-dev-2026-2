import { describe, expect, it } from 'vitest';
import { runtimeConfigScript } from './runtime-config';

describe('runtimeConfigScript', () => {
  it('expõe o API_URL do ambiente', () => {
    expect(runtimeConfigScript({ API_URL: 'https://api.exemplo.com' })).toBe(
      'window.__APP_CONFIG__={"apiUrl":"https://api.exemplo.com"};',
    );
  });

  it('sem API_URL entrega string vazia (o front usa o valor do build/padrão)', () => {
    expect(runtimeConfigScript({})).toBe('window.__APP_CONFIG__={"apiUrl":""};');
  });

  it('é seguro contra valor que tente fechar a tag <script>', () => {
    const script = runtimeConfigScript({ API_URL: 'https://x</script><script>alert(1)' });
    expect(script).not.toContain('</script>');
    expect(script).toContain('\\u003c/script>');
  });
});
