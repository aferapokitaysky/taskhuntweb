import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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

const pendingInvoice: Invoice = {
  id: 'invoice-pending-123456',
  orderId: 'order-1',
  amount: '120',
  currency: 'USD',
  description: 'Предоплата за этап',
  status: 'PENDING',
  payAddress: '0xabc123',
  payAmount: '120',
  payCurrency: 'USDT',
  paymentNetwork: 'BSC',
  createdAt: '2026-08-01T12:00:00.000Z',
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

  it('показывает сеть платежа и даёт скопировать адрес/сумму pending-счёта', async () => {
    const user = userEvent.setup();
    render(<InvoiceChatCard invoice={pendingInvoice} canPay />);

    expect(screen.getByText('Сеть: BSC')).toBeInTheDocument();
    expect(screen.getByText('120 USDT')).toBeInTheDocument();
    expect(screen.getByText('0xabc123')).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: 'Копировать' })[3]);

    expect(await screen.findByText('Скопировано')).toBeInTheDocument();
  });

  it('объясняет исполнителю, что деньги в эскроу и появятся после приёмки работы', () => {
    render(<InvoiceChatCard invoice={paidInvoice} own />);

    expect(screen.getByText('Оплачено')).toBeInTheDocument();
    expect(
      screen.getByText('Заказчик оплатил — сумма в эскроу. Сдайте работу по заказу, и после приёмки она поступит на ваш баланс.'),
    ).toBeInTheDocument();
  });

  it('объясняет заказчику, что оплата уйдёт исполнителю после приёмки работы', () => {
    render(<InvoiceChatCard invoice={paidInvoice} />);

    expect(screen.getByText('Оплачено')).toBeInTheDocument();
    expect(
      screen.getByText('Сумма в эскроу, ждёт результата работы. Она уйдёт исполнителю, как только вы примете сдачу по заказу.'),
    ).toBeInTheDocument();
  });
});
