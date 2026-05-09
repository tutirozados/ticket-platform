'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

const RATE = parseFloat(process.env.NEXT_PUBLIC_USD_TO_CRC_RATE ?? '515');
const fmtCRC = (usd) => Math.round(parseFloat(usd) * RATE).toLocaleString('es-CR');

export default function SinpeTab() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(null);
  const [toast, setToast] = useState(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('orders')
      .select('*, events(title)')
      .eq('payment_method', 'sinpe')
      .eq('payment_status', 'pending_sinpe')
      .order('created_at', { ascending: false });
    setOrders(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  function showToast(msg, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  async function handleConfirm(orderId) {
    setActing(orderId);
    const res = await fetch('/api/admin/confirm-sinpe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId }),
    });
    const data = await res.json();
    setActing(null);
    if (data.success) {
      showToast('Payment confirmed — ticket sent.');
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
    } else {
      showToast(data.error ?? 'Error confirming payment.', false);
    }
  }

  async function handleReject(orderId) {
    if (!confirm('Reject this SINPE payment? Tickets will be returned to inventory and the buyer will be notified.')) return;
    setActing(orderId);
    const res = await fetch('/api/admin/reject-sinpe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId }),
    });
    const data = await res.json();
    setActing(null);
    if (data.success) {
      showToast('Payment rejected — buyer notified.');
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
    } else {
      showToast(data.error ?? 'Error rejecting payment.', false);
    }
  }

  if (loading) return <div className="text-center py-24 text-gray-400 text-sm">Loading…</div>;

  return (
    <div className="space-y-4">
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-white ${toast.ok ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {orders.length === 0 ? 'No pending SINPE payments.' : `${orders.length} payment${orders.length !== 1 ? 's' : ''} awaiting confirmation`}
        </p>
        <button onClick={fetchOrders} className="text-xs text-gray-400 hover:text-gray-700 transition-colors">Refresh</button>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-24">
          <p className="text-gray-400 text-sm">All caught up — no pending SINPE payments.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-widest">Buyer</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-widest">Event</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-widest">Qty</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-widest">Amount</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-widest">Reference</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-widest">Submitted</th>
                <th className="px-6 py-3" />
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
                  <td className="px-6 py-4">
                    <p className="font-semibold text-gray-900">₡{fmtCRC(order.total_price)}</p>
                    <p className="text-xs text-gray-400">${parseFloat(order.total_price).toFixed(2)}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-mono text-sm font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                      {order.sinpe_reference}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-400 text-xs">
                    {new Date(order.created_at).toLocaleDateString('es-CR', { month: 'short', day: 'numeric' })}
                    {' '}
                    {new Date(order.created_at).toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => handleConfirm(order.id)}
                        disabled={acting === order.id}
                        className="text-xs font-medium bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition-colors"
                      >
                        {acting === order.id ? '…' : 'Confirm'}
                      </button>
                      <button
                        onClick={() => handleReject(order.id)}
                        disabled={acting === order.id}
                        className="text-xs font-medium text-red-600 hover:text-red-800 px-3 py-1.5 rounded-lg border border-red-200 hover:border-red-300 transition-colors disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
