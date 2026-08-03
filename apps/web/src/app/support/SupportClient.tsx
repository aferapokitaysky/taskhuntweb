'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useRequireAuth } from '@/lib/useRequireAuth';
import { AppHeader } from '@/components/AppHeader';
import { EmptyState } from '@/components/EmptyState';
import { ErrorNotice } from '@/components/ErrorNotice';
import { ChatIcon } from '@/components/icons/illustrated/ChatIcon';
import { MailCheckIcon } from '@/components/icons/illustrated/MailCheckIcon';
import { EscrowSupportShieldIcon } from '@/components/icons/illustrated/EscrowSupportShieldIcon';
import { Mascot } from '@/components/Mascot';

const FAQ_ITEMS = [
  {
    q: 'Когда деньги переходят исполнителю?',
    a: 'Оплата резервируется в эскроу после выставления счёта. Исполнитель получает средства только после приёмки работы заказчиком.',
  },
  {
    q: 'Что будет, если возник спор?',
    a: 'Любая сторона может открыть спор по заказу. Эскроу замораживается, а модератор изучает переписку, файлы и историю действий.',
  },
  {
    q: 'Сколько платформа берёт комиссии?',
    a: 'Комиссия зависит от тарифа Starter, Pro или Premium и удерживается автоматически при выплате.',
  },
  {
    q: 'Как вывести средства?',
    a: 'На дашборде откройте вывод средств, выберите сохранённый адрес и создайте заявку. Статус будет виден в истории операций.',
  },
];

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

const STATUS_LABEL: Record<SupportTicket['status'], string> = {
  OPEN: 'Открыт',
  PENDING: 'В работе',
  RESOLVED: 'Решён',
  CLOSED: 'Закрыт',
};

const STATUS_TONE: Record<SupportTicket['status'], string> = {
  OPEN: 'bg-card-sand text-stone-800',
  PENDING: 'bg-card-lavender text-stone-800',
  RESOLVED: 'bg-card-sage text-stone-800',
  CLOSED: 'bg-stone-100 text-stone-500',
};

export default function SupportClient() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-7xl px-4 py-8 text-stone-500">Загружаем поддержку...</main>}>
      <SupportContent />
    </Suspense>
  );
}

function SupportContent() {
  useRequireAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selected, setSelected] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newTicket, setNewTicket] = useState({ subject: '', message: '' });
  const [creating, setCreating] = useState(false);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const ticketIdFromQuery = searchParams.get('ticketId');

  const openTickets = useMemo(() => tickets.filter((ticket) => ticket.status === 'OPEN' || ticket.status === 'PENDING').length, [tickets]);

  function loadTickets() {
    return api<SupportTicket[]>('/support/tickets/mine').then(setTickets);
  }

  useEffect(() => {
    loadTickets()
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!ticketIdFromQuery) return;
    if (selected?.id === ticketIdFromQuery) return;
    void openTicket(ticketIdFromQuery);
  }, [ticketIdFromQuery, selected?.id]);

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
      const created = await api<TicketDetail>('/support/tickets', { method: 'POST', body: JSON.stringify(newTicket) });
      setNewTicket({ subject: '', message: '' });
      await loadTickets();
      setSelected(created);
      router.replace(`/support?ticketId=${created.id}`, { scroll: false });
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

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <AppHeader />

      <section className="workspace-hero mb-8 p-6 md:p-8">
        <div className="relative grid gap-8 lg:grid-cols-[1fr_360px] lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Центр поддержки</p>
            <h1 className="mt-3 max-w-3xl font-serif text-4xl leading-tight text-stone-950 md:text-6xl">Помогаем довести сделку до спокойного финала</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-stone-600">
              Быстрые ответы, личные обращения, переписка по тикету и понятный статус без лишних переходов.
            </p>
          </div>
          <div className="rounded-[2rem] border border-stone-100 bg-white/70 p-5 shadow-sm backdrop-blur">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-400">Пульс поддержки</p>
                <p className="mt-1 text-sm text-stone-600">Статусы, FAQ и обращения в одном спокойном блоке.</p>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="hero-stat min-w-0 p-3 text-center">
                <p className="font-serif text-2xl text-stone-950">{tickets.length}</p>
                <p className="text-[11px] uppercase text-stone-400">всего</p>
              </div>
              <div className="hero-stat min-w-0 p-3 text-center">
                <p className="font-serif text-2xl text-stone-950">{openTickets}</p>
                <p className="text-[11px] uppercase text-stone-400">активно</p>
              </div>
              <div className="hero-stat min-w-0 p-3 text-center">
                <p className="font-serif text-2xl text-stone-950">4</p>
                <p className="text-[11px] uppercase text-stone-400">FAQ</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {error && <ErrorNotice message={error} />}

      <section className="mb-8 grid gap-4 lg:grid-cols-3">
        {[
          { title: 'Эскроу и оплата', text: 'Разбираем блокировки, выплаты, возвраты и спорные ситуации.', Icon: EscrowSupportShieldIcon },
          { title: 'Сделка и чат', text: 'Помогаем восстановить контекст заказа, файлов и этапов.', Icon: ChatIcon },
          { title: 'Аккаунт и доступ', text: 'Пароль, 2FA, уведомления и вопросы по профилю.', Icon: MailCheckIcon },
        ].map(({ title, text, Icon }) => (
          <div key={title} className="interactive-card rounded-[2rem] p-5">
            <div className="flex h-16 w-16 items-center justify-center rounded-[1.4rem] bg-white/70 shadow-sm">
              <Icon className="h-12 w-12" />
            </div>
            <h2 className="mt-4 font-serif text-xl text-stone-950">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-stone-600">{text}</p>
          </div>
        ))}
      </section>

      <section className="premium-panel mb-8 rounded-[2rem] p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-[1.7rem] bg-card-lavender/60">
            <Mascot name="supportHeadset" size="h-20 w-20" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-stone-400">Быстрые ответы</p>
            <h2 className="font-serif text-2xl text-stone-950">FAQ перед обращением</h2>
          </div>
        </div>
        <div className="divide-y divide-stone-100">
          {FAQ_ITEMS.map((item) => (
            <details key={item.q} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-[1.35rem] px-3 py-2 text-sm font-semibold text-stone-950 transition hover:bg-stone-50 marker:content-none">
                {item.q}
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-stone-100 text-stone-500 transition group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <aside className="space-y-4">
          <form onSubmit={createTicket} className="premium-panel space-y-3 p-5">
            <div>
              <p className="text-xs font-semibold uppercase text-stone-400">Новое обращение</p>
              <h2 className="mt-1 font-serif text-2xl text-stone-950">Опишите вопрос</h2>
            </div>
            <div className="flex items-center gap-3 rounded-[1.5rem] bg-card-sage/45 p-3">
              <Mascot name="supportHeadset" size="h-14 w-14" />
              <p className="text-sm leading-5 text-stone-600">Добавьте тему, номер заказа и что уже пробовали.</p>
            </div>
            <input
              required
              placeholder="Тема обращения"
              value={newTicket.subject}
              onChange={(e) => setNewTicket((form) => ({ ...form, subject: e.target.value }))}
              className="field-surface w-full px-3 py-2 text-sm"
            />
            <textarea
              required
              placeholder="Что произошло? Добавьте номер заказа, если он есть"
              value={newTicket.message}
              onChange={(e) => setNewTicket((form) => ({ ...form, message: e.target.value }))}
              className="field-surface min-h-28 w-full px-3 py-2 text-sm"
            />
            <button type="submit" disabled={creating} className="primary-action w-full px-4 py-3 text-sm">
              {creating ? 'Отправляем…' : 'Создать обращение'}
            </button>
          </form>

          <section className="premium-panel p-3">
            <p className="px-2 pb-2 text-xs font-semibold uppercase text-stone-400">Мои обращения</p>
            {loading ? (
              <p className="px-2 py-3 text-sm text-stone-500">Загружаем…</p>
            ) : tickets.length > 0 ? (
              <div className="space-y-2">
                {tickets.map((ticket) => (
                  <button
                    key={ticket.id}
                    type="button"
                    onClick={() => openTicket(ticket.id)}
                    className={`w-full rounded-2xl p-3 text-left text-sm transition ${
                      selected?.id === ticket.id ? 'bg-brand text-white shadow-sm' : 'bg-white text-stone-900 hover:bg-stone-100'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="line-clamp-2 font-semibold">{ticket.subject}</p>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_TONE[ticket.status]}`}>
                        {STATUS_LABEL[ticket.status]}
                      </span>
                    </div>
                    <p className={selected?.id === ticket.id ? 'mt-2 text-xs text-white/75' : 'mt-2 text-xs text-stone-500'}>
                      {new Date(ticket.updatedAt).toLocaleString('ru-RU')}
                    </p>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-[2rem] bg-card-sand/45 p-4">
                <EmptyState icon={<ChatIcon />} title="Обращений пока нет" description="Создайте первое обращение, если нужен разбор." />
              </div>
            )}
          </section>
        </aside>

        <section className="premium-panel min-h-[560px] rounded-[2rem] p-5">
          {!selected ? (
            <div className="flex min-h-[520px] items-center justify-center">
              <div className="w-full rounded-[2rem] bg-card-lavender/35 p-6">
                <EmptyState icon={<ChatIcon />} title="Выберите обращение" description="Переписка и статус появятся в этой панели." />
              </div>
            </div>
          ) : (
            <div className="flex min-h-[520px] flex-col">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-stone-100 pb-4">
                <div>
                  <p className="text-xs font-semibold uppercase text-stone-400">Тикет</p>
                  <h2 className="mt-1 font-serif text-2xl text-stone-950">{selected.subject}</h2>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_TONE[selected.status]}`}>
                  {STATUS_LABEL[selected.status]}
                </span>
              </div>

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-[2rem] bg-stone-50 p-4">
                {selected.messages.map((message) => (
                  <article key={message.id} className="rounded-[1.5rem] bg-white p-4 shadow-sm">
                    <div className="mb-2 flex items-center justify-between gap-3 text-xs text-stone-500">
                      <span>{message.sender?.profile?.displayName ?? message.sender?.email ?? 'Поддержка'}</span>
                      <span>{new Date(message.createdAt).toLocaleString('ru-RU')}</span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-6 text-stone-800">{message.body}</p>
                  </article>
                ))}
              </div>

              <form onSubmit={sendReply} className="mt-4 flex flex-col gap-2 sm:flex-row">
                <input
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Ваше сообщение"
                  className="field-surface min-w-0 flex-1 px-3 py-3 text-sm"
                />
                <button type="submit" disabled={sending || !reply.trim()} className="primary-action px-5 py-3 text-sm disabled:opacity-50">
                  {sending ? 'Отправляем…' : 'Отправить'}
                </button>
              </form>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
