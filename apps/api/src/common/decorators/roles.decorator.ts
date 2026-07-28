import { SetMetadata } from '@nestjs/common';
import { MarketplaceRole } from '@prisma/client';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: MarketplaceRole[]) => SetMetadata(ROLES_KEY, roles);
