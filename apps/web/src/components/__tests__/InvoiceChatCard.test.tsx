import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Invoice } from '@/lib/types';
import { InvoiceChatCard } from '../InvoiceChatCard';

const paidInvoice: Invoice = {
  id: 'invoice-paid-123456',
  orderId: 'order-1',
  amount: '500',
  currency: 'USD',
  description: 'Финальный этап',
  status: 'PAID',
  createdAt: '2026-08-01T12:00:00.000Z',
  paidAt: '2026-08-01T12:10:00.000Z',
};

describe('InvoiceChatCard', () => {
  let storage: Record<string, string>;

  beforeEach(() => {
    storage = {};
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn((key: string) => storage[key] ?? null),
        setItem: vi.fn((key: string, value: string) => {
          storage[key] = value;
        }),
        clear: vi.fn(() => {
          storage = {};
        }),
      },
      configurable: true,
    });
    window.localStorage.clear();
  });

  it('сохраняет принятие оплаченного чека по invoice id', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<InvoiceChatCard invoice={paidInvoice} />);

    expect(screen.getByText('Чек готов к приёмке')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Принять чек' }));

    expect(screen.getByRole('button', { name: 'Чек принят' })).toBeDisabled();
    expect(screen.getByText('использован')).toBeInTheDocument();
    expect(window.localStorage.getItem('taskhunt:acceptedReceipts:v1')).toContain(paidInvoice.id);

    unmount();
    render(<InvoiceChatCard invoice={paidInvoice} />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Чек принят' })).toBeDisabled());
    expect(screen.getByText('использован')).toBeInTheDocument();
  });
});
