import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MatchingService } from '../matching/matching.service';
import { OnboardingDto } from './dto/onboarding.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly matching: MatchingService,
  ) {}

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: { include: { skills: { include: { skill: true } } } },
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

    return {
      ...user,
      profileCompleteness,
      missingSteps,
    };
  }

  async getPublicProfile(id: string) {
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
          },
        },
        reviewsReceived: {
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
          skills: user.profile.skills.map((s) => ({
            id: s.skill.id,
            name: s.skill.name,
            slug: s.skill.slug,
          })),
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

    return {
      id: user.id,
      primaryRole: user.primaryRole,
      roles: user.roles,
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

    if (filters.search) {
      const searchWhere: Prisma.ProfileWhereInput = {
        OR: [
          { displayName: { contains: filters.search, mode: 'insensitive' } },
          { bio: { contains: filters.search, mode: 'insensitive' } },
        ],
      };
      if (where.profile) {
        where.profile = { AND: [where.profile, searchWhere] };
      } else {
        where.profile = searchWhere;
      }
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

    const now = new Date();

    const candidates = freelancers.map((user) => {
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

    return this.matching.rankFreelancers(candidates);
  }

  /** Персональная лента заказов для фрилансера — см. MatchingService.recommendOrdersForFreelancer. */
  async getRecommendedOrders(freelancerId: string, limit = 20) {
    return this.matching.recommendOrdersForFreelancer(freelancerId, limit);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const { skillIds, ...profileFields } = dto;

    return this.prisma.profile.update({
      where: { userId },
      data: {
        ...profileFields,
        ...(skillIds && {
          skills: {
            deleteMany: {},
            create: skillIds.map((skillId) => ({ skillId })),
          },
        }),
      },
      include: { skills: { include: { skill: true } } },
    });
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
}
