'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface SupportTicket {
  id: string;
  subject: string;
  status: 'OPEN' | 'PENDING' | 'RESOLVED' | 'CLOSED';
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  updatedAt: string;
}

interface SupportMessage {
  id: string;
  senderId: string;
  body: string;
  createdAt: string;
  sender?: { profile?: { displayName?: string } | null; email: string };
}

interface TicketDetail extends SupportTicket {
  messages: SupportMessage[];
}

const STATUS_LABEL: Record<string, string> = {
  OPEN: 'Открыт',
  PENDING: 'В работе',
  RESOLVED: 'Решён',
  CLOSED: 'Закрыт',
};

export default function SupportPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selected, setSelected] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newTicket, setNewTicket] = useState({ subject: '', message: '' });
  const [creating, setCreating] = useState(false);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  function loadTickets() {
    return api<SupportTicket[]>('/support/tickets/mine').then(setTickets);
  }

  useEffect(() => {
    loadTickets()
      .catch((err) => setError(err instanceof Error ? err.message : 'Не удалось загрузить тикеты'))
      .finally(() => setLoading(false));
  }, []);

  async function openTicket(id: string) {
    setError(null);
    try {
      const detail = await api<TicketDetail>(`/support/tickets/${id}`);
      setSelected(detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить тикет');
    }
  }

  async function createTicket(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      await api('/support/tickets', { method: 'POST', body: JSON.stringify(newTicket) });
      setNewTicket({ subject: '', message: '' });
      await loadTickets();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать тикет');
    } finally {
      setCreating(false);
    }
  }

  async function sendReply(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected || !reply.trim()) return;
    setSending(true);
    setError(null);
    try {
      await api(`/support/tickets/${selected.id}/messages`, { method: 'POST', body: JSON.stringify({ body: reply }) });
      setReply('');
      await openTicket(selected.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить сообщение');
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return <main className="mx-auto max-w-5xl px-4 py-10 text-slate-500">Загружаем поддержку…</main>;
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <Link href="/dashboard" className="mb-6 inline-block text-sm font-medium text-slate-500 hover:text-slate-900">
        ← Назад в dashboard
      </Link>
      <h1 className="mb-6 text-2xl font-bold">Поддержка</h1>

      {error && <p className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div>
          <form onSubmit={createTicket} className="mb-6 space-y-2 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-2 font-semibold">Новое обращение</h2>
            <input
              required
              placeholder="Тема"
              value={newTicket.subject}
              onChange={(e) => setNewTicket((f) => ({ ...f, subject: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <textarea
              required
              placeholder="Опишите проблему"
              value={newTicket.message}
              onChange={(e) => setNewTicket((f) => ({ ...f, message: e.target.value }))}
              className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={creating}
              className="w-full rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {creating ? 'Отправляем…' : 'Создать обращение'}
            </button>
          </form>

          <div className="space-y-2">
            {tickets.map((ticket) => (
              <button
                key={ticket.id}
                type="button"
                onClick={() => openTicket(ticket.id)}
                className={`w-full rounded-lg border p-3 text-left text-sm transition ${
                  selected?.id === ticket.id ? 'border-brand bg-indigo-50' : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <p className="font-medium">{ticket.subject}</p>
                <p className="mt-1 text-xs text-slate-500">{STATUS_LABEL[ticket.status]}</p>
              </button>
            ))}
            {tickets.length === 0 && <p className="text-sm text-slate-500">Обращений пока нет.</p>}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          {!selected ? (
            <p className="text-sm text-slate-500">Выберите обращение слева.</p>
          ) : (
            <>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">{selected.subject}</h2>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium">
                  {STATUS_LABEL[selected.status]}
                </span>
              </div>

              <div className="mb-4 max-h-[420px] space-y-3 overflow-y-auto rounded-lg bg-slate-50 p-3">
                {selected.messages.map((message) => (
                  <div key={message.id} className="rounded-lg bg-white p-3 shadow-sm">
                    <p className="text-xs text-slate-500">
                      {message.sender?.profile?.displayName ?? message.sender?.email ?? 'Поддержка'}
                    </p>
                    <p className="mt-1 text-sm text-slate-800">{message.body}</p>
                  </div>
                ))}
              </div>

              <form onSubmit={sendReply} className="flex gap-2">
                <input
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Ваше сообщение"
                  className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2"
                />
                <button
                  type="submit"
                  disabled={sending}
                  className="rounded-lg bg-brand px-4 py-2 font-medium text-white disabled:opacity-50"
                >
                  Отправить
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
