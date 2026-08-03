import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextLevelWidget } from '../NextLevelWidget';

describe('NextLevelWidget', () => {
  it('для TOP_RATED показывает поздравление, а не прогресс-бар', () => {
    render(<NextLevelWidget level="TOP_RATED" completedOrders={15} successRate={98} />);
    expect(screen.getByText('Вы достигли максимального уровня — так держать!')).toBeInTheDocument();
  });

  it('для NEW с 0 заказами считает до порога Rising Talent (3 заказа)', () => {
    render(<NextLevelWidget level="NEW" completedOrders={0} successRate={null} />);
    expect(screen.getByText('До уровня Rising Talent')).toBeInTheDocument();
    expect(screen.getByText(/Ещё 3 завершённых заказа/)).toBeInTheDocument();
  });

  it('для NEW с 1 заказом склоняет "заказ" в единственном числе', () => {
    render(<NextLevelWidget level="NEW" completedOrders={2} successRate={50} />);
    // до порога 3 остаётся 1 заказ
    expect(screen.getByText(/Ещё 1 завершённых заказ[^а]/)).toBeInTheDocument();
  });

  it('для RISING_TALENT считает до порога Top Rated (10 заказов)', () => {
    render(<NextLevelWidget level="RISING_TALENT" completedOrders={3} successRate={92} />);
    expect(screen.getByText('До уровня Top Rated')).toBeInTheDocument();
    expect(screen.getByText(/Ещё 7 завершённых заказов/)).toBeInTheDocument();
  });

  it('когда заказов уже достаточно, но не хватает рейтинга — просит держать рейтинг, без счётчика заказов', () => {
    render(<NextLevelWidget level="RISING_TALENT" completedOrders={10} successRate={92} />);
    expect(screen.getByText(/Держите рейтинг успеха от 95%/)).toBeInTheDocument();
  });
});
