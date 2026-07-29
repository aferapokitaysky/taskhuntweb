import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { AuthProvider, MarketplaceRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../common/events/event-bus.service';
import { DomainEventName } from '@taskhunt/shared-types';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24 часа
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1 час — короче, т.к. чувствительнее

export interface OAuthProfile {
  provider: Exclude<AuthProvider, 'LOCAL'>;
  oauthId: string;
  email: string;
  displayName: string;
  githubUrl?: string;
  role: MarketplaceRole;
}

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly eventBus: EventBusService,
  ) {}

  async register(dto: RegisterDto, ip: string | null = null) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    // Регистрация — атомарно: пользователь + профиль + кошелёк с нулевым балансом.
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          primaryRole: dto.role,
          roles: [dto.role],
          status: 'PENDING_VERIFICATION',
          profile: { create: { displayName: dto.displayName } },
          wallet: { create: {} },
        },
      });
      return created;
    });

    await this.eventBus.publish(DomainEventName.UserRegistered, {
      userId: user.id,
      email: user.email,
      role: dto.role,
      ip,
    });

    await this.sendVerificationEmail(user.id, user.email);

    return this.issueTokens(user.id);
  }

  /**
   * Генерирует токен верификации и публикует событие — реальная отправка
   * письма происходит в notifications-service (см. EmailVerificationRequestedEvent).
   * Единый токен на пользователя: новый запрос молча инвалидирует старую ссылку.
   */
  async sendVerificationEmail(userId: string, email: string) {
    const token = crypto.randomBytes(32).toString('hex');
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        emailVerificationToken: token,
        emailVerificationExpiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
      },
    });

    const verificationUrl = `${process.env.WEB_PUBLIC_URL}/verify-email?token=${token}`;
    await this.eventBus.publish(DomainEventName.EmailVerificationRequested, {
      userId,
      email,
      verificationUrl,
    });
  }

  async verifyEmail(token: string) {
    const user = await this.prisma.user.findUnique({ where: { emailVerificationToken: token } });
    if (!user || !user.emailVerificationExpiresAt || user.emailVerificationExpiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired verification link');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        status: user.status === 'PENDING_VERIFICATION' ? 'ACTIVE' : user.status,
        emailVerificationToken: null,
        emailVerificationExpiresAt: null,
      },
    });

    return { verified: true };
  }

  /**
   * Не раскрываем, существует ли email в системе (защита от enumeration) —
   * контроллер всегда отвечает одинаковым сообщением независимо от результата.
   */
  async requestPasswordReset(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      return; // OAuth-аккаунт без пароля или email не найден — тихо ничего не делаем
    }

    const token = crypto.randomBytes(32).toString('hex');
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: token,
        passwordResetExpiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
      },
    });

    const resetUrl = `${process.env.WEB_PUBLIC_URL}/reset-password?token=${token}`;
    await this.eventBus.publish(DomainEventName.PasswordResetRequested, {
      userId: user.id,
      email: user.email,
      resetUrl,
    });
  }

  async resetPassword(token: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { passwordResetToken: token } });
    if (!user || !user.passwordResetExpiresAt || user.passwordResetExpiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired reset link');
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, passwordResetToken: null, passwordResetExpiresAt: null },
    });

    return { reset: true };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.passwordHash) {
      throw new BadRequestException('Для этого аккаунта не задан пароль (вход через OAuth)');
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      throw new BadRequestException('Неверный текущий пароль');
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });

    return { changed: true };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status === 'BANNED' || user.status === 'SUSPENDED') {
      throw new UnauthorizedException('Account is not active');
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } });

    return this.issueTokens(user.id);
  }

  /**
   * Единая точка входа для Google/Apple/GitHub. Матчим существующего
   * пользователя по (authProvider, oauthId); если это первый вход с таким
   * email через LOCAL — не мёржим автоматически (во избежание захвата
   * чужого аккаунта через якобы тот же email), а создаём отдельный OAuth-аккаунт.
   */
  async handleOAuthLogin(profile: OAuthProfile) {
    let user = await this.prisma.user.findFirst({
      where: { authProvider: profile.provider, oauthId: profile.oauthId },
    });

    if (!user) {
      user = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            email: profile.email,
            authProvider: profile.provider,
            oauthId: profile.oauthId,
            primaryRole: profile.role,
            roles: [profile.role],
            status: 'ACTIVE', // email уже подтверждён провайдером — верификация не нужна
            profile: {
              create: {
                displayName: profile.displayName,
                githubUrl: profile.githubUrl,
              },
            },
            wallet: { create: {} },
          },
        });
        return created;
      });

      await this.eventBus.publish(DomainEventName.UserRegistered, {
        userId: user.id,
        email: user.email,
        role: profile.role,
        ip: null, // OAuth — личность уже подтверждена провайдером
      });
    }

    if (user.status === 'BANNED' || user.status === 'SUSPENDED') {
      throw new UnauthorizedException('Account is not active');
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } });
    return this.issueTokens(user.id);
  }

  async refresh(refreshToken: string) {
    let payload: { sub: string };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, { secret: process.env.JWT_SECRET });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    return this.issueTokens(payload.sub);
  }

  private async issueTokens(userId: string) {
    const accessToken = await this.jwt.signAsync(
      { sub: userId },
      { expiresIn: process.env.JWT_ACCESS_TTL ?? '15m' },
    );
    const refreshToken = await this.jwt.signAsync(
      { sub: userId },
      { expiresIn: process.env.JWT_REFRESH_TTL ?? '30d' },
    );
    return { accessToken, refreshToken };
  }
}
