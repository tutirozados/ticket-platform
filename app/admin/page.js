'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import CreateEventForm from './CreateEventForm';
import EditEventModal from './EditEventModal';
import DiscountCodesTab from './DiscountCodesTab';
import SinpeTab from './SinpeTab';

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [tab, setTab] = useState('Overview');
  const [events, setEvents] = useState([]);
  const [pendingEvents, setPendingEvents] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingEvent, setEditingEvent] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [rejectingEvent, setRejectingEvent] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [approvingId, setApprovingId] = useState(null);
  const [sinpePendingCount, setSinpePendingCount] = useState(0);

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

    const promises = [eventsQuery, ordersQuery];

    if (isAdmin) {
      promises.push(
        supabase.from('events').select('*').eq('status', 'pending').order('created_at', { ascending: true })
      );
      promises.push(
        supabase.from('orders').select('id', { count: 'exact', head: true }).eq('payment_method', 'sinpe').eq('payment_status', 'pending_sinpe')
      );
    }

    const results = await Promise.all(promises);
    const [{ data: eventsData }, { data: ordersData }] = results;

    setEvents(eventsData ?? []);
    setOrders((ordersData ?? []).filter((o) => o.events !== null));

    if (isAdmin && results[2]) {
      setPendingEvents(results[2].data ?? []);
    }
    if (isAdmin && results[3]) {
      setSinpePendingCount(results[3].count ?? 0);
    }

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

  async function approveEvent(eventId) {
    setApprovingId(eventId);
    await fetch('/api/event-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, status: 'approved' }),
    });
    setApprovingId(null);
    fetchData();
  }

  async function rejectEvent() {
    if (!rejectingEvent) return;
    setApprovingId(rejectingEvent.id);
    await fetch('/api/event-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId: rejectingEvent.id, status: 'rejected', reason: rejectReason }),
    });
    setRejectingEvent(null);
    setRejectReason('');
    setApprovingId(null);
    fetchData();
  }

  const tabs = isAdmin ? ['Overview', 'Approvals', 'SINPE', 'Events', 'Orders', 'Discounts', 'New Event'] : ['Overview', 'Events', 'Orders', 'New Event'];
  const totalRevenue = orders.reduce((sum, o) => sum + parseFloat(o.total_price ?? 0), 0);
  const ticketsSold = orders.reduce((sum, o) => sum + (o.quantity ?? 0), 0);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-xl font-bold text-gray-900 tracking-tight">FOMO</Link>
            <span className="text-sm text-gray-400">Admin</span>
            {isAdmin && (
              <span className="text-xs bg-gray-900 text-white px-2 py-0.5 rounded-full font-medium">Super Admin</span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400 hidden sm:block">{user.email}</span>
            <Link
              href="/admin/analytics"
              className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
            >
              Analytics
            </Link>
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
            {tabs.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`relative px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  tab === t
                    ? 'border-gray-900 text-gray-900'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {t}
                {t === 'Approvals' && pendingEvents.length > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold bg-orange-500 text-white rounded-full">
                    {pendingEvents.length}
                  </span>
                )}
                {t === 'SINPE' && sinpePendingCount > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold bg-blue-600 text-white rounded-full">
                    {sinpePendingCount}
                  </span>
                )}
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
            {tab === 'Approvals' && isAdmin && (
              <ApprovalsTab
                pendingEvents={pendingEvents}
                approvingId={approvingId}
                onApprove={approveEvent}
                onReject={setRejectingEvent}
              />
            )}
            {tab === 'Events' && (
              <EventsTab
                events={events}
                isAdmin={isAdmin}
                deletingId={deletingId}
                onEdit={setEditingEvent}
                onDelete={deleteEvent}
              />
            )}
            {tab === 'Orders' && <OrdersTab orders={orders} isAdmin={isAdmin} />}
            {tab === 'SINPE' && isAdmin && <SinpeTab />}
            {tab === 'Discounts' && isAdmin && <DiscountCodesTab events={events} />}
            {tab === 'New Event' && (
              <div className="max-w-2xl">
                <CreateEventForm
                  userId={user.id}
                  userEmail={user.email}
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

      {/* Reject reason modal */}
      {rejectingEvent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <h3 className="text-base font-semibold text-gray-900 mb-1">Reject event</h3>
            <p className="text-sm text-gray-500 mb-4">
              Rejecting <strong>{rejectingEvent.title}</strong>. Optionally provide a reason for the organizer.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason (optional)…"
              rows={3}
              className="input resize-none mb-4"
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setRejectingEvent(null); setRejectReason(''); }}
                className="text-sm font-medium text-gray-600 hover:text-gray-900 px-4 py-2 rounded-lg border border-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={rejectEvent}
                disabled={!!approvingId}
                className="text-sm font-medium bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors"
              >
                {approvingId ? 'Rejecting…' : 'Reject Event'}
              </button>
            </div>
          </div>
        </div>
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

/* ── Approvals ── */
function ApprovalsTab({ pendingEvents, approvingId, onApprove, onReject }) {
  if (pendingEvents.length === 0) {
    return (
      <div className="text-center py-24">
        <p className="text-gray-400 text-sm">No pending events. You're all caught up.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">{pendingEvents.length} event{pendingEvents.length !== 1 ? 's' : ''} awaiting review</p>
      {pendingEvents.map((event) => (
        <div key={event.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold text-gray-900">{event.title}</h3>
              {event.description && (
                <p className="text-sm text-gray-500 mt-1 line-clamp-2">{event.description}</p>
              )}
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-gray-500">
                <span>
                  {new Date(event.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                  {' · '}
                  {new Date(event.date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </span>
                <span>{event.location}</span>
                <span>{parseFloat(event.price) === 0 ? 'Free' : `$${parseFloat(event.price).toFixed(2)}`}</span>
                <span>{event.total_tickets} tickets</span>
                {event.organizer_email && <span>by {event.organizer_email}</span>}
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => onReject(event)}
                disabled={!!approvingId}
                className="text-sm font-medium text-red-600 hover:text-red-800 px-4 py-2 rounded-lg border border-red-200 hover:border-red-300 transition-colors disabled:opacity-50"
              >
                Reject
              </button>
              <button
                onClick={() => onApprove(event.id)}
                disabled={!!approvingId}
                className="text-sm font-medium bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors"
              >
                {approvingId === event.id ? 'Approving…' : 'Approve'}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Status badge ── */
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

/* ── Events ── */
function EventsTab({ events, isAdmin, deletingId, onEdit, onDelete }) {
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
            <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-widest">Status</th>
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
                <StatusBadge status={event.status ?? 'pending'} />
                {event.status === 'rejected' && event.rejection_reason && (
                  <p className="text-[11px] text-gray-400 mt-1 max-w-[160px] truncate" title={event.rejection_reason}>
                    {event.rejection_reason}
                  </p>
                )}
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
