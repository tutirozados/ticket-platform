'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function CheckoutForm({ event }) {
  const [form, setForm] = useState({ name: '', email: '', quantity: 1 });
  const [status, setStatus] = useState(null); // 'loading' | 'success' | 'error'
  const [errorMsg, setErrorMsg] = useState('');

  const price = parseFloat(event.price);
  const total = (price * form.quantity).toFixed(2);
  const isFree = price === 0;

  function handleChange(e) {
    const value = e.target.name === 'quantity' ? parseInt(e.target.value, 10) : e.target.value;
    setForm((prev) => ({ ...prev, [e.target.name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus('loading');
    setErrorMsg('');

    if (form.quantity > event.tickets_remaining) {
      setErrorMsg(`Only ${event.tickets_remaining} tickets are available.`);
      setStatus('error');
      return;
    }

    // Create the order
    const { error: orderError } = await supabase.from('orders').insert({
      event_id: event.id,
      buyer_name: form.name,
      buyer_email: form.email,
      quantity: form.quantity,
      total_price: parseFloat(total),
    });

    if (orderError) {
      setErrorMsg(orderError.message);
      setStatus('error');
      return;
    }

    // Decrement tickets_remaining
    const { error: updateError } = await supabase
      .from('events')
      .update({ tickets_remaining: event.tickets_remaining - form.quantity })
      .eq('id', event.id);

    if (updateError) {
      setErrorMsg('Order placed but ticket count could not be updated.');
      setStatus('error');
      return;
    }

    setStatus('success');
  }

  if (status === 'success') {
    return (
      <div className="text-center py-4">
        <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-gray-900 font-semibold">You're registered!</p>
        <p className="text-gray-500 text-sm mt-1">
          A confirmation will be sent to <span className="font-medium">{form.email}</span>.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {status === 'error' && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {errorMsg || 'Something went wrong. Please try again.'}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-700">Full Name</label>
        <input
          type="text"
          name="name"
          value={form.name}
          onChange={handleChange}
          placeholder="Jane Smith"
          required
          className="input"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-700">Email</label>
        <input
          type="email"
          name="email"
          value={form.email}
          onChange={handleChange}
          placeholder="jane@example.com"
          required
          className="input"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-700">Quantity</label>
        <select
          name="quantity"
          value={form.quantity}
          onChange={handleChange}
          className="input"
        >
          {Array.from(
            { length: Math.min(10, event.tickets_remaining) },
            (_, i) => i + 1
          ).map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </div>

      {/* Order summary */}
      <div className="border-t border-gray-100 pt-4 space-y-1.5">
        <div className="flex justify-between text-sm text-gray-500">
          <span>{isFree ? 'Free' : `$${price.toFixed(2)}`} × {form.quantity}</span>
          <span>{isFree ? 'Free' : `$${total}`}</span>
        </div>
        <div className="flex justify-between text-sm font-semibold text-gray-900">
          <span>Total</span>
          <span>{isFree ? 'Free' : `$${total}`}</span>
        </div>
      </div>

      <button
        type="submit"
        disabled={status === 'loading'}
        className="w-full bg-gray-900 hover:bg-gray-700 disabled:bg-gray-400 text-white text-sm font-medium py-2.5 px-4 rounded-lg transition-colors"
      >
        {status === 'loading'
          ? 'Processing…'
          : isFree
          ? 'Register for Free'
          : `Pay $${total}`}
      </button>

      <p className="text-xs text-center text-gray-400">
        No payment required for now — Stripe coming soon.
      </p>
    </form>
  );
}
