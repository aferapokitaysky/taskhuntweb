import { MarketplaceRole } from '@prisma/client';

export interface AuthenticatedUser {
  id: string;
  email: string;
  primaryRole: MarketplaceRole;
  roles: MarketplaceRole[];
  isStaff: boolean;
  staffPermissions: string[]; // коды из PermissionCode, вычисленные при логине
}
