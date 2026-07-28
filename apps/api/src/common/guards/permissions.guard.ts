import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionCode } from '@taskhunt/shared-types';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { AuthenticatedUser } from '../types/authenticated-user';

/** Granular staff RBAC — проверяет конкретные права (escrow.release и т.д.), не роль. */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<PermissionCode[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const user: AuthenticatedUser = context.switchToHttp().getRequest().user;
    if (!user?.isStaff) {
      throw new ForbiddenException('Staff access required');
    }

    const hasAll = required.every((p) => user.staffPermissions.includes(p));
    if (!hasAll) {
      throw new ForbiddenException(`Missing permission(s): ${required.join(', ')}`);
    }
    return true;
  }
}
