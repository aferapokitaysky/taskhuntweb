import type { Metadata } from 'next';
import RegisterClient from './RegisterClient';

export const metadata: Metadata = {
  title: 'Регистрация',
  description:
    'Создайте аккаунт на TaskHunt за минуту — заказчик или фрилансер. Крипто-эскроу защищает бюджет заказа с первого отклика, без банковских задержек.',
  alternates: { canonical: '/register' },
};

export default function RegisterPage() {
  return <RegisterClient />;
}
