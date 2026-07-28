export type MarketplaceRole = 'CLIENT' | 'FREELANCER';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  children?: Category[];
}

export interface Skill {
  id: string;
  name: string;
  slug: string;
}

export interface Profile {
  displayName: string;
  bio?: string | null;
  country?: string | null;
  city?: string | null;
  githubUrl?: string | null;
  websiteUrl?: string | null;
  skills?: { skill: Skill }[];
}

export interface User {
  id: string;
  email: string;
  primaryRole: MarketplaceRole;
  roles: MarketplaceRole[];
  isStaff: boolean;
  profile?: Profile | null;
}

export interface WalletBalance {
  mainBalance: string;
  escrowBalance: string;
  lockedBalance: string;
  withdrawableBalance: string;
  pendingBalance: string;
  currency: string;
}

export interface Bid {
  id: string;
  freelancerId: string;
  amount: string;
  deliveryDays: number;
  message: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN';
  freelancer?: User & { profile?: Profile | null };
}

export interface Invoice {
  id: string;
  amount: string;
  currency: string;
  description?: string | null;
  status: 'PENDING' | 'PAID' | 'CANCELLED' | 'EXPIRED';
}

export interface ChatMessage {
  id: string;
  senderId: string;
  type: 'TEXT' | 'FILE' | 'INVOICE' | 'SYSTEM';
  body?: string | null;
  invoice?: Invoice | null;
  createdAt: string;
  sender?: User & { profile?: Profile | null };
}

export type MilestoneStatus = 'PENDING' | 'FUNDED' | 'IN_PROGRESS' | 'DELIVERED' | 'APPROVED' | 'RELEASED' | 'DISPUTED';

export interface Milestone {
  id: string;
  orderId: string;
  title: string;
  amount: string;
  position: number;
  status: MilestoneStatus;
  dueDate?: string | null;
}

export interface Order {
  id: string;
  clientId: string;
  categoryId: string;
  title: string;
  description: string;
  budgetMin: string;
  budgetMax?: string | null;
  currency: string;
  deadline?: string | null;
  status: 'DRAFT' | 'OPEN' | 'IN_PROGRESS' | 'IN_REVIEW' | 'COMPLETED' | 'CANCELLED' | 'DISPUTED';
  acceptedBidId?: string | null;
  category?: Category;
  bids?: Bid[];
  milestones?: Milestone[];
  chatThread?: { id: string } | null;
  _count?: { bids: number };
  isPromoted?: boolean;
}

export interface Dispute {
  id: string;
  orderId: string;
  reason: string;
  status: string;
  openedBy?: User & { profile?: Profile | null };
  order?: Order;
}

export interface FeatureFlag {
  key: string;
  enabled: boolean;
  rolloutPercent: number;
}

export interface CommissionRule {
  type: string;
  percentage?: string | null;
  fixedAmount?: string | null;
}

export function money(value: string | number | null | undefined, currency = 'USD') {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));
}
