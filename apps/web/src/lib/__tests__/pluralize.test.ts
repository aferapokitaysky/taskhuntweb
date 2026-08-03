import { describe, expect, it } from 'vitest';
import { pluralize } from '../pluralize';

const FORMS: [string, string, string] = ['заказ', 'заказа', 'заказов'];

describe('pluralize', () => {
  it('использует форму "один" для 1, 21, 31 — но не для 11', () => {
    expect(pluralize(1, FORMS)).toBe('заказ');
    expect(pluralize(21, FORMS)).toBe('заказ');
    expect(pluralize(31, FORMS)).toBe('заказ');
    expect(pluralize(11, FORMS)).toBe('заказов');
  });

  it('использует форму "несколько" для 2-4, 22-24 — но не для 12-14', () => {
    expect(pluralize(2, FORMS)).toBe('заказа');
    expect(pluralize(3, FORMS)).toBe('заказа');
    expect(pluralize(4, FORMS)).toBe('заказа');
    expect(pluralize(22, FORMS)).toBe('заказа');
    expect(pluralize(12, FORMS)).toBe('заказов');
    expect(pluralize(13, FORMS)).toBe('заказов');
    expect(pluralize(14, FORMS)).toBe('заказов');
  });

  it('использует форму "много" для 0, 5-20, 25-30', () => {
    expect(pluralize(0, FORMS)).toBe('заказов');
    expect(pluralize(5, FORMS)).toBe('заказов');
    expect(pluralize(10, FORMS)).toBe('заказов');
    expect(pluralize(20, FORMS)).toBe('заказов');
    expect(pluralize(25, FORMS)).toBe('заказов');
  });
});
