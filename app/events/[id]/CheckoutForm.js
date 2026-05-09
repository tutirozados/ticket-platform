'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { PayPalScriptProvider, PayPalButtons, FUNDING } from '@paypal/react-paypal-js';
import { supabase } from '@/lib/supabase';

const PAYPAL_CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_LIVE !== 'true'
  ? process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID_SANDBOX
  : process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID_LIVE;

const emptyForm = {
  firstName: '',
  lastName: '',
  idNumber: '',
  email: '',
  confirmEmail: '',
  quantity: 1,
};


export default function CheckoutForm({ event, selectedTier }) {
  const [form, setForm] = useState(emptyForm);
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [step, setStep] = useState('info'); // 'info' | 'payment' | 'success'
  const [errorMsg, setErrorMsg] = useState('');
  const [paymentProcessing, setPaymentProcessing] = useState(false);

  const [discountInput, setDiscountInput] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState(null);
  const [discountStatus, setDiscountStatus] = useState(null);
  const [discountError, setDiscountError] = useState('');

  const price = selectedTier ? parseFloat(selectedTier.effective_price ?? selectedTier.price) : parseFloat(event.price);
  const maxQty = selectedTier ? selectedTier.quantity_remaining : event.tickets_remaining;
  const baseTotal = price * form.quantity;
  const discountAmount = appliedDiscount?.amount ?? 0;
  const finalTotal = Math.max(0, baseTotal - discountAmount);
  const total = finalTotal.toFixed(2);
  const isFree = finalTotal === 0;
  const emailMismatch = form.confirmEmail && form.confirmEmail !== form.email;

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setLoggedInUser(user);
      const meta = user.user_metadata ?? {};
      setForm((prev) => ({
        ...prev,
        firstName: meta.first_name ?? '',
        lastName: meta.last_name ?? '',
        email: user.email ?? '',
        confirmEmail: user.email ?? '',
      }));
    });
  }, []);

  function handleChange(e) {
    const value = e.target.name === 'quantity' ? parseInt(e.target.value, 10) : e.target.value;
    setForm((prev) => ({ ...prev, [e.target.name]: value }));
  }

  async function applyDiscount() {
    if (!discountInput.trim()) return;
    setDiscountStatus('loading');
    setDiscountError('');
    const res = await fetch('/api/validate-discount', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: discountInput, eventId: event.id, subtotal: baseTotal }),
    });
    const data = await res.json();
    if (data.valid) {
      setAppliedDiscount(data);
      setDiscountStatus('valid');
    } else {
      setAppliedDiscount(null);
      setDiscountStatus('invalid');
      setDiscountError(data.error);
    }
  }

  // Creates the Supabase order and sends the ticket — called after payment (or free)
  const completeOrder = useCallback(async (captureId = null) => {
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
        user_id: loggedInUser?.id ?? null,
        tier_id: selectedTier?.id ?? null,
        tier_name: selectedTier?.name ?? null,
        discount_code_id: appliedDiscount?.codeId ?? null,
        discount_code: appliedDiscount?.code ?? null,
        discount_amount: appliedDiscount?.amount ?? 0,
        is_early_bird: selectedTier?.is_early_bird ?? false,
        paypal_capture_id: captureId,
      })
      .select('id')
      .single();

    if (orderError) throw new Error(orderError.message);

    await supabase
      .from('events')
      .update({ tickets_remaining: event.tickets_remaining - form.quantity })
      .eq('id', event.id);

    if (selectedTier) {
      const tierUpdate = { quantity_remaining: selectedTier.quantity_remaining - form.quantity };
      if (selectedTier.is_early_bird) {
        tierUpdate.early_bird_sold = (selectedTier.early_bird_sold ?? 0) + form.quantity;
      }
      await supabase.from('ticket_tiers').update(tierUpdate).eq('id', selectedTier.id);
    }

    if (appliedDiscount) {
      await supabase
        .from('discount_codes')
        .update({ times_used: appliedDiscount.currentUses + 1 })
        .eq('id', appliedDiscount.codeId);
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
      console.error('[checkout] send-ticket error:', err);
    }
  }, [event, form, total, loggedInUser, selectedTier, appliedDiscount]);

  function handleInfoSubmit(e) {
    e.preventDefault();
    setErrorMsg('');

    if (form.email !== form.confirmEmail) {
      setErrorMsg('Email addresses do not match.');
      return;
    }
    if (form.quantity > maxQty) {
      setErrorMsg(`Only ${maxQty} tickets are available.`);
      return;
    }

    if (isFree) {
      // Free ticket — skip payment
      setPaymentProcessing(true);
      completeOrder(null)
        .then(() => setStep('success'))
        .catch((err) => setErrorMsg(err.message))
        .finally(() => setPaymentProcessing(false));
    } else {
      setStep('payment');
    }
  }

  // PayPal callbacks
  async function createPayPalOrder() {
    const res = await fetch('/api/paypal/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: total }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Could not create PayPal order');
    return data.id;
  }

  async function onPayPalApprove(data) {
    setPaymentProcessing(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/paypal/capture-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: data.orderID }),
      });
      const capture = await res.json();
      if (!res.ok) throw new Error(capture.error ?? 'Payment capture failed');
      await completeOrder(capture.captureId);
      setStep('success');
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setPaymentProcessing(false);
    }
  }

  function onPayPalError(err) {
    setErrorMsg(err?.message ?? 'PayPal encountered an error. Please try again.');
    setPaymentProcessing(false);
  }

  // ── SUCCESS ──────────────────────────────────────────────────────────────────
  if (step === 'success') {
    return (
      <div className="text-center py-4">
        <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-gray-900 font-semibold">You&apos;re registered!</p>
        {selectedTier && (
          <p className="text-sm text-gray-500 mt-0.5">{selectedTier.name} ticket</p>
        )}
        <p className="text-gray-500 text-sm mt-1">
          Your ticket is on its way to <span className="font-medium">{form.email}</span>.
        </p>
        {loggedInUser ? (
          <Link href="/my-tickets" className="mt-4 inline-block text-sm font-medium text-gray-900 hover:underline">
            View my tickets →
          </Link>
        ) : (
          <p className="mt-4 text-xs text-gray-400">
            <Link href="/signup" className="text-gray-700 font-medium hover:underline">Create an account</Link>
            {' '}to view your tickets anytime.
          </p>
        )}
      </div>
    );
  }

  // ── PAYMENT STEP ─────────────────────────────────────────────────────────────
  if (step === 'payment') {
    return (
      <PayPalScriptProvider options={{
        clientId: PAYPAL_CLIENT_ID,
        components: 'buttons',
        currency: 'USD',
      }}>
        <div className="space-y-4">
          {/* Order summary */}
          <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 space-y-1">
            <p className="text-sm font-semibold text-gray-800">Order summary</p>
            <div className="flex justify-between text-sm text-gray-500">
              <span>{form.firstName} {form.lastName} · {form.quantity} ticket{form.quantity > 1 ? 's' : ''}</span>
              <span>${baseTotal.toFixed(2)}</span>
            </div>
            {appliedDiscount && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Discount ({appliedDiscount.code})</span>
                <span>−${discountAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-semibold text-gray-900 border-t border-gray-200 pt-1 mt-1">
              <span>Total</span>
              <span>${total}</span>
            </div>
          </div>

          {errorMsg && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {errorMsg}
            </div>
          )}

          <PayPalButtons
            fundingSource={FUNDING.PAYPAL}
            createOrder={createPayPalOrder}
            onApprove={onPayPalApprove}
            onError={onPayPalError}
            disabled={paymentProcessing}
            style={{ layout: 'vertical', shape: 'rect', label: 'pay', height: 44 }}
          />

          <p className="text-xs text-center text-gray-400">
            Secure payment via PayPal. No PayPal account? Pay with card after clicking the button above.
          </p>

          <button
            type="button"
            onClick={() => { setStep('info'); setErrorMsg(''); }}
            className="w-full text-sm text-gray-500 hover:text-gray-700 text-center"
          >
            ← Back
          </button>
        </div>
      </PayPalScriptProvider>
    );
  }

  // ── INFO STEP ─────────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleInfoSubmit} className="space-y-4">
      {!loggedInUser && (
        <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-600 flex items-center gap-2">
          <svg className="w-4 h-4 shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span>
            <Link href={`/login?redirect=${encodeURIComponent(`/events/${event.id}`)}`} className="font-medium text-gray-900 hover:underline">Sign in</Link>
            {' '}to save your tickets to your profile.
          </span>
        </div>
      )}

      {loggedInUser && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 flex items-center gap-2">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Signed in — your ticket will be saved to your account.
        </div>
      )}

      {errorMsg && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">First Name</label>
          <input type="text" name="firstName" value={form.firstName} onChange={handleChange} placeholder="Jane" required className="input" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">Last Name</label>
          <input type="text" name="lastName" value={form.lastName} onChange={handleChange} placeholder="Smith" required className="input" />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-700">ID Number (Cédula)</label>
        <input type="text" name="idNumber" value={form.idNumber} onChange={handleChange} placeholder="0000000000" required className="input" />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-700">Email</label>
        <input type="email" name="email" value={form.email} onChange={handleChange} placeholder="jane@example.com" required className="input" />
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
        {emailMismatch && <p className="text-xs text-red-500">Email addresses do not match.</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-700">Quantity</label>
        <select name="quantity" value={form.quantity} onChange={handleChange} className="input">
          {Array.from({ length: Math.min(10, maxQty) }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </div>

      {/* Discount code */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-700">Discount Code</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={discountInput}
            onChange={(e) => {
              setDiscountInput(e.target.value.toUpperCase());
              if (appliedDiscount) { setAppliedDiscount(null); setDiscountStatus(null); }
            }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyDiscount(); } }}
            placeholder="Enter code"
            className="input flex-1 font-mono uppercase"
            disabled={!!appliedDiscount}
          />
          <button
            type="button"
            onClick={appliedDiscount ? () => { setAppliedDiscount(null); setDiscountStatus(null); setDiscountInput(''); } : applyDiscount}
            disabled={discountStatus === 'loading'}
            className="text-sm font-medium px-3 py-2 border border-gray-200 rounded-lg hover:border-gray-300 text-gray-600 hover:text-gray-900 transition-colors whitespace-nowrap disabled:opacity-50"
          >
            {discountStatus === 'loading' ? '…' : appliedDiscount ? 'Remove' : 'Apply'}
          </button>
        </div>
        {discountStatus === 'valid' && appliedDiscount && (
          <p className="text-xs text-green-600 font-medium">
            ✓ {appliedDiscount.type === 'percentage' ? `${appliedDiscount.value}%` : `$${appliedDiscount.value}`} off applied — you save ${appliedDiscount.amount.toFixed(2)}
          </p>
        )}
        {discountStatus === 'invalid' && (
          <p className="text-xs text-red-500">{discountError}</p>
        )}
      </div>

      {/* Totals */}
      <div className="border-t border-gray-100 pt-4 space-y-1.5">
        <div className="flex justify-between text-sm text-gray-500">
          <span>{`$${price.toFixed(2)}`} × {form.quantity}</span>
          <span>${baseTotal.toFixed(2)}</span>
        </div>
        {appliedDiscount && (
          <div className="flex justify-between text-sm text-green-600">
            <span>Discount ({appliedDiscount.code})</span>
            <span>−${discountAmount.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between text-sm font-semibold text-gray-900">
          <span>Total</span>
          <span>{isFree ? 'Free' : `$${total}`}</span>
        </div>
      </div>

      <button
        type="submit"
        disabled={paymentProcessing || emailMismatch}
        className="w-full bg-gray-900 hover:bg-gray-700 disabled:bg-gray-400 text-white text-sm font-medium py-2.5 px-4 rounded-lg transition-colors"
      >
        {paymentProcessing ? 'Processing…' : isFree ? 'Register for Free' : 'Continue to Payment →'}
      </button>
    </form>
  );
}
