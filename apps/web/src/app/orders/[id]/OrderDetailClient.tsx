'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { api, downloadFile } from '@/lib/api';
import type { ChatThreadSummary, Invoice, InvoicePaymentDetails, Order, User } from '@/lib/types';
import { money } from '@/lib/types';
import { FileUpload, type UploadedFile } from '@/components/FileUpload';
import { PaperclipIcon } from '@/components/icons/PaperclipIcon';
import { StarIcon } from '@/components/icons/StarIcon';
import { BoostIcon } from '@/components/icons/BoostIcon';
import { CheckIcon } from '@/components/icons/CheckIcon';
import { AppHeader } from '@/components/AppHeader';
import { ErrorNotice } from '@/components/ErrorNotice';
import { EmptyState } from '@/components/EmptyState';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PaymentConfirmDetails } from '@/components/PaymentConfirmDetails';
import { MatchIcon } from '@/components/icons/illustrated/MatchIcon';
import { ChatIcon } from '@/components/icons/illustrated/ChatIcon';
import { BidAvatarIcon } from '@/components/icons/illustrated/BidAvatarIcon';
import { BalanceEscrowIcon } from '@/components/icons/illustrated/BalanceEscrowIcon';
import { BalanceMainIcon } from '@/components/icons/illustrated/BalanceMainIcon';
import { Mascot } from '@/components/Mascot';
import { OrderStatusBadge } from '@/components/OrderStatusBadge';
import { OrderTimeline } from '@/components/OrderTimeline';
import { BID_STATUS_LABELS } from '@/lib/bidStatus';

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

function getWorkflowGuidance(params: {
  status: Order['status'];
  isClient: boolean;
  isFreelancer: boolean;
  pendingBidCount: number;
  hasAcceptedBid: boolean;
  hasMilestones: boolean;
}) {
  const { status, isClient, isFreelancer, pendingBidCount, hasAcceptedBid, hasMilestones } = params;
  if (status === 'OPEN') {
    if (isClient && pendingBidCount > 0) {
      return {
        title: 'Ваш ход: выберите исполнителя',
        text: 'Статус станет «В работе», когда заказчик примет один из откликов. После этого появится рабочий чат и сдача результата.',
        actor: 'Заказчик',
      };
    }
    if (isClient) {
      return {
        title: 'Ждём отклики',
        text: 'Сейчас заказ виден фрилансерам. Когда появятся отклики, заказчик выбирает исполнителя кнопкой «Принять».',
        actor: 'Фрилансеры',
      };
    }
    return {
      title: hasAcceptedBid ? 'Исполнитель уже выбран' : 'Можно откликнуться',
      text: hasAcceptedBid
        ? 'Заказ скоро перейдёт в работу после принятого отклика.'
        : 'Фрилансер отправляет отклик, а заказчик решает, кого взять в работу.',
      actor: isFreelancer ? 'Фрилансер' : 'Участники',
    };
  }
  if (status === 'IN_PROGRESS') {
    return {
      title: isFreelancer ? 'Ваш ход: сдайте работу' : 'Исполнитель работает над задачей',
      text: hasMilestones
        ? 'Фрилансер сдаёт этапы по одному. Заказчик принимает каждый сданный этап и отпускает оплату.'
        : 'Фрилансер нажимает «Сдать работу», после этого заказ переходит на проверку заказчику.',
      actor: isFreelancer ? 'Фрилансер' : 'Фрилансер',
    };
  }
  if (status === 'IN_REVIEW') {
    return {
      title: isClient ? 'Ваш ход: принять результат' : 'Ждём проверку заказчика',
      text: 'Заказчик принимает работу и отпускает оплату. Если что-то пошло не так, любая сторона может открыть спор.',
      actor: 'Заказчик',
    };
  }
  if (status === 'DISPUTED') {
    return {
      title: 'Спор на разборе',
      text: 'Статус держит система, пока поддержка не разберёт материалы и не вынесет решение.',
      actor: 'Поддержка',
    };
  }
  if (status === 'COMPLETED') {
    return {
      title: 'Заказ завершён',
      text: 'Работа принята, оплата отпущена. Участники могут оставить отзыв и подтвердить навыки исполнителя.',
      actor: 'Система',
    };
  }
  if (status === 'CANCELLED') {
    return { title: 'Заказ отменён', text: 'Дальше действий по заказу нет. Заказчик может создать копию и запустить задачу заново.', actor: 'Система' };
  }
  if (status === 'EXPIRED') {
    return { title: 'Срок истёк', text: 'Заказ не дошёл до работы в срок. Заказчик может повторить публикацию.', actor: 'Система' };
  }
  return { title: 'Черновик', text: 'Заказ ещё не опубликован и не участвует в рабочем процессе.', actor: 'Заказчик' };
}

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
  const [orderInvoices, setOrderInvoices] = useState<Invoice[]>([]);
  const [copiedInvoiceField, setCopiedInvoiceField] = useState<string | null>(null);
  const [paymentConfirmInvoice, setPaymentConfirmInvoice] = useState<Invoice | null>(null);
  const [paymentDetailsLoading, setPaymentDetailsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [threads, setThreads] = useState<ChatThreadSummary[]>([]);
  const [compatibilityByBidId, setCompatibilityByBidId] = useState<Record<string, number | null>>({});
  const [similarOrders, setSimilarOrders] = useState<Order[]>([]);

  // --- Milestones/сдача работы/приёмка ---
  const [milestoneForm, setMilestoneForm] = useState({ title: '', amount: '', dueDate: '' });
  const [deliverTarget, setDeliverTarget] = useState<'order' | string | null>(null);
  const [deliverDescription, setDeliverDescription] = useState('');
  const [deliverNotes, setDeliverNotes] = useState('');
  const [deliverFiles, setDeliverFiles] = useState<UploadedFile[]>([]);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [bidActionId, setBidActionId] = useState<string | null>(null);
  const [hireConfirmBidId, setHireConfirmBidId] = useState<string | null>(null);
  const [declineConfirmBidId, setDeclineConfirmBidId] = useState<string | null>(null);
  const [approveConfirmTarget, setApproveConfirmTarget] = useState<'order' | string | null>(null);

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

  async function refreshOrderInvoices() {
    const invoices = await api<Invoice[]>(`/orders/${orderId}/invoices`);
    setOrderInvoices(invoices);
  }

  useEffect(() => {
    Promise.all([api<User>('/users/me'), api<Order>(`/orders/${orderId}`)])
      .then(([user, orderDetails]) => {
        setMe(user);
        setOrder(orderDetails);
        rememberRecentlyViewed(orderDetails.id, orderDetails.title);
        if (user.id === orderDetails.clientId || orderDetails.bids?.some((bid) => bid.status === 'ACCEPTED' && bid.freelancerId === user.id)) {
          void refreshOrderInvoices();
        }
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
  // Заказчик переходит в чат с уже нанятым исполнителем (если такой есть) —
  // остальных активных откликнувшихся он видит и открывает по отдельности
  // из списка тредов на странице /chats. Фрилансер — всегда со своим
  // собственным откликом, доступен и до найма (hasActiveBid).
  const chatFreelancerId = isClient ? (acceptedBid?.freelancerId ?? null) : hasActiveBid ? (me?.id ?? null) : null;
  const milestones = useMemo(() => [...(order?.milestones ?? [])].sort((a, b) => a.position - b.position), [order]);
  const hasMilestones = milestones.length > 0;
  const pendingBidCount = order?.bids?.filter((bid) => bid.status === 'PENDING').length ?? 0;
  const bids = order?.bids ?? [];
  const selectedBidCount = bids.filter((bid) => bid.status === 'ACCEPTED').length;
  const closedBidCount = bids.filter((bid) => bid.status === 'REJECTED' || bid.status === 'WITHDRAWN').length;
  const paidInvoiceCount = orderInvoices.filter((invoice) => invoice.status === 'PAID').length;
  const pendingInvoiceCount = orderInvoices.filter((invoice) => invoice.status === 'PENDING').length;
  const hireConfirmBid = order?.bids?.find((bid) => bid.id === hireConfirmBidId) ?? null;
  const declineConfirmBid = order?.bids?.find((bid) => bid.id === declineConfirmBidId) ?? null;
  const approveConfirmMilestone =
    approveConfirmTarget && approveConfirmTarget !== 'order'
      ? (order?.milestones?.find((milestone) => milestone.id === approveConfirmTarget) ?? null)
      : null;
  const workflowGuidance = order
    ? getWorkflowGuidance({
        status: order.status,
        isClient,
        isFreelancer,
        pendingBidCount,
        hasAcceptedBid,
        hasMilestones,
      })
    : null;

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
    setApproveConfirmTarget(null);
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

  async function hireBid(bidId: string) {
    setError(null);
    setHireConfirmBidId(null);
    setBidActionId(`hire-${bidId}`);
    try {
      await api(`/orders/${orderId}/bids/${bidId}/accept`, { method: 'POST' });
      await refreshOrder();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось выбрать исполнителя');
    } finally {
      setBidActionId(null);
    }
  }

  async function declineBid(bidId: string) {
    setError(null);
    setDeclineConfirmBidId(null);
    setBidActionId(`decline-${bidId}`);
    try {
      await api(`/orders/${orderId}/bids/${bidId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Заказчик выбрал другого исполнителя или продолжает отбор.' }),
      });
      await refreshOrder();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отклонить отклик');
    } finally {
      setBidActionId(null);
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

  // Список тредов держим только ради счётчика "Чатов" в статистике по
  // откликам ниже — сама переписка теперь целиком живёт на /chats
  // (см. компактный баннер "Открыть чат"), чтобы не дублировать один и тот
  // же чат в двух местах интерфейса с разной свежестью данных.
  useEffect(() => {
    if (!canChat) return;
    api<ChatThreadSummary[]>(`/orders/${orderId}/chat/threads`)
      .then(setThreads)
      .catch(() => setThreads([]));
  }, [canChat, orderId]);

  // % совпадения тэгов заказа с навыками откликнувшихся — видно только заказчику.
  // order?.id === orderId — обязательная проверка, не просто isClient:
  // при переходе между заказами (client-side navigation) URL уже указывает
  // на новый orderId, а order в стейте ещё хранит ПРЕДЫДУЩИЙ заказ, пока
  // fetch не отработает. Если предыдущий заказ принадлежал этому клиенту,
  // isClient успевает быть true один рендер раньше, чем order обновится —
  // без этой проверки эффект стрелял бы запросом на чужой orderId (403 в консоли).
  useEffect(() => {
    if (!isClient || order?.id !== orderId) return;
    api<{ bidId: string; compatibilityPercent: number | null }[]>(`/orders/${orderId}/recommended-freelancers`)
      .then((ranked) => {
        const map: Record<string, number | null> = {};
        for (const r of ranked) map[r.bidId] = r.compatibilityPercent;
        setCompatibilityByBidId(map);
      })
      .catch(() => undefined);
  }, [isClient, orderId, order?.id]);

  async function exportOrderInvoices() {
    setError(null);
    try {
      await downloadFile(`/orders/${orderId}/invoices/export.csv`, `invoices-order-${orderId}.csv`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось скачать историю счетов');
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

  async function copyInvoiceValue(invoiceId: string, field: string, value: string) {
    await navigator.clipboard?.writeText(value).catch(() => undefined);
    const key = `${invoiceId}:${field}`;
    setCopiedInvoiceField(key);
    window.setTimeout(() => {
      setCopiedInvoiceField((current) => (current === key ? null : current));
    }, 1300);
  }

  // Выставление счёта переехало на /chats (см. sync-заметку в
  // docs/CODEX_CLAUDE_SYNC.md) — здесь остаётся только чтение истории
  // платежей, живое обновление статуса счёта приходит через сокет /chats,
  // а этот 15с-поллинг остаётся страховкой конкретно для этой таблицы
  // истории (она не подключена к сокету чата).
  useEffect(() => {
    if (!isClient && !isFreelancer) return;
    if (!orderInvoices.some((invoice) => invoice.status === 'PENDING')) return;
    const interval = setInterval(() => {
      void refreshOrderInvoices().catch(() => undefined);
    }, 15000);
    return () => clearInterval(interval);
  }, [isClient, isFreelancer, orderInvoices]);

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

      <section className="workspace-hero mb-6 p-6 md:p-8">
        <div className="relative flex flex-wrap items-start justify-between gap-6">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-stone-500">
              <span>{order.category?.name}</span>
              {order.client?.verifiedPayer && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                  <BalanceEscrowIcon className="h-4 w-4" />
                  Проверенный плательщик
                </span>
              )}
            </div>
            <div className="mt-1 flex items-center gap-2">
              <h1 className="max-w-3xl font-serif text-3xl leading-tight text-stone-950 md:text-5xl">{order.title}</h1>
              {order.isPromoted && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                  <BoostIcon className="h-3 w-3" />
                  Продвигается
                </span>
              )}
            </div>
          </div>
          <div className="rounded-[2rem] border border-stone-100 bg-white/70 p-5 text-right shadow-sm backdrop-blur">
            <div className="flex items-start justify-between gap-4 text-left">
              <Mascot name="invoiceCoin" size="h-14 w-14" />
              <div>
                <p className="text-xs uppercase text-stone-400">Бюджет</p>
                <p className="mt-1 font-serif text-3xl text-stone-950">{money(order.budgetMin, order.currency)}</p>
                <OrderStatusBadge status={order.status} className="mt-1" />
              </div>
            </div>
            {isClient && ['COMPLETED', 'CANCELLED', 'EXPIRED'].includes(order.status) && (
              <button
                type="button"
                onClick={cloneOrder}
                disabled={cloning}
                className="secondary-action mt-3 px-3 py-1.5 text-xs font-medium disabled:opacity-50"
              >
                {cloning ? 'Создаём…' : 'Повторить заказ'}
              </button>
            )}
          </div>
        </div>
        <p className="relative mt-5 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-stone-600">{order.description}</p>

        <div className="relative mt-6 rounded-[2rem] border border-stone-100 bg-white/70 p-4 shadow-sm backdrop-blur">
          <div className="flex items-center gap-4">
            <div className="min-w-0 flex-1">
              <OrderTimeline status={order.status} />
            </div>
          </div>
          {workflowGuidance && (
            <div className="mt-4 grid gap-3 border-t border-stone-100 pt-4 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
                    Сейчас отвечает: {workflowGuidance.actor}
                  </span>
                  <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-500">
                    {pendingBidCount} откликов на решении
                  </span>
                </div>
                <p className="mt-3 font-semibold text-stone-950">{workflowGuidance.title}</p>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-stone-600">{workflowGuidance.text}</p>
              </div>
              <div className="rounded-[1.5rem] bg-card-sand/70 px-4 py-3 text-sm font-semibold text-stone-700">
                Статус меняется только действием участника
              </div>
            </div>
          )}
        </div>

        {isClient && order.status === 'OPEN' && !order.isPromoted && (
          <div className="relative mt-4 rounded-3xl border border-amber-300/20 bg-amber-300/10 p-4">
            <button
              type="button"
              onClick={boostOrder}
              disabled={boosting}
              className="flex items-center gap-2 rounded-full border border-amber-200/40 bg-amber-100 px-4 py-2 text-sm font-medium text-stone-950 hover:bg-amber-50 disabled:opacity-50"
            >
              <BoostIcon className="h-4 w-4" />
              {boosting ? 'Оформляем…' : 'Продвинуть заказ (7 дней)'}
            </button>
            {boostResult && (
              <p className="mt-2 text-sm text-stone-700">
                {boostResult.paidFromQuota
                  ? 'Продвижение активировано из бесплатной квоты тарифа.'
                  : `Оплатите буст: ${boostResult.payAddress}`}
              </p>
            )}
          </div>
        )}

        {(isClient || isFreelancer) && (
          <div className="relative mt-4">
            {order.disputes && order.disputes.length > 0 ? (
              <div
                className={`rounded-2xl px-4 py-3 text-sm ${
                  order.disputes[0].status === 'RESOLVED' ? 'bg-card-sage text-stone-800' : 'bg-card-sand text-stone-800'
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
                className="secondary-action px-4 py-2 text-sm font-medium"
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
                  className="field-surface min-h-20 w-full px-3 py-2 text-sm"
                />
                {disputeError && <p className="text-sm text-red-600">{disputeError}</p>}
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={disputeSubmitting}
                    className="primary-action px-4 py-2 text-sm font-medium disabled:opacity-50"
                  >
                    {disputeSubmitting ? 'Отправляем…' : 'Отправить'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDisputeForm(false)}
                    className="secondary-action px-4 py-2 text-sm font-medium"
                  >
                    Отмена
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </section>

      <section className="premium-panel mb-6 overflow-hidden rounded-[2rem] p-0">
        <div className="border-b border-stone-100 bg-white/74 p-5 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-brand">Панель отбора</p>
              <h2 className="mt-1 font-serif text-2xl text-stone-900">Отклики и кандидаты</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-stone-600">
                Сравните профиль, срок, бюджет и сообщение. Заказ перейдёт в работу только после действия заказчика.
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-[1.4rem] bg-card-sand/75 px-4 py-3 text-sm font-semibold text-stone-700">
              <Mascot name="search" size="h-12 w-12" />
              <div>
                <p className="text-xs uppercase tracking-wide text-stone-500">Всего кандидатов</p>
                <p className="font-serif text-2xl text-stone-950">{bids.length}</p>
              </div>
            </div>
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-4">
            {[
              ['На решении', pendingBidCount, 'bg-card-sand/80'],
              ['Выбран', selectedBidCount, 'bg-card-sage/80'],
              ['Закрыто', closedBidCount, 'bg-stone-100'],
              ['Чатов', threads.length, 'bg-card-lavender/75'],
            ].map(([label, value, tone]) => (
              <div key={label} className={`rounded-[1.25rem] px-4 py-3 ${tone}`}>
                <p className="text-[11px] font-bold uppercase tracking-wide text-stone-500">{label}</p>
                <p className="mt-1 font-serif text-2xl text-stone-950">{value}</p>
              </div>
            ))}
          </div>
        </div>
        {order.tags && order.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 border-b border-stone-100 bg-card-sand/25 px-5 py-3 md:px-6">
            {order.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-card-sand px-2.5 py-1 text-xs font-medium text-stone-700">
                {tag}
              </span>
            ))}
          </div>
        )}
        <div className="space-y-4 p-5 md:p-6">
          {bids.map((bid, index) => {
            const compatibility = compatibilityByBidId[bid.id];
            const freelancerName = bid.freelancer?.profile?.displayName ?? bid.freelancer?.email ?? 'Фрилансер';
            const avatarUrl = bid.freelancer?.profile?.avatarUrl;
            const isSelectedBid = bid.status === 'ACCEPTED' || order.acceptedBidId === bid.id;
            const canDecideBid = isClient && order.status === 'OPEN' && bid.status === 'PENDING';
            const isMutedBid = bid.status === 'REJECTED' || bid.status === 'WITHDRAWN';
            const profile = bid.freelancer?.profile;
            const skills = profile?.skills?.map(({ skill }) => skill.name).filter(Boolean).slice(0, 4) ?? [];
            const location = [profile?.city, profile?.country].filter(Boolean).join(', ');
            return (
              <article
                key={bid.id}
                className={`interactive-card overflow-hidden rounded-[2rem] border transition ${
                  isSelectedBid
                    ? 'border-emerald-300 bg-emerald-50/60'
                    : isMutedBid
                      ? 'border-stone-100 bg-stone-50/75 opacity-75'
                      : 'border-stone-100 bg-white/80'
                }`}
              >
                <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_290px]">
                  <div className="min-w-0 p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                      <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[1.5rem] border border-stone-100 bg-card-sage shadow-sm">
                        {avatarUrl ? (
                          <img
                            src={avatarUrl.startsWith('http') ? avatarUrl : `${API_URL}${avatarUrl}`}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <BidAvatarIcon className="h-14 w-14" />
                        )}
                        {isSelectedBid && (
                          <span className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm">
                            <CheckIcon className="h-3.5 w-3.5" />
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="min-w-0 break-words text-xl font-semibold leading-tight text-stone-950">{freelancerName}</p>
                              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-stone-500 shadow-sm">
                                #{index + 1}
                              </span>
                            </div>
                            <p className="mt-1 break-all text-xs text-stone-500">{bid.freelancer?.email}</p>
                            {location && <p className="mt-1 text-xs font-medium text-stone-500">{location}</p>}
                          </div>
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              isSelectedBid
                                ? 'bg-emerald-100 text-emerald-700'
                                : bid.status === 'PENDING'
                                  ? 'bg-card-sand text-stone-700'
                                  : 'bg-stone-100 text-stone-500'
                            }`}
                          >
                            {BID_STATUS_LABELS[bid.status] ?? bid.status}
                          </span>
                        </div>
                        <div className="mt-4 grid gap-2 sm:grid-cols-3">
                          <div className="rounded-[1.15rem] bg-white/75 px-3 py-2 shadow-sm">
                            <p className="text-[11px] font-bold uppercase tracking-wide text-stone-400">Срок</p>
                            <p className="mt-1 text-sm font-semibold text-stone-900">{bid.deliveryDays} дн.</p>
                          </div>
                          <div className="rounded-[1.15rem] bg-white/75 px-3 py-2 shadow-sm">
                            <p className="text-[11px] font-bold uppercase tracking-wide text-stone-400">Сумма</p>
                            <p className="mt-1 text-sm font-semibold text-stone-900">{money(bid.amount, order.currency)}</p>
                          </div>
                          <div
                            className={`rounded-[1.15rem] px-3 py-2 shadow-sm ${
                              compatibility == null
                                ? 'bg-white/75'
                                : compatibility >= 70
                                  ? 'bg-card-sage/85'
                                  : compatibility >= 40
                                    ? 'bg-card-sand/85'
                                    : 'bg-stone-100'
                            }`}
                          >
                            <p className="text-[11px] font-bold uppercase tracking-wide text-stone-400">Совпадение</p>
                            <p className="mt-1 text-sm font-semibold text-stone-900">{compatibility != null ? `${compatibility}%` : 'Ждём'}</p>
                          </div>
                        </div>
                        {skills.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {skills.map((skill) => (
                              <span key={skill} className="rounded-full bg-card-sand/75 px-2.5 py-1 text-xs font-medium text-stone-700">
                                {skill}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="mt-4 rounded-[1.4rem] border border-stone-100 bg-white/72 p-4">
                          <p className="text-xs font-semibold uppercase text-stone-400">Сообщение к заказу</p>
                          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-stone-700">
                            {bid.message || 'Фрилансер пока не добавил сопроводительное сообщение.'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <aside className="flex min-h-full flex-col justify-between gap-4 border-t border-stone-100 bg-stone-50/65 p-5 xl:border-l xl:border-t-0">
                    {isSelectedBid ? (
                      <p className="rounded-[1.25rem] bg-emerald-100 px-3 py-2 text-sm font-semibold text-emerald-700">
                        Исполнитель выбран. Рабочий чат уже доступен.
                      </p>
                    ) : canDecideBid ? (
                      <p className="rounded-[1.25rem] bg-card-sand/80 px-3 py-2 text-sm text-stone-700">
                        Можно открыть профиль, уточнить детали в чате или сразу дать задачу.
                      </p>
                    ) : (
                      <p className="rounded-[1.25rem] bg-stone-100 px-3 py-2 text-sm text-stone-500">
                        Действия по этому отклику сейчас недоступны.
                      </p>
                    )}

                    <div className="grid gap-2">
                      <Link href={`/freelancers/${bid.freelancerId}`} className="secondary-action justify-center px-4 py-2 text-sm font-semibold">
                        Посмотреть профиль
                      </Link>
                      {isClient && bid.status === 'PENDING' && (
                        <Link
                          href={`/chats?orderId=${order.id}&freelancerId=${bid.freelancerId}`}
                          className="secondary-action justify-center px-4 py-2 text-sm font-semibold"
                        >
                          Открыть чат
                        </Link>
                      )}
                      {isClient && isSelectedBid && (
                        <Link
                          href={`/chats?orderId=${order.id}&freelancerId=${bid.freelancerId}`}
                          className="primary-action justify-center px-4 py-2 text-sm font-semibold"
                        >
                          Открыть чат
                        </Link>
                      )}
                      {canDecideBid && (
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                          <button
                            type="button"
                            onClick={() => setHireConfirmBidId(bid.id)}
                            disabled={bidActionId === `hire-${bid.id}`}
                            className="primary-action justify-center px-4 py-2 text-sm font-semibold disabled:opacity-50"
                          >
                            {bidActionId === `hire-${bid.id}` ? 'Выбираем…' : 'Дать таск'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeclineConfirmBidId(bid.id)}
                            disabled={bidActionId === `decline-${bid.id}`}
                            className="secondary-action justify-center px-4 py-2 text-sm font-semibold disabled:opacity-50"
                          >
                            {bidActionId === `decline-${bid.id}` ? 'Отклоняем…' : 'Отклонить'}
                          </button>
                        </div>
                      )}
                    </div>
                  </aside>
                </div>
              </article>
            );
          })}
          {bids.length === 0 && (
            <div className="rounded-[1.8rem] border border-dashed border-stone-200 bg-white/70 p-6">
              <EmptyState icon={<MatchIcon />} title="Откликов пока нет" description="Когда фрилансеры отправят предложения, здесь появится панель сравнения и быстрые действия." />
            </div>
          )}
        </div>
      </section>

      {hasAcceptedBid && (
        <section className="premium-panel mb-6 p-5">
          <h2 className="mb-4 font-serif text-xl text-stone-900">Этапы и сдача работы</h2>

          {hasMilestones ? (
            <div className="space-y-3">
              {milestones.map((milestone) => (
                <div key={milestone.id} className="interactive-card rounded-[1.5rem] p-4">
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
                        className="primary-action px-3 py-1.5 text-sm font-medium"
                      >
                        Сдать этап
                      </button>
                    )}
                    {isClient && milestone.status === 'DELIVERED' && (
                      <button
                        type="button"
                        onClick={() => setApproveConfirmTarget(milestone.id)}
                        disabled={busyAction === `approve-${milestone.id}`}
                        className="primary-action px-3 py-1.5 text-sm font-medium disabled:opacity-50"
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
            <div className="rounded-2xl border border-stone-100 bg-stone-50/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-stone-600">Этапы не заведены — работа сдаётся заказом целиком.</p>
                <div className="flex gap-2">
                  {isFreelancer && order.status === 'IN_PROGRESS' && (
                    <button
                      type="button"
                      onClick={() => openDeliverForm('order')}
                      className="primary-action px-3 py-1.5 text-sm font-medium"
                    >
                      Сдать работу
                    </button>
                  )}
                  {isClient && order.status === 'IN_REVIEW' && (
                    <button
                      type="button"
                      onClick={() => setApproveConfirmTarget('order')}
                      disabled={busyAction === 'approve-order'}
                      className="primary-action px-3 py-1.5 text-sm font-medium disabled:opacity-50"
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
                  className="field-surface min-w-0 flex-1 px-3 py-2 text-sm"
                />
                <input
                  required
                  type="number"
                  min="1"
                  placeholder="Сумма"
                  value={milestoneForm.amount}
                  onChange={(e) => setMilestoneForm((f) => ({ ...f, amount: e.target.value }))}
                  className="field-surface w-28 px-3 py-2 text-sm"
                />
                <input
                  type="date"
                  value={milestoneForm.dueDate}
                  onChange={(e) => setMilestoneForm((f) => ({ ...f, dueDate: e.target.value }))}
                  className="field-surface px-3 py-2 text-sm"
                />
                <button type="submit" className="secondary-action px-3 py-2 text-sm font-medium">
                  Создать
                </button>
              </form>
            </details>
          )}

          {order.status === 'COMPLETED' && !reviewSubmitted && (isClient || isFreelancer) && (
            <div className="mt-6 rounded-2xl border border-stone-100 bg-stone-50/70 p-4">
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
                  className="field-surface min-h-20 w-full px-3 py-2 text-sm"
                />
                <button type="submit" className="primary-action px-4 py-2 text-sm font-medium">
                  Отправить отзыв
                </button>
              </form>
            </div>
          )}
          {reviewSubmitted && (
            <div className="mt-6 flex items-center gap-3 rounded-2xl bg-emerald-50 px-4 py-3">
              <Mascot name="successConfetti" size="h-12 w-12" />
              <p className="text-sm font-medium text-emerald-700">Спасибо за отзыв! Заказ закрыт.</p>
            </div>
          )}

          {order.status === 'COMPLETED' && isClient && acceptedBid?.freelancer?.profile?.skills && acceptedBid.freelancer.profile.skills.length > 0 && (
            <div className="mt-6 rounded-2xl border border-stone-100 bg-stone-50/70 p-4">
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

      {(isClient || isFreelancer) && (
        <section id="payment-history" className="premium-panel mb-6 scroll-mt-24 overflow-hidden rounded-[2rem] p-0">
          <div className="border-b border-stone-100 bg-white/74 p-5 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">История платежей</p>
                <h2 className="mt-1 font-serif text-2xl text-stone-900">Счета и чеки заказа</h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-stone-600">
                  Все счета и чеки заказа собраны здесь: можно проверить статус, скопировать реквизиты и открыть оплату.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void Promise.all([refreshOrder(), refreshOrderInvoices()])}
                  className="secondary-action px-3 py-2 text-sm font-semibold"
                >
                  Обновить статус
                </button>
                <button type="button" onClick={exportOrderInvoices} className="secondary-action px-3 py-2 text-sm font-semibold">
                  Экспорт CSV
                </button>
              </div>
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-3">
              {[
                ['Всего', orderInvoices.length, 'bg-card-sand/80'],
                ['Ожидают', pendingInvoiceCount, 'bg-card-lavender/75'],
                ['Чеки', paidInvoiceCount, 'bg-card-sage/80'],
              ].map(([label, value, tone]) => (
                <div key={label} className={`rounded-[1.25rem] px-4 py-3 ${tone}`}>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-stone-500">{label}</p>
                  <p className="mt-1 font-serif text-2xl text-stone-950">{value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 p-5 md:p-6">
            {orderInvoices.map((invoice) => {
              const pending = invoice.status === 'PENDING';
              const paid = invoice.status === 'PAID';
              const payLine = invoice.payAddress ? `${invoice.payAmount ?? invoice.amount} ${invoice.payCurrency ?? invoice.currency}` : null;
              const documentId = `TH-${invoice.id.slice(0, 8).toUpperCase()}`;
              return (
                <article key={invoice.id} className="interactive-card rounded-[1.7rem] border border-stone-100 bg-white/78 p-4">
                  <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold ${
                            paid ? 'bg-emerald-100 text-emerald-700' : pending ? 'bg-card-sand text-stone-700' : 'bg-stone-100 text-stone-500'
                          }`}
                        >
                          {paid ? 'Чек принят системой' : pending ? 'Ожидает оплату' : 'Закрыт'}
                        </span>
                        {invoice.createdAt && (
                          <span className="text-xs font-medium text-stone-400">
                            {new Date(invoice.createdAt).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}
                          </span>
                        )}
                      </div>
                      <p className="mt-2 font-serif text-2xl text-stone-950">{money(invoice.amount, invoice.currency)}</p>
                      {invoice.description && <p className="mt-1 break-words text-sm leading-6 text-stone-600">{invoice.description}</p>}
                      {invoice.milestone?.title && (
                        <p className="mt-2 inline-flex rounded-full bg-card-lavender/75 px-3 py-1 text-xs font-bold text-stone-600">
                          Этап: {invoice.milestone.title}
                        </p>
                      )}
                      <div className="mt-3 grid gap-2 text-xs text-stone-500 sm:grid-cols-2">
                        <InvoiceCopyBox
                          label="Документ"
                          value={documentId}
                          copied={copiedInvoiceField === `${invoice.id}:document`}
                          onCopy={() => copyInvoiceValue(invoice.id, 'document', documentId)}
                        />
                        <InvoiceCopyBox
                          label="Сумма"
                          value={money(invoice.amount, invoice.currency)}
                          copied={copiedInvoiceField === `${invoice.id}:amount`}
                          onCopy={() => copyInvoiceValue(invoice.id, 'amount', `${invoice.amount} ${invoice.currency}`)}
                        />
                        <InvoiceCopyBox
                          label="К оплате"
                          value={payLine ?? 'Реквизиты появятся после создания платежа'}
                          copied={copiedInvoiceField === `${invoice.id}:pay-amount`}
                          onCopy={payLine ? () => copyInvoiceValue(invoice.id, 'pay-amount', payLine) : undefined}
                        />
                        <InvoiceCopyBox
                          label="Сеть"
                          value={invoice.paymentNetwork ?? 'Сеть появится вместе с реквизитами'}
                          copied={copiedInvoiceField === `${invoice.id}:network`}
                          onCopy={invoice.paymentNetwork ? () => copyInvoiceValue(invoice.id, 'network', invoice.paymentNetwork ?? '') : undefined}
                        />
                        <InvoiceCopyBox
                          label="Адрес"
                          value={invoice.payAddress ?? 'Адрес появится после создания платежа'}
                          copied={copiedInvoiceField === `${invoice.id}:address`}
                          onCopy={invoice.payAddress ? () => copyInvoiceValue(invoice.id, 'address', invoice.payAddress ?? '') : undefined}
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      {pending && isClient && (
                        <button type="button" onClick={() => openPaymentConfirm(invoice)} className="primary-action px-4 py-2 text-sm font-semibold">
                          Оплатить
                        </button>
                      )}
                      <Link
                        href={`/chats?orderId=${orderId}${chatFreelancerId ? `&freelancerId=${chatFreelancerId}` : ''}`}
                        className="secondary-action px-4 py-2 text-sm font-semibold"
                      >
                        Открыть в чате
                      </Link>
                      <button type="button" onClick={() => void downloadInvoicePdf(invoice)} className="secondary-action px-4 py-2 text-sm font-semibold">
                        {paid ? 'PDF-чек' : 'PDF-счёт'}
                      </button>
                      <span className="rounded-full bg-stone-100 px-3 py-2 text-xs font-medium text-stone-500">
                        Статус обновляется автоматически
                      </span>
                    </div>
                  </div>
                </article>
              );
            })}

            {orderInvoices.length === 0 && (
              <EmptyState
                icon={<BalanceMainIcon />}
                title="Счетов и чеков по заказу пока нет"
                description={isFreelancer ? 'Выставьте первый счёт из чата, и он появится в истории платежей.' : 'Когда исполнитель выставит счёт, здесь появятся реквизиты и дальнейший чек оплаты.'}
              />
            )}
          </div>
        </section>
      )}

      {canChat && (
        <section className="premium-panel flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex items-center gap-3">
            <ChatIcon className="h-8 w-8" />
            <div>
              <h2 className="font-serif text-xl text-stone-900">Чат заказа</h2>
              <p className="mt-1 text-sm text-stone-500">
                {threads.length > 0
                  ? `Переписка (${threads.length}) теперь на одной странице со всеми вашими чатами — сообщения, счета и файлы приходят туда вживую.`
                  : 'Напишите первым — переписка и выставление счетов теперь в одном месте со всеми вашими чатами.'}
              </p>
            </div>
          </div>
          <Link
            href={`/chats?orderId=${orderId}${chatFreelancerId ? `&freelancerId=${chatFreelancerId}` : ''}`}
            className="primary-action shrink-0 px-5 py-3 text-sm"
          >
            Открыть чат
          </Link>
        </section>
      )}

      <ConfirmDialog
        open={Boolean(hireConfirmBid)}
        title="Дать таск этому исполнителю?"
        description={
          hireConfirmBid
            ? `Вы выбираете ${hireConfirmBid.freelancer?.profile?.displayName ?? hireConfirmBid.freelancer?.email ?? 'исполнителя'} на сумму ${money(
                hireConfirmBid.amount,
                order.currency,
              )}. Заказ перейдёт в работу, а остальные ожидающие отклики будут закрыты.`
            : ''
        }
        confirmLabel="Дать таск"
        busy={Boolean(hireConfirmBidId && bidActionId === `hire-${hireConfirmBidId}`)}
        onCancel={() => setHireConfirmBidId(null)}
        onConfirm={() => {
          if (hireConfirmBidId) void hireBid(hireConfirmBidId);
        }}
      />
      <ConfirmDialog
        open={Boolean(declineConfirmBid)}
        title="Отклонить отклик?"
        description={
          declineConfirmBid
            ? `Отклик от ${declineConfirmBid.freelancer?.profile?.displayName ?? declineConfirmBid.freelancer?.email ?? 'исполнителя'} будет закрыт. Исполнитель получит понятный статус и не будет ждать решения по этому предложению.`
            : ''
        }
        confirmLabel="Отклонить"
        busy={Boolean(declineConfirmBidId && bidActionId === `decline-${declineConfirmBidId}`)}
        onCancel={() => setDeclineConfirmBidId(null)}
        onConfirm={() => {
          if (declineConfirmBidId) void declineBid(declineConfirmBidId);
        }}
      />
      <ConfirmDialog
        open={Boolean(approveConfirmTarget)}
        title="Принять работу и отпустить оплату?"
        description={
          approveConfirmTarget === 'order'
            ? `Вы принимаете результат по заказу и отпускаете оплату исполнителю: ${money(order.budgetMin, order.currency)}. После этого заказ станет завершённым.`
            : approveConfirmMilestone
              ? `Вы принимаете этап «${approveConfirmMilestone.title}» и отпускаете исполнителю ${money(
                  approveConfirmMilestone.amount,
                  order.currency,
                )}. Это действие меняет финансовый статус этапа.`
              : ''
        }
        confirmLabel="Принять и оплатить"
        busy={Boolean(approveConfirmTarget && busyAction === `approve-${approveConfirmTarget}`)}
        onCancel={() => setApproveConfirmTarget(null)}
        onConfirm={() => {
          if (approveConfirmTarget) void approve(approveConfirmTarget);
        }}
      />
      <ConfirmDialog
        open={Boolean(paymentConfirmInvoice)}
        title="Перейти к оплате счёта?"
        description={<PaymentConfirmDetails invoice={paymentConfirmInvoice} loading={paymentDetailsLoading} />}
        confirmLabel={paymentDetailsLoading ? 'Загружаем' : 'Готово'}
        busy={paymentDetailsLoading}
        onCancel={() => setPaymentConfirmInvoice(null)}
        onConfirm={() => setPaymentConfirmInvoice(null)}
      />

      {similarOrders.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 font-serif text-lg text-stone-900">Похожие заказы</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {similarOrders.map((similar) => (
              <Link
                key={similar.id}
                href={`/orders/${similar.id}`}
                className="interactive-card rounded-2xl p-4"
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

function InvoiceCopyBox({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy?: () => void;
}) {
  return (
    <div className="rounded-[1rem] bg-stone-50 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold uppercase tracking-[0.12em] text-stone-400">{label}</span>
        {onCopy && (
          <button type="button" onClick={onCopy} className="shrink-0 font-semibold text-brand hover:text-brand-dark">
            {copied ? 'Скопировано' : 'Копировать'}
          </button>
        )}
      </div>
      <p className="mt-1 break-all font-mono text-stone-600">{value}</p>
    </div>
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
    <form onSubmit={onSubmit} className="mt-3 space-y-3 rounded-2xl bg-stone-50 p-3">
      <textarea
        required
        placeholder="Что сделано"
        value={description}
        onChange={(e) => onDescriptionChange(e.target.value)}
        className="field-surface min-h-20 w-full px-3 py-2 text-sm"
      />
      <textarea
        placeholder="Заметки (необязательно)"
        value={notes}
        onChange={(e) => onNotesChange(e.target.value)}
        className="field-surface min-h-16 w-full px-3 py-2 text-sm"
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
          className="primary-action px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {busy ? 'Отправляем…' : 'Отправить на проверку'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="secondary-action px-4 py-2 text-sm font-medium"
        >
          Отмена
        </button>
      </div>
    </form>
  );
}
