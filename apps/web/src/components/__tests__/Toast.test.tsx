import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider, useToast } from '../Toast';

function TestConsumer() {
  const { showToast } = useToast();
  return (
    <div>
      <button onClick={() => showToast('Успешно сохранено', 'success')}>Показать успех</button>
      <button onClick={() => showToast('Что-то сломалось', 'error')}>Показать ошибку</button>
    </div>
  );
}

describe('Toast', () => {
  it('показывает сообщение после вызова showToast', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    );

    await user.click(screen.getByText('Показать успех'));
    expect(await screen.findByText('Успешно сохранено')).toBeInTheDocument();
  });

  it('закрывается по клику на кнопку закрытия', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    );

    await user.click(screen.getByText('Показать ошибку'));
    expect(await screen.findByText('Что-то сломалось')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Закрыть'));
    await waitFor(() => expect(screen.queryByText('Что-то сломалось')).not.toBeInTheDocument());
  });

  it('useToast вне ToastProvider бросает ошибку', () => {
    // подавляем ожидаемый React-лог об ошибке в консоли для чистоты вывода теста
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<TestConsumer />)).toThrow('useToast must be used within ToastProvider');
    consoleError.mockRestore();
  });
});
