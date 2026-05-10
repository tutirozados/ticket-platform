'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

export default function AnalyticsPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/admin/login'); return; }
      setUser(user);
      setIsAdmin(user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL);
    });
  }, [router]);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const eventsQuery = supabase.from('events').select('*').order('date', { ascending: true });
    const ordersQuery = supabase
      .from('orders')
      .select('*, events(title, user_id, currency)')
      .order('created_at', { ascending: true });

    if (!isAdmin) {
      eventsQuery.eq('user_id', user.id);
      ordersQuery.eq('events.user_id', user.id);
    }

    const [{ data: eventsData }, { data: ordersData }] = await Promise.all([eventsQuery, ordersQuery]);
    setEvents(eventsData ?? []);
    setOrders((ordersData ?? []).filter((o) => o.events !== null));
    setLoading(false);
  }, [user, isAdmin]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (!user || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400 text-sm">Loading…</p>
      </div>
    );
  }

  const usdRevenue = orders.filter((o) => (o.events?.currency ?? 'USD') !== 'CRC').reduce((s, o) => s + parseFloat(o.total_price ?? 0), 0);
  const crcRevenue = orders.filter((o) => o.events?.currency === 'CRC').reduce((s, o) => s + parseFloat(o.total_price ?? 0), 0);
  const totalTickets = orders.reduce((s, o) => s + (o.quantity ?? 0), 0);
  const avgTickets = events.length > 0 ? (totalTickets / events.length).toFixed(1) : 0;
  const recentOrders = [...orders].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 10);
  const chartData = buildChartData(orders.filter((o) => (o.events?.currency ?? 'USD') !== 'CRC'));

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="text-xl font-bold text-gray-900 tracking-tight">FOMO</Link>
            <span className="text-sm text-gray-400">Analytics</span>
          </div>
          <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
            ← Dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">

        {/* Overview cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <RevenueStatCard
            usdRevenue={usdRevenue}
            crcRevenue={crcRevenue}
            sub={`from ${orders.length} orders`}
          />
          <StatCard
            label="Tickets Sold"
            value={totalTickets}
            sub={`across ${events.length} events`}
            icon={<TicketIcon />}
          />
          <StatCard
            label="Events Created"
            value={events.length}
            sub={`${events.filter((e) => e.status === 'approved').length} approved`}
            icon={<CalendarIcon />}
          />
          <StatCard
            label="Avg Tickets / Event"
            value={avgTickets}
            sub="per event"
            icon={<ChartIcon />}
          />
        </div>

        {/* Revenue chart */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-1">
            Revenue Over Time (last 30 days)
          </h2>
          {crcRevenue > 0 && (
            <p className="text-xs text-gray-400 mb-5">USD events only — CRC revenue shown separately above</p>
          )}
          {chartData.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-12">No sales data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#111827" stopOpacity={0.12} />
                    <stop offset="95%" stopColor="#111827" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `$${v}`}
                  width={48}
                />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: 12 }}
                  formatter={(value) => [`$${parseFloat(value).toFixed(2)}`, 'Revenue']}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#111827"
                  strokeWidth={2}
                  fill="url(#revenueGrad)"
                  dot={false}
                  activeDot={{ r: 4, fill: '#111827' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Events table */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-widest">Events Performance</h2>
          </div>
          {events.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-12">No events yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-widest">Event</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-widest">Tickets Sold</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-widest">Revenue</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-widest hidden lg:table-cell">Sold %</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-widest">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {events.map((event) => {
                  const eventOrders = orders.filter((o) => o.event_id === event.id);
                  const sold = eventOrders.reduce((s, o) => s + (o.quantity ?? 0), 0);
                  const revenue = eventOrders.reduce((s, o) => s + parseFloat(o.total_price ?? 0), 0);
                  const pct = event.total_tickets > 0 ? Math.round((sold / event.total_tickets) * 100) : 0;

                  return (
                    <tr key={event.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-900">{event.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-gray-700 font-medium">
                        {sold} / {event.total_tickets}
                      </td>
                      <td className="px-6 py-4 font-semibold text-gray-900">
                        {parseFloat(event.price) === 0 ? 'Free' : event.currency === 'CRC'
                          ? `₡${Math.round(revenue).toLocaleString('es-CR')}`
                          : `$${revenue.toFixed(2)}`}
                      </td>
                      <td className="px-6 py-4 hidden lg:table-cell">
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gray-900 transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500 w-8">{pct}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={event.status ?? 'pending'} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Recent orders */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-widest">Recent Orders</h2>
          </div>
          {recentOrders.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-12">No orders yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-widest">Buyer</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-widest">Event</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-widest">Qty</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-widest">Amount</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-widest">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900">{order.buyer_name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{order.buyer_email}</p>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{order.events?.title ?? '—'}</td>
                    <td className="px-6 py-4 text-gray-600">{order.quantity}</td>
                    <td className="px-6 py-4 font-semibold text-gray-900">
                      {order.events?.currency === 'CRC'
                        ? `₡${Math.round(parseFloat(order.total_price)).toLocaleString('es-CR')}`
                        : `$${parseFloat(order.total_price).toFixed(2)}`}
                    </td>
                    <td className="px-6 py-4 text-gray-400 text-xs">
                      {new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      {' '}
                      {new Date(order.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Tier breakdown */}
        {(() => {
          const tierRows = buildTierData(orders, events);
          if (tierRows.length === 0) return null;
          return (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-widest">Sales by Tier</h2>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-widest">Event</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-widest">Tier</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-widest">Tickets Sold</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-widest">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {tierRows.map((row) => (
                    <tr key={row.key} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-gray-600">{row.eventTitle}</td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 border border-gray-200">
                          {row.tierName}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-700 font-medium">{row.quantity}</td>
                      <td className="px-6 py-4 font-semibold text-gray-900">
                        {row.currency === 'CRC'
                          ? `₡${Math.round(row.revenue).toLocaleString('es-CR')}`
                          : `$${row.revenue.toFixed(2)}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })()}

      </main>
    </div>
  );
}

/* ── Helpers ── */

function buildChartData(orders) {
  const now = new Date();
  const days = {};

  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    days[key] = 0;
  }

  orders.forEach((o) => {
    const d = new Date(o.created_at);
    const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (key in days) {
      days[key] += parseFloat(o.total_price ?? 0);
    }
  });

  return Object.entries(days).map(([date, revenue]) => ({ date, revenue: revenue.toFixed(2) }));
}

function buildTierData(orders, events) {
  const map = {};
  const eventMap = Object.fromEntries(events.map((e) => [e.id, { title: e.title, currency: e.currency ?? 'USD' }]));

  orders.forEach((o) => {
    if (!o.tier_name) return;
    const key = `${o.event_id}::${o.tier_name}`;
    const ev = eventMap[o.event_id] ?? { title: '—', currency: 'USD' };
    if (!map[key]) {
      map[key] = { key, eventTitle: ev.title, tierName: o.tier_name, currency: ev.currency, quantity: 0, revenue: 0 };
    }
    map[key].quantity += o.quantity ?? 0;
    map[key].revenue += parseFloat(o.total_price ?? 0);
  });

  return Object.values(map).sort((a, b) => a.eventTitle.localeCompare(b.eventTitle));
}

function StatusBadge({ status }) {
  const styles = {
    approved: 'bg-green-50 text-green-700 border-green-200',
    pending: 'bg-orange-50 text-orange-600 border-orange-200',
    rejected: 'bg-red-50 text-red-600 border-red-200',
  };
  const labels = { approved: 'Live', pending: 'Pending', rejected: 'Rejected' };
  return (
    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${styles[status] ?? 'bg-gray-50 text-gray-500 border-gray-200'}`}>
      {labels[status] ?? status}
    </span>
  );
}

function RevenueStatCard({ usdRevenue, crcRevenue, sub }) {
  const hasUsd = usdRevenue > 0;
  const hasCrc = crcRevenue > 0;
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-gray-400"><DollarIcon /></span>
      </div>
      {!hasUsd && !hasCrc && <p className="text-2xl font-bold text-gray-900">$0.00</p>}
      {hasUsd && <p className={`font-bold text-gray-900 ${hasCrc ? 'text-xl' : 'text-2xl'}`}>${usdRevenue.toFixed(2)} <span className="text-xs font-normal text-gray-400">USD</span></p>}
      {hasCrc && <p className={`font-bold text-gray-900 ${hasUsd ? 'text-xl mt-0.5' : 'text-2xl'}`}>₡{Math.round(crcRevenue).toLocaleString('es-CR')} <span className="text-xs font-normal text-gray-400">CRC</span></p>}
      <p className="text-sm font-medium text-gray-500 mt-0.5">Total Revenue</p>
      <p className="text-xs text-gray-400 mt-1">{sub}</p>
    </div>
  );
}

function StatCard({ label, value, sub, icon }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-gray-400">{icon}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm font-medium text-gray-500 mt-0.5">{label}</p>
      <p className="text-xs text-gray-400 mt-1">{sub}</p>
    </div>
  );
}

function DollarIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function TicketIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}
