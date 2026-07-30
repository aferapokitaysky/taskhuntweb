import { describe, expect, it } from 'vitest';
import { ORDER_STATUS_COLORS, ORDER_STATUS_LABELS } from '../orderStatus';

const KNOWN_STATUSES = ['DRAFT', 'OPEN', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETED', 'CANCELLED', 'DISPUTED', 'EXPIRED'];

describe('orderStatus', () => {
  it('содержит русскую подпись для каждого известного статуса заказа', () => {
    for (const status of KNOWN_STATUSES) {
      expect(ORDER_STATUS_LABELS[status]).toBeTruthy();
    }
  });

  it('содержит цветовой класс для каждого известного статуса заказа', () => {
    for (const status of KNOWN_STATUSES) {
      expect(ORDER_STATUS_COLORS[status]).toBeTruthy();
    }
  });

  it('LABELS и COLORS покрывают ровно один и тот же набор статусов', () => {
    expect(Object.keys(ORDER_STATUS_LABELS).sort()).toEqual(Object.keys(ORDER_STATUS_COLORS).sort());
  });
});
