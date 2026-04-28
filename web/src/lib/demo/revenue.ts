/**
 * Demo revenue / attribution data for the Revenue dashboard (websiteId === "demo")
 */

const now = new Date();
const daysAgo = (days: number) => {
  const d = new Date(now);
  d.setDate(d.getDate() - days);
  return d;
};

const iso = (d: Date) => d.toISOString();

export const demoRevenueDashboard = (days: number) => {
  const daily = Array.from({ length: days }, (_, i) => {
    const d = daysAgo(days - 1 - i);
    const base = 4200 + Math.sin(i / 2.2) * 800 + (i > days * 0.7 ? 400 : 0);
    const revenue = Math.round(base * 100 + Math.random() * 900) / 100;
    const orders = Math.max(12, Math.round(revenue / 85 + (Math.random() - 0.3) * 8));
    return { date: d.toISOString().split('T')[0]!, revenue, orders };
  });

  const totalRevenue = daily.reduce((s, x) => s + x.revenue, 0);
  const orders = daily.reduce((s, x) => s + x.orders, 0);
  const prevRevenue = totalRevenue * 0.88;
  const changePct = ((totalRevenue - prevRevenue) / prevRevenue) * 100;
  const sessions = 128400;
  const uniqueCustomers = 8240;

  const bySource = [
    { name: 'google', revenue: totalRevenue * 0.31, orders: Math.round(orders * 0.3), share_pct: 31 },
    { name: 'direct', revenue: totalRevenue * 0.24, orders: Math.round(orders * 0.25), share_pct: 24 },
    { name: 'newsletter', revenue: totalRevenue * 0.14, orders: Math.round(orders * 0.15), share_pct: 14 },
    { name: 't.co / twitter', revenue: totalRevenue * 0.11, orders: Math.round(orders * 0.1), share_pct: 11 },
    { name: 'facebook', revenue: totalRevenue * 0.09, orders: Math.round(orders * 0.08), share_pct: 9 },
    { name: 'linkedin', revenue: totalRevenue * 0.07, orders: Math.round(orders * 0.07), share_pct: 7 },
  ].map((r) => ({
    ...r,
    share_pct: Math.round((r.revenue / totalRevenue) * 1000) / 10,
  }));

  const byMedium = [
    { name: 'cpc', revenue: totalRevenue * 0.28, orders: Math.round(orders * 0.28), share_pct: 28 },
    { name: 'organic', revenue: totalRevenue * 0.26, orders: Math.round(orders * 0.25), share_pct: 26 },
    { name: 'email', revenue: totalRevenue * 0.18, orders: Math.round(orders * 0.2), share_pct: 18 },
    { name: 'social', revenue: totalRevenue * 0.15, orders: Math.round(orders * 0.15), share_pct: 15 },
    { name: 'referral', revenue: totalRevenue * 0.13, orders: Math.round(orders * 0.12), share_pct: 13 },
  ].map((r) => ({
    ...r,
    share_pct: Math.round((r.revenue / totalRevenue) * 1000) / 10,
  }));

  const byCampaign = [
    { name: 'q1_growth', revenue: totalRevenue * 0.22, orders: Math.round(orders * 0.2), share_pct: 22 },
    { name: 'product_hunt_launch', revenue: totalRevenue * 0.18, orders: Math.round(orders * 0.16), share_pct: 18 },
    { name: 'retargeting_global', revenue: totalRevenue * 0.16, orders: Math.round(orders * 0.18), share_pct: 16 },
    { name: 'brand_search', revenue: totalRevenue * 0.14, orders: Math.round(orders * 0.15), share_pct: 14 },
    { name: 'partner_webinar', revenue: totalRevenue * 0.12, orders: Math.round(orders * 0.1), share_pct: 12 },
  ].map((r) => ({
    ...r,
    share_pct: Math.round((r.revenue / totalRevenue) * 1000) / 10,
  }));

  const byProduct = [
    { name: 'Pro plan (annual)', revenue: totalRevenue * 0.34, orders: Math.round(orders * 0.22), share_pct: 34 },
    { name: 'Pro plan (monthly)', revenue: totalRevenue * 0.28, orders: Math.round(orders * 0.35), share_pct: 28 },
    { name: 'Add-on: Extra seats', revenue: totalRevenue * 0.14, orders: Math.round(orders * 0.18), share_pct: 14 },
    { name: 'Business plan', revenue: totalRevenue * 0.12, orders: Math.round(orders * 0.05), share_pct: 12 },
    { name: 'Merch & swag', revenue: totalRevenue * 0.08, orders: Math.round(orders * 0.2), share_pct: 8 },
  ].map((r) => ({
    ...r,
    share_pct: Math.round((r.revenue / totalRevenue) * 1000) / 10,
  }));

  const byCountry = [
    { name: 'United States', revenue: totalRevenue * 0.42, orders: Math.round(orders * 0.4), share_pct: 42 },
    { name: 'United Kingdom', revenue: totalRevenue * 0.12, orders: Math.round(orders * 0.12), share_pct: 12 },
    { name: 'Canada', revenue: totalRevenue * 0.09, orders: Math.round(orders * 0.1), share_pct: 9 },
    { name: 'Germany', revenue: totalRevenue * 0.08, orders: Math.round(orders * 0.08), share_pct: 8 },
    { name: 'Australia', revenue: totalRevenue * 0.07, orders: Math.round(orders * 0.08), share_pct: 7 },
  ].map((r) => ({
    ...r,
    share_pct: Math.round((r.revenue / totalRevenue) * 1000) / 10,
  }));

  const recentTransactions = [
    { id: 'txn_demo_1', occurred_at: iso(daysAgo(0)), value: 588, currency: 'USD', product_name: 'Pro plan (annual)', order_id: 'ord_7x2k9', source: 'google', medium: 'cpc', campaign: 'q1_growth', country: 'United States', user_type: 'returning' as const },
    { id: 'txn_demo_2', occurred_at: iso(daysAgo(0)), value: 49, currency: 'USD', product_name: 'Pro plan (monthly)', order_id: 'ord_8a3m1', source: 'direct', medium: 'none', campaign: '—', country: 'United Kingdom', user_type: 'new' as const },
    { id: 'txn_demo_3', occurred_at: iso(daysAgo(1)), value: 49, currency: 'USD', product_name: 'Pro plan (monthly)', order_id: 'ord_2p9qz', source: 'newsletter', medium: 'email', campaign: 'q1_growth', country: 'Canada', user_type: 'returning' as const },
    { id: 'txn_demo_4', occurred_at: iso(daysAgo(1)), value: 1299, currency: 'USD', product_name: 'Business plan', order_id: 'ord_4n8bw', source: 'linkedin', medium: 'social', campaign: 'partner_webinar', country: 'United States', user_type: 'new' as const },
    { id: 'txn_demo_5', occurred_at: iso(daysAgo(2)), value: 79, currency: 'USD', product_name: 'Add-on: Extra seats (x2)', order_id: 'ord_1v7jd', source: 't.co / twitter', medium: 'social', campaign: 'product_hunt_launch', country: 'Germany', user_type: 'returning' as const },
    { id: 'txn_demo_6', occurred_at: iso(daysAgo(2)), value: 49, currency: 'USD', product_name: 'Pro plan (monthly)', order_id: 'ord_9c4ht', source: 'facebook', medium: 'cpc', campaign: 'retargeting_global', country: 'France', user_type: 'new' as const },
    { id: 'txn_demo_7', occurred_at: iso(daysAgo(3)), value: 588, currency: 'USD', product_name: 'Pro plan (annual)', order_id: 'ord_0m5ps', source: 'google', medium: 'cpc', campaign: 'brand_search', country: 'Australia', user_type: 'returning' as const },
    { id: 'txn_demo_8', occurred_at: iso(daysAgo(3)), value: 28, currency: 'USD', product_name: 'Merch & swag', order_id: 'ord_3r6wq', source: 'direct', medium: 'none', campaign: '—', country: 'Netherlands', user_type: 'new' as const },
  ].map((t) => ({
    ...t,
    items: t.product_name.includes('Add-on')
      ? [{ sku: 'addon-seat', name: 'Extra seat', qty: 2, price: 39.5 }]
      : t.product_name.includes('Business')
        ? [{ sku: 'biz-annual', name: t.product_name, qty: 1, price: t.value }]
        : [{ sku: 'plan', name: t.product_name, qty: 1, price: t.value }],
  }));

  return {
    website_id: 'demo',
    days,
    data_quality: 'full' as const,
    summary: {
      total_revenue: Math.round(totalRevenue * 100) / 100,
      currency: 'USD',
      orders,
      aov: Math.round((totalRevenue / orders) * 100) / 100,
      sessions,
      revenue_per_session: Math.round((totalRevenue / sessions) * 10000) / 10000,
      arpu: Math.round((totalRevenue / uniqueCustomers) * 100) / 100,
      unique_customers: uniqueCustomers,
      refund_total: 420.5,
      new_customer_revenue_pct: 34.2,
      prior_period: { total_revenue: Math.round(prevRevenue * 100) / 100, orders: Math.round(orders * 0.91), change_pct: Math.round(changePct * 10) / 10 },
    },
    daily,
    by_source: bySource,
    by_medium: byMedium,
    by_campaign: byCampaign,
    by_product: byProduct,
    by_country: byCountry,
    recent_transactions: recentTransactions,
  };
};
