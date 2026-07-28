// Коды granular-прав для staff RBAC. Строки, а не enum на бэке — чтобы
// новые права можно было добавлять миграцией данных, без релиза кода.
export enum PermissionCode {
  UserBan = 'user.ban',
  UserView = 'user.view',
  UserImpersonate = 'user.impersonate',

  OrderModerate = 'order.moderate',
  OrderDelete = 'order.delete',

  DisputeView = 'dispute.view',
  DisputeAssign = 'dispute.assign',
  DisputeResolve = 'dispute.resolve',

  EscrowRelease = 'escrow.release',
  EscrowRefund = 'escrow.refund',
  WalletAdjust = 'wallet.adjust',

  FinanceViewReports = 'finance.view_reports',
  FinanceConfigureCommissions = 'finance.configure_commissions',

  ContentModerate = 'content.moderate',

  FeatureFlagToggle = 'feature_flag.toggle',
  StaffManageRoles = 'staff.manage_roles',
  CatalogManage = 'catalog.manage',
}

export const DEFAULT_STAFF_ROLES: Record<string, PermissionCode[]> = {
  OWNER: Object.values(PermissionCode),
  FINANCE: [
    PermissionCode.FinanceViewReports,
    PermissionCode.FinanceConfigureCommissions,
    PermissionCode.EscrowRelease,
    PermissionCode.EscrowRefund,
    PermissionCode.WalletAdjust,
  ],
  SUPPORT: [PermissionCode.UserView, PermissionCode.DisputeView],
  MODERATOR: [PermissionCode.OrderModerate, PermissionCode.ContentModerate, PermissionCode.UserView, PermissionCode.CatalogManage],
  ARBITRATOR: [PermissionCode.DisputeView, PermissionCode.DisputeAssign, PermissionCode.DisputeResolve],
  ANALYST: [PermissionCode.FinanceViewReports, PermissionCode.UserView],
};
