import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { OnboardingDto } from './dto/onboarding.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: { include: { skills: { include: { skill: true } } } }, onboarding: true, wallet: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
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

    const result = freelancers.map((user) => {
      const isPremium =
        user.subscription?.status === 'ACTIVE' &&
        user.subscription.expiresAt > now &&
        user.subscription.tier?.name === 'PREMIUM';

      const tierName =
        user.subscription?.status === 'ACTIVE' && user.subscription.expiresAt > now
          ? user.subscription.tier?.name
          : 'STARTER';

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
            }
          : null,
        subscriptionTier: tierName,
        isPremium,
      };
    });

    result.sort((a, b) => {
      if (a.isPremium && !b.isPremium) return -1;
      if (!a.isPremium && b.isPremium) return 1;
      return 0;
    });

    return result;
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
