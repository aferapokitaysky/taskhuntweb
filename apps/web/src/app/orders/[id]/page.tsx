'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { api, getStoredAccessToken } from '@/lib/api';
import type { ChatMessage, Order, User } from '@/lib/types';
import { money } from '@/lib/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export default function OrderPage() {
  const params = useParams<{ id: string }>();
  const orderId = params.id;
  const [me, setMe] = useState<User | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [body, setBody] = useState('');
  const [invoiceAmount, setInvoiceAmount] = useState('');
  const [invoiceDescription, setInvoiceDescription] = useState('');
  const [paymentAddress, setPaymentAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    Promise.all([api<User>('/users/me'), api<Order>(`/orders/${orderId}`)])
      .then(([user, orderDetails]) => {
        setMe(user);
        setOrder(orderDetails);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Не удалось загрузить заказ'));
  }, [orderId]);

  const acceptedBid = useMemo(() => order?.bids?.find((bid) => bid.status === 'ACCEPTED'), [order]);
  const isFreelancer = acceptedBid?.freelancerId === me?.id;
  const hasChat = Boolean(order?.chatThread ?? order?.acceptedBidId);

  useEffect(() => {
    if (!hasChat) return;
    api<ChatMessage[]>(`/orders/${orderId}/chat/messages`)
      .then(setMessages)
      .catch(() => setMessages([]));

    const token = getStoredAccessToken();
    if (!token) return;
    const nextSocket = io(`${API_URL}/chat`, { auth: { token } });
    nextSocket.on('connect', () => nextSocket.emit('joinOrder', orderId));
    nextSocket.on('newMessage', (message: ChatMessage) => {
      setMessages((current) => (current.some((item) => item.id === message.id) ? current : [...current, message]));
    });
    nextSocket.on('connect_error', () => setError('Не удалось подключиться к чату'));
    setSocket(nextSocket);
    return () => {
      nextSocket.disconnect();
    };
  }, [hasChat, orderId]);

  async function sendMessage(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!body.trim()) return;
    const text = body.trim();
    setBody('');
    if (socket?.connected) {
      socket.emit('sendMessage', { orderId, body: text });
      return;
    }
    const created = await api<ChatMessage>(`/orders/${orderId}/chat/messages`, {
      method: 'POST',
      body: JSON.stringify({ body: text }),
    });
    setMessages((current) => [...current, created]);
  }

  async function issueInvoice(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    try {
      const result = await api<{ payment: { payAddress: string } }>('/wallet/invoices', {
        method: 'POST',
        body: JSON.stringify({
          orderId,
          amount: Number(invoiceAmount),
          description: invoiceDescription || undefined,
        }),
      });
      setPaymentAddress(result.payment.payAddress);
      setInvoiceAmount('');
      setInvoiceDescription('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось выставить счёт');
    }
  }

  if (!order) {
    return <main className="mx-auto max-w-5xl px-4 py-10 text-slate-500">Загружаем заказ...</main>;
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <Link href="/dashboard" className="mb-6 inline-block text-sm font-medium text-slate-500 hover:text-slate-900">
        Назад в dashboard
      </Link>

      {error && <p className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <section className="mb-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500">{order.category?.name}</p>
            <h1 className="mt-1 text-3xl font-bold">{order.title}</h1>
          </div>
          <div className="text-right">
            <p className="text-xl font-semibold">{money(order.budgetMin, order.currency)}</p>
            <p className="text-sm text-slate-500">{order.status}</p>
          </div>
        </div>
        <p className="mt-4 whitespace-pre-wrap text-slate-700">{order.description}</p>
      </section>

      <section className="mb-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-xl font-semibold">Отклики</h2>
        <div className="space-y-3">
          {(order.bids ?? []).map((bid) => (
            <div key={bid.id} className="rounded-lg border border-slate-200 p-3">
              <div className="flex justify-between gap-3">
                <p className="font-medium">{bid.freelancer?.profile?.displayName ?? bid.freelancer?.email ?? 'Фрилансер'}</p>
                <p className="font-semibold">{money(bid.amount, order.currency)}</p>
              </div>
              <p className="mt-1 text-sm text-slate-600">{bid.message}</p>
              <p className="mt-2 text-xs text-slate-500">
                {bid.deliveryDays} дн. · {bid.status}
              </p>
            </div>
          ))}
        </div>
      </section>

      {hasChat && (
        <section className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-xl font-semibold">Чат заказа</h2>
            <div className="mb-4 max-h-[480px] space-y-3 overflow-y-auto rounded-lg bg-slate-50 p-3">
              {messages.map((message) => (
                <div key={message.id} className="rounded-lg bg-white p-3 shadow-sm">
                  <p className="text-xs text-slate-500">{message.sender?.profile?.displayName ?? message.sender?.email ?? message.senderId}</p>
                  {message.type === 'INVOICE' && message.invoice ? (
                    <div className="mt-2 rounded-lg border border-indigo-100 bg-indigo-50 p-3">
                      <p className="font-semibold">Счёт на оплату {money(message.invoice.amount, message.invoice.currency)}</p>
                      <p className="text-sm text-slate-600">{message.invoice.status}</p>
                    </div>
                  ) : (
                    <p className="mt-1 text-sm text-slate-800">{message.body}</p>
                  )}
                </div>
              ))}
              {messages.length === 0 && <p className="text-sm text-slate-500">Сообщений пока нет.</p>}
            </div>
            <form onSubmit={sendMessage} className="flex gap-2">
              <input
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Сообщение"
                className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2"
              />
              <button type="submit" className="rounded-lg bg-brand px-4 py-2 font-medium text-white">
                Отправить
              </button>
            </form>
          </div>

          {isFreelancer && (
            <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold">Выставить счёт</h2>
              <form onSubmit={issueInvoice} className="space-y-3">
                <input
                  required
                  type="number"
                  min="1"
                  placeholder="Сумма"
                  value={invoiceAmount}
                  onChange={(e) => setInvoiceAmount(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
                <textarea
                  placeholder="Описание"
                  value={invoiceDescription}
                  onChange={(e) => setInvoiceDescription(e.target.value)}
                  className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2"
                />
                <button type="submit" className="w-full rounded-lg bg-brand px-4 py-3 font-medium text-white">
                  Выставить
                </button>
              </form>
              {paymentAddress && (
                <p className="mt-4 break-all rounded-lg bg-slate-50 p-3 text-xs text-slate-600">Pay address: {paymentAddress}</p>
              )}
            </aside>
          )}
        </section>
      )}
    </main>
  );
}
