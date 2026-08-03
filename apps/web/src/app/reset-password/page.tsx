import type { Metadata } from 'next';
import ResetPasswordClient from './ResetPasswordClient';

// noindex особенно важен здесь — URL несёт одноразовый токен сброса в
// query-параметре (?token=...), индексация показала бы его в выдаче/превью.
export const metadata: Metadata = {
  title: 'Сброс пароля',
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage() {
  return <ResetPasswordClient />;
}
