'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import CreateEventForm from './CreateEventForm';
import EditEventModal from './EditEventModal';

const TABS = ['Overview', 'Events', 'Orders', 'New Event'];

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [tab, setTab] = useState('Overview');
  const [events, setEvents] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingEvent, setEditingEvent] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

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
    const ordersQuery = supabase.from('orders').select('*, events(title)').order('created_at', { ascending: false });

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

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/admin/login');
  }

  async function deleteEvent(id) {
    if (!confirm('Delete this event? This will also delete all related orders and tickets.')) return;
    setDeletingId(id);
    await supabase.from('events').delete().eq('id', id);
    setDeletingId(null);
    fetchData();
  }

  const totalRevenue = orders.reduce((sum, o) => sum + parseFloat(o.total_price ?? 0), 0);
  const ticketsSold = orders.reduce((sum, o) => sum + (o.quantity ?? 0), 0);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-xl font-bold text-gray-900 tracking-tight">TicketFlow</Link>
            <span className="text-sm text-gray-400">Admin</span>
            {isAdmin && (
              <span className="text-xs bg-gray-900 text-white px-2 py-0.5 rounded-full font-medium">Super Admin</span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400 hidden sm:block">{user.email}</span>
            <Link
              href="/scan"
              className="text-sm font-medium bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
            >
              Scan Tickets
            </Link>
            <button
              onClick={handleSignOut}
              className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Tab Nav */}
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex gap-1">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  tab === t
                    ? 'border-gray-900 text-gray-900'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        {loading ? (
          <div className="text-center py-24 text-gray-400 text-sm">Loading…</div>
        ) : (
          <>
            {tab === 'Overview' && (
              <OverviewTab events={events} orders={orders} totalRevenue={totalRevenue} ticketsSold={ticketsSold} isAdmin={isAdmin} />
            )}
            {tab === 'Events' && (
              <EventsTab
                events={events}
                deletingId={deletingId}
                onEdit={setEditingEvent}
                onDelete={deleteEvent}
              />
            )}
            {tab === 'Orders' && <OrdersTab orders={orders} isAdmin={isAdmin} />}
            {tab === 'New Event' && (
              <div className="max-w-2xl">
                <CreateEventForm
                  userId={user.id}
                  onCreated={() => { fetchData(); setTab('Events'); }}
                />
              </div>
            )}
          </>
        )}
      </main>

      {editingEvent && (
        <EditEventModal
          event={editingEvent}
          onClose={() => setEditingEvent(null)}
          onSaved={fetchData}
        />
      )}
    </div>
  );
}

/* ── Overview ── */
function OverviewTab({ events, orders, totalRevenue, ticketsSold, isAdmin }) {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <StatCard label={isAdmin ? 'Total Orders' : 'Your Orders'} value={orders.length} icon="🧾" />
        <StatCard label={isAdmin ? 'Total Revenue' : 'Your Revenue'} value={`$${totalRevenue.toFixed(2)}`} icon="💰" />
        <StatCard label="Tickets Sold" value={ticketsSold} icon="🎟️" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-4">Recent Orders</h3>
          {orders.length === 0 ? (
            <p className="text-sm text-gray-400">No orders yet.</p>
          ) : (
            <div className="space-y-3">
              {orders.slice(0, 5).map((o) => (
                <div key={o.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{o.buyer_name}</p>
                    <p className="text-xs text-gray-400">{o.events?.title}</p>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">${parseFloat(o.total_price).toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-4">
            {isAdmin ? 'All Events' : 'Your Events'}
          </h3>
          {events.length === 0 ? (
            <p className="text-sm text-gray-400">No events yet.</p>
          ) : (
            <div className="space-y-3">
              {events.slice(0, 5).map((e) => (
                <div key={e.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{e.title}</p>
                    <p className="text-xs text-gray-400">{new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                  </div>
                  <span className="text-xs text-gray-500">{e.tickets_remaining}/{e.total_tickets} left</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
      <div className="text-2xl mb-3">{icon}</div>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500 mt-1">{label}</p>
    </div>
  );
}

/* ── Events ── */
function EventsTab({ events, deletingId, onEdit, onDelete }) {
  if (events.length === 0) {
    return <p className="text-gray-400 text-sm py-12 text-center">No events yet.</p>;
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-widest">Event</th>
            <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-widest">Date</th>
            <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-widest">Price</th>
            <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-widest">Tickets</th>
            <th className="px-6 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {events.map((event) => (
            <tr key={event.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-6 py-4">
                <p className="font-medium text-gray-900">{event.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">{event.location}</p>
              </td>
              <td className="px-6 py-4 text-gray-600">
                {new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </td>
              <td className="px-6 py-4 text-gray-600">
                {parseFloat(event.price) === 0 ? 'Free' : `$${parseFloat(event.price).toFixed(2)}`}
              </td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <div className="w-20 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full bg-gray-900 rounded-full"
                      style={{ width: `${Math.round(((event.total_tickets - event.tickets_remaining) / event.total_tickets) * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500">{event.tickets_remaining}/{event.total_tickets}</span>
                </div>
              </td>
              <td className="px-6 py-4">
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => onEdit(event)}
                    className="text-xs font-medium text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onDelete(event.id)}
                    disabled={deletingId === event.id}
                    className="text-xs font-medium text-red-500 hover:text-red-700 px-3 py-1.5 rounded-lg border border-red-100 hover:border-red-200 transition-colors disabled:opacity-50"
                  >
                    {deletingId === event.id ? '…' : 'Delete'}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Orders ── */
function OrdersTab({ orders, isAdmin }) {
  if (orders.length === 0) {
    return <p className="text-gray-400 text-sm py-12 text-center">No orders yet.</p>;
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-widest">Buyer</th>
            <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-widest">Event</th>
            <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-widest">Qty</th>
            <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-widest">Total</th>
            <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-widest">Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {orders.map((order) => (
            <tr key={order.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-6 py-4">
                <p className="font-medium text-gray-900">{order.buyer_name}</p>
                <p className="text-xs text-gray-400 mt-0.5">{order.buyer_email}</p>
              </td>
              <td className="px-6 py-4 text-gray-600">{order.events?.title ?? '—'}</td>
              <td className="px-6 py-4 text-gray-600">{order.quantity}</td>
              <td className="px-6 py-4 font-semibold text-gray-900">${parseFloat(order.total_price).toFixed(2)}</td>
              <td className="px-6 py-4 text-gray-400 text-xs">
                {new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
