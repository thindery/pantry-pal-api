"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordLoginEvent = recordLoginEvent;
exports.recordTransaction = recordTransaction;
exports.getTransactions = getTransactions;
exports.getFailedPaymentAlerts = getFailedPaymentAlerts;
exports.getDashboardMetrics = getDashboardMetrics;
const index_1 = require("./index");
const crypto_1 = __importDefault(require("crypto"));
function generateId() {
    return crypto_1.default.randomUUID();
}
function getPeriodDates(period) {
    const now = new Date();
    const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
    const currentEnd = now.toISOString();
    const currentStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
    const previousEnd = currentStart;
    const previousStart = new Date(now.getTime() - 2 * days * 24 * 60 * 60 * 1000).toISOString();
    return { currentStart, currentEnd, previousStart, previousEnd };
}
function getDailySparkline(startDate, endDate, data) {
    const sparkline = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    const dayMs = 24 * 60 * 60 * 1000;
    const dataMap = new Map();
    for (const item of data) {
        const dateKey = item.date.split('T')[0];
        dataMap.set(dateKey, (dataMap.get(dateKey) || 0) + item.value);
    }
    for (let d = new Date(start); d <= end; d = new Date(d.getTime() + dayMs)) {
        const dateKey = d.toISOString().split('T')[0];
        sparkline.push(dataMap.get(dateKey) || 0);
    }
    return sparkline;
}
async function recordLoginEvent(userId, source) {
    const db = (0, index_1.getDatabase)();
    const id = generateId();
    await db.execute(`INSERT INTO login_events (id, user_id, source, created_at)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP)`, [id, userId, source || 'api']);
}
async function recordTransaction(data) {
    const db = (0, index_1.getDatabase)();
    const id = generateId();
    await db.execute(`INSERT INTO admin_transactions (
      id, user_id, stripe_customer_id, stripe_subscription_id, stripe_invoice_id,
      amount_cents, currency, status, tier, billing_interval,
      failure_code, failure_message, stripe_event_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`, [
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
    ]);
}
async function getTransactions(limit = 10, cursor) {
    const db = (0, index_1.getDatabase)();
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
    const params = [];
    if (cursor) {
        query += ` WHERE created_at < ? `;
        params.push(cursor);
    }
    query += ` ORDER BY created_at DESC LIMIT ? `;
    params.push(limit + 1);
    const rows = await db.query(query, params);
    const transactions = rows.slice(0, limit).map(row => ({
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
async function getFailedPaymentAlerts() {
    const db = (0, index_1.getDatabase)();
    const countResult = await db.query(`SELECT COUNT(*) as count FROM admin_transactions 
     WHERE status = 'failed' 
     AND created_at > datetime('now', '-7 days')`, []);
    const count = countResult[0]?.count || 0;
    const rows = await db.query(`SELECT 
      id,
      user_id as userId,
      amount_cents as amountCents,
      failure_code as failureCode,
      failure_message as failureMessage,
      created_at as createdAt
    FROM admin_transactions
    WHERE status = 'failed'
    ORDER BY created_at DESC
    LIMIT 10`, []);
    const recent = rows.map(row => ({
        id: row.id,
        userId: row.userId,
        amountCents: row.amountCents,
        failureCode: row.failureCode,
        failureMessage: row.failureMessage,
        createdAt: row.createdAt,
    }));
    return { count, recent };
}
async function getDashboardMetrics(period) {
    const db = (0, index_1.getDatabase)();
    const { currentStart, currentEnd, previousStart, previousEnd } = getPeriodDates(period);
    const totalUsersResult = await db.query(`SELECT COUNT(DISTINCT user_id) as count FROM user_subscriptions`, []);
    const totalUsers = totalUsersResult[0]?.count || 0;
    const currentUsersResult = await db.query(`SELECT COUNT(DISTINCT user_id) as count FROM user_subscriptions 
     WHERE created_at >= ? AND created_at <= ?`, [currentStart, currentEnd]);
    const currentPeriodUsers = currentUsersResult[0]?.count || 0;
    const previousUsersResult = await db.query(`SELECT COUNT(DISTINCT user_id) as count FROM user_subscriptions 
     WHERE created_at >= ? AND created_at <= ?`, [previousStart, previousEnd]);
    const previousPeriodUsers = previousUsersResult[0]?.count || 0;
    const userGrowth = previousPeriodUsers > 0
        ? ((currentPeriodUsers - previousPeriodUsers) / previousPeriodUsers) * 100
        : 0;
    const dailyUsersResult = await db.query(`SELECT 
      date(created_at) as date,
      COUNT(DISTINCT user_id) as count
    FROM user_subscriptions
    WHERE created_at >= ? AND created_at <= ?
    GROUP BY date(created_at)
    ORDER BY date`, [currentStart, currentEnd]);
    const userSparkline = getDailySparkline(currentStart, currentEnd, dailyUsersResult.map(r => ({ date: r.date, value: r.count })));
    const totalProductsResult = await db.query(`SELECT COUNT(*) as count FROM pantry_items`, []);
    const totalProducts = totalProductsResult[0]?.count || 0;
    const categoryResult = await db.query(`SELECT category, COUNT(*) as count FROM pantry_items GROUP BY category`, []);
    const productsByCategory = {};
    for (const row of categoryResult) {
        productsByCategory[row.category] = row.count;
    }
    const lifetimeRevenueResult = await db.query(`SELECT SUM(amount_cents) as total FROM admin_transactions WHERE status = 'succeeded'`, []);
    const lifetimeRevenue = lifetimeRevenueResult[0]?.total || 0;
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString();
    const currentMonthRevenueResult = await db.query(`SELECT SUM(amount_cents) as total FROM admin_transactions 
     WHERE status = 'succeeded' AND created_at >= ?`, [currentMonthStart]);
    const currentMonthRevenue = currentMonthRevenueResult[0]?.total || 0;
    const previousMonthRevenueResult = await db.query(`SELECT SUM(amount_cents) as total FROM admin_transactions 
     WHERE status = 'succeeded' AND created_at >= ? AND created_at <= ?`, [previousMonthStart, previousMonthEnd]);
    const previousMonthRevenue = previousMonthRevenueResult[0]?.total || 0;
    const revenueMomGrowth = previousMonthRevenue > 0
        ? ((currentMonthRevenue - previousMonthRevenue) / previousMonthRevenue) * 100
        : 0;
    const dailyRevenueResult = await db.query(`SELECT 
      date(created_at) as date,
      SUM(amount_cents) as total
    FROM admin_transactions
    WHERE status = 'succeeded' AND created_at >= ? AND created_at <= ?
    GROUP BY date(created_at)
    ORDER BY date`, [currentStart, currentEnd]);
    const revenueSparkline = getDailySparkline(currentStart, currentEnd, dailyRevenueResult.map(r => ({ date: r.date, value: r.total || 0 })));
    const dailyLoginsResult = await db.query(`SELECT 
      date(created_at) as date,
      COUNT(DISTINCT user_id) as count
    FROM login_events
    WHERE created_at >= ? AND created_at <= ?
    GROUP BY date(created_at)
    ORDER BY date`, [currentStart, currentEnd]);
    const loginSparkline = getDailySparkline(currentStart, currentEnd, dailyLoginsResult.map(r => ({ date: r.date, value: r.count })));
    const today = new Date().toISOString().split('T')[0];
    const todayLogins = dailyLoginsResult.find(r => r.date === today);
    const dau = todayLogins?.count || loginSparkline[loginSparkline.length - 1] || 0;
    const { transactions: recentTransactions } = await getTransactions(10);
    const failedPayments = await getFailedPaymentAlerts();
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
            recent: failedPayments.recent,
        },
    };
}
//# sourceMappingURL=admin.js.map