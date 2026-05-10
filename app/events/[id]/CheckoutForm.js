'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

const DEFAULT_EXCHANGE_RATE = parseFloat(process.env.NEXT_PUBLIC_USD_TO_CRC_RATE ?? '515');

const emptyForm = {
  firstName: '',
  lastName: '',
  idNumber: '',
  email: '',
  confirmEmail: '',
  quantity: 1,
};

function generateRef() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function formatPhone(n) {
  const d = n.replace(/\D/g, '');
  return d.length === 8 ? `${d.slice(0, 4)}-${d.slice(4)}` : n;
}

export default function CheckoutForm({ event, selectedTier }) {
  const [form, setForm] = useState(emptyForm);
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [step, setStep] = useState('info'); // info | payment | sinpe-pending | success
  const [errorMsg, setErrorMsg] = useState('');
  const [paymentProcessing, setPaymentProcessing] = useState(false);

  const [discountInput, setDiscountInput] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState(null);
  const [discountStatus, setDiscountStatus] = useState(null);
  const [discountError, setDiscountError] = useState('');

  const [sinpeRef] = useState(() => generateRef());
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [sinpeNumber, setSinpeNumber] = useState('');
  const [exchangeRate, setExchangeRate] = useState(DEFAULT_EXCHANGE_RATE);

  useEffect(() => {
    fetch('/api/sinpe-config')
      .then((r) => r.json())
      .then((d) => {
        if (d.sinpeNumber) setSinpeNumber(d.sinpeNumber);
        if (d.exchangeRate) setExchangeRate(d.exchangeRate);
      })
      .catch(() => {});
  }, []);

  const currency = event.currency ?? 'USD';
  const isCRC = currency === 'CRC';
  const requireId = selectedTier
    ? (selectedTier.require_id ?? event.require_id ?? true)
    : (event.require_id ?? true);
  const fmtAmt = (n) => isCRC
    ? `₡${Math.round(n).toLocaleString('es-CR')}`
    : `$${parseFloat(n).toFixed(2)}`;

  const price = selectedTier ? parseFloat(selectedTier.effective_price ?? selectedTier.price) : parseFloat(event.price);
  const maxQty = selectedTier ? selectedTier.quantity_remaining : event.tickets_remaining;
  const baseTotal = price * form.quantity;
  const discountAmount = appliedDiscount?.amount ?? 0;
  const finalTotal = Math.max(0, baseTotal - discountAmount);
  const total = finalTotal.toFixed(2);
  const isFree = finalTotal === 0;
  const crcAmount = isCRC ? Math.round(finalTotal) : Math.round(finalTotal * exchangeRate);
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

  // Generate QR when payment step is shown
  useEffect(() => {
    if (step !== 'payment' || qrDataUrl) return;
    import('qrcode').then((QRCode) => {
      const text = `SINPE Movil\nNum: ${formatPhone(sinpeNumber)}\nMonto: CRC ${crcAmount.toLocaleString('es-CR')}\nRef: ${sinpeRef}`;
      QRCode.default.toDataURL(text, { width: 200, margin: 2 }).then(setQrDataUrl);
    });
  }, [step, qrDataUrl, crcAmount, sinpeRef, sinpeNumber]);

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

  // Creates Supabase order + sends ticket — for free tickets only
  const completeOrder = useCallback(async () => {
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
        payment_method: 'free',
        payment_status: 'confirmed',
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
      await fetch('/api/send-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id }),
      });
    } catch (err) {
      console.error('[checkout] send-ticket error:', err);
    }
  }, [event, form, total, loggedInUser, selectedTier, appliedDiscount]);

  function handleInfoSubmit(e) {
    e.preventDefault();
    setErrorMsg('');
    if (form.email !== form.confirmEmail) { setErrorMsg('Email addresses do not match.'); return; }
    if (form.quantity > maxQty) { setErrorMsg(`Only ${maxQty} tickets are available.`); return; }

    if (isFree) {
      setPaymentProcessing(true);
      completeOrder()
        .then(() => setStep('success'))
        .catch((err) => setErrorMsg(err.message))
        .finally(() => setPaymentProcessing(false));
    } else {
      setStep('payment');
    }
  }

  // ── SINPE submit ──────────────────────────────────────────────────────────
  async function handleSinpeSubmit() {
    setPaymentProcessing(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/sinpe-submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: event.id,
          firstName: form.firstName,
          lastName: form.lastName,
          idNumber: form.idNumber,
          email: form.email,
          quantity: form.quantity,
          totalUsd: total,
          crcAmount,
          sinpeReference: sinpeRef,
          userId: loggedInUser?.id ?? null,
          tierId: selectedTier?.id ?? null,
          tierName: selectedTier?.name ?? null,
          isEarlyBird: selectedTier?.is_early_bird ?? false,
          discountCodeId: appliedDiscount?.codeId ?? null,
          discountCode: appliedDiscount?.code ?? null,
          discountAmount: appliedDiscount?.amount ?? 0,
          ticketsRemaining: event.tickets_remaining,
          tierRemaining: selectedTier?.quantity_remaining ?? null,
          earlyBirdSold: selectedTier?.early_bird_sold ?? null,
          discountCurrentUses: appliedDiscount?.currentUses ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Submission failed');
      setStep('sinpe-pending');
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setPaymentProcessing(false);
    }
  }

  // ── SINPE PENDING ─────────────────────────────────────────────────────────
  if (step === 'sinpe-pending') {
    return (
      <div className="text-center py-4 space-y-3">
        <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mx-auto">
          <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-gray-900 font-semibold">Payment submitted!</p>
        <p className="text-sm text-gray-500">
          We'll confirm your SINPE transfer and send your ticket to{' '}
          <span className="font-medium">{form.email}</span> shortly.
        </p>
        <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 px-4 py-2 rounded-lg">
          <span className="text-xs text-blue-600">Reference:</span>
          <span className="font-mono font-bold text-blue-800">{sinpeRef}</span>
        </div>
        <p className="text-xs text-gray-400">Keep this reference in case you need to follow up.</p>
      </div>
    );
  }

  // ── SUCCESS ───────────────────────────────────────────────────────────────
  if (step === 'success') {
    return (
      <div className="text-center py-4">
        <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-gray-900 font-semibold">You&apos;re registered!</p>
        {selectedTier && <p className="text-sm text-gray-500 mt-0.5">{selectedTier.name} ticket</p>}
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

  // ── PAYMENT STEP ──────────────────────────────────────────────────────────
  if (step === 'payment') {
    return (
      <div className="space-y-4">
        {/* Order summary */}
        <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 space-y-1">
          <p className="text-sm font-semibold text-gray-800">Order summary</p>
          <div className="flex justify-between text-sm text-gray-500">
            <span>{form.firstName} {form.lastName} · {form.quantity} ticket{form.quantity > 1 ? 's' : ''}</span>
            <span>{fmtAmt(baseTotal)}</span>
          </div>
          {appliedDiscount && (
            <div className="flex justify-between text-sm text-green-600">
              <span>Discount ({appliedDiscount.code})</span>
              <span>−{fmtAmt(discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-semibold text-gray-900 border-t border-gray-200 pt-1 mt-1">
            <span>Total</span>
            <span>{fmtAmt(finalTotal)}</span>
          </div>
        </div>

        {errorMsg && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {errorMsg}
          </div>
        )}

        {/* SINPE Móvil */}
        <div className="space-y-4">
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">SINPE Móvil</span>
                {qrDataUrl && (
                  <img src={qrDataUrl} alt="QR SINPE" className="w-16 h-16 rounded" />
                )}
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-blue-700">Número</span>
                  <span className="font-mono font-bold text-blue-900 text-lg">{formatPhone(sinpeNumber)}</span>
                </div>
                <div className="flex justify-between items-start">
                  <span className="text-sm text-blue-700">Monto exacto</span>
                  <div className="text-right">
                    <span className="font-bold text-blue-900 text-lg">₡{crcAmount.toLocaleString('es-CR')}</span>
                    {!isCRC && (
                      <p className="text-xs text-blue-500 mt-0.5">= ${finalTotal.toFixed(2)} USD</p>
                    )}
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-blue-700">Referencia</span>
                  <span className="font-mono font-bold text-blue-900">{sinpeRef}</span>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 space-y-1.5 text-sm text-amber-800">
              <p className="font-semibold text-amber-900 mb-1">Instrucciones</p>
              <p>1. Abre SINPE Móvil en tu teléfono</p>
              <p>2. Transfiere <strong>₡{crcAmount.toLocaleString('es-CR')}</strong>{!isCRC && ` (= $${finalTotal.toFixed(2)} USD)`} al número <strong>{formatPhone(sinpeNumber)}</strong></p>
              <p>3. Escribe <strong>{sinpeRef}</strong> en el campo de descripción/referencia</p>
              <p>4. Haz clic en &quot;Ya pagué&quot;</p>
            </div>

            <button
              type="button"
              onClick={handleSinpeSubmit}
              disabled={paymentProcessing}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white text-sm font-medium py-2.5 px-4 rounded-lg transition-colors"
            >
              {paymentProcessing ? 'Enviando…' : 'Ya pagué — enviar comprobante'}
            </button>
            <p className="text-xs text-center text-gray-400">
              Tu entrada llegará por email una vez confirmemos la transferencia.
            </p>
        </div>

        <button
          type="button"
          onClick={() => { setStep('info'); setErrorMsg(''); }}
          className="w-full text-sm text-gray-500 hover:text-gray-700 text-center"
        >
          ← Back
        </button>
      </div>
    );
  }

  // ── INFO STEP ─────────────────────────────────────────────────────────────
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

      {requireId && (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">ID Number (Cédula)</label>
          <input type="text" name="idNumber" value={form.idNumber} onChange={handleChange} placeholder="0000000000" required className="input" />
        </div>
      )}

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
            ✓ {appliedDiscount.type === 'percentage' ? `${appliedDiscount.value}%` : fmtAmt(appliedDiscount.value)} off applied — you save {fmtAmt(appliedDiscount.amount)}
          </p>
        )}
        {discountStatus === 'invalid' && <p className="text-xs text-red-500">{discountError}</p>}
      </div>

      {/* Totals */}
      <div className="border-t border-gray-100 pt-4 space-y-1.5">
        <div className="flex justify-between text-sm text-gray-500">
          <span>{fmtAmt(price)} × {form.quantity}</span>
          <span>{fmtAmt(baseTotal)}</span>
        </div>
        {appliedDiscount && (
          <div className="flex justify-between text-sm text-green-600">
            <span>Discount ({appliedDiscount.code})</span>
            <span>−{fmtAmt(discountAmount)}</span>
          </div>
        )}
        <div className="flex justify-between text-sm font-semibold text-gray-900">
          <span>Total</span>
          <span>{isFree ? 'Free' : fmtAmt(finalTotal)}</span>
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
