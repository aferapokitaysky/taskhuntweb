import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { MatchingService } from '../matching/matching.service';
import { sanitizeUser } from '../../common/utils/sanitize-user';
import { OnboardingDto } from './dto/onboarding.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CreatePortfolioItemDto } from './dto/create-portfolio-item.dto';
import { UpdatePortfolioItemDto } from './dto/update-portfolio-item.dto';
import { CreateBidTemplateDto } from './dto/create-bid-template.dto';
import { UpdateBidTemplateDto } from './dto/update-bid-template.dto';

const MAX_SKILLS_PER_PROFILE = 25;
const MAX_BID_TEMPLATES = 10;
const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2MB — этого достаточно для фото профиля
const ALLOWED_AVATAR_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

type FreelancerLevel = 'TOP_RATED' | 'RISING_TALENT' | 'NEW';

// Чистая презентационная метрика поверх Profile.successRate — считается
// на лету, не хранится, чтобы не рассинхронизироваться с исходными
// данными (см. TZ_CLAUDE_13.md, п.3). completedOrders — число заказов,
// где этот юзер был принятым фрилансером и заказ дошёл до COMPLETED.
function computeFreelancerLevel(completedOrders: number, successRate: Prisma.Decimal | number | null): FreelancerLevel {
  const rate = successRate === null ? 0 : Number(successRate);
  if (completedOrders >= 10 && rate >= 95) return 'TOP_RATED';
  if (completedOrders >= 3 && rate >= 90) return 'RISING_TALENT';
  return 'NEW';
}

// Сверяем реальные magic bytes, а не только Content-Type из запроса —
// иначе можно было бы залить произвольный файл с подделанным заголовком
// и получить его назад с Content-Type: image/... на публичном /avatar.
function sniffImageMimeType(buffer: Buffer): string | null {
  if (buffer.length < 4) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return 'image/png';
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) return 'image/gif';
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    return 'image/webp';
  }
  return null;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly matching: MatchingService,
  ) {}

  /**
   * CodexTZ 020 / CODEX_CLAUDE_SYNC.md — процент заполненности профиля,
   * зависит от роли (клиент/фрилансер собирают разные поля). Возвращает
   * ближайшее недостающее поле как nextAction, чтобы фронт мог показать
   * одну конкретную подсказку, а не список из десяти пунктов сразу.
   */
  async getCompleteness(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: { include: { skills: true, portfolioItems: true } },
        onboarding: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');

    const isClient = user.primaryRole === 'CLIENT';
    const profile = user.profile;
    const onboarding = user.onboarding;

    const checklist = isClient
      ? [
          { done: Boolean(profile?.bio), field: 'bio', label: 'Расскажите о компании или о себе', action: 'Заполните описание в профиле' },
          {
            done: Boolean(onboarding?.interestedCategoryIds?.length),
            field: 'categories',
            label: 'Интересующие категории заказов',
            action: 'Отметьте категории, с которыми обычно работаете',
          },
          {
            done: onboarding?.expectedBudgetMin != null,
            field: 'budget',
            label: 'Типичный бюджет заказа',
            action: 'Укажите примерный бюджет — так фрилансеры лучше поймут ваши заказы',
          },
          {
            done: await this.prisma.invoice.count({ where: { payerId: userId, status: 'PAID' } }).then((n) => n > 0),
            field: 'payment',
            label: 'Готовность к оплате',
            action: 'Пополните кошелёк или оплатите первый счёт',
          },
        ]
      : [
          { done: Boolean(profile?.bio), field: 'headline', label: 'Заголовок/описание профиля', action: 'Опишите себя в двух предложениях' },
          {
            done: Boolean(profile?.skills?.length),
            field: 'skills',
            label: 'Навыки',
            action: 'Добавьте навыки — по ним вас находят заказчики',
          },
          {
            done: onboarding?.expectedRateMin != null,
            field: 'rate',
            label: 'Ожидаемая ставка',
            action: 'Укажите ставку, чтобы попадать в подходящие по бюджету заказы',
          },
          {
            done: Boolean(onboarding?.availability),
            field: 'availability',
            label: 'Занятость',
            action: 'Укажите, сколько времени готовы уделять заказам',
          },
          {
            done: Boolean(profile?.portfolioItems?.length),
            field: 'portfolio',
            label: 'Портфолио',
            action: 'Добавьте примеры работ — это сильно повышает доверие',
          },
        ];

    const done = checklist.filter((item) => item.done);
    const missing = checklist.filter((item) => !item.done);
    const percentage = Math.round((done.length / checklist.length) * 100);

    return {
      percentage,
      role: isClient ? 'CLIENT' : 'FREELANCER',
      missingFields: missing.map((item) => ({ field: item.field, label: item.label })),
      nextAction: missing[0]?.action ?? 'Профиль полностью заполнен',
    };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: {
          include: {
            skills: { include: { skill: true } },
            portfolioItems: { orderBy: { createdAt: 'desc' } },
          },
        },
        onboarding: true,
        wallet: true,
        subscription: { include: { tier: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');

    const profile = user.profile;
    const now = new Date();

    const isAvatarDone = Boolean(profile?.avatarUrl);
    const isBioDone = Boolean(profile?.bio && profile.bio.trim().length > 0);
    const isSkillsDone = Boolean(profile?.skills && profile.skills.length > 0);
    const isLinksDone = Boolean(profile?.githubUrl || profile?.websiteUrl);
    const isLocationDone = Boolean(profile?.country && profile?.city);
    const isEmailDone = user.status === 'ACTIVE';

    let isSubDone = false;
    if (user.subscription && user.subscription.status === 'ACTIVE' && user.subscription.expiresAt > now) {
      const tierName = user.subscription.tier?.name;
      if (tierName === 'PRO' || tierName === 'PREMIUM') {
        isSubDone = true;
      }
    }

    const steps = [
      { done: isEmailDone, points: 20, label: 'Пройдите верификацию Email' },
      { done: isBioDone, points: 15, label: 'Расскажите о себе' },
      { done: isSkillsDone, points: 15, label: 'Добавьте навыки' },
      { done: isLinksDone, points: 15, label: 'Добавьте ссылки на GitHub/Портфолио' },
      { done: isLocationDone, points: 15, label: 'Укажите местоположение' },
      { done: isAvatarDone, points: 10, label: 'Добавьте фото профиля' },
      { done: isSubDone, points: 10, label: 'Оформите Pro-подписку' },
    ];

    let profileCompleteness = 0;
    const missingSteps: { label: string; points: number }[] = [];

    for (const step of steps) {
      if (step.done) {
        profileCompleteness += step.points;
      } else {
        missingSteps.push({ label: step.label, points: step.points });
      }
    }

    missingSteps.sort((a, b) => b.points - a.points);

    let freelancerLevel: FreelancerLevel | undefined;
    let completedOrders: number | undefined;
    if (user.roles.includes('FREELANCER')) {
      completedOrders = await this.prisma.bid.count({
        where: { freelancerId: userId, status: 'ACCEPTED', order: { status: 'COMPLETED' } },
      });
      freelancerLevel = computeFreelancerLevel(completedOrders, profile?.successRate ?? null);
    }

    // Никогда не отдаём секреты наружу — passwordHash/totpSecret/токены
    // верификации-сброса раньше утекали целиком через `...user` (реальный
    // баг, найден при добавлении 2FA: секрет TOTP через этот же спред
    // сделал бы саму двухфакторку бессмысленной — любой с access-токеном
    // мог бы прочитать totpSecret и сам генерировать валидные коды).
    // См. sanitizeUser — тот же баг позже нашёлся в admin.service.ts
    // (listUsers/banUser/suspendUser), поэтому список полей теперь один
    // на оба места, не дублируется руками.
    return {
      ...sanitizeUser(user),
      profileCompleteness,
      missingSteps,
      level: freelancerLevel,
      completedOrders,
    };
  }

  async getPublicProfile(id: string, viewerUserId?: string) {
    await this.recordProfileView(id, viewerUserId);

    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        profile: {
          include: {
            skills: {
              include: {
                skill: true,
              },
            },
            portfolioItems: {
              orderBy: { createdAt: 'desc' },
            },
          },
        },
        reviewsReceived: {
          where: { hiddenAt: null },
          include: {
            author: {
              include: {
                profile: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!user) throw new NotFoundException('User not found');

    const activeSub = await this.prisma.subscription.findFirst({
      where: {
        userId: id,
        status: 'ACTIVE',
        expiresAt: { gt: new Date() },
      },
      include: { tier: true },
    });

    const subscriptionTier = activeSub?.tier?.name ?? 'STARTER';

    const endorsements = await this.prisma.skillEndorsement.groupBy({
      by: ['skillId'],
      where: { targetId: id },
      _count: { _all: true },
    });
    const endorsementMap = new Map(endorsements.map((e) => [e.skillId, e._count._all]));

    const profileData = user.profile
      ? {
          displayName: user.profile.displayName,
          avatarUrl: user.profile.avatarUrl,
          bio: user.profile.bio,
          country: user.profile.country,
          city: user.profile.city,
          githubUrl: user.profile.githubUrl,
          websiteUrl: user.profile.websiteUrl,
          successRate: user.profile.successRate,
          completionRate: user.profile.completionRate,
          avgResponseMins: user.profile.avgResponseMins,
          disputesCount: user.profile.disputesCount,
          lateDeliveries: user.profile.lateDeliveries,
          viewsCount: user.profile.viewsCount,
          skills: user.profile.skills.map((s) => ({
            id: s.skill.id,
            name: s.skill.name,
            slug: s.skill.slug,
            endorsementCount: endorsementMap.get(s.skill.id) ?? 0,
          })),
          portfolioItems: user.profile.portfolioItems,
        }
      : null;

    const reviewsData = user.reviewsReceived.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt,
      author: {
        id: r.author.id,
        displayName: r.author.profile?.displayName ?? r.author.id,
      },
    }));

    const completedOrdersCount = await this.prisma.order.count({
      where: { clientId: id, status: 'COMPLETED' },
    });

    const completedAsFreelancer = await this.prisma.bid.count({
      where: { freelancerId: id, status: 'ACCEPTED', order: { status: 'COMPLETED' } },
    });

    return {
      id: user.id,
      primaryRole: user.primaryRole,
      roles: user.roles,
      verifiedPayer: completedOrdersCount > 0,
      level: computeFreelancerLevel(completedAsFreelancer, user.profile?.successRate ?? null),
      profile: profileData,
      subscriptionTier,
      reviews: reviewsData,
    };
  }

  async findFreelancers(filters: { categoryId?: string; skillId?: string; search?: string }) {
    const where: Prisma.UserWhereInput = {
      OR: [{ primaryRole: 'FREELANCER' }, { roles: { has: 'FREELANCER' } }],
    };

    if (filters.skillId) {
      where.profile = {
        skills: {
          some: { skillId: filters.skillId },
        },
      };
    }

    const now = new Date();
    const vacationWhere: Prisma.ProfileWhereInput = {
      OR: [
        { vacationUntil: null },
        { vacationUntil: { lt: now } },
      ],
    };
    where.profile = vacationWhere;

    if (filters.search) {
      const searchWhere: Prisma.ProfileWhereInput = {
        OR: [
          { displayName: { contains: filters.search, mode: 'insensitive' } },
          { bio: { contains: filters.search, mode: 'insensitive' } },
        ],
      };
      where.profile = { AND: [where.profile, searchWhere] };
    }

    const freelancers = await this.prisma.user.findMany({
      where,
      include: {
        profile: {
          include: {
            skills: {
              include: { skill: true },
            },
          },
        },
        subscription: {
          include: { tier: true },
        },
      },
    });

    const targetIds = freelancers.map((f) => f.id);
    const endorsements = targetIds.length
      ? await this.prisma.skillEndorsement.groupBy({
          by: ['targetId', 'skillId'],
          where: { targetId: { in: targetIds } },
          _count: { _all: true },
        })
      : [];
    const endorsementMap = new Map(endorsements.map((e) => [`${e.targetId}:${e.skillId}`, e._count._all]));

    // Батчем, не в цикле — один groupBy на весь список, тот же приём,
    // что уже используется для endorsements/orderCount в этом раунде.
    const completedCounts = targetIds.length
      ? await this.prisma.bid.groupBy({
          by: ['freelancerId'],
          where: { freelancerId: { in: targetIds }, status: 'ACCEPTED', order: { status: 'COMPLETED' } },
          _count: { _all: true },
        })
      : [];
    const completedCountMap = new Map(completedCounts.map((c) => [c.freelancerId, c._count._all]));

    const candidates = freelancers.map((user) => {
      const isActiveSub = user.subscription?.status === 'ACTIVE' && user.subscription.expiresAt > now;
      const tierName = isActiveSub ? user.subscription!.tier.name : 'STARTER';

      return {
        id: user.id,
        primaryRole: user.primaryRole,
        roles: user.roles,
        level: computeFreelancerLevel(completedCountMap.get(user.id) ?? 0, user.profile?.successRate ?? null),
        profile: user.profile
          ? {
              displayName: user.profile.displayName,
              avatarUrl: user.profile.avatarUrl,
              bio: user.profile.bio,
              country: user.profile.country,
              city: user.profile.city,
              availableForWork: user.profile.availableForWork,
              skills: user.profile.skills.map((s) => ({
                id: s.skill.id,
                name: s.skill.name,
                slug: s.skill.slug,
                endorsementCount: endorsementMap.get(`${user.id}:${s.skill.id}`) ?? 0,
              })),
              successRate: user.profile.successRate,
              completionRate: user.profile.completionRate,
              avgResponseMins: user.profile.avgResponseMins,
              disputesCount: user.profile.disputesCount,
              lateDeliveries: user.profile.lateDeliveries,
            }
          : null,
        subscriptionTier: tierName,
        isPremium: tierName === 'PREMIUM',
      };
    });

    return this.matching.rankFreelancers(candidates);
  }

  /** Персональная лента заказов для фрилансера — см. MatchingService.recommendOrdersForFreelancer. */
  async getRecommendedOrders(freelancerId: string, limit = 20) {
    return this.matching.recommendOrdersForFreelancer(freelancerId, limit);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const { skillIds, ...profileFields } = dto;

    if (skillIds && skillIds.length > MAX_SKILLS_PER_PROFILE) {
      throw new BadRequestException(`Можно указать не больше ${MAX_SKILLS_PER_PROFILE} навыков`);
    }

    return this.prisma.profile.update({
      where: { userId },
      data: {
        ...profileFields,
        ...(skillIds && {
          skills: {
            deleteMany: {},
            create: [...new Set(skillIds)].map((skillId) => ({ skillId })),
          },
        }),
      },
      include: { skills: { include: { skill: true } } },
    });
  }

  async uploadAvatar(userId: string, file: Express.Multer.File | undefined) {
    if (!file) throw new BadRequestException('No file provided');
    if (file.size > MAX_AVATAR_BYTES) {
      throw new BadRequestException(`Файл больше ${MAX_AVATAR_BYTES / 1024 / 1024}MB`);
    }
    const sniffed = sniffImageMimeType(file.buffer);
    if (!sniffed || !ALLOWED_AVATAR_MIME_TYPES.has(sniffed)) {
      throw new BadRequestException('Поддерживаются только изображения JPEG, PNG, GIF, WEBP');
    }

    const profile = await this.prisma.profile.update({
      where: { userId },
      data: {
        avatarData: file.buffer,
        avatarMimeType: sniffed,
        avatarUrl: `/users/${userId}/avatar`,
      },
    });

    return { avatarUrl: profile.avatarUrl };
  }

  async getAvatar(userId: string): Promise<{ data: Buffer; mimeType: string }> {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { avatarData: true, avatarMimeType: true },
    });
    if (!profile?.avatarData || !profile.avatarMimeType) {
      throw new NotFoundException('Avatar not found');
    }
    return { data: profile.avatarData, mimeType: profile.avatarMimeType };
  }

  async submitOnboarding(userId: string, dto: OnboardingDto) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    const structuredAnswers = dto.structuredAnswers as Prisma.InputJsonValue | undefined;

    const onboarding = await this.prisma.onboardingResponse.upsert({
      where: { userId },
      create: { userId, role: user.primaryRole, ...dto, structuredAnswers },
      update: { ...dto, structuredAnswers },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { status: 'ACTIVE' },
    });

    return onboarding;
  }

  async recordProfileView(targetUserId: string, viewerUserId?: string) {
    if (viewerUserId && viewerUserId === targetUserId) {
      return;
    }
    const profile = await this.prisma.profile.findUnique({ where: { userId: targetUserId } });
    if (profile) {
      await this.prisma.profile.update({
        where: { id: profile.id },
        data: { viewsCount: { increment: 1 } },
      });
    }
  }

  async addPortfolioItem(userId: string, dto: CreatePortfolioItemDto) {
    let profile = await this.prisma.profile.findUnique({ where: { userId } });
    if (!profile) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new NotFoundException('User not found');
      profile = await this.prisma.profile.create({
        data: { userId, displayName: user.email.split('@')[0] },
      });
    }
    return this.prisma.portfolioItem.create({
      data: {
        profileId: profile.id,
        title: dto.title,
        description: dto.description,
        imageUrl: dto.imageUrl,
        projectUrl: dto.projectUrl,
        tags: dto.tags ?? [],
      },
    });
  }

  async updatePortfolioItem(userId: string, itemId: string, dto: UpdatePortfolioItemDto) {
    const item = await this.prisma.portfolioItem.findFirst({
      where: { id: itemId, profile: { userId } },
    });
    if (!item) throw new NotFoundException('Portfolio item not found');

    return this.prisma.portfolioItem.update({
      where: { id: itemId },
      data: dto,
    });
  }

  async deletePortfolioItem(userId: string, itemId: string) {
    const item = await this.prisma.portfolioItem.findFirst({
      where: { id: itemId, profile: { userId } },
    });
    if (!item) throw new NotFoundException('Portfolio item not found');

    await this.prisma.portfolioItem.delete({ where: { id: itemId } });
    return { success: true };
  }

  async saveFreelancer(userId: string, freelancerId: string) {
    const target = await this.prisma.user.findUnique({ where: { id: freelancerId } });
    if (!target || !target.roles.includes('FREELANCER')) {
      throw new BadRequestException('Пользователь не является фрилансером');
    }

    return this.prisma.savedFreelancer.upsert({
      where: { userId_freelancerId: { userId, freelancerId } },
      create: { userId, freelancerId },
      update: {},
    });
  }

  async unsaveFreelancer(userId: string, freelancerId: string) {
    await this.prisma.savedFreelancer.deleteMany({
      where: { userId, freelancerId },
    });
    return { success: true };
  }

  async listSavedFreelancers(userId: string) {
    const items = await this.prisma.savedFreelancer.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        freelancer: {
          include: {
            profile: {
              include: {
                skills: {
                  include: { skill: true },
                },
              },
            },
            subscription: {
              include: { tier: true },
            },
          },
        },
      },
    });

    const now = new Date();

    return items.map((item) => {
      const user = item.freelancer;
      const isActiveSub = user.subscription?.status === 'ACTIVE' && user.subscription.expiresAt > now;
      const tierName = isActiveSub ? user.subscription!.tier.name : 'STARTER';

      return {
        id: user.id,
        primaryRole: user.primaryRole,
        roles: user.roles,
        profile: user.profile
          ? {
              displayName: user.profile.displayName,
              avatarUrl: user.profile.avatarUrl,
              bio: user.profile.bio,
              country: user.profile.country,
              city: user.profile.city,
              availableForWork: user.profile.availableForWork,
              skills: user.profile.skills.map((s) => ({
                id: s.skill.id,
                name: s.skill.name,
                slug: s.skill.slug,
              })),
              successRate: user.profile.successRate,
              completionRate: user.profile.completionRate,
              avgResponseMins: user.profile.avgResponseMins,
              disputesCount: user.profile.disputesCount,
              lateDeliveries: user.profile.lateDeliveries,
            }
          : null,
        subscriptionTier: tierName,
        isPremium: tierName === 'PREMIUM',
      };
    });
  }

  async recalculateSuccessMetrics(freelancerId: string) {
    const acceptedBids = await this.prisma.bid.findMany({
      where: { freelancerId, status: 'ACCEPTED' },
      include: { order: { include: { disputes: true } } },
    });

    const acceptedOrdersCount = acceptedBids.length;
    if (acceptedOrdersCount === 0) {
      await this.prisma.profile.updateMany({
        where: { userId: freelancerId },
        data: { successRate: 0, completionRate: 0 },
      });
      return;
    }

    const completedBids = acceptedBids.filter((b) => b.order.status === 'COMPLETED');
    const completedOrdersCount = completedBids.length;

    const successRate = (completedOrdersCount / acceptedOrdersCount) * 100;

    let completionRate = 0;
    if (completedOrdersCount > 0) {
      const completedWithoutDispute = completedBids.filter((b) => b.order.disputes.length === 0).length;
      completionRate = (completedWithoutDispute / completedOrdersCount) * 100;
    }

    await this.prisma.profile.updateMany({
      where: { userId: freelancerId },
      data: {
        successRate: Number(successRate.toFixed(2)),
        completionRate: Number(completionRate.toFixed(2)),
      },
    });
  }

  async recalculateAvgResponseTime(freelancerId: string) {
    const recentBids = await this.prisma.bid.findMany({
      where: { freelancerId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { order: true },
    });

    if (recentBids.length === 0) return;

    let totalMins = 0;
    for (const bid of recentBids) {
      const diffMs = bid.createdAt.getTime() - bid.order.createdAt.getTime();
      const mins = Math.max(0, Math.floor(diffMs / 60000));
      totalMins += mins;
    }

    const avgResponseMins = Math.round(totalMins / recentBids.length);

    await this.prisma.profile.updateMany({
      where: { userId: freelancerId },
      data: { avgResponseMins },
    });
  }

  async incrementDisputesCount(freelancerId: string) {
    await this.prisma.profile.updateMany({
      where: { userId: freelancerId },
      data: { disputesCount: { increment: 1 } },
    });
  }

  async incrementLateDeliveries(freelancerId: string) {
    await this.prisma.profile.updateMany({
      where: { userId: freelancerId },
      data: { lateDeliveries: { increment: 1 } },
    });
  }

  async listPreviousFreelancers(clientId: string) {
    const completedOrders = await this.prisma.order.findMany({
      where: { clientId, status: 'COMPLETED' },
      include: {
        bids: {
          where: { status: 'ACCEPTED' },
          include: {
            freelancer: {
              include: {
                profile: {
                  include: {
                    skills: { include: { skill: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    const reviews = await this.prisma.review.findMany({
      where: { authorId: clientId },
    });
    const ratingMap = new Map<string, number[]>();
    for (const r of reviews) {
      const arr = ratingMap.get(r.targetId) ?? [];
      arr.push(r.rating);
      ratingMap.set(r.targetId, arr);
    }

    const hireCountMap = new Map<string, { freelancer: any; count: number }>();
    for (const order of completedOrders) {
      for (const bid of order.bids) {
        const free = bid.freelancer;
        if (!free) continue;
        const existing = hireCountMap.get(free.id);
        if (existing) {
          existing.count += 1;
        } else {
          hireCountMap.set(free.id, { freelancer: free, count: 1 });
        }
      }
    }

    return Array.from(hireCountMap.values()).map(({ freelancer, count }) => {
      const ratings = ratingMap.get(freelancer.id) ?? [];
      const avgRating = ratings.length > 0 ? Number((ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2)) : null;
      return {
        id: freelancer.id,
        primaryRole: freelancer.primaryRole,
        roles: freelancer.roles,
        profile: freelancer.profile,
        hireCount: count,
        myAvgRating: avgRating,
      };
    });
  }

  // --- Шаблоны откликов (для фрилансеров) ---

  async listBidTemplates(freelancerId: string) {
    return this.prisma.bidTemplate.findMany({ where: { freelancerId }, orderBy: { createdAt: 'desc' } });
  }

  async createBidTemplate(freelancerId: string, dto: CreateBidTemplateDto) {
    const count = await this.prisma.bidTemplate.count({ where: { freelancerId } });
    if (count >= MAX_BID_TEMPLATES) {
      throw new BadRequestException(`Можно сохранить не больше ${MAX_BID_TEMPLATES} шаблонов`);
    }
    return this.prisma.bidTemplate.create({ data: { freelancerId, ...dto } });
  }

  async updateBidTemplate(freelancerId: string, templateId: string, dto: UpdateBidTemplateDto) {
    const template = await this.prisma.bidTemplate.findFirst({ where: { id: templateId, freelancerId } });
    if (!template) throw new NotFoundException('Bid template not found');
    return this.prisma.bidTemplate.update({ where: { id: templateId }, data: dto });
  }

  async deleteBidTemplate(freelancerId: string, templateId: string) {
    const template = await this.prisma.bidTemplate.findFirst({ where: { id: templateId, freelancerId } });
    if (!template) throw new NotFoundException('Bid template not found');
    await this.prisma.bidTemplate.delete({ where: { id: templateId } });
    return { success: true };
  }

  // --- GDPR: экспорт данных и удаление аккаунта ---

  async exportUserData(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        profile: { include: { skills: { include: { skill: true } }, portfolioItems: true } },
        ordersAsClient: true,
        bids: true,
        reviewsAuthored: true,
        reviewsReceived: true,
        wallet: true,
        savedSearches: true,
        payoutAddresses: true,
      },
    });

    const ledgerEntries = user.wallet
      ? await this.prisma.ledgerEntry.findMany({
          where: { walletId: user.wallet.id },
          include: { transaction: true },
          orderBy: { createdAt: 'desc' },
        })
      : [];

    return {
      exportedAt: new Date().toISOString(),
      user: sanitizeUser(user),
      ledgerEntries,
    };
  }

  async deleteAccount(userId: string, password: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new BadRequestException('Неверный пароль');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          status: 'DELETED',
          email: `deleted-${userId}@taskhunt.invalid`,
          passwordHash: null,
          totpSecret: null,
          totpEnabled: false,
        },
      });
      await tx.totpBackupCode.deleteMany({ where: { userId } });
      await tx.refreshSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.profile.updateMany({
        where: { userId },
        data: {
          displayName: 'Удалённый пользователь',
          bio: null,
          avatarUrl: null,
          avatarData: null,
          githubUrl: null,
          websiteUrl: null,
        },
      });
    });

    return { deleted: true };
  }
}
