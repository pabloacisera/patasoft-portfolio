export type UserRole = 'GUEST' | 'USER' | 'ADMIN_COMPANY' | 'STAFF' | 'SUPER_ADMIN';
export type SubscriptionPlan = 'TRIAL' | 'MONTHLY' | 'YEARLY' | 'TEST';
export type SubscriptionStatus = 'TRIAL' | 'ACTIVE' | 'EXPIRED' | 'BLOCKED' | 'CANCELLED';
export type PaymentStatus = 'PENDING' | 'PARTIAL' | 'PAID' | 'DEFERRED' | 'CANCELLED' | 'OVERDUE';
export type PaymentMethod = 'CASH' | 'TRANSFER' | 'MP_QR' | 'MP_CHECKOUT' | 'CHECK' | 'OTHER';
export type DebtStatus = 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';
export type ConnectionStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'BLOCKED';
export type CashMovementType = 'INCOME' | 'EXPENSE';
export type DocumentType = 'PAYMENT_RECEIPT' | 'DEBT_RECORD' | 'SUPPLY_EXCEL' | 'PRICE_LIST'
  | 'RAG_DOCUMENT' | 'EXPORT_EXCEL' | 'EXPORT_PDF' | 'ACCOUNT_STATEMENT';
export type NotificationType = 'STOCK_LOW' | 'DEBT_DUE' | 'DEBT_OVERDUE'
  | 'CONNECTION_REQUEST' | 'CONNECTION_ACCEPTED' | 'CONNECTION_REJECTED'
  | 'SUBSCRIPTION_EXPIRING' | 'SUBSCRIPTION_EXPIRED' | 'MIGRATION_COMPLETE'
  | 'ONBOARDING_INCOMPLETE' | 'DOCUMENT_READY' | 'SYSTEM';

export interface ApiResponse<T = any> {
  data: T;
  meta?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ApiError {
  statusCode: number;
  message: string;
  code?: string;
  timestamp: string;
  path: string;
  method: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
}
