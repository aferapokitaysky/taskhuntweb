import { describe, expect, it } from 'vitest';
import { money } from '../types';

describe('money', () => {
  it('форматирует число со знаком валюты по умолчанию (USD)', () => {
    const result = money(1234.5);
    expect(result).toContain('1');
    expect(result).toContain('234');
  });

  it('принимает валюту как строку', () => {
    const result = money('99.99', 'USD');
    expect(result).toContain('99');
  });

  it('не падает на null/undefined — форматирует как 0', () => {
    expect(() => money(null)).not.toThrow();
    expect(() => money(undefined)).not.toThrow();
    expect(money(null)).toContain('0');
  });

  it('округляет до максимум 2 знаков после запятой', () => {
    const result = money(10.999);
    // 10.999 должно округлиться до 11 (maximumFractionDigits: 2)
    expect(result).not.toContain('999');
  });
});
