import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FEED_WEIGHTS, FREELANCER_DIRECTORY_WEIGHTS, ORDER_RECOMMEND_WEIGHTS } from './matching.weights';

function ageInHours(date: Date, now: Date): number {
  return Math.max(0, (now.getTime() - date.getTime()) / (1000 * 60 * 60));
}

function decayScore(maxPoints: number, ageHours: number, halfLifeHours: number): number {
  return maxPoints * Math.pow(0.5, ageHours / halfLifeHours);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * % совпадения тэгов/стека заказа с навыками фрилансера — только
 * отображаемая метрика для пользователя, в сам `matchScore` не входит
 * (ранжирование по-прежнему только по откалиброванным весам ниже).
 */
export function compatibilityPercent(orderTags: string[], freelancerSkillNames: string[]): number | null {
  if (orderTags.length === 0) return null;
  const skillSet = new Set(freelancerSkillNames.map((s) => s.trim().toLowerCase()));
  const matched = orderTags.filter((t) => skillSet.has(t.trim().toLowerCase())).length;
  return Math.round((matched / orderTags.length) * 100);
}

interface FeedOrderInput {
  id: string;
  createdAt: Date;
  deadline: Date | null;
  budgetMax: unknown;
  status?: string;
  isPromoted: boolean;
}

interface FreelancerCandidateInput {
  id: string;
  profile: {
    successRate: unknown;
    completionRate: unknown;
    avgResponseMins: number | null;
    disputesCount: number;
    lateDeliveries: number;
  } | null;
  subscriptionTier: string;
}

interface OrderRecommendInput {
  id: string;
  createdAt: Date;
  deadline: Date | null;
  categoryId: string;
  budgetMin: unknown;
  budgetMax: unknown;
  tags: string[];
}

@Injectable()
export class MatchingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ранжирование ленты заказов (`GET /orders`). Публичная лента без
   * привязки к конкретному пользователю — сигналы только объективные:
   * свежесть (экспоненциальный распад), срочность по дедлайну, качество
   * заполнения (указан ли budgetMax) и платное продвижение с потолком
   * вклада (см. matching.weights.ts).
   */
  rankOrdersForFeed<T extends FeedOrderInput>(orders: T[], now: Date = new Date()): (T & { matchScore: number; matchReasons: string[] })[] {
    const w = FEED_WEIGHTS;

    const scored = orders.map((order) => {
      const reasons: string[] = [];
      let score = w.base;

      const recency = decayScore(w.recencyMaxPoints, ageInHours(order.createdAt, now), w.recencyHalfLifeHours);
      score += recency;
      if (recency >= w.recencyMaxPoints * 0.6) reasons.push('Свежий заказ');

      if (order.deadline) {
        const hoursLeft = (order.deadline.getTime() - now.getTime()) / (1000 * 60 * 60);
        if (hoursLeft > 0 && hoursLeft <= w.urgencyWindowHours) {
          const urgency = w.urgencyMaxPoints * (1 - hoursLeft / w.urgencyWindowHours);
          score += urgency;
          if (urgency >= w.urgencyMaxPoints * 0.5) reasons.push('Скоро дедлайн');
        }
      }

      if (order.budgetMax !== null && order.budgetMax !== undefined) {
        score += w.definedBudgetMaxPoints;
      }

      if (order.isPromoted) {
        score += w.promotionBoostMax;
        reasons.push('Продвигается');
      }

      return { ...order, matchScore: Math.round(score * 100) / 100, matchReasons: reasons };
    });

    scored.sort((a, b) => b.matchScore - a.matchScore || b.createdAt.getTime() - a.createdAt.getTime());
    return scored;
  }

  /**
   * Ранжирование каталога фрилансеров (`GET /freelancers`) и (с переданной
   * `categoryAffinity`) сортировка откликов на конкретный заказ. Пустой/
   * отсутствующий послужной список (новый фрилансер) намеренно получает
   * нейтральный (половинный) балл за рейтинг/скорость ответа, а не ноль —
   * иначе новые аккаунты никогда не попадали бы в топ и маркетплейс терял
   * бы приток исполнителей.
   */
  rankFreelancers<T extends FreelancerCandidateInput>(
    candidates: T[],
    categoryAffinity?: Map<string, number>,
  ): (T & { matchScore: number; matchReasons: string[] })[] {
    const w = FREELANCER_DIRECTORY_WEIGHTS;

    const scored = candidates.map((candidate) => {
      const reasons: string[] = [];
      let score = w.base;

      const successRate = candidate.profile?.successRate != null ? Number(candidate.profile.successRate) : null;
      const ratingPoints = successRate !== null ? w.ratingMaxPoints * clamp(successRate / 100, 0, 1) : w.ratingMaxPoints * 0.5;
      score += ratingPoints;
      if (successRate !== null && successRate >= 90) reasons.push('Высокий процент успешных сделок');

      const completionRate = candidate.profile?.completionRate != null ? Number(candidate.profile.completionRate) : null;
      score += completionRate !== null ? w.completionRateMaxPoints * clamp(completionRate / 100, 0, 1) : w.completionRateMaxPoints * 0.5;

      const avgResponseMins = candidate.profile?.avgResponseMins ?? null;
      if (avgResponseMins !== null) {
        const responseFraction = clamp(
          1 - (avgResponseMins - w.responseTimeFullCreditMinutes) / (w.responseTimeZeroCreditMinutes - w.responseTimeFullCreditMinutes),
          0,
          1,
        );
        const responsePoints = w.responseTimeMaxPoints * responseFraction;
        score += responsePoints;
        if (responsePoints >= w.responseTimeMaxPoints * 0.8) reasons.push('Быстро отвечает');
      } else {
        score += w.responseTimeMaxPoints * 0.5;
      }

      const disputesCount = candidate.profile?.disputesCount ?? 0;
      if (disputesCount > 0) {
        score -= Math.min(w.disputePenaltyMax, disputesCount * w.disputePenaltyPerIncident);
      }

      const lateDeliveries = candidate.profile?.lateDeliveries ?? 0;
      if (lateDeliveries > 0) {
        score -= Math.min(w.lateDeliveryPenaltyMax, lateDeliveries * w.lateDeliveryPenaltyPerIncident);
      }

      const subscriptionBoost = w.subscriptionBoost[candidate.subscriptionTier] ?? 0;
      score += subscriptionBoost;
      if (subscriptionBoost > 0) reasons.push(`Активная подписка ${candidate.subscriptionTier}`);

      if (categoryAffinity) {
        const affinity = categoryAffinity.get(candidate.id) ?? 0;
        score += affinity;
        if (affinity >= w.categoryAffinityMaxPoints * 0.5) reasons.push('Уже успешно работал в этой категории');
      }

      return { ...candidate, matchScore: Math.round(score * 100) / 100, matchReasons: reasons };
    });

    scored.sort((a, b) => b.matchScore - a.matchScore);
    return scored;
  }

  /**
   * Персональная лента заказов для фрилансера (`GET /freelancers/me/recommended-orders`).
   * Категорийная близость считается по истории его ПРИНЯТЫХ бидов — чем
   * больше доля принятых бидов в категории, тем выше сродство. У новых
   * фрилансеров (нет принятых бидов) истории нет — все категории
   * получают affinity 0, это осознанный fallback: лента не пустеет для
   * новичков, она просто не персонализирована по категориям (остальные
   * сигналы — свежесть/срочность/rate-fit — продолжают работать).
   */
  async recommendOrdersForFreelancer(freelancerId: string, limit = 20) {
    const w = ORDER_RECOMMEND_WEIGHTS;
    const now = new Date();

    const [acceptedBids, onboarding, openOrders, profile] = await Promise.all([
      this.prisma.bid.findMany({
        where: { freelancerId, status: 'ACCEPTED' },
        include: { order: { select: { categoryId: true } } },
      }),
      this.prisma.onboardingResponse.findUnique({ where: { userId: freelancerId } }),
      this.prisma.order.findMany({
        where: { status: 'OPEN', clientId: { not: freelancerId } },
        include: { category: true, _count: { select: { bids: true } } },
        orderBy: { createdAt: 'desc' },
        take: 200, // скорим последние 200 открытых заказов, не всю таблицу целиком
      }),
      this.prisma.profile.findUnique({
        where: { userId: freelancerId },
        include: { skills: { include: { skill: true } } },
      }),
    ]);

    const skillNames = profile?.skills?.map((s) => s.skill.name) ?? [];

    const categoryCounts = new Map<string, number>();
    for (const bid of acceptedBids) {
      const catId = bid.order.categoryId;
      categoryCounts.set(catId, (categoryCounts.get(catId) ?? 0) + 1);
    }
    const totalAccepted = acceptedBids.length;

    const expectedRateMin = onboarding?.expectedRateMin != null ? Number(onboarding.expectedRateMin) : null;

    const scored = (openOrders as OrderRecommendInput[]).map((order) => {
      const reasons: string[] = [];
      let score = w.base;

      if (totalAccepted > 0) {
        const share = (categoryCounts.get(order.categoryId) ?? 0) / totalAccepted;
        const affinity = w.categoryAffinityMaxPoints * share;
        score += affinity;
        if (affinity >= w.categoryAffinityMaxPoints * 0.3) reasons.push('Категория, в которой вы уже успешно работали');
      }

      if (expectedRateMin !== null) {
        const budgetMin = Number(order.budgetMin);
        const budgetMax = order.budgetMax != null ? Number(order.budgetMax) : budgetMin;
        if (expectedRateMin <= budgetMax && expectedRateMin >= budgetMin * 0.5) {
          score += w.rateFitMaxPoints;
          reasons.push('Бюджет соответствует вашей ставке');
        }
      }

      const recency = decayScore(w.recencyMaxPoints, ageInHours(order.createdAt, now), FEED_WEIGHTS.recencyHalfLifeHours);
      score += recency;

      if (order.deadline) {
        const hoursLeft = (order.deadline.getTime() - now.getTime()) / (1000 * 60 * 60);
        if (hoursLeft > 0 && hoursLeft <= FEED_WEIGHTS.urgencyWindowHours) {
          score += w.urgencyMaxPoints * (1 - hoursLeft / FEED_WEIGHTS.urgencyWindowHours);
          reasons.push('Скоро дедлайн');
        }
      }

      return {
        ...order,
        matchScore: Math.round(score * 100) / 100,
        matchReasons: reasons,
        compatibilityPercent: compatibilityPercent(order.tags ?? [], skillNames),
      };
    });

    scored.sort((a, b) => b.matchScore - a.matchScore);
    return scored.slice(0, limit);
  }

  /**
   * Ранжирование откликов на заказ для заказчика (`GET /orders/:id/recommended-freelancers`)
   * — аналог "Best Match" сортировки предложений на Upwork. Ранжируются
   * уже поданные биды (не весь каталог фрилансеров — приглашать
   * незаявившихся мы не умеем, инвайт-механики нет), скоринг переиспользует
   * `rankFreelancers` с добавленной категорийной близостью по истории
   * фрилансера + учитывает конкурентность цены бида относительно бюджета.
   */
  async rankBidsForOrder(orderId: string) {
    const order = await this.prisma.order.findUniqueOrThrow({ where: { id: orderId } });

    const bids = await this.prisma.bid.findMany({
      where: { orderId, status: 'PENDING' },
      include: {
        freelancer: {
          include: {
            profile: { include: { skills: { include: { skill: true } } } },
            subscription: { include: { tier: true } },
          },
        },
      },
    });

    const now = new Date();
    const activeBids = bids.filter((b) => {
      const v = b.freelancer.profile?.vacationUntil;
      return !v || v <= now;
    });
    const freelancerIds = activeBids.map((b) => b.freelancerId);
    const acceptedBids = freelancerIds.length
      ? await this.prisma.bid.findMany({
          where: { freelancerId: { in: freelancerIds }, status: 'ACCEPTED' },
          include: { order: { select: { categoryId: true } } },
        })
      : [];

    const affinity = new Map<string, number>();
    const perFreelancerAccepted = new Map<string, { total: number; sameCategory: number }>();
    for (const bid of acceptedBids) {
      const entry = perFreelancerAccepted.get(bid.freelancerId) ?? { total: 0, sameCategory: 0 };
      entry.total += 1;
      if (bid.order.categoryId === order.categoryId) entry.sameCategory += 1;
      perFreelancerAccepted.set(bid.freelancerId, entry);
    }
    for (const [freelancerId, entry] of perFreelancerAccepted) {
      affinity.set(freelancerId, FREELANCER_DIRECTORY_WEIGHTS.categoryAffinityMaxPoints * (entry.sameCategory / entry.total));
    }

    const candidates = activeBids.map((bid) => {
      const activeSub = bid.freelancer.subscription;
      const isActiveSub = activeSub?.status === 'ACTIVE' && activeSub.expiresAt > now;
      const skillNames = bid.freelancer.profile?.skills?.map((s) => s.skill.name) ?? [];
      return {
        id: bid.freelancerId,
        bidId: bid.id,
        bidAmount: Number(bid.amount),
        deliveryDays: bid.deliveryDays,
        compatibilityPercent: compatibilityPercent(order.tags ?? [], skillNames),
        profile: bid.freelancer.profile
          ? {
              successRate: bid.freelancer.profile.successRate,
              completionRate: bid.freelancer.profile.completionRate,
              avgResponseMins: bid.freelancer.profile.avgResponseMins,
              disputesCount: bid.freelancer.profile.disputesCount,
              lateDeliveries: bid.freelancer.profile.lateDeliveries,
              displayName: bid.freelancer.profile.displayName,
            }
          : null,
        subscriptionTier: isActiveSub ? activeSub!.tier.name : 'STARTER',
      };
    });

    const ranked = this.rankFreelancers(candidates, affinity);

    // Небольшая корректировка по цене бида относительно бюджета заказа —
    // это свойство конкретного бида, не фрилансера, поэтому считается
    // отдельно от rankFreelancers (тот скорит кандидата, а не предложение).
    const budgetMin = Number(order.budgetMin);
    const budgetMax = order.budgetMax != null ? Number(order.budgetMax) : budgetMin * 1.5;
    for (const candidate of ranked) {
      if (candidate.bidAmount <= budgetMax) {
        const priceFitBonus = candidate.bidAmount <= budgetMin ? 8 : 4;
        candidate.matchScore = Math.round((candidate.matchScore + priceFitBonus) * 100) / 100;
        candidate.matchReasons.push('Цена в рамках бюджета');
      }
    }

    ranked.sort((a, b) => b.matchScore - a.matchScore);
    return ranked;
  }
}
