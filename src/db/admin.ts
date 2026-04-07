/**
 * Admin Database Operations
 * Dashboard metrics, transaction tracking, and login events
 */

import { getDatabase } from './index';
import crypto from 'crypto';

// ============================================================================
// Types
// ============================================================================

export interface TransactionData {
  userId: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripeInvoiceId?: string;
  amountCents: number;
  currency?: string;
  status: 'succeeded' | 'failed' | 'pending' | 'refunded';
  tier?: 'free' | 'pro' | 'family';
  billingInterval?: 'month' | 'year';
  failureCode?: string;
  failureMessage?: string;
  stripeEventId?: string;
}

export interface Transaction {
  id: string;
  userId: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripeInvoiceId: string | null;
  amountCents: number;
  currency: string;
  status: string;
  tier: string | null;
  billingInterval: string | null;
  failureCode: string | null;
  failureMessage: string | null;
  createdAt: string;
  stripeEventId: string | null;
}

export interface DashboardMetrics {
  users: {
    total: number;
    growth: number; // percentage
    sparkline: number[]; // daily counts
  };
  products: {
    total: number;
    byCategory: Record<string, number>;
  };
  revenue: {
    lifetime: number; // cents
    momGrowth: number; // percentage
    trend: number[]; // daily revenue for period
  };
  logins: {
    dau: number;
    sparkline: number[];
  };
  transactions: Transaction[];
  failedPayments: {
    count: number;
    recent: Transaction[];
  };
}

export interface FailedPaymentAlert {
  id: string;
  userId: string;
  amountCents: number;
  failureCode: string | null;
  failureMessage: string | null;
  createdAt: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

function generateId(): string {
  return crypto.randomUUID();
}

function getPeriodDates(period: '7d' | '30d' | '90d'): {
  currentStart: string;
  currentEnd: string;
  previousStart: string;
  previousEnd: string;
} {
  const now = new Date();
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;

  const currentEnd = now.toISOString();
  const currentStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
  const previousEnd = currentStart;
  const previousStart = new Date(now.getTime() - 2 * days * 24 * 60 * 60 * 1000).toISOString();

  return { currentStart, currentEnd, previousStart, previousEnd };
}

function getDailySparkline(startDate: string, endDate: string, data: Array<{ date: string; value: number }>): number[] {
  const sparkline: number[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  const dayMs = 24 * 60 * 60 * 1000;

  // Create a map of date -> value
  const dataMap = new Map<string, number>();
  for (const item of data) {
    const dateKey = item.date.split('T')[0];
    dataMap.set(dateKey, (dataMap.get(dateKey) || 0) + item.value);
  }

  // Fill in all days
  for (let d = new Date(start); d <= end; d = new Date(d.getTime() + dayMs)) {
    const dateKey = d.toISOString().split('T')[0];
    sparkline.push(dataMap.get(dateKey) || 0);
  }

  return sparkline;
}

// ============================================================================
// Login Events
// ============================================================================

/**
 * Record a login event for DAU tracking
 */
export async function recordLoginEvent(
  userId: string,
  source?: string
): Promise<void> {
  const db = getDatabase();
  const id = generateId();

  await db.execute(
    `INSERT INTO login_events (id, user_id, source, created_at)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
    [id, userId, source || 'api']
  );
}

// ============================================================================
// Transactions
// ============================================================================

/**
 * Record a transaction from Stripe webhook
 */
export async function recordTransaction(data: TransactionData): Promise<void> {
  const db = getDatabase();
  const id = generateId();

  await db.execute(
    `INSERT INTO admin_transactions (
      id, user_id, stripe_customer_id, stripe_subscription_id, stripe_invoice_id,
      amount_cents, currency, status, tier, billing_interval,
      failure_code, failure_message, stripe_event_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [
      id,
      data.userId,
      data.stripeCustomerId || null,
      data.stripeSubscriptionId || null,
      data.stripeInvoiceId || null,
      data.amountCents,
      data.currency || 'usd',
      data.status,
      data.tier || null,
      data.billingInterval || null,
      data.failureCode || null,
      data.failureMessage || null,
      data.stripeEventId || null,
    ]
  );
}

/**
 * Get paginated transactions
 */
export async function getTransactions(
  limit: number = 10,
  cursor?: string
): Promise<{ transactions: Transaction[]; nextCursor?: string }> {
  const db = getDatabase();

  let query = `
    SELECT 
      id,
      user_id as userId,
      stripe_customer_id as stripeCustomerId,
      stripe_subscription_id as stripeSubscriptionId,
      stripe_invoice_id as stripeInvoiceId,
      amount_cents as amountCents,
      currency,
      status,
      tier,
      billing_interval as billingInterval,
      failure_code as failureCode,
      failure_message as failureMessage,
      created_at as createdAt,
      stripe_event_id as stripeEventId
    FROM admin_transactions
  `;

  const params: (string | number)[] = [];

  if (cursor) {
    query += ` WHERE created_at < ? `;
    params.push(cursor);
  }

  query += ` ORDER BY created_at DESC LIMIT ? `;
  params.push(limit + 1); // Get one extra to determine if there's a next page

  const rows = await db.query(query, params) as any[];

  const transactions: Transaction[] = rows.slice(0, limit).map(row => ({
    id: row.id,
    userId: row.userId,
    stripeCustomerId: row.stripeCustomerId,
    stripeSubscriptionId: row.stripeSubscriptionId,
    stripeInvoiceId: row.stripeInvoiceId,
    amountCents: row.amountCents,
    currency: row.currency,
    status: row.status,
    tier: row.tier,
    billingInterval: row.billingInterval,
    failureCode: row.failureCode,
    failureMessage: row.failureMessage,
    createdAt: row.createdAt,
    stripeEventId: row.stripeEventId,
  }));

  const nextCursor = rows.length > limit ? transactions[transactions.length - 1]?.createdAt : undefined;

  return { transactions, nextCursor };
}

// ============================================================================
// Failed Payment Alerts
// ============================================================================

/**
 * Get recent failed payment alerts
 */
export async function getFailedPaymentAlerts(): Promise<{
  count: number;
  recent: FailedPaymentAlert[];
}> {
  const db = getDatabase();

  // Count failures in last 7 days
  const countResult = await db.query(
    `SELECT COUNT(*) as count FROM admin_transactions 
     WHERE status = 'failed' 
     AND created_at > datetime('now', '-7 days')`,
    []
  ) as any[];

  const count = countResult[0]?.count || 0;

  // Get recent failed transactions
  const rows = await db.query(
    `SELECT 
      id,
      user_id as userId,
      amount_cents as amountCents,
      failure_code as failureCode,
      failure_message as failureMessage,
      created_at as createdAt
    FROM admin_transactions
    WHERE status = 'failed'
    ORDER BY created_at DESC
    LIMIT 10`,
    []
  ) as any[];

  const recent: FailedPaymentAlert[] = rows.map(row => ({
    id: row.id,
    userId: row.userId,
    amountCents: row.amountCents,
    failureCode: row.failureCode,
    failureMessage: row.failureMessage,
    createdAt: row.createdAt,
  }));

  return { count, recent };
}

// ============================================================================
// Dashboard Metrics
// ============================================================================

/**
 * Get comprehensive dashboard metrics
 */
export async function getDashboardMetrics(
  period: '7d' | '30d' | '90d'
): Promise<DashboardMetrics> {
  const db = getDatabase();
  const { currentStart, currentEnd, previousStart, previousEnd } = getPeriodDates(period);

  // ==========================================================================
  // Users Metrics
  // ==========================================================================

  // Total users (distinct user_id from subscriptions)
  const totalUsersResult = await db.query(
    `SELECT COUNT(DISTINCT user_id) as count FROM user_subscriptions`,
    []
  ) as any[];
  const totalUsers = totalUsersResult[0]?.count || 0;

  // Users in current period vs previous period
  const currentUsersResult = await db.query(
    `SELECT COUNT(DISTINCT user_id) as count FROM user_subscriptions 
     WHERE created_at >= ? AND created_at <= ?`,
    [currentStart, currentEnd]
  ) as any[];
  const currentPeriodUsers = currentUsersResult[0]?.count || 0;

  const previousUsersResult = await db.query(
    `SELECT COUNT(DISTINCT user_id) as count FROM user_subscriptions 
     WHERE created_at >= ? AND created_at <= ?`,
    [previousStart, previousEnd]
  ) as any[];
  const previousPeriodUsers = previousUsersResult[0]?.count || 0;

  const userGrowth = previousPeriodUsers > 0
    ? ((currentPeriodUsers - previousPeriodUsers) / previousPeriodUsers) * 100
    : 0;

  // Daily new users sparkline
  const dailyUsersResult = await db.query(
    `SELECT 
      date(created_at) as date,
      COUNT(DISTINCT user_id) as count
    FROM user_subscriptions
    WHERE created_at >= ? AND created_at <= ?
    GROUP BY date(created_at)
    ORDER BY date`,
    [currentStart, currentEnd]
  ) as any[];

  const userSparkline = getDailySparkline(
    currentStart,
    currentEnd,
    dailyUsersResult.map(r => ({ date: r.date, value: r.count }))
  );

  // ==========================================================================
  // Products Metrics
  // ==========================================================================

  const totalProductsResult = await db.query(
    `SELECT COUNT(*) as count FROM pantry_items`,
    []
  ) as any[];
  const totalProducts = totalProductsResult[0]?.count || 0;

  const categoryResult = await db.query(
    `SELECT category, COUNT(*) as count FROM pantry_items GROUP BY category`,
    []
  ) as any[];

  const productsByCategory: Record<string, number> = {};
  for (const row of categoryResult) {
    productsByCategory[row.category] = row.count;
  }

  // ==========================================================================
  // Revenue Metrics
  // ==========================================================================

  // Lifetime revenue
  const lifetimeRevenueResult = await db.query(
    `SELECT SUM(amount_cents) as total FROM admin_transactions WHERE status = 'succeeded'`,
    []
  ) as any[];
  const lifetimeRevenue = lifetimeRevenueResult[0]?.total || 0;

  // Current month vs previous month
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString();

  const currentMonthRevenueResult = await db.query(
    `SELECT SUM(amount_cents) as total FROM admin_transactions 
     WHERE status = 'succeeded' AND created_at >= ?`,
    [currentMonthStart]
  ) as any[];
  const currentMonthRevenue = currentMonthRevenueResult[0]?.total || 0;

  const previousMonthRevenueResult = await db.query(
    `SELECT SUM(amount_cents) as total FROM admin_transactions 
     WHERE status = 'succeeded' AND created_at >= ? AND created_at <= ?`,
    [previousMonthStart, previousMonthEnd]
  ) as any[];
  const previousMonthRevenue = previousMonthRevenueResult[0]?.total || 0;

  const revenueMomGrowth = previousMonthRevenue > 0
    ? ((currentMonthRevenue - previousMonthRevenue) / previousMonthRevenue) * 100
    : 0;

  // Daily revenue sparkline
  const dailyRevenueResult = await db.query(
    `SELECT 
      date(created_at) as date,
      SUM(amount_cents) as total
    FROM admin_transactions
    WHERE status = 'succeeded' AND created_at >= ? AND created_at <= ?
    GROUP BY date(created_at)
    ORDER BY date`,
    [currentStart, currentEnd]
  ) as any[];

  const revenueSparkline = getDailySparkline(
    currentStart,
    currentEnd,
    dailyRevenueResult.map(r => ({ date: r.date, value: r.total || 0 }))
  );

  // ==========================================================================
  // Login Metrics (DAU)
  // ==========================================================================

  // Daily active users - unique users per day
  const dailyLoginsResult = await db.query(
    `SELECT 
      date(created_at) as date,
      COUNT(DISTINCT user_id) as count
    FROM login_events
    WHERE created_at >= ? AND created_at <= ?
    GROUP BY date(created_at)
    ORDER BY date`,
    [currentStart, currentEnd]
  ) as any[];

  const loginSparkline = getDailySparkline(
    currentStart,
    currentEnd,
    dailyLoginsResult.map(r => ({ date: r.date, value: r.count }))
  );

  // Today's DAU (or last day in period if no data today)
  const today = new Date().toISOString().split('T')[0];
  const todayLogins = dailyLoginsResult.find(r => r.date === today);
  const dau = todayLogins?.count || loginSparkline[loginSparkline.length - 1] || 0;

  // ==========================================================================
  // Recent Transactions
  // ==========================================================================

  const { transactions: recentTransactions } = await getTransactions(10);

  // ==========================================================================
  // Failed Payments
  // ==========================================================================

  const failedPayments = await getFailedPaymentAlerts();

  // ==========================================================================
  // Assemble Response
  // ==========================================================================

  return {
    users: {
      total: totalUsers,
      growth: Math.round(userGrowth * 100) / 100,
      sparkline: userSparkline,
    },
    products: {
      total: totalProducts,
      byCategory: productsByCategory,
    },
    revenue: {
      lifetime: lifetimeRevenue,
      momGrowth: Math.round(revenueMomGrowth * 100) / 100,
      trend: revenueSparkline,
    },
    logins: {
      dau,
      sparkline: loginSparkline,
    },
    transactions: recentTransactions,
    failedPayments: {
      count: failedPayments.count,
      recent: failedPayments.recent as unknown as Transaction[],
    },
  };
}
