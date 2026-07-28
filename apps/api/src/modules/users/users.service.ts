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

  /**
   * Квиз/анкета при регистрации. После заполнения переводим аккаунт в ACTIVE —
   * в реальном флоу тут же должна стоять проверка email-верификации,
   * это TODO для отдельного email-сервиса (не блокирует MVP).
   */
  async submitOnboarding(userId: string, dto: OnboardingDto) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    // structuredAnswers — произвольный JSON квиза, Prisma требует явный
    // тип Prisma.InputJsonValue вместо обычного Record<string, unknown>.
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
