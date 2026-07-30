import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OrderTimeline } from '../OrderTimeline';

describe('OrderTimeline', () => {
  it('ничего не рендерит для DRAFT', () => {
    const { container } = render(<OrderTimeline status="DRAFT" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('показывает сообщение об отмене для CANCELLED вместо степпера', () => {
    render(<OrderTimeline status="CANCELLED" />);
    expect(screen.getByText('Заказ отменён до завершения.')).toBeInTheDocument();
    expect(screen.queryByText('Открыт')).not.toBeInTheDocument();
  });

  it('показывает сообщение об истечении срока для EXPIRED', () => {
    render(<OrderTimeline status="EXPIRED" />);
    expect(screen.getByText('Срок заказа истёк без завершения.')).toBeInTheDocument();
  });

  it('рендерит все 4 шага для нормального статуса happy path', () => {
    render(<OrderTimeline status="IN_PROGRESS" />);
    expect(screen.getByText('Открыт')).toBeInTheDocument();
    expect(screen.getByText('В работе')).toBeInTheDocument();
    expect(screen.getByText('На проверке')).toBeInTheDocument();
    expect(screen.getByText('Завершён')).toBeInTheDocument();
  });

  it('для DISPUTED подсвечивает шаг "На проверке" как "Спор"', () => {
    render(<OrderTimeline status="DISPUTED" />);
    expect(screen.getByText('Спор')).toBeInTheDocument();
    // исходная подпись шага "На проверке" заменена на "Спор", а не дублируется
    expect(screen.queryByText('На проверке')).not.toBeInTheDocument();
  });

  it('для COMPLETED все 4 шага отмечены как выполненные (галочка вместо номера)', () => {
    const { container } = render(<OrderTimeline status="COMPLETED" />);
    // done-шаг рендерит CheckCircleIcon (svg) вместо текстового номера
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBe(4);
  });
});
