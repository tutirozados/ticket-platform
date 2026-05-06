'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

const initialForm = {
  firstName: '',
  lastName: '',
  idNumber: '',
  email: '',
  confirmEmail: '',
  quantity: 1,
};

export default function CheckoutForm({ event }) {
  const [form, setForm] = useState(initialForm);
  const [status, setStatus] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const price = parseFloat(event.price);
  const total = (price * form.quantity).toFixed(2);
  const isFree = price === 0;

  const emailMismatch = form.confirmEmail && form.confirmEmail !== form.email;

  function handleChange(e) {
    const value = e.target.name === 'quantity' ? parseInt(e.target.value, 10) : e.target.value;
    setForm((prev) => ({ ...prev, [e.target.name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg('');

    if (form.email !== form.confirmEmail) {
      setErrorMsg('Email addresses do not match.');
      setStatus('error');
      return;
    }

    if (form.quantity > event.tickets_remaining) {
      setErrorMsg(`Only ${event.tickets_remaining} tickets are available.`);
      setStatus('error');
      return;
    }

    setStatus('loading');

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        event_id: event.id,
        buyer_name: `${form.firstName} ${form.lastName}`,
        buyer_email: form.email,
        first_name: form.firstName,
        last_name: form.lastName,
        id_number: form.idNumber,
        quantity: form.quantity,
        total_price: parseFloat(total),
      })
      .select('id')
      .single();

    if (orderError) {
      setErrorMsg(orderError.message);
      setStatus('error');
      return;
    }

    const { error: updateError } = await supabase
      .from('events')
      .update({ tickets_remaining: event.tickets_remaining - form.quantity })
      .eq('id', event.id);

    if (updateError) {
      setErrorMsg('Order placed but ticket count could not be updated.');
      setStatus('error');
      return;
    }

    try {
      const res = await fetch('/api/send-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        console.error('[checkout] send-ticket failed:', detail);
      }
    } catch (err) {
      console.error('[checkout] send-ticket request error:', err);
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
          Your ticket is on its way to <span className="font-medium">{form.email}</span>.
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

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">First Name</label>
          <input
            type="text"
            name="firstName"
            value={form.firstName}
            onChange={handleChange}
            placeholder="Jane"
            required
            className="input"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">Last Name</label>
          <input
            type="text"
            name="lastName"
            value={form.lastName}
            onChange={handleChange}
            placeholder="Smith"
            required
            className="input"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-700">ID Number (Cédula)</label>
        <input
          type="text"
          name="idNumber"
          value={form.idNumber}
          onChange={handleChange}
          placeholder="0000000000"
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
        <label className="text-sm font-medium text-gray-700">Confirm Email</label>
        <input
          type="email"
          name="confirmEmail"
          value={form.confirmEmail}
          onChange={handleChange}
          placeholder="jane@example.com"
          required
          className={`input ${emailMismatch ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10' : ''}`}
        />
        {emailMismatch && (
          <p className="text-xs text-red-500">Email addresses do not match.</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-700">Quantity</label>
        <select name="quantity" value={form.quantity} onChange={handleChange} className="input">
          {Array.from(
            { length: Math.min(10, event.tickets_remaining) },
            (_, i) => i + 1
          ).map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </div>

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
        disabled={status === 'loading' || emailMismatch}
        className="w-full bg-gray-900 hover:bg-gray-700 disabled:bg-gray-400 text-white text-sm font-medium py-2.5 px-4 rounded-lg transition-colors"
      >
        {status === 'loading' ? 'Processing…' : isFree ? 'Register for Free' : `Pay $${total}`}
      </button>

      <p className="text-xs text-center text-gray-400">
        No payment required for now — Stripe coming soon.
      </p>
    </form>
  );
}
