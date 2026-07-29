import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user';

interface JwtPayload {
  sub: string;
  sid?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET')!,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { staffRoles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } },
    });

    if (!user || user.status === 'BANNED' || user.status === 'SUSPENDED' || user.status === 'DELETED') {
      throw new UnauthorizedException();
    }

    const staffPermissions = user.staffRoles.flatMap((ur) =>
      ur.role.permissions.map((rp) => rp.permission.code),
    );

    return {
      id: user.id,
      email: user.email,
      primaryRole: user.primaryRole,
      roles: user.roles,
      isStaff: user.isStaff,
      staffPermissions: [...new Set(staffPermissions)],
      sessionId: payload.sid,
    };
  }
}
