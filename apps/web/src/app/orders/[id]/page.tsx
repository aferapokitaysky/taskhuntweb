'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { api, getStoredAccessToken } from '@/lib/api';
import type { ChatMessage, Order, User } from '@/lib/types';
import { money } from '@/lib/types';
import { FileUpload, type UploadedFile } from '@/components/FileUpload';
import { PaperclipIcon } from '@/components/icons/PaperclipIcon';
import { StarIcon } from '@/components/icons/StarIcon';
import { BoostIcon } from '@/components/icons/BoostIcon';

const MILESTONE_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Не оплачен',
  FUNDED: 'Оплачен, ждёт сдачи',
  IN_PROGRESS: 'В работе',
  DELIVERED: 'Сдан, ждёт приёмки',
  APPROVED: 'Принят',
  RELEASED: 'Оплата отправлена',
  DISPUTED: 'Спор',
};

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

  // --- Milestones/сдача работы/приёмка ---
  const [milestoneForm, setMilestoneForm] = useState({ title: '', amount: '', dueDate: '' });
  const [deliverTarget, setDeliverTarget] = useState<'order' | string | null>(null);
  const [deliverDescription, setDeliverDescription] = useState('');
  const [deliverNotes, setDeliverNotes] = useState('');
  const [deliverFiles, setDeliverFiles] = useState<UploadedFile[]>([]);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  // --- Отзыв после завершения заказа ---
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  // --- Продвижение заказа ---
  const [boosting, setBoosting] = useState(false);
  const [boostResult, setBoostResult] = useState<{ paidFromQuota: boolean; payAddress?: string } | null>(null);

  async function boostOrder() {
    setBoosting(true);
    setError(null);
    try {
      const result = await api<{ paidFromQuota: boolean; payment?: { payAddress: string } }>('/promotions/checkout', {
        method: 'POST',
        body: JSON.stringify({ entityType: 'ORDER', entityId: orderId }),
      });
      setBoostResult({ paidFromQuota: result.paidFromQuota, payAddress: result.payment?.payAddress });
      if (result.paidFromQuota) await refreshOrder();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось оформить продвижение');
    } finally {
      setBoosting(false);
    }
  }

  async function refreshOrder() {
    const fresh = await api<Order>(`/orders/${orderId}`);
    setOrder(fresh);
  }

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
  const isClient = order?.clientId === me?.id;
  const hasChat = Boolean(order?.chatThread ?? order?.acceptedBidId);
  const milestones = useMemo(() => [...(order?.milestones ?? [])].sort((a, b) => a.position - b.position), [order]);
  const hasMilestones = milestones.length > 0;

  async function createMilestone(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    try {
      await api(`/orders/${orderId}/milestones`, {
        method: 'POST',
        body: JSON.stringify({
          title: milestoneForm.title,
          amount: Number(milestoneForm.amount),
          position: milestones.length,
          dueDate: milestoneForm.dueDate || undefined,
        }),
      });
      setMilestoneForm({ title: '', amount: '', dueDate: '' });
      await refreshOrder();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать этап');
    }
  }

  function openDeliverForm(target: 'order' | string) {
    setDeliverTarget(target);
    setDeliverDescription('');
    setDeliverNotes('');
    setDeliverFiles([]);
  }

  async function submitDelivery(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!deliverTarget) return;
    setError(null);
    setBusyAction('deliver');
    try {
      const path =
        deliverTarget === 'order' ? `/orders/${orderId}/deliver` : `/orders/${orderId}/milestones/${deliverTarget}/deliver`;
      await api(path, {
        method: 'POST',
        body: JSON.stringify({
          description: deliverDescription,
          notes: deliverNotes || undefined,
          fileIds: deliverFiles.map((f) => f.id),
        }),
      });
      setDeliverTarget(null);
      await refreshOrder();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сдать работу');
    } finally {
      setBusyAction(null);
    }
  }

  async function approve(target: 'order' | string) {
    setError(null);
    setBusyAction(`approve-${target}`);
    try {
      const path = target === 'order' ? `/orders/${orderId}/approve` : `/orders/${orderId}/milestones/${target}/approve`;
      await api(path, { method: 'POST' });
      await refreshOrder();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось принять работу');
    } finally {
      setBusyAction(null);
    }
  }

  async function submitReview(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    try {
      await api(`/orders/${orderId}/reviews`, {
        method: 'POST',
        body: JSON.stringify({ rating: reviewRating, comment: reviewComment || undefined }),
      });
      setReviewSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось оставить отзыв');
    }
  }

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
            <div className="mt-1 flex items-center gap-2">
              <h1 className="text-3xl font-bold">{order.title}</h1>
              {order.isPromoted && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                  <BoostIcon className="h-3 w-3" />
                  Продвигается
                </span>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-xl font-semibold">{money(order.budgetMin, order.currency)}</p>
            <p className="text-sm text-slate-500">{order.status}</p>
          </div>
        </div>
        <p className="mt-4 whitespace-pre-wrap text-slate-700">{order.description}</p>

        {isClient && order.status === 'OPEN' && !order.isPromoted && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={boostOrder}
              disabled={boosting}
              className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50"
            >
              <BoostIcon className="h-4 w-4" />
              {boosting ? 'Оформляем…' : 'Продвинуть заказ (7 дней)'}
            </button>
            {boostResult && (
              <p className="mt-2 text-sm text-slate-600">
                {boostResult.paidFromQuota
                  ? 'Продвижение активировано из бесплатной квоты тарифа.'
                  : `Оплатите буст: ${boostResult.payAddress}`}
              </p>
            )}
          </div>
        )}
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
        <section className="mb-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold">Этапы и сдача работы</h2>

          {hasMilestones ? (
            <div className="space-y-3">
              {milestones.map((milestone) => (
                <div key={milestone.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{milestone.title}</p>
                    <p className="font-semibold">{money(milestone.amount, order.currency)}</p>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {MILESTONE_STATUS_LABEL[milestone.status] ?? milestone.status}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {isFreelancer && (milestone.status === 'FUNDED' || milestone.status === 'IN_PROGRESS') && (
                      <button
                        type="button"
                        onClick={() => openDeliverForm(milestone.id)}
                        className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-dark"
                      >
                        Сдать этап
                      </button>
                    )}
                    {isClient && milestone.status === 'DELIVERED' && (
                      <button
                        type="button"
                        onClick={() => approve(milestone.id)}
                        disabled={busyAction === `approve-${milestone.id}`}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {busyAction === `approve-${milestone.id}` ? 'Принимаем…' : 'Принять и отпустить оплату'}
                      </button>
                    )}
                  </div>

                  {deliverTarget === milestone.id && (
                    <DeliveryForm
                      description={deliverDescription}
                      notes={deliverNotes}
                      files={deliverFiles}
                      busy={busyAction === 'deliver'}
                      onDescriptionChange={setDeliverDescription}
                      onNotesChange={setDeliverNotes}
                      onFileUploaded={(f) => setDeliverFiles((current) => [...current, f])}
                      onCancel={() => setDeliverTarget(null)}
                      onSubmit={submitDelivery}
                    />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-slate-600">Этапы не заведены — работа сдаётся заказом целиком.</p>
                <div className="flex gap-2">
                  {isFreelancer && order.status === 'IN_PROGRESS' && (
                    <button
                      type="button"
                      onClick={() => openDeliverForm('order')}
                      className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-dark"
                    >
                      Сдать работу
                    </button>
                  )}
                  {isClient && order.status === 'IN_REVIEW' && (
                    <button
                      type="button"
                      onClick={() => approve('order')}
                      disabled={busyAction === 'approve-order'}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {busyAction === 'approve-order' ? 'Принимаем…' : 'Принять и отпустить оплату'}
                    </button>
                  )}
                </div>
              </div>

              {deliverTarget === 'order' && (
                <DeliveryForm
                  description={deliverDescription}
                  notes={deliverNotes}
                  files={deliverFiles}
                  busy={busyAction === 'deliver'}
                  onDescriptionChange={setDeliverDescription}
                  onNotesChange={setDeliverNotes}
                  onFileUploaded={(f) => setDeliverFiles((current) => [...current, f])}
                  onCancel={() => setDeliverTarget(null)}
                  onSubmit={submitDelivery}
                />
              )}
            </div>
          )}

          {isClient && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-medium text-slate-500 hover:text-slate-900">
                + Добавить этап
              </summary>
              <form onSubmit={createMilestone} className="mt-3 flex flex-wrap items-end gap-3">
                <input
                  required
                  placeholder="Название этапа"
                  value={milestoneForm.title}
                  onChange={(e) => setMilestoneForm((f) => ({ ...f, title: e.target.value }))}
                  className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  required
                  type="number"
                  min="1"
                  placeholder="Сумма"
                  value={milestoneForm.amount}
                  onChange={(e) => setMilestoneForm((f) => ({ ...f, amount: e.target.value }))}
                  className="w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  type="date"
                  value={milestoneForm.dueDate}
                  onChange={(e) => setMilestoneForm((f) => ({ ...f, dueDate: e.target.value }))}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <button type="submit" className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50">
                  Создать
                </button>
              </form>
            </details>
          )}

          {order.status === 'COMPLETED' && !reviewSubmitted && (isClient || isFreelancer) && (
            <div className="mt-6 rounded-lg border border-slate-200 p-4">
              <h3 className="mb-3 font-semibold">Оставить отзыв</h3>
              <form onSubmit={submitReview} className="space-y-3">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setReviewRating(n)}
                      className={n <= reviewRating ? 'text-amber-400' : 'text-slate-300'}
                      aria-label={`${n} из 5`}
                    >
                      <StarIcon className="h-7 w-7" filled={n <= reviewRating} />
                    </button>
                  ))}
                </div>
                <textarea
                  placeholder="Комментарий (необязательно)"
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  className="min-h-20 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <button type="submit" className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white">
                  Отправить отзыв
                </button>
              </form>
            </div>
          )}
          {reviewSubmitted && <p className="mt-6 text-sm text-emerald-600">Спасибо за отзыв!</p>}
        </section>
      )}

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

interface DeliveryFormProps {
  description: string;
  notes: string;
  files: UploadedFile[];
  busy: boolean;
  onDescriptionChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onFileUploaded: (file: UploadedFile) => void;
  onCancel: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}

/** Форма сдачи работы — общая и для этапа, и для заказа целиком (см. deliverTarget в OrderPage). */
function DeliveryForm({
  description,
  notes,
  files,
  busy,
  onDescriptionChange,
  onNotesChange,
  onFileUploaded,
  onCancel,
  onSubmit,
}: DeliveryFormProps) {
  return (
    <form onSubmit={onSubmit} className="mt-3 space-y-3 rounded-lg bg-slate-50 p-3">
      <textarea
        required
        placeholder="Что сделано"
        value={description}
        onChange={(e) => onDescriptionChange(e.target.value)}
        className="min-h-20 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
      <textarea
        placeholder="Заметки (необязательно)"
        value={notes}
        onChange={(e) => onNotesChange(e.target.value)}
        className="min-h-16 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />

      <FileUpload multiple onUploaded={onFileUploaded} label="Прикрепить файлы сдачи" />
      {files.length > 0 && (
        <ul className="space-y-1">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-1.5 text-xs text-slate-600">
              <PaperclipIcon className="h-3.5 w-3.5 text-slate-400" />
              {f.originalName}
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? 'Отправляем…' : 'Отправить на проверку'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-white"
        >
          Отмена
        </button>
      </div>
    </form>
  );
}
