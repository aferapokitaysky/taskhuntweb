import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthProvider, MarketplaceRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../common/events/event-bus.service';
import { DomainEventName } from '@taskhunt/shared-types';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

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

  async register(dto: RegisterDto) {
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
    });

    return this.issueTokens(user.id);
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
