// ============================================================================
// Контракт событий между apps/api (издатель) и микросервисами (подписчики).
// Любое изменение формата события — breaking change для notifications-service
// и fraud-service, версионировать через suffix (например UserRegisteredV2).
// ============================================================================

export const EVENT_QUEUE_NAME = 'taskhunt-events';

export enum DomainEventName {
  UserRegistered = 'UserRegistered',
  OrderCreated = 'OrderCreated',
  BidSubmitted = 'BidSubmitted',
  BidAccepted = 'BidAccepted',
  InvoiceIssued = 'InvoiceIssued',
  InvoicePaid = 'InvoicePaid',
  EscrowLocked = 'EscrowLocked',
  EscrowReleased = 'EscrowReleased',
  WorkSubmitted = 'WorkSubmitted',
  DisputeOpened = 'DisputeOpened',
  OrderInviteCreated = 'OrderInviteCreated',
  EmailVerificationRequested = 'EmailVerificationRequested',
  PasswordResetRequested = 'PasswordResetRequested',
  SubscriptionExpiringSoon = 'SubscriptionExpiringSoon',
  DeadlineExtensionRequested = 'DeadlineExtensionRequested',
  DeadlineExtensionResponded = 'DeadlineExtensionResponded',
}

export interface BaseDomainEvent<TName extends DomainEventName, TPayload> {
  name: TName;
  occurredAt: string; // ISO timestamp
  payload: TPayload;
}

export type UserRegisteredEvent = BaseDomainEvent<
  DomainEventName.UserRegistered,
  // ip — для анти-фрод детекции дублей аккаунтов по IP в fraud-service;
  // null для OAuth-регистрации (там личность уже подтверждена провайдером,
  // риск дублей ниже, IP через колбэк-цепочку тянуть не стали)
  { userId: string; email: string; role: 'CLIENT' | 'FREELANCER'; ip: string | null }
>;

export type OrderCreatedEvent = BaseDomainEvent<
  DomainEventName.OrderCreated,
  { orderId: string; clientId: string; categoryId: string; budgetMin: number; budgetMax: number | null }
>;

export type BidSubmittedEvent = BaseDomainEvent<
  DomainEventName.BidSubmitted,
  { bidId: string; orderId: string; freelancerId: string; amount: number }
>;

export type BidAcceptedEvent = BaseDomainEvent<
  DomainEventName.BidAccepted,
  { bidId: string; orderId: string; freelancerId: string; clientId: string; amount: number }
>;

export type OrderInviteCreatedEvent = BaseDomainEvent<
  DomainEventName.OrderInviteCreated,
  { inviteId: string; orderId: string; orderTitle: string; freelancerId: string; clientId: string }
>;

export type InvoiceIssuedEvent = BaseDomainEvent<
  DomainEventName.InvoiceIssued,
  { invoiceId: string; orderId: string; payerId: string; amount: number; currency: string }
>;

export type InvoicePaidEvent = BaseDomainEvent<
  DomainEventName.InvoicePaid,
  { invoiceId: string; orderId: string; payerId: string; freelancerId: string; amount: number; currency: string }
>;

export type EscrowLockedEvent = BaseDomainEvent<
  DomainEventName.EscrowLocked,
  { orderId: string; walletId: string; clientId: string; amount: number }
>;

export type EscrowReleasedEvent = BaseDomainEvent<
  DomainEventName.EscrowReleased,
  { orderId: string; walletId: string; amount: number; toFreelancerId: string }
>;

export type WorkSubmittedEvent = BaseDomainEvent<
  DomainEventName.WorkSubmitted,
  { orderId: string; deliveryId: string; submittedById: string; clientId: string }
>;

export type DisputeOpenedEvent = BaseDomainEvent<
  DomainEventName.DisputeOpened,
  { disputeId: string; orderId: string; openedById: string; reason: string }
>;

export type EmailVerificationRequestedEvent = BaseDomainEvent<
  DomainEventName.EmailVerificationRequested,
  { userId: string; email: string; verificationUrl: string }
>;

export type PasswordResetRequestedEvent = BaseDomainEvent<
  DomainEventName.PasswordResetRequested,
  { userId: string; email: string; resetUrl: string }
>;

export type SubscriptionExpiringSoonEvent = BaseDomainEvent<
  DomainEventName.SubscriptionExpiringSoon,
  { userId: string; tierName: string; expiresAt: string }
>;

export type DeadlineExtensionRequestedEvent = BaseDomainEvent<
  DomainEventName.DeadlineExtensionRequested,
  { requestId: string; orderId: string; freelancerId: string; clientId: string; newDeadline: string }
>;

export type DeadlineExtensionRespondedEvent = BaseDomainEvent<
  DomainEventName.DeadlineExtensionResponded,
  { requestId: string; orderId: string; clientId: string; freelancerId: string; approved: boolean }
>;

export type DomainEvent =
  | UserRegisteredEvent
  | OrderCreatedEvent
  | BidSubmittedEvent
  | BidAcceptedEvent
  | InvoiceIssuedEvent
  | InvoicePaidEvent
  | EscrowLockedEvent
  | EscrowReleasedEvent
  | WorkSubmittedEvent
  | DisputeOpenedEvent
  | OrderInviteCreatedEvent
  | EmailVerificationRequestedEvent
  | PasswordResetRequestedEvent
  | SubscriptionExpiringSoonEvent
  | DeadlineExtensionRequestedEvent
  | DeadlineExtensionRespondedEvent;
