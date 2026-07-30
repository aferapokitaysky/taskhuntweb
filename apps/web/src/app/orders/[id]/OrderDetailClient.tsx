'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { api, getStoredAccessToken } from '@/lib/api';
import type { ChatMessage, ChatThreadSummary, Order, User } from '@/lib/types';
import { money } from '@/lib/types';
import { FileUpload, type UploadedFile } from '@/components/FileUpload';
import { PaperclipIcon } from '@/components/icons/PaperclipIcon';
import { StarIcon } from '@/components/icons/StarIcon';
import { BoostIcon } from '@/components/icons/BoostIcon';
import { ShieldIcon } from '@/components/icons/ShieldIcon';
import { CheckIcon } from '@/components/icons/CheckIcon';
import { AppHeader } from '@/components/AppHeader';
import { ErrorNotice } from '@/components/ErrorNotice';
import { EmptyState } from '@/components/EmptyState';
import { MatchIcon } from '@/components/icons/illustrated/MatchIcon';
import { ChatIcon } from '@/components/icons/illustrated/ChatIcon';
import { Mascot } from '@/components/Mascot';
import { OrderStatusBadge } from '@/components/OrderStatusBadge';
import { OrderTimeline } from '@/components/OrderTimeline';

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

const RECENTLY_VIEWED_KEY = 'taskhunt:recentlyViewed';
const MAX_RECENTLY_VIEWED = 10;

function rememberRecentlyViewed(id: string, title: string) {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(RECENTLY_VIEWED_KEY);
    const current: { id: string; title: string; viewedAt: number }[] = raw ? JSON.parse(raw) : [];
    const next = [{ id, title, viewedAt: Date.now() }, ...current.filter((entry) => entry.id !== id)].slice(
      0,
      MAX_RECENTLY_VIEWED,
    );
    localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(next));
  } catch {
    // localStorage может быть недоступен (приватный режим и т.п.) — не критично
  }
}

export default function OrderDetailClient() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const orderId = params.id;
  const [cloning, setCloning] = useState(false);
  const [me, setMe] = useState<User | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [body, setBody] = useState('');
  const [invoiceAmount, setInvoiceAmount] = useState('');
  const [invoiceDescription, setInvoiceDescription] = useState('');
  const [paymentAddress, setPaymentAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [threads, setThreads] = useState<ChatThreadSummary[]>([]);
  const [activeFreelancerId, setActiveFreelancerId] = useState<string | null>(null);
  const [compatibilityByBidId, setCompatibilityByBidId] = useState<Record<string, number | null>>({});
  const [similarOrders, setSimilarOrders] = useState<Order[]>([]);

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
  const [endorsedSkillIds, setEndorsedSkillIds] = useState<Set<string>>(new Set());

  // --- Продвижение заказа ---
  const [boosting, setBoosting] = useState(false);
  const [boostResult, setBoostResult] = useState<{ paidFromQuota: boolean; payAddress?: string } | null>(null);

  // --- Спор ---
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeSubmitting, setDisputeSubmitting] = useState(false);
  const [disputeError, setDisputeError] = useState<string | null>(null);

  async function openDispute(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setDisputeSubmitting(true);
    setDisputeError(null);
    try {
      await api(`/orders/${orderId}/disputes`, { method: 'POST', body: JSON.stringify({ reason: disputeReason }) });
      setShowDisputeForm(false);
      setDisputeReason('');
      await refreshOrder();
    } catch (err) {
      setDisputeError(err instanceof Error ? err.message : 'Не удалось открыть спор');
    } finally {
      setDisputeSubmitting(false);
    }
  }

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

  async function endorseSkill(skillId: string) {
    setEndorsedSkillIds((current) => new Set(current).add(skillId));
    await api(`/orders/${orderId}/endorse`, { method: 'POST', body: JSON.stringify({ skillId }) }).catch(() => undefined);
  }

  async function cloneOrder() {
    setCloning(true);
    setError(null);
    try {
      const cloned = await api<Order>(`/orders/${orderId}/clone`, { method: 'POST' });
      router.push(`/orders/${cloned.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать копию заказа');
      setCloning(false);
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
        rememberRecentlyViewed(orderDetails.id, orderDetails.title);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Не удалось загрузить заказ'));

    api<Order[]>(`/orders/${orderId}/similar`)
      .then(setSimilarOrders)
      .catch(() => undefined);
  }, [orderId]);

  const acceptedBid = useMemo(() => order?.bids?.find((bid) => bid.status === 'ACCEPTED'), [order]);
  const isFreelancer = acceptedBid?.freelancerId === me?.id;
  const isClient = order?.clientId === me?.id;
  const hasAcceptedBid = Boolean(acceptedBid);
  // Чат доступен раньше принятия отклика — заказчику с любым активным откликнувшимся, фрилансеру — если у него есть свой отклик.
  const hasActiveBid = order?.bids?.some((b) => b.freelancerId === me?.id && (b.status === 'PENDING' || b.status === 'ACCEPTED')) ?? false;
  const canChat = isClient
    ? (order?.bids?.some((b) => b.status === 'PENDING' || b.status === 'ACCEPTED') ?? false)
    : hasActiveBid;
  const chatFreelancerId = isClient ? activeFreelancerId : (me?.id ?? null);
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

  // Список тредов — у клиента по одному на каждого активного откликнувшегося, у фрилансера свой.
  useEffect(() => {
    if (!canChat) return;
    api<ChatThreadSummary[]>(`/orders/${orderId}/chat/threads`)
      .then((list) => {
        setThreads(list);
        if (isClient) {
          setActiveFreelancerId((current) => current ?? list.find((t) => t.hasThread)?.freelancerId ?? list[0]?.freelancerId ?? null);
        }
      })
      .catch(() => setThreads([]));
  }, [canChat, orderId, isClient]);

  useEffect(() => {
    if (!canChat || !chatFreelancerId) return;
    api<ChatMessage[]>(`/orders/${orderId}/chat/messages?freelancerId=${chatFreelancerId}`)
      .then(setMessages)
      .catch(() => setMessages([]));

    const token = getStoredAccessToken();
    if (!token) return;
    const nextSocket = io(`${API_URL}/chat`, { auth: { token } });
    nextSocket.on('connect', () => nextSocket.emit('joinOrder', { orderId, freelancerId: chatFreelancerId }));
    nextSocket.on('newMessage', (message: ChatMessage) => {
      setMessages((current) => (current.some((item) => item.id === message.id) ? current : [...current, message]));
    });
    nextSocket.on('connect_error', () => setError('Не удалось подключиться к чату'));
    setSocket(nextSocket);
    return () => {
      nextSocket.disconnect();
    };
  }, [canChat, chatFreelancerId, orderId]);

  // % совпадения тэгов заказа с навыками откликнувшихся — видно только заказчику.
  useEffect(() => {
    if (!isClient) return;
    api<{ bidId: string; compatibilityPercent: number | null }[]>(`/orders/${orderId}/recommended-freelancers`)
      .then((ranked) => {
        const map: Record<string, number | null> = {};
        for (const r of ranked) map[r.bidId] = r.compatibilityPercent;
        setCompatibilityByBidId(map);
      })
      .catch(() => undefined);
  }, [isClient, orderId]);

  async function sendMessage(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!body.trim() || !chatFreelancerId) return;
    const text = body.trim();
    setBody('');
    if (socket?.connected) {
      socket.emit('sendMessage', { orderId, freelancerId: chatFreelancerId, body: text });
      return;
    }
    const created = await api<ChatMessage>(`/orders/${orderId}/chat/messages?freelancerId=${chatFreelancerId}`, {
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
    return (
      <main className="mx-auto max-w-6xl px-4 py-10">
        <AppHeader />
        <p className="text-stone-500">Загружаем заказ...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <AppHeader />

      {error && <ErrorNotice message={error} />}

      <section className="mb-6 rounded-3xl border border-stone-100 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm text-stone-500">
              <span>{order.category?.name}</span>
              {order.client?.verifiedPayer && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                  <ShieldIcon className="h-3 w-3" />
                  Проверенный плательщик
                </span>
              )}
            </div>
            <div className="mt-1 flex items-center gap-2">
              <h1 className="font-serif text-3xl text-stone-900">{order.title}</h1>
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
            <OrderStatusBadge status={order.status} className="mt-1" />
            {isClient && ['COMPLETED', 'CANCELLED', 'EXPIRED'].includes(order.status) && (
              <button
                type="button"
                onClick={cloneOrder}
                disabled={cloning}
                className="mt-2 rounded-full border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 hover:border-brand hover:text-brand disabled:opacity-50"
              >
                {cloning ? 'Создаём…' : 'Повторить заказ'}
              </button>
            )}
          </div>
        </div>
        <p className="mt-4 whitespace-pre-wrap text-stone-700">{order.description}</p>

        <div className="mt-5 border-t border-stone-100 pt-4">
          <OrderTimeline status={order.status} />
        </div>

        {isClient && order.status === 'OPEN' && !order.isPromoted && (
          <div className="mt-4 border-t border-stone-100 pt-4">
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
              <p className="mt-2 text-sm text-stone-600">
                {boostResult.paidFromQuota
                  ? 'Продвижение активировано из бесплатной квоты тарифа.'
                  : `Оплатите буст: ${boostResult.payAddress}`}
              </p>
            )}
          </div>
        )}

        {(isClient || isFreelancer) && (
          <div className="mt-4 border-t border-stone-100 pt-4">
            {order.disputes && order.disputes.length > 0 ? (
              <div
                className={`rounded-lg px-4 py-3 text-sm ${
                  order.disputes[0].status === 'RESOLVED' ? 'bg-card-sage/50 text-stone-700' : 'bg-card-sand text-stone-700'
                }`}
              >
                <p className="font-medium">
                  {order.disputes[0].status === 'RESOLVED' ? 'Спор разрешён' : 'Спор открыт, ожидает рассмотрения'}
                </p>
                <p className="mt-1 text-stone-600">Причина: {order.disputes[0].reason}</p>
                {order.disputes[0].status === 'RESOLVED' && order.disputes[0].resolutionNotes && (
                  <p className="mt-1 text-stone-600">Решение: {order.disputes[0].resolutionNotes}</p>
                )}
              </div>
            ) : (order.status === 'IN_PROGRESS' || order.status === 'IN_REVIEW') && !showDisputeForm ? (
              <button
                type="button"
                onClick={() => setShowDisputeForm(true)}
                className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50"
              >
                Открыть спор
              </button>
            ) : null}

            {showDisputeForm && (
              <form onSubmit={openDispute} className="mt-2 space-y-2">
                <textarea
                  required
                  minLength={10}
                  placeholder="Опишите причину спора (минимум 10 символов)"
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  className="min-h-20 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
                />
                {disputeError && <p className="text-sm text-red-600">{disputeError}</p>}
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={disputeSubmitting}
                    className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {disputeSubmitting ? 'Отправляем…' : 'Отправить'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDisputeForm(false)}
                    className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-600"
                  >
                    Отмена
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </section>

      <section className="mb-6 rounded-3xl border border-stone-100 bg-white p-5 shadow-sm">
        <h2 className="mb-4 font-serif text-xl text-stone-900">Отклики</h2>
        {order.tags && order.tags.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {order.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-card-sand px-2.5 py-1 text-xs font-medium text-stone-700">
                {tag}
              </span>
            ))}
          </div>
        )}
        <div className="space-y-3">
          {(order.bids ?? []).map((bid) => {
            const compatibility = compatibilityByBidId[bid.id];
            return (
              <div key={bid.id} className="rounded-lg border border-stone-200 p-3">
                <div className="flex justify-between gap-3">
                  <p className="font-medium">{bid.freelancer?.profile?.displayName ?? bid.freelancer?.email ?? 'Фрилансер'}</p>
                  <p className="font-semibold">{money(bid.amount, order.currency)}</p>
                </div>
                <p className="mt-1 text-sm text-stone-600">{bid.message}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-stone-500">
                  <span>
                    {bid.deliveryDays} дн. · {bid.status}
                  </span>
                  {compatibility != null && (
                    <span
                      className={`rounded-full px-2 py-0.5 font-medium ${
                        compatibility >= 70 ? 'bg-card-sage text-stone-800' : compatibility >= 40 ? 'bg-card-sand text-stone-800' : 'bg-stone-100 text-stone-600'
                      }`}
                    >
                      {compatibility}% совпадение
                    </span>
                  )}
                  {isClient && (bid.status === 'PENDING' || bid.status === 'ACCEPTED') && (
                    <button
                      type="button"
                      onClick={() => setActiveFreelancerId(bid.freelancerId)}
                      className="font-medium text-brand hover:underline"
                    >
                      Написать
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {(order.bids ?? []).length === 0 && <EmptyState icon={<MatchIcon />} title="Откликов пока нет" />}
        </div>
      </section>

      {hasAcceptedBid && (
        <section className="mb-6 rounded-3xl border border-stone-100 bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-serif text-xl text-stone-900">Этапы и сдача работы</h2>

          {hasMilestones ? (
            <div className="space-y-3">
              {milestones.map((milestone) => (
                <div key={milestone.id} className="rounded-lg border border-stone-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{milestone.title}</p>
                    <p className="font-semibold">{money(milestone.amount, order.currency)}</p>
                  </div>
                  <p className="mt-1 text-xs text-stone-500">
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
            <div className="rounded-lg border border-stone-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-stone-600">Этапы не заведены — работа сдаётся заказом целиком.</p>
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
              <summary className="cursor-pointer text-sm font-medium text-stone-500 hover:text-stone-900">
                + Добавить этап
              </summary>
              <form onSubmit={createMilestone} className="mt-3 flex flex-wrap items-end gap-3">
                <input
                  required
                  placeholder="Название этапа"
                  value={milestoneForm.title}
                  onChange={(e) => setMilestoneForm((f) => ({ ...f, title: e.target.value }))}
                  className="min-w-0 flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm"
                />
                <input
                  required
                  type="number"
                  min="1"
                  placeholder="Сумма"
                  value={milestoneForm.amount}
                  onChange={(e) => setMilestoneForm((f) => ({ ...f, amount: e.target.value }))}
                  className="w-28 rounded-lg border border-stone-300 px-3 py-2 text-sm"
                />
                <input
                  type="date"
                  value={milestoneForm.dueDate}
                  onChange={(e) => setMilestoneForm((f) => ({ ...f, dueDate: e.target.value }))}
                  className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
                />
                <button type="submit" className="rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium hover:bg-stone-50">
                  Создать
                </button>
              </form>
            </details>
          )}

          {order.status === 'COMPLETED' && !reviewSubmitted && (isClient || isFreelancer) && (
            <div className="mt-6 rounded-lg border border-stone-200 p-4">
              <h3 className="mb-3 font-semibold">Оставить отзыв</h3>
              <form onSubmit={submitReview} className="space-y-3">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setReviewRating(n)}
                      className={n <= reviewRating ? 'text-amber-400' : 'text-stone-300'}
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
                  className="min-h-20 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
                />
                <button type="submit" className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white">
                  Отправить отзыв
                </button>
              </form>
            </div>
          )}
          {reviewSubmitted && (
            <div className="mt-6 flex items-center gap-3 rounded-lg bg-emerald-50 px-4 py-3">
              <Mascot name="love" size="h-12 w-12" />
              <p className="text-sm font-medium text-emerald-700">Спасибо за отзыв! Заказ закрыт.</p>
            </div>
          )}

          {order.status === 'COMPLETED' && isClient && acceptedBid?.freelancer?.profile?.skills && acceptedBid.freelancer.profile.skills.length > 0 && (
            <div className="mt-6 rounded-lg border border-stone-200 p-4">
              <h3 className="mb-3 font-semibold">Подтвердить навыки исполнителя</h3>
              <div className="flex flex-wrap gap-2">
                {acceptedBid.freelancer.profile.skills.map(({ skill }) => {
                  const done = endorsedSkillIds.has(skill.id);
                  return (
                    <button
                      key={skill.id}
                      type="button"
                      disabled={done}
                      onClick={() => endorseSkill(skill.id)}
                      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                        done ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-stone-300 text-stone-600 hover:border-brand hover:text-brand'
                      }`}
                    >
                      {done && <CheckIcon className="h-3.5 w-3.5" />}
                      {skill.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      )}

      {canChat && (
        <section className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="rounded-3xl border border-stone-100 bg-white p-5 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 font-serif text-xl text-stone-900">
              <ChatIcon className="h-8 w-8" />
              Чат заказа
            </h2>

            {isClient && threads.length > 1 && (
              <div className="mb-4 flex flex-wrap gap-1.5 border-b border-stone-100 pb-4">
                {threads.map((t) => (
                  <button
                    key={t.freelancerId}
                    type="button"
                    onClick={() => setActiveFreelancerId(t.freelancerId)}
                    className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                      activeFreelancerId === t.freelancerId ? 'bg-brand/10 text-brand' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                    }`}
                  >
                    {t.freelancer?.profile?.displayName ?? 'Фрилансер'}
                  </button>
                ))}
              </div>
            )}

            {!chatFreelancerId ? (
              <p className="text-sm text-stone-500">Выберите отклик выше, чтобы начать переписку.</p>
            ) : (
              <>
                <div className="mb-4 max-h-[480px] space-y-3 overflow-y-auto rounded-2xl bg-stone-50 p-4">
                  {messages.map((message) => {
                    const isOwn = message.senderId === me?.id;
                    const name = message.sender?.profile?.displayName ?? message.sender?.email ?? 'Участник';
                    return (
                      <div key={message.id} className={`flex items-end gap-2 ${isOwn ? 'flex-row-reverse' : ''}`}>
                        <div
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-serif text-xs text-stone-900 ${
                            isOwn ? 'bg-card-sand' : 'bg-card-lavender'
                          }`}
                        >
                          {name.charAt(0).toUpperCase()}
                        </div>
                        <div className={`max-w-[75%] rounded-2xl p-3 shadow-sm ${isOwn ? 'rounded-br-sm bg-brand text-white' : 'rounded-bl-sm bg-white text-stone-900'}`}>
                          <p className={`text-xs ${isOwn ? 'text-white/70' : 'text-stone-500'}`}>{name}</p>
                          {message.type === 'INVOICE' && message.invoice ? (
                            <div className={`mt-2 rounded-lg border p-3 ${isOwn ? 'border-white/30 bg-white/10' : 'border-brand/20 bg-brand/10'}`}>
                              <p className="font-semibold">Счёт на оплату {money(message.invoice.amount, message.invoice.currency)}</p>
                              <p className={`text-sm ${isOwn ? 'text-white/80' : 'text-stone-600'}`}>{message.invoice.status}</p>
                            </div>
                          ) : (
                            <p className="mt-1 text-sm">{message.body}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {messages.length === 0 && (
                    <EmptyState icon={<ChatIcon />} title="Сообщений пока нет" description="Напишите первым — это ни к чему не обязывает." />
                  )}
                </div>
                <form onSubmit={sendMessage} className="flex gap-2">
                  <input
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Сообщение"
                    className="min-w-0 flex-1 rounded-lg border border-stone-300 px-3 py-2"
                  />
                  <button type="submit" className="rounded-lg bg-brand px-4 py-2 font-medium text-white">
                    Отправить
                  </button>
                </form>
              </>
            )}
          </div>

          {isFreelancer && (
            <aside className="rounded-3xl border border-stone-100 bg-white p-5 shadow-sm">
              <h2 className="mb-4 font-serif text-lg text-stone-900">Выставить счёт</h2>
              <form onSubmit={issueInvoice} className="space-y-3">
                <input
                  required
                  type="number"
                  min="1"
                  placeholder="Сумма"
                  value={invoiceAmount}
                  onChange={(e) => setInvoiceAmount(e.target.value)}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2"
                />
                <textarea
                  placeholder="Описание"
                  value={invoiceDescription}
                  onChange={(e) => setInvoiceDescription(e.target.value)}
                  className="min-h-24 w-full rounded-lg border border-stone-300 px-3 py-2"
                />
                <button type="submit" className="w-full rounded-lg bg-brand px-4 py-3 font-medium text-white">
                  Выставить
                </button>
              </form>
              {paymentAddress && (
                <p className="mt-4 break-all rounded-lg bg-stone-50 p-3 text-xs text-stone-600">Pay address: {paymentAddress}</p>
              )}
            </aside>
          )}
        </section>
      )}

      {similarOrders.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 font-serif text-lg text-stone-900">Похожие заказы</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {similarOrders.map((similar) => (
              <Link
                key={similar.id}
                href={`/orders/${similar.id}`}
                className="rounded-2xl border border-stone-100 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
              >
                <p className="line-clamp-2 font-medium text-stone-900">{similar.title}</p>
                <p className="mt-2 text-sm font-semibold text-stone-700">{money(similar.budgetMin, similar.currency)}</p>
              </Link>
            ))}
          </div>
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
    <form onSubmit={onSubmit} className="mt-3 space-y-3 rounded-lg bg-stone-50 p-3">
      <textarea
        required
        placeholder="Что сделано"
        value={description}
        onChange={(e) => onDescriptionChange(e.target.value)}
        className="min-h-20 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
      />
      <textarea
        placeholder="Заметки (необязательно)"
        value={notes}
        onChange={(e) => onNotesChange(e.target.value)}
        className="min-h-16 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
      />

      <FileUpload multiple onUploaded={onFileUploaded} label="Прикрепить файлы сдачи" />
      {files.length > 0 && (
        <ul className="space-y-1">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-1.5 text-xs text-stone-600">
              <PaperclipIcon className="h-3.5 w-3.5 text-stone-400" />
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
          className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium hover:bg-white"
        >
          Отмена
        </button>
      </div>
    </form>
  );
}
