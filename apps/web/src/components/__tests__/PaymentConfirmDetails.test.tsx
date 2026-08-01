import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Invoice } from '@/lib/types';
import { PaymentConfirmDetails } from '../PaymentConfirmDetails';

const invoice: Invoice = {
  id: 'invoice-1',
  orderId: 'order-1',
  amount: '500',
  currency: 'USD',
  status: 'PENDING',
  payAddress: 'TXYZ123456789',
  payAmount: '499.50',
  payCurrency: 'USDT',
};

describe('PaymentConfirmDetails', () => {
  it('показывает реквизиты оплаты и копирует сумму с адресом', async () => {
    const user = userEvent.setup();
    render(<PaymentConfirmDetails invoice={invoice} />);

    expect(screen.getByText('499.50 USDT')).toBeInTheDocument();
    expect(screen.getByText('TXYZ123456789')).toBeInTheDocument();

    const copyButtons = screen.getAllByRole('button', { name: 'Копировать' });
    await user.click(copyButtons[0]);
    expect(screen.getByRole('button', { name: 'Скопировано' })).toBeInTheDocument();

    await user.click(copyButtons[1]);

    expect(screen.getByRole('button', { name: 'Скопировано' })).toBeInTheDocument();
  });

  it('показывает состояние загрузки, пока адрес недоступен', () => {
    render(<PaymentConfirmDetails invoice={{ ...invoice, payAddress: null }} loading />);

    expect(screen.getByText('Получаем реквизиты оплаты для этого счёта...')).toBeInTheDocument();
  });
});
