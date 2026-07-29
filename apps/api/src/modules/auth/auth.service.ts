import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { authenticator } from 'otplib';
import * as qrcode from 'qrcode';
import { AuthProvider, MarketplaceRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../common/events/event-bus.service';
import { DomainEventName } from '@taskhunt/shared-types';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24 часа
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1 час — короче, т.к. чувствительнее
const TOTP_BACKUP_CODES_COUNT = 10;

export interface RequestMeta {
  userAgent?: string;
  ip?: string;
}

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

  async register(dto: RegisterDto, ip: string | null = null, meta?: RequestMeta) {
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

    return this.issueTokens(user.id, meta);
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

  async login(dto: LoginDto, meta?: RequestMeta) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status === 'BANNED' || user.status === 'SUSPENDED' || user.status === 'DELETED') {
      throw new UnauthorizedException('Account is not active');
    }

    // 2FA включена — не выдаём токены сразу, только короткоживущий
    // промежуточный токен для второго шага (POST /auth/2fa/verify). meta
    // (userAgent/ip) едет вместе с ним — issueTokens вызовется только там.
    if (user.totpEnabled) {
      const totpToken = await this.jwt.signAsync({ sub: user.id, purpose: 'totp', meta }, { expiresIn: '5m' });
      return { requiresTotp: true, totpToken };
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } });

    return this.issueTokens(user.id, meta);
  }

  // --- Двухфакторная аутентификация (TOTP) ---

  async enrollTotp(userId: string, email: string) {
    const secret = authenticator.generateSecret();
    await this.prisma.user.update({ where: { id: userId }, data: { totpSecret: secret } });

    const otpauthUrl = authenticator.keyuri(email, 'TaskHunt', secret);
    const qrCodeDataUrl = await qrcode.toDataURL(otpauthUrl);

    return { secret, otpauthUrl, qrCodeDataUrl };
  }

  async confirmTotpEnrollment(userId: string, code: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.totpSecret) {
      throw new BadRequestException('Сначала запросите QR-код через /auth/2fa/enroll');
    }
    if (!authenticator.check(code, user.totpSecret)) {
      throw new BadRequestException('Неверный код');
    }

    const backupCodes = Array.from({ length: TOTP_BACKUP_CODES_COUNT }, () =>
      crypto.randomInt(10000000, 99999999).toString(),
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { totpEnabled: true } });
      await tx.totpBackupCode.deleteMany({ where: { userId } });
      await tx.totpBackupCode.createMany({
        data: await Promise.all(
          backupCodes.map(async (code) => ({ userId, codeHash: await bcrypt.hash(code, BCRYPT_ROUNDS) })),
        ),
      });
    });

    return { enabled: true, backupCodes };
  }

  async disableTotp(userId: string, password: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new BadRequestException('Неверный пароль');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { totpSecret: null, totpEnabled: false } });
      await tx.totpBackupCode.deleteMany({ where: { userId } });
    });

    return { disabled: true };
  }

  async verifyTotp(totpToken: string, code: string) {
    let payload: { sub: string; purpose?: string; meta?: RequestMeta };
    try {
      payload = await this.jwt.verifyAsync(totpToken, { secret: process.env.JWT_SECRET });
    } catch {
      throw new UnauthorizedException('Invalid or expired totpToken');
    }
    if (payload.purpose !== 'totp') {
      throw new UnauthorizedException('Invalid totpToken');
    }

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: payload.sub } });
    if (!user.totpSecret) {
      throw new BadRequestException('2FA не настроена для этого аккаунта');
    }

    if (authenticator.check(code, user.totpSecret)) {
      await this.prisma.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } });
      return this.issueTokens(user.id, payload.meta);
    }

    // Не подошёл TOTP-код — пробуем как одноразовый backup-код.
    const unusedCodes = await this.prisma.totpBackupCode.findMany({ where: { userId: user.id, usedAt: null } });
    for (const backupCode of unusedCodes) {
      if (await bcrypt.compare(code, backupCode.codeHash)) {
        await this.prisma.totpBackupCode.update({ where: { id: backupCode.id }, data: { usedAt: new Date() } });
        await this.prisma.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } });
        return this.issueTokens(user.id, payload.meta);
      }
    }

    throw new UnauthorizedException('Неверный код');
  }

  /**
   * Единая точка входа для Google/Apple/GitHub. Матчим существующего
   * пользователя по (authProvider, oauthId); если это первый вход с таким
   * email через LOCAL — не мёржим автоматически (во избежание захвата
   * чужого аккаунта через якобы тот же email), а создаём отдельный OAuth-аккаунт.
   */
  async handleOAuthLogin(profile: OAuthProfile, meta?: RequestMeta) {
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

    if (user.status === 'BANNED' || user.status === 'SUSPENDED' || user.status === 'DELETED') {
      throw new UnauthorizedException('Account is not active');
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } });
    return this.issueTokens(user.id, meta);
  }

  async refresh(refreshToken: string, meta?: RequestMeta) {
    let payload: { sub: string };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, { secret: process.env.JWT_SECRET });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Токен подписан валидно, но сессия могла быть отозвана вручную
    // (см. GET/DELETE /auth/sessions) — стейтфул-слой поверх stateless JWT,
    // без него отзыв конкретного логина был бы невозможен.
    const tokenHash = this.hashToken(refreshToken);
    const session = await this.prisma.refreshSession.findUnique({ where: { tokenHash } });
    if (!session || session.revokedAt) {
      throw new UnauthorizedException('Сессия отозвана, войдите заново');
    }

    // Ротация — старая сессия отзывается, новый refresh-токен получает новую запись.
    await this.prisma.refreshSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } });

    return this.issueTokens(payload.sub, meta);
  }

  // --- Активные сессии ---

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async listSessions(userId: string, currentSessionId?: string) {
    const sessions = await this.prisma.refreshSession.findMany({
      where: { userId, revokedAt: null },
      orderBy: { lastUsedAt: 'desc' },
    });
    return sessions.map((s) => ({
      id: s.id,
      userAgent: s.userAgent,
      ip: s.ip,
      createdAt: s.createdAt,
      lastUsedAt: s.lastUsedAt,
      isCurrent: s.id === currentSessionId,
    }));
  }

  async revokeSession(userId: string, sessionId: string) {
    const session = await this.prisma.refreshSession.findUnique({ where: { id: sessionId } });
    if (!session || session.userId !== userId) {
      throw new BadRequestException('Сессия не найдена');
    }
    await this.prisma.refreshSession.update({ where: { id: sessionId }, data: { revokedAt: new Date() } });
    return { revoked: true };
  }

  async revokeOtherSessions(userId: string, currentSessionId?: string) {
    await this.prisma.refreshSession.updateMany({
      where: { userId, revokedAt: null, ...(currentSessionId && { id: { not: currentSessionId } }) },
      data: { revokedAt: new Date() },
    });
    return { revoked: true };
  }

  private async issueTokens(userId: string, meta?: RequestMeta) {
    // Id сессии известен заранее (генерируем сами, не полагаемся на дефолт
    // Prisma) — нужен внутри payload обоих токенов ещё до того, как сама
    // запись создана, чтобы `sid` в access-токене мог адресовать текущую
    // сессию в /auth/sessions без лишнего похода в БД на каждый запрос.
    const sessionId = crypto.randomUUID();

    const accessToken = await this.jwt.signAsync(
      { sub: userId, sid: sessionId },
      { expiresIn: process.env.JWT_ACCESS_TTL ?? '15m' },
    );
    const refreshToken = await this.jwt.signAsync(
      { sub: userId, sid: sessionId },
      { expiresIn: process.env.JWT_REFRESH_TTL ?? '30d' },
    );

    await this.prisma.refreshSession.create({
      data: {
        id: sessionId,
        userId,
        tokenHash: this.hashToken(refreshToken),
        userAgent: meta?.userAgent,
        ip: meta?.ip,
      },
    });

    return { accessToken, refreshToken };
  }
}
