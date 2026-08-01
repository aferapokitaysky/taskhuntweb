export type MarketplaceRole = 'CLIENT' | 'FREELANCER';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export type LoginResponse = AuthTokens | { requiresTotp: true; totpToken: string };

export interface Category {
  id: string;
  name: string;
  slug: string;
  children?: Category[];
  orderCount?: number;
}

export interface Skill {
  id: string;
  name: string;
  slug: string;
  usageCount?: number;
}

export interface SavedSearch {
  id: string;
  label: string;
  categoryId?: string | null;
  tags: string[];
  minBudget?: string | null;
  createdAt: string;
  lastMatchedAt?: string | null;
}

export interface PortfolioItem {
  id: string;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  projectUrl?: string | null;
  tags: string[];
  createdAt: string;
}

export interface BidTemplate {
  id: string;
  name: string;
  message: string;
  defaultDeliveryDays?: number | null;
  createdAt: string;
}

export interface PreviousFreelancer {
  id: string;
  hireCount: number;
  myAvgRating: number | null;
  profile: { displayName: string; avatarUrl?: string | null } | null;
}

export interface SessionItem {
  id: string;
  userAgent?: string | null;
  ip?: string | null;
  createdAt: string;
  lastUsedAt: string;
  isCurrent: boolean;
}

export interface Profile {
  displayName: string;
  avatarUrl?: string | null;
  bio?: string | null;
  country?: string | null;
  city?: string | null;
  githubUrl?: string | null;
  websiteUrl?: string | null;
  skills?: { skill: Skill }[];
  portfolioItems?: PortfolioItem[];
  availableForWork?: boolean;
  vacationUntil?: string | null;
  viewsCount?: number;
  successRate?: string | null;
}

export interface User {
  id: string;
  email: string;
  primaryRole: MarketplaceRole;
  roles: MarketplaceRole[];
  isStaff: boolean;
  status?: 'PENDING_VERIFICATION' | 'ACTIVE' | 'SUSPENDED' | 'BANNED' | 'DELETED';
  totpEnabled?: boolean;
  digestFrequency?: 'NONE' | 'DAILY' | 'WEEKLY';
  profile?: Profile | null;
  level?: 'TOP_RATED' | 'RISING_TALENT' | 'NEW';
  completedOrders?: number;
}

export interface WalletBalance {
  mainBalance: string;
  escrowBalance: string;
  lockedBalance: string;
  withdrawableBalance: string;
  pendingBalance: string;
  currency: string;
  autoWithdrawThreshold?: string | null;
  autoWithdrawAddressId?: string | null;
}

export interface Bid {
  id: string;
  freelancerId: string;
  amount: string;
  deliveryDays: number;
  message: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN';
  compatibilityPercent?: number | null;
  freelancer?: User & { profile?: Profile | null };
}

/** Ответ GET /orders/bids/mine — отклик фрилансера + заказ, на который он подан. */
export interface MyBid extends Bid {
  orderId: string;
  createdAt: string;
  order: Order;
}

export interface Invoice {
  id: string;
  orderId?: string;
  milestoneId?: string | null;
  milestone?: { id: string; title: string } | null;
  amount: string;
  currency: string;
  description?: string | null;
  status: 'PENDING' | 'PAID' | 'CANCELLED' | 'EXPIRED';
  payAddress?: string | null;
  payAmount?: string | null;
  payCurrency?: string | null;
  paymentNetwork?: string | null;
  createdAt?: string;
  paidAt?: string | null;
}

/** Пополнение кошелька через NOWPayments (POST /wallet/deposits, GET /wallet/deposits/:id/payment). */
export interface WalletDeposit {
  depositId: string;
  amount: string;
  currency: string;
  status: 'PENDING' | 'PAID' | 'CANCELLED' | 'EXPIRED';
  payAddress?: string | null;
  payAmount?: string | null;
  payCurrency?: string | null;
  paymentNetwork?: string | null;
}

export interface InvoicePaymentDetails {
  invoiceId: string;
  orderId: string;
  amount: string;
  currency: string;
  status: Invoice['status'];
  payAddress?: string | null;
  payAmount?: string | null;
  payCurrency?: string | null;
  paymentNetwork?: string | null;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  type: 'TEXT' | 'FILE' | 'INVOICE' | 'SYSTEM';
  body?: string | null;
  invoice?: Invoice | null;
  createdAt: string;
  sender?: User & { profile?: Profile | null };
  /** Только на живых WebSocket-пушах (ChatGateway.broadcastToOrder) — нужны на /chats, где один сокет держит сразу все треды. REST-ответы их не возвращают. */
  orderId?: string;
  freelancerId?: string;
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
  tags?: string[];
  status: 'DRAFT' | 'OPEN' | 'IN_PROGRESS' | 'IN_REVIEW' | 'COMPLETED' | 'CANCELLED' | 'DISPUTED' | 'EXPIRED';
  acceptedBidId?: string | null;
  category?: Category;
  bids?: Bid[];
  milestones?: Milestone[];
  chatThreads?: { id: string; freelancerId: string }[];
  _count?: { bids: number };
  isPromoted?: boolean;
  disputes?: Dispute[];
  viewsCount?: number;
  matchScore?: number;
  matchReasons?: string[];
  missing?: string[];
  compatibilityPercent?: number | null;
  client?: { id: string; verifiedPayer?: boolean } | null;
}

export interface PaginatedOrders {
  items: Order[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface OrderInvite {
  id: string;
  orderId: string;
  freelancerId: string;
  clientId: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  createdAt: string;
  order: Order;
}

export interface ChatThreadSummary {
  freelancerId: string;
  threadId: string | null;
  hasThread: boolean;
  freelancer?: User & { profile?: Profile | null };
  lastMessage?: ChatMessage | null;
  unreadCount?: number;
}

export interface ChatInboxThread {
  threadId: string;
  orderId: string;
  freelancerId: string;
  role: 'CLIENT' | 'FREELANCER';
  createdAt: string;
  order: Order;
  participant?: User & { profile?: Profile | null };
  lastMessage?: ChatMessage | null;
  unreadCount?: number;
}

export interface SavedPayoutAddress {
  id: string;
  label: string;
  network: string;
  address: string;
  isDefault: boolean;
  createdAt: string;
  lastUsedAt?: string | null;
}

export interface LedgerEntryItem {
  id: string;
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'ESCROW_LOCK' | 'ESCROW_RELEASE' | 'REFUND' | 'COMMISSION' | 'BONUS' | 'REFERRAL' | 'PROMO' | 'CHARGEBACK';
  direction: 'DEBIT' | 'CREDIT';
  balanceType: 'MAIN' | 'ESCROW' | 'LOCKED' | 'WITHDRAWABLE' | 'PENDING';
  amount: string;
  currency: string;
  description?: string | null;
  referenceType: string;
  createdAt: string;
}

export interface Dispute {
  id: string;
  orderId: string;
  reason: string;
  status: string;
  resolutionNotes?: string | null;
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
