'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function MyTicketsPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resendingId, setResendingId] = useState(null);
  const [resentId, setResentId] = useState(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/login'); return; }
      setUser(user);

      const { data } = await supabase
        .from('orders')
        .select('*, events(*), tickets(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      setOrders(data ?? []);
      setLoading(false);
    });
  }, [router]);

  async function resendTicket(orderId) {
    setResendingId(orderId);
    await fetch('/api/send-ticket', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId }),
    });
    setResendingId(null);
    setResentId(orderId);
    setTimeout(() => setResentId(null), 3000);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/');
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400 text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-gray-900 tracking-tight">FOMO</Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400 hidden sm:block">{user?.email}</span>
            <button
              onClick={handleSignOut}
              className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">My Tickets</h1>

        {orders.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-gray-400 text-lg mb-6">No tickets yet.</p>
            <Link
              href="/"
              className="text-sm font-medium bg-gray-900 text-white px-5 py-2.5 rounded-lg hover:bg-gray-700 transition-colors"
            >
              Browse Events
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {orders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                resendingId={resendingId}
                resentId={resentId}
                onResend={resendTicket}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function OrderCard({ order, resendingId, resentId, onResend }) {
  const event = order.events;
  const tickets = order.tickets ?? [];

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Event header */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold text-gray-900">{event?.title ?? 'Event'}</h2>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-gray-500">
            {event?.date && (
              <span>
                {new Date(event.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                {' · '}
                {new Date(event.date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              </span>
            )}
            {event?.location && <span>{event.location}</span>}
          </div>
        </div>
        <button
          onClick={() => onResend(order.id)}
          disabled={resendingId === order.id}
          className="shrink-0 text-xs font-medium text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors disabled:opacity-50"
        >
          {resendingId === order.id ? 'Sending…' : resentId === order.id ? '✓ Sent!' : 'Email PDF'}
        </button>
      </div>

      {/* Tickets */}
      <div className="divide-y divide-gray-100">
        {tickets.map((ticket) => (
          <TicketRow key={ticket.id} ticket={ticket} />
        ))}
      </div>
    </div>
  );
}

function TicketRow({ ticket }) {
  return (
    <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-center gap-5">
      <QRCodeImg code={ticket.ticket_code} />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-400 mb-1">Ticket code</p>
        <p className="font-mono text-sm text-gray-900 tracking-wide">{ticket.ticket_code}</p>
        <div className="mt-3">
          {ticket.is_used ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              Used
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              Valid
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function QRCodeImg({ code }) {
  const [src, setSrc] = useState(null);

  useEffect(() => {
    import('qrcode').then((mod) => {
      const QRCode = mod.default;
      QRCode.toDataURL(code, { width: 140, margin: 1 }).then(setSrc);
    });
  }, [code]);

  if (!src) {
    return <div className="w-[140px] h-[140px] shrink-0 bg-gray-100 rounded-xl animate-pulse" />;
  }
  return <img src={src} alt="QR code" className="w-[140px] h-[140px] shrink-0 rounded-xl border border-gray-100" />;
}
