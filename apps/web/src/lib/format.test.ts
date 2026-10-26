import { describe, expect, it } from 'vitest';
import { formatBRL, formatCountdown, parseBRLToCents, shortHash } from './format';

describe('formatBRL', () => {
  it('formata centavos em reais', () => {
    expect(formatBRL(123456)).toBe('R$ 1.234,56');
    expect(formatBRL(0)).toBe('R$ 0,00');
    expect(formatBRL(5)).toBe('R$ 0,05');
  });
});

describe('parseBRLToCents', () => {
  it.each([
    ['1.234,56', 123456],
    ['1234,56', 123456],
    ['1234.56', 123456],
    ['R$ 10,00', 1000],
    ['10', 1000],
    ['1.000', 100000],
    ['0,5', 50],
    ['0,05', 5],
  ])('interpreta "%s" como %i centavos', (input, expected) => {
    expect(parseBRLToCents(input)).toBe(expected);
  });

  it('retorna null para texto sem números', () => {
    expect(parseBRLToCents('abc')).toBeNull();
    expect(parseBRLToCents('')).toBeNull();
  });
});

describe('formatCountdown', () => {
  it('formata minutos, horas e dias', () => {
    expect(formatCountdown(65_000)).toBe('01:05');
    expect(formatCountdown(3_661_000)).toBe('01:01:01');
    expect(formatCountdown(90_061_000)).toBe('1d 01:01:01');
  });

  it('nunca fica negativo', () => {
    expect(formatCountdown(-5_000)).toBe('00:00');
  });
});

describe('shortHash', () => {
  it('abrevia hashes longos', () => {
    expect(shortHash('a'.repeat(64))).toBe(`${'a'.repeat(8)}…${'a'.repeat(8)}`);
    expect(shortHash('abc')).toBe('abc');
  });
});
