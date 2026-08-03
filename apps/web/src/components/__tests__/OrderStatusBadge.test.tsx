import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OrderStatusBadge } from '../OrderStatusBadge';

describe('OrderStatusBadge', () => {
  it('показывает русскую подпись для известного статуса', () => {
    render(<OrderStatusBadge status="OPEN" />);
    expect(screen.getByText('Открыт')).toBeInTheDocument();
  });

  it('показывает подпись спора красным акцентом', () => {
    render(<OrderStatusBadge status="DISPUTED" />);
    const badge = screen.getByText('Спор');
    expect(badge.className).toContain('bg-red-100');
  });

  it('для неизвестного статуса откатывается на исходную строку', () => {
    render(<OrderStatusBadge status="SOME_NEW_STATUS" />);
    expect(screen.getByText('SOME_NEW_STATUS')).toBeInTheDocument();
  });
});
