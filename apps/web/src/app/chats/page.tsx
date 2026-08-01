'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AppHeader } from '@/components/AppHeader';
import { EmptyState } from '@/components/EmptyState';
import { ErrorNotice } from '@/components/ErrorNotice';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { FileUpload, type UploadedFile } from '@/components/FileUpload';
import { InvoiceChatCard } from '@/components/InvoiceChatCard';
import { PaperclipIcon } from '@/components/icons/PaperclipIcon';
import { ChatIcon } from '@/components/icons/illustrated/ChatIcon';
import { Mascot } from '@/components/Mascot';
import { api, API_URL, downloadFile } from '@/lib/api';
import type { ChatInboxThread, ChatMessage, Invoice, InvoicePaymentDetails, User } from '@/lib/types';
import { money } from '@/lib/types';

type ActiveChat = { orderId: string; freelancerId: string; threadId?: string | null };

const QUICK_CHAT_TEMPLATES = [
  'Привет! Уточните, пожалуйста, один момент по задаче.',
  'Готов двигаться дальше, подтверждаю сроки и следующий шаг.',
  'Посмотрите, пожалуйста, счёт и реквизиты в чате.',
];

export default function ChatsPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-7xl px-4 py-8 text-stone-500">Загружаем чаты...</main>}>
      <ChatsContent />
    </Suspense>
  );
}

function ChatsContent() {
  const searchParams = useSearchParams();
  const [me, setMe] = useState<User | null>(null);
  const [threads, setThreads] = useState<ChatInboxThread[]>([]);
  const [active, setActive] = useState<ActiveChat | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [body, setBody] = useState('');
  const [chatFilter, setChatFilter] = useState<'ALL' | 'INVOICES'>('ALL');
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendingFileId, setSendingFileId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paymentConfirmInvoice, setPaymentConfirmInvoice] = useState<Invoice | null>(null);
  const [paymentDetailsLoading, setPaymentDetailsLoading] = useState(false);

  async function loadInbox(selectFirst = true) {
    const [user, list] = await Promise.all([api<User>('/users/me'), api<ChatInboxThread[]>('/chat/threads')]);
    setMe(user);
    setThreads(list);
    const queryOrderId = searchParams.get('orderId');
    const queryFreelancerId = searchParams.get('freelancerId');
    const fromQuery = queryOrderId
      ? list.find((item) => item.orderId === queryOrderId && (!queryFreelancerId || item.freelancerId === queryFreelancerId))
      : null;
    if (fromQuery) {
      setActive({ orderId: fromQuery.orderId, freelancerId: fromQuery.freelancerId, threadId: fromQuery.threadId });
      return;
    }
    if (queryOrderId && queryFreelancerId) {
      setActive({ orderId: queryOrderId, freelancerId: queryFreelancerId });
      return;
    }
    if (selectFirst && !active && list[0]) {
      setActive({ orderId: list[0].orderId, freelancerId: list[0].freelancerId, threadId: list[0].threadId });
    }
  }

  useEffect(() => {
    loadInbox()
      .catch((err) => setError(err instanceof Error ? err.message : 'Не удалось загрузить чаты'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!active) {
      setMessages([]);
      return;
    }
    setMessagesLoading(true);
    api<ChatMessage[]>(`/orders/${active.orderId}/chat/messages?freelancerId=${active.freelancerId}`)
      .then(setMessages)
      .then(() => {
        setThreads((current) =>
          current.map((thread) =>
            thread.orderId === active.orderId && thread.freelancerId === active.freelancerId ? { ...thread, unreadCount: 0 } : thread,
          ),
        );
        return loadInbox(false).catch(() => undefined);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Не удалось открыть чат'))
      .finally(() => setMessagesLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.orderId, active?.freelancerId]);

  const activeThread = useMemo(
    () => threads.find((item) => item.orderId === active?.orderId && item.freelancerId === active?.freelancerId) ?? null,
    [active, threads],
  );
  const participant = activeThread?.participant;
  const participantName = participant?.profile?.displayName ?? participant?.email ?? 'Собеседник';
  const canOpenFreelancerProfile = participant?.roles?.includes('FREELANCER') || activeThread?.role === 'CLIENT';
  const invoiceCount = messages.filter((message) => message.type === 'INVOICE').length;
  const visibleMessages = chatFilter === 'INVOICES' ? messages.filter((message) => message.type === 'INVOICE') : messages;
  const totalUnreadCount = threads.reduce((sum, thread) => sum + (thread.unreadCount ?? 0), 0);

  async function sendMessage(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!active || !body.trim()) return;
    const text = body.trim();
    setBody('');
    setSending(true);
    try {
      const created = await api<ChatMessage>(`/orders/${active.orderId}/chat/messages?freelancerId=${active.freelancerId}`, {
        method: 'POST',
        body: JSON.stringify({ body: text }),
      });
      setMessages((current) => [...current, created]);
      await loadInbox(false);
    } catch (err) {
      setBody(text);
      setError(err instanceof Error ? err.message : 'Не удалось отправить сообщение');
    } finally {
      setSending(false);
    }
  }

  async function sendChatFile(file: UploadedFile) {
    if (!active) return;
    setSendingFileId(file.id);
    setError(null);
    try {
      const created = await api<ChatMessage>(`/orders/${active.orderId}/chat/messages/file?freelancerId=${active.freelancerId}`, {
        method: 'POST',
        body: JSON.stringify({ fileId: file.id, body: file.originalName }),
      });
      setMessages((current) => [...current, created]);
      await loadInbox(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить файл в чат');
    } finally {
      setSendingFileId(null);
    }
  }

  async function openPaymentConfirm(invoice: Invoice) {
    setPaymentConfirmInvoice(invoice);
    setPaymentDetailsLoading(true);
    try {
      const details = await api<InvoicePaymentDetails>(`/wallet/invoices/${invoice.id}/payment`);
      setPaymentConfirmInvoice({ ...invoice, ...details, id: details.invoiceId });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось получить реквизиты оплаты');
    } finally {
      setPaymentDetailsLoading(false);
    }
  }

  async function downloadInvoicePdf(invoice: Invoice) {
    setError(null);
    try {
      const suffix = invoice.status === 'PAID' ? 'receipt' : 'invoice';
      await downloadFile(`/wallet/invoices/${invoice.id}/receipt.pdf`, `${suffix}-TH-${invoice.id.slice(0, 8).toUpperCase()}.pdf`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось скачать PDF-документ');
    }
  }

  useEffect(() => {
    if (!active) return;
    if (!messages.some((message) => message.invoice?.status === 'PENDING')) return;
    const interval = setInterval(() => {
      api<ChatMessage[]>(`/orders/${active.orderId}/chat/messages?freelancerId=${active.freelancerId}`)
        .then(setMessages)
        .catch(() => undefined);
    }, 15000);
    return () => clearInterval(interval);
  }, [active?.orderId, active?.freelancerId, messages]);

  function paymentDescription() {
    if (!paymentConfirmInvoice) return '';
    const address = paymentConfirmInvoice.payAddress;
    if (!address) {
      return paymentDetailsLoading
        ? 'Получаем реквизиты оплаты для этого счёта...'
        : 'Реквизиты оплаты пока недоступны. Обновите счёт или попросите исполнителя выставить новый.';
    }
    const payAmount = paymentConfirmInvoice.payAmount ?? paymentConfirmInvoice.amount;
    const payCurrency = paymentConfirmInvoice.payCurrency ?? paymentConfirmInvoice.currency;
    return `К оплате: ${payAmount} ${payCurrency}. Адрес: ${address}. После подтверждения провайдера сумма уйдёт в эскроу TaskHunt.`;
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <AppHeader />
      <section className="workspace-hero mb-8 p-6 md:p-8">
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Сообщения</p>
            <h1 className="mt-3 font-serif text-4xl leading-tight text-stone-950 md:text-6xl">Чаты по заказам</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-stone-600">
              Все рабочие переписки в одном месте: кто пишет, по какому заказу, когда был последний ответ и куда перейти дальше.
            </p>
          </div>
          <Mascot name="supportHeadset" size="h-20 w-20" />
        </div>
      </section>

      {error && <ErrorNotice message={error} />}

      <section className="grid min-h-[680px] gap-5 lg:grid-cols-[380px_1fr]">
        <aside className="premium-panel overflow-hidden rounded-[2.25rem] p-0">
          <div className="border-b border-stone-100 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">Inbox</p>
            <div className="mt-1 flex items-center justify-between gap-3">
              <h2 className="font-serif text-2xl text-stone-950">Диалоги</h2>
              {totalUnreadCount > 0 && (
                <span className="rounded-full bg-brand px-3 py-1 text-xs font-bold text-white">{totalUnreadCount} новых</span>
              )}
            </div>
          </div>
          <div className="max-h-[620px] overflow-y-auto p-3">
            {loading && <p className="p-4 text-sm text-stone-500">Загружаем...</p>}
            {!loading && threads.length === 0 && (
              <div className="p-4">
                <EmptyState icon={<ChatIcon />} title="Чатов пока нет" description="Диалог появится после отклика или первого сообщения по заказу." />
              </div>
            )}
            {threads.map((thread) => {
              const selected = thread.orderId === active?.orderId && thread.freelancerId === active?.freelancerId;
              const name = thread.participant?.profile?.displayName ?? thread.participant?.email ?? 'Собеседник';
              const preview = thread.lastMessage?.body || (thread.lastMessage?.type === 'INVOICE' ? 'Счёт в чате' : 'Сообщений пока нет');
              const unread = thread.unreadCount ?? 0;
              return (
                <button
                  key={thread.threadId}
                  type="button"
                  onClick={() => setActive({ orderId: thread.orderId, freelancerId: thread.freelancerId, threadId: thread.threadId })}
                  className={`mb-2 flex w-full items-start gap-3 rounded-[1.75rem] p-3 text-left transition ${
                    selected ? 'bg-brand/10 ring-1 ring-brand/15' : 'hover:bg-stone-50'
                  }`}
                >
                  <Avatar user={thread.participant} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-stone-950">{name}</span>
                      <span className="flex shrink-0 items-center gap-1">
                        {unread > 0 && <span className="rounded-full bg-brand px-2 py-0.5 text-[11px] font-bold text-white">{unread}</span>}
                        <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-semibold text-stone-500">
                          {thread.role === 'CLIENT' ? 'Заказчик' : 'Фрилансер'}
                        </span>
                      </span>
                    </span>
                    <span className="mt-1 block line-clamp-1 text-xs font-medium text-stone-500">{thread.order.title}</span>
                    <span className="mt-1 block line-clamp-1 text-xs text-stone-400">{preview}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="premium-panel flex overflow-hidden rounded-[2.25rem] p-0">
          {!active ? (
            <div className="flex flex-1 items-center justify-center p-8">
              <EmptyState icon={<ChatIcon />} title="Выберите чат" description="Слева появятся диалоги по вашим заказам и откликам." />
            </div>
          ) : (
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="border-b border-stone-100 bg-gradient-to-br from-white via-card-sand/35 to-card-sage/35 p-5 md:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <Avatar user={participant} size="large" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">
                        {activeThread?.role === 'CLIENT' ? 'Вы заказчик в этом чате' : 'Вы исполнитель в этом чате'}
                      </p>
                      <h2 className="mt-1 truncate font-serif text-3xl text-stone-950">{participantName}</h2>
                      <p className="mt-1 line-clamp-1 text-sm text-stone-600">Заказ: {activeThread?.order.title ?? active.orderId}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/orders/${active.orderId}`} className="secondary-action px-4 py-2.5 text-sm">
                      Открыть заказ
                    </Link>
                    {canOpenFreelancerProfile && participant && (
                      <Link href={`/freelancers/${participant.id}`} className="secondary-action px-4 py-2.5 text-sm">
                        Профиль
                      </Link>
                    )}
                  </div>
                </div>
                {activeThread?.order && (
                  <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-stone-600">
                    <span className="rounded-full bg-white/80 px-3 py-1.5">{activeThread.order.category?.name ?? 'Категория'}</span>
                    <span className="rounded-full bg-card-sage/80 px-3 py-1.5">{money(activeThread.order.budgetMin, activeThread.order.currency)}</span>
                    <span className="rounded-full bg-white/80 px-3 py-1.5">{activeThread.order.status}</span>
                  </div>
                )}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {[
                    ['ALL', `Все ${messages.length}`],
                    ['INVOICES', `Счета ${invoiceCount}`],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setChatFilter(value as 'ALL' | 'INVOICES')}
                      className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                        chatFilter === value ? 'bg-brand text-white shadow-sm' : 'bg-white/80 text-stone-600 hover:bg-white'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                  {QUICK_CHAT_TEMPLATES.map((template) => (
                    <button
                      key={template}
                      type="button"
                      onClick={() => setBody(template)}
                      className="rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold text-stone-600 transition hover:-translate-y-0.5 hover:bg-card-sand/70"
                    >
                      {template}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto bg-stone-50/70 p-4 md:p-6">
                {messagesLoading && <p className="text-sm text-stone-500">Загружаем сообщения...</p>}
                {!messagesLoading && visibleMessages.length === 0 && (
                  <EmptyState
                    icon={<ChatIcon />}
                    title={chatFilter === 'INVOICES' ? 'Счетов пока нет' : 'Сообщений пока нет'}
                    description={chatFilter === 'INVOICES' ? 'Когда в диалоге появится счёт или чек, он будет собран здесь.' : 'Начните диалог с короткого сообщения по задаче.'}
                  />
                )}
                <div className="space-y-3">
                  {visibleMessages.map((message) => {
                    const own = message.senderId === me?.id;
                    const name = message.sender?.profile?.displayName ?? message.sender?.email ?? 'Участник';
                    return (
                      <div key={message.id} className={`flex items-end gap-2 ${own ? 'flex-row-reverse' : ''}`}>
                        <Avatar user={message.sender} size="small" />
                        <div className={`max-w-[78%] rounded-[1.6rem] p-3 shadow-sm ${own ? 'bg-brand text-white' : 'bg-white text-stone-900'}`}>
                          <div className={`mb-1 flex items-center gap-2 text-[11px] ${own ? 'text-white/70' : 'text-stone-400'}`}>
                            <span>{name}</span>
                            <span>{new Date(message.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          {message.type === 'INVOICE' && message.invoice ? (
                            <InvoiceChatCard
                              invoice={message.invoice}
                              own={own}
                              canPay={activeThread?.role === 'CLIENT' && !own}
                              onPayIntent={openPaymentConfirm}
                              onDownloadPdf={downloadInvoicePdf}
                            />
                          ) : (
                            <>
                              {message.type === 'FILE' && (
                                <span className={`mb-2 flex h-9 w-9 items-center justify-center rounded-[1rem] ${own ? 'bg-white/15' : 'bg-card-sand'}`}>
                                  <PaperclipIcon className="h-5 w-5" />
                                </span>
                              )}
                              <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.body}</p>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <form onSubmit={sendMessage} className="border-t border-stone-100 bg-white/80 p-3 md:p-4">
                <div className="flex flex-wrap items-center gap-2 rounded-[1.75rem] bg-stone-50 p-2">
                  <FileUpload onUploaded={(file) => void sendChatFile(file)} label={sendingFileId ? '...' : 'Файл'} />
                  <input
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Напишите сообщение по заказу"
                    className="field-surface min-w-0 flex-1 rounded-[1.35rem] px-4 py-3 text-sm"
                  />
                  <button type="submit" disabled={sending || !body.trim()} className="primary-action rounded-[1.35rem] px-5 py-3 text-sm disabled:opacity-50">
                    {sending ? '...' : 'Отправить'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </section>
      <ConfirmDialog
        open={Boolean(paymentConfirmInvoice)}
        title="Перейти к оплате счёта?"
        description={paymentDescription()}
        confirmLabel={paymentDetailsLoading ? 'Загружаем' : 'Готово'}
        busy={paymentDetailsLoading}
        onCancel={() => setPaymentConfirmInvoice(null)}
        onConfirm={() => setPaymentConfirmInvoice(null)}
      />
    </main>
  );
}

function Avatar({ user, size = 'normal' }: { user?: (User & { profile?: User['profile'] }) | null; size?: 'small' | 'normal' | 'large' }) {
  const className = size === 'large' ? 'h-14 w-14' : size === 'small' ? 'h-8 w-8' : 'h-11 w-11';
  return (
    <span className={`flex ${className} shrink-0 items-center justify-center overflow-hidden rounded-full border border-stone-200 bg-card-sand shadow-sm`}>
      {user?.profile?.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`${API_URL}${user.profile.avatarUrl}`} alt="" className="h-full w-full object-cover" />
      ) : (
        <ChatIcon className={size === 'small' ? 'h-5 w-5' : 'h-7 w-7'} />
      )}
    </span>
  );
}
