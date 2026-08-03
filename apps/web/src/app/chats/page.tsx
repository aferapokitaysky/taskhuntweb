'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { io, type Socket } from 'socket.io-client';
import { useRequireAuth } from '@/lib/useRequireAuth';
import { AppHeader } from '@/components/AppHeader';
import { EmptyState } from '@/components/EmptyState';
import { ErrorNotice } from '@/components/ErrorNotice';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { FileUpload, type UploadedFile } from '@/components/FileUpload';
import { InvoiceChatCard } from '@/components/InvoiceChatCard';
import { PaymentConfirmDetails } from '@/components/PaymentConfirmDetails';
import { PaperclipIcon } from '@/components/icons/PaperclipIcon';
import { ChatIcon } from '@/components/icons/illustrated/ChatIcon';
import { Mascot } from '@/components/Mascot';
import { api, API_URL, downloadFile, ensureFreshAccessToken } from '@/lib/api';
import type { ChatInboxThread, ChatMessage, Invoice, InvoicePaymentDetails, User } from '@/lib/types';
import { money } from '@/lib/types';

type ActiveChat = { orderId: string; freelancerId: string; threadId?: string | null };

const QUICK_CHAT_TEMPLATES = [
  { label: 'Уточнить', text: 'Привет! Уточните, пожалуйста, один момент по задаче.' },
  { label: 'Следующий шаг', text: 'Готов двигаться дальше, подтверждаю сроки и следующий шаг.' },
  { label: 'Счёт', text: 'Посмотрите, пожалуйста, счёт и реквизиты в чате.' },
];

export default function ChatsPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-7xl px-4 py-8 text-stone-500">Загружаем чаты...</main>}>
      <ChatsContent />
    </Suspense>
  );
}

function ChatsContent() {
  useRequireAuth();
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
  const [socket, setSocket] = useState<Socket | null>(null);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [invoiceAmount, setInvoiceAmount] = useState('');
  const [invoiceDescription, setInvoiceDescription] = useState('');
  const [issueInvoiceConfirmOpen, setIssueInvoiceConfirmOpen] = useState(false);
  const [issuingInvoice, setIssuingInvoice] = useState(false);
  const [payingFromBalance, setPayingFromBalance] = useState(false);
  const [payFromBalanceError, setPayFromBalanceError] = useState<string | null>(null);

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
    if (socket?.connected) {
      // Сокет — сам отправитель тоже состоит в комнате и получит своё же
      // сообщение обратно через 'newMessage' (см. эффект выше), поэтому
      // здесь не добавляем его в messages локально — иначе будет дубль
      // на долю секунды до прихода эха.
      socket.emit('sendMessage', { orderId: active.orderId, freelancerId: active.freelancerId, body: text });
      return;
    }
    setSending(true);
    try {
      const created = await api<ChatMessage>(`/orders/${active.orderId}/chat/messages?freelancerId=${active.freelancerId}`, {
        method: 'POST',
        body: JSON.stringify({ body: text }),
      });
      setMessages((current) => (current.some((item) => item.id === created.id) ? current : [...current, created]));
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
      setMessages((current) => (current.some((item) => item.id === created.id) ? current : [...current, created]));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить файл в чат');
    } finally {
      setSendingFileId(null);
    }
  }

  async function openPaymentConfirm(invoice: Invoice) {
    setPaymentConfirmInvoice(invoice);
    setPayFromBalanceError(null);
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

  async function payInvoiceFromBalance() {
    if (!paymentConfirmInvoice) return;
    setPayingFromBalance(true);
    setPayFromBalanceError(null);
    try {
      // Списание с MAIN — основной способ оплаты счёта (см. заметку в
      // docs/CODEX_CLAUDE_SYNC.md: "деньги должны списываться из основного
      // баланса"). Криптоплатёж ниже остаётся как запасной вариант, когда
      // основного баланса не хватает.
      await api(`/wallet/invoices/${paymentConfirmInvoice.id}/pay-from-balance`, { method: 'POST' });
      // Статус счёта на PAID обновится сам через живой 'invoiceUpdated' —
      // здесь просто закрываем диалог.
      setPaymentConfirmInvoice(null);
    } catch (err) {
      setPayFromBalanceError(err instanceof Error ? err.message : 'Не удалось оплатить с основного баланса');
    } finally {
      setPayingFromBalance(false);
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

  async function issueInvoice() {
    if (!active) return;
    setError(null);
    setIssueInvoiceConfirmOpen(false);
    setIssuingInvoice(true);
    try {
      // Карточку счёта в переписке добавлять локально не нужно — она придёт
      // сама через 'newMessage' (ChatEventsListener слушает InvoiceIssued
      // и шлёт в комнату почти сразу после ответа этого запроса).
      await api('/wallet/invoices', {
        method: 'POST',
        body: JSON.stringify({
          orderId: active.orderId,
          amount: Number(invoiceAmount),
          description: invoiceDescription || undefined,
        }),
      });
      setInvoiceAmount('');
      setInvoiceDescription('');
      setShowInvoiceForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось выставить счёт');
    } finally {
      setIssuingInvoice(false);
    }
  }

  // Один сокет на весь инбокс — раньше здесь был 15с-поллинг только для
  // открытого диалога с PENDING-счётом; теперь статус счёта и новые
  // сообщения приходят вживую по ЛЮБОМУ треду, не только открытому.
  useEffect(() => {
    let cancelled = false;
    let nextSocket: Socket | null = null;
    ensureFreshAccessToken().then((token) => {
      if (cancelled || !token) return;
      nextSocket = io(`${API_URL}/chat`, { auth: { token } });
      nextSocket.on('connect_error', () => setError('Не удалось подключиться к чату'));
      setSocket(nextSocket);
    });
    return () => {
      cancelled = true;
      nextSocket?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Вступаем в комнаты ВСЕХ тредов инбокса (не только открытого) — иначе
  // превью последнего сообщения и счётчик непрочитанных слева не
  // обновлялись бы вживую для чатов, которые сейчас не открыты.
  useEffect(() => {
    if (!socket) return;
    const joinAll = () => {
      for (const thread of threads) {
        socket.emit('joinOrder', { orderId: thread.orderId, freelancerId: thread.freelancerId });
      }
      if (active) socket.emit('joinOrder', { orderId: active.orderId, freelancerId: active.freelancerId });
    };
    if (socket.connected) joinAll();
    socket.on('connect', joinAll);
    return () => {
      socket.off('connect', joinAll);
    };
  }, [socket, threads, active]);

  useEffect(() => {
    if (!socket) return;

    function onNewMessage(message: ChatMessage) {
      const isActiveThread = Boolean(active) && message.orderId === active?.orderId && message.freelancerId === active?.freelancerId;
      if (isActiveThread) {
        setMessages((current) => (current.some((item) => item.id === message.id) ? current : [...current, message]));
      }
      setThreads((current) => {
        const idx = current.findIndex((t) => t.orderId === message.orderId && t.freelancerId === message.freelancerId);
        if (idx === -1) {
          // Первое сообщение по треду, которого ещё не было в инбоксе — просто дозагрузим список целиком.
          void loadInbox(false).catch(() => undefined);
          return current;
        }
        const next = [...current];
        const incrementUnread = !isActiveThread && message.senderId !== me?.id;
        next[idx] = {
          ...next[idx],
          lastMessage: message,
          unreadCount: incrementUnread ? (next[idx].unreadCount ?? 0) + 1 : isActiveThread ? 0 : next[idx].unreadCount,
        };
        return next;
      });
    }

    function onInvoiceUpdated(invoice: Invoice) {
      setMessages((current) =>
        current.map((message) => (message.invoice?.id === invoice.id ? { ...message, invoice: { ...message.invoice, ...invoice } } : message)),
      );
    }

    socket.on('newMessage', onNewMessage);
    socket.on('invoiceUpdated', onInvoiceUpdated);
    return () => {
      socket.off('newMessage', onNewMessage);
      socket.off('invoiceUpdated', onInvoiceUpdated);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, active?.orderId, active?.freelancerId, me?.id]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <AppHeader />
      {/* Компактный заголовок вместо полноразмерного hero — на странице
          мессенджера основная площадь должна уходить под сам чат, а не под
          маркетинговый баннер сверху. */}
      <section className="workspace-hero mb-4 flex flex-wrap items-center justify-between gap-4 p-4 md:p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Сообщения</p>
          <h1 className="mt-1 font-serif text-2xl leading-tight text-stone-950 md:text-3xl">Чаты по заказам</h1>
        </div>
        <Mascot name="supportHeadset" size="h-12 w-12" />
      </section>

      {error && <ErrorNotice message={error} />}

      {/* Фиксированная высота (не min-h!) — иначе flex-1/overflow-y-auto у
          списка сообщений ниже не от чего было считать границу, и при
          накоплении сообщений/счетов росла не внутренняя прокрутка, а вся
          секция (и вместе с ней вся страница). */}
      <section className="grid gap-5 lg:h-[calc(100vh-100px)] lg:min-h-[960px] lg:grid-rows-[1fr] lg:grid-cols-[380px_1fr]">
        <aside className="premium-panel flex min-h-0 flex-col overflow-hidden rounded-[2.25rem] p-0">
          <div className="shrink-0 border-b border-stone-100 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">Inbox</p>
            <div className="mt-1 flex items-center justify-between gap-3">
              <h2 className="font-serif text-2xl text-stone-950">Диалоги</h2>
              {totalUnreadCount > 0 && (
                <span className="rounded-full bg-brand px-3 py-1 text-xs font-bold text-white">{totalUnreadCount} новых</span>
              )}
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
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

        <div className="premium-panel flex min-h-0 overflow-hidden rounded-[2.25rem] p-0">
          {!active ? (
            <div className="flex flex-1 items-center justify-center p-8">
              <EmptyState icon={<ChatIcon />} title="Выберите чат" description="Слева появятся диалоги по вашим заказам и откликам." />
            </div>
          ) : (
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
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
                    {activeThread?.role === 'FREELANCER' && (
                      <button
                        type="button"
                        onClick={() => setShowInvoiceForm((v) => !v)}
                        className="primary-action px-4 py-2.5 text-sm"
                      >
                        {showInvoiceForm ? 'Свернуть счёт' : 'Выставить счёт'}
                      </button>
                    )}
                  </div>
                </div>

                {showInvoiceForm && activeThread?.role === 'FREELANCER' && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      setIssueInvoiceConfirmOpen(true);
                    }}
                    className="mt-4 flex flex-wrap items-end gap-2 rounded-[1.5rem] border border-brand/15 bg-white/80 p-3"
                  >
                    <label className="field-surface flex min-h-[4.5rem] flex-1 min-w-[8rem] flex-col justify-between px-3 py-2">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-stone-400">Сумма, USD</span>
                      <input
                        required
                        type="number"
                        min="1"
                        placeholder="100"
                        value={invoiceAmount}
                        onChange={(e) => setInvoiceAmount(e.target.value)}
                        className="mt-1 w-full bg-transparent font-serif text-xl text-stone-950 outline-none"
                      />
                    </label>
                    <label className="field-surface flex min-h-[4.5rem] flex-[2] min-w-[12rem] flex-col justify-between px-3 py-2">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-stone-400">За что счёт</span>
                      <input
                        placeholder="Этап, результат, доработка"
                        value={invoiceDescription}
                        onChange={(e) => setInvoiceDescription(e.target.value)}
                        className="mt-1 w-full bg-transparent text-sm text-stone-800 outline-none"
                      />
                    </label>
                    <button type="submit" disabled={issuingInvoice} className="primary-action px-4 py-3 text-sm disabled:opacity-60">
                      {issuingInvoice ? 'Отправляем...' : 'В чат'}
                    </button>
                  </form>
                )}
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
                    ['INVOICES', `Счета/чеки ${invoiceCount}`],
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
                </div>
              </div>

              <div className="flex-1 overflow-y-auto bg-stone-50/70 p-4 md:p-6">
                {messagesLoading && <p className="text-sm text-stone-500">Загружаем сообщения...</p>}
                {!messagesLoading && visibleMessages.length === 0 && (
                  <EmptyState
                    icon={<ChatIcon />}
                    title={chatFilter === 'INVOICES' ? 'Счетов и чеков пока нет' : 'Сообщений пока нет'}
                    description={chatFilter === 'INVOICES' ? 'Когда в диалоге появится счёт или чек, он будет собран здесь.' : 'Начните диалог с короткого сообщения по задаче.'}
                  />
                )}
                <div className="space-y-3">
                  {visibleMessages.map((message) => {
                    const own = message.senderId === me?.id;
                    const name = message.sender?.profile?.displayName ?? message.sender?.email ?? 'Участник';
                    const isInvoice = message.type === 'INVOICE' && Boolean(message.invoice);
                    return (
                      <div key={message.id} className={`flex items-end gap-2 ${own ? 'flex-row-reverse' : ''}`}>
                        <Avatar user={message.sender} size="small" />
                        <div
                          className={
                            isInvoice
                              ? 'max-w-[min(34rem,86%)]'
                              : `max-w-[78%] rounded-[1.6rem] p-3 shadow-sm ${own ? 'bg-brand text-white' : 'bg-white text-stone-900'}`
                          }
                        >
                          <div className={`mb-1 flex items-center gap-2 text-[11px] ${own ? 'text-white/70' : 'text-stone-400'}`}>
                            <span>{name}</span>
                            <span>{new Date(message.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          {isInvoice && message.invoice ? (
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
                <div className="mb-2 flex flex-wrap items-center gap-1.5 px-1">
                  <span className="rounded-full bg-stone-100 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-stone-400">
                    Быстрые ответы
                  </span>
                  {QUICK_CHAT_TEMPLATES.map((template) => (
                    <button
                      key={template.label}
                      type="button"
                      title={template.text}
                      onClick={() => setBody(template.text)}
                      className="rounded-full bg-card-sand/80 px-3 py-1.5 text-xs font-semibold text-stone-700 transition hover:-translate-y-0.5 hover:bg-card-sage"
                    >
                      {template.label}
                    </button>
                  ))}
                </div>
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
        title="Оплата счёта"
        description={
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => void payInvoiceFromBalance()}
              disabled={payingFromBalance || !paymentConfirmInvoice}
              className="primary-action w-full justify-center px-4 py-3 text-sm disabled:opacity-60"
            >
              {payingFromBalance
                ? 'Списываем...'
                : `Оплатить ${paymentConfirmInvoice ? money(paymentConfirmInvoice.amount, paymentConfirmInvoice.currency) : ''} с основного баланса`}
            </button>
            {payFromBalanceError && <p className="text-xs text-red-600">{payFromBalanceError}</p>}
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-stone-400">
              <span className="h-px flex-1 bg-stone-200" /> или переводом в крипте <span className="h-px flex-1 bg-stone-200" />
            </div>
            <PaymentConfirmDetails invoice={paymentConfirmInvoice} loading={paymentDetailsLoading} />
          </div>
        }
        confirmLabel="Готово"
        busy={payingFromBalance}
        onCancel={() => setPaymentConfirmInvoice(null)}
        onConfirm={() => setPaymentConfirmInvoice(null)}
      />
      <ConfirmDialog
        open={issueInvoiceConfirmOpen}
        title="Отправить счёт заказчику?"
        description={`Проверьте сумму: ${money(invoiceAmount || 0)}. После подтверждения счёт появится в чате, а заказчик получит уведомление.`}
        confirmLabel="Отправить счёт"
        busy={issuingInvoice}
        onCancel={() => setIssueInvoiceConfirmOpen(false)}
        onConfirm={issueInvoice}
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
