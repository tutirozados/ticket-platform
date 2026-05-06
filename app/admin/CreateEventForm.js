'use client';

import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';

const COLORS = [
  { id: 'gray',   label: 'Gray',   dot: 'bg-gray-400' },
  { id: 'blue',   label: 'Blue',   dot: 'bg-blue-500' },
  { id: 'purple', label: 'Purple', dot: 'bg-purple-500' },
  { id: 'green',  label: 'Green',  dot: 'bg-green-500' },
  { id: 'amber',  label: 'Amber',  dot: 'bg-amber-400' },
  { id: 'rose',   label: 'Rose',   dot: 'bg-rose-500' },
];

const initialForm = {
  title: '',
  description: '',
  date: '',
  time: '',
  location: '',
  price: '',
  total_tickets: '',
};

function newTier() {
  return {
    _key: Math.random().toString(36).slice(2),
    name: '',
    description: '',
    price: '',
    total_quantity: '',
    color: 'gray',
    benefits: [],
    benefitInput: '',
    early_bird_enabled: false,
    early_bird_price: '',
    early_bird_quantity: '',
    early_bird_deadline: '',
  };
}

export default function CreateEventForm({ onCreated, userId, userEmail }) {
  const [form, setForm] = useState(initialForm);
  const [tiers, setTiers] = useState([]);
  const [status, setStatus] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const dragIdx = useRef(null);
  const dragOverIdx = useRef(null);

  const hasTiers = tiers.length > 0;

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  /* ── Tier helpers ── */
  function addTier() {
    setTiers((prev) => [...prev, newTier()]);
  }

  function removeTier(key) {
    setTiers((prev) => prev.filter((t) => t._key !== key));
  }

  function updateTier(key, field, value) {
    setTiers((prev) => prev.map((t) => t._key === key ? { ...t, [field]: value } : t));
  }

  function addBenefit(key) {
    setTiers((prev) => prev.map((t) => {
      if (t._key !== key || !t.benefitInput.trim()) return t;
      return { ...t, benefits: [...t.benefits, t.benefitInput.trim()], benefitInput: '' };
    }));
  }

  function removeBenefit(key, idx) {
    setTiers((prev) => prev.map((t) => {
      if (t._key !== key) return t;
      return { ...t, benefits: t.benefits.filter((_, i) => i !== idx) };
    }));
  }

  function handleDragStart(idx) { dragIdx.current = idx; }
  function handleDragOver(e, idx) { e.preventDefault(); dragOverIdx.current = idx; }
  function handleDrop() {
    const from = dragIdx.current;
    const to = dragOverIdx.current;
    if (from === null || to === null || from === to) { dragIdx.current = null; dragOverIdx.current = null; return; }
    const next = [...tiers];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setTiers(next);
    dragIdx.current = null;
    dragOverIdx.current = null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus('loading');
    setErrorMsg('');

    if (hasTiers) {
      const invalid = tiers.find((t) => !t.name || !t.price || !t.total_quantity);
      if (invalid) {
        setErrorMsg('Each tier needs a name, price, and quantity.');
        setStatus('error');
        return;
      }
    }

    const datetime = new Date(`${form.date}T${form.time}`).toISOString();

    const totalTickets = hasTiers
      ? tiers.reduce((s, t) => s + parseInt(t.total_quantity, 10), 0)
      : parseInt(form.total_tickets, 10);

    const eventPrice = hasTiers
      ? Math.min(...tiers.map((t) => parseFloat(t.price)))
      : parseFloat(form.price);

    const { data: event, error: eventError } = await supabase
      .from('events')
      .insert({
        title: form.title,
        description: form.description,
        date: datetime,
        location: form.location,
        price: eventPrice,
        total_tickets: totalTickets,
        tickets_remaining: totalTickets,
        user_id: userId,
        organizer_email: userEmail,
        status: 'pending',
      })
      .select('id')
      .single();

    if (eventError || !event) {
      setErrorMsg(eventError?.message ?? 'Failed to create event.');
      setStatus('error');
      return;
    }

    if (hasTiers) {
      const { error: tierError } = await supabase.from('ticket_tiers').insert(
        tiers.map((t) => ({
          event_id: event.id,
          name: t.name,
          description: t.description || null,
          price: parseFloat(t.price),
          total_quantity: parseInt(t.total_quantity, 10),
          quantity_remaining: parseInt(t.total_quantity, 10),
          color: t.color,
          benefits: t.benefits,
          is_active: true,
          early_bird_price: t.early_bird_enabled && t.early_bird_price ? parseFloat(t.early_bird_price) : null,
          early_bird_quantity: t.early_bird_enabled && t.early_bird_quantity ? parseInt(t.early_bird_quantity, 10) : null,
          early_bird_deadline: t.early_bird_enabled && t.early_bird_deadline ? new Date(t.early_bird_deadline).toISOString() : null,
          early_bird_sold: 0,
        }))
      );
      if (tierError) {
        setErrorMsg('Event created but tiers could not be saved: ' + tierError.message);
        setStatus('error');
        return;
      }
    }

    setStatus('success');
    setForm(initialForm);
    setTiers([]);
    onCreated?.();
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-6">New Event</h2>

      {status === 'success' && (
        <div className="mb-6 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          Event submitted for review. It will go live once approved.
        </div>
      )}
      {status === 'error' && (
        <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {errorMsg || 'Something went wrong. Please try again.'}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Field label="Title" required>
          <input type="text" name="title" value={form.title} onChange={handleChange} placeholder="Concert, conference, workshop…" required className="input" />
        </Field>

        <Field label="Description">
          <textarea name="description" value={form.description} onChange={handleChange} rows={3} placeholder="Tell attendees what to expect…" className="input resize-none" />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Date" required>
            <input type="date" name="date" value={form.date} onChange={handleChange} required className="input" />
          </Field>
          <Field label="Time" required>
            <input type="time" name="time" value={form.time} onChange={handleChange} required className="input" />
          </Field>
        </div>

        <Field label="Location" required>
          <input type="text" name="location" value={form.location} onChange={handleChange} placeholder="Venue name or address" required className="input" />
        </Field>

        {/* Price + Qty — hidden when tiers are used */}
        {!hasTiers && (
          <div className="grid grid-cols-2 gap-4">
            <Field label="Price (USD)" required>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input type="number" name="price" value={form.price} onChange={handleChange} min="0" step="0.01" placeholder="0.00" required className="input pl-7" />
              </div>
            </Field>
            <Field label="Total Tickets" required>
              <input type="number" name="total_tickets" value={form.total_tickets} onChange={handleChange} min="1" step="1" placeholder="100" required className="input" />
            </Field>
          </div>
        )}

        {/* ── Ticket Tiers ── */}
        <div className="border-t border-gray-100 pt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-semibold text-gray-900">Ticket Tiers</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {hasTiers ? 'Price and quantity are set per tier.' : 'Optional — add multiple price levels.'}
              </p>
            </div>
            <button type="button" onClick={addTier} className="text-xs font-medium text-gray-700 hover:text-gray-900 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
              + Add Tier
            </button>
          </div>

          <div className="space-y-4">
            {tiers.map((tier, idx) => (
              <TierCard
                key={tier._key}
                tier={tier}
                idx={idx}
                total={tiers.length}
                onUpdate={(f, v) => updateTier(tier._key, f, v)}
                onRemove={() => removeTier(tier._key)}
                onAddBenefit={() => addBenefit(tier._key)}
                onRemoveBenefit={(i) => removeBenefit(tier._key, i)}
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={handleDrop}
              />
            ))}
          </div>
        </div>

        <div className="pt-2">
          <button type="submit" disabled={status === 'loading'} className="w-full bg-gray-900 hover:bg-gray-700 disabled:bg-gray-400 text-white text-sm font-medium py-2.5 px-4 rounded-lg transition-colors">
            {status === 'loading' ? 'Creating event…' : 'Create Event'}
          </button>
        </div>
      </form>
    </div>
  );
}

function TierCard({ tier, idx, total, onUpdate, onRemove, onAddBenefit, onRemoveBenefit, onDragStart, onDragOver, onDrop }) {
  return (
    <div
      className="border border-gray-200 rounded-xl p-4 bg-gray-50"
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="cursor-grab text-gray-300 hover:text-gray-500 select-none" title="Drag to reorder">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="9" cy="6" r="1.5" /><circle cx="9" cy="12" r="1.5" /><circle cx="9" cy="18" r="1.5" />
            <circle cx="15" cy="6" r="1.5" /><circle cx="15" cy="12" r="1.5" /><circle cx="15" cy="18" r="1.5" />
          </svg>
        </div>
        <span className="text-xs font-medium text-gray-500">Tier {idx + 1}</span>
        <button type="button" onClick={onRemove} className="ml-auto text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50 transition-colors">
          Remove
        </button>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-600">Name<span className="text-red-500 ml-0.5">*</span></label>
            <input type="text" value={tier.name} onChange={(e) => onUpdate('name', e.target.value)} placeholder="General, VIP, Early Bird…" className="input text-sm" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-600">Color</label>
            <div className="flex gap-1.5 pt-1">
              {COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onUpdate('color', c.id)}
                  title={c.label}
                  className={`w-6 h-6 rounded-full ${c.dot} transition-transform hover:scale-110 ${tier.color === c.id ? 'ring-2 ring-offset-1 ring-gray-400 scale-110' : ''}`}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-gray-600">Description</label>
          <input type="text" value={tier.description} onChange={(e) => onUpdate('description', e.target.value)} placeholder="Short description…" className="input text-sm" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-600">Price (USD)<span className="text-red-500 ml-0.5">*</span></label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <input type="number" value={tier.price} onChange={(e) => onUpdate('price', e.target.value)} min="0" step="0.01" placeholder="0.00" className="input pl-7 text-sm" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-600">Quantity<span className="text-red-500 ml-0.5">*</span></label>
            <input type="number" value={tier.total_quantity} onChange={(e) => onUpdate('total_quantity', e.target.value)} min="1" step="1" placeholder="100" className="input text-sm" />
          </div>
        </div>

        {/* Benefits */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-gray-600">Benefits</label>
          {tier.benefits.length > 0 && (
            <ul className="space-y-1 mb-1">
              {tier.benefits.map((b, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-gray-700">
                  <span className="text-green-500">✓</span>
                  <span className="flex-1">{b}</span>
                  <button type="button" onClick={() => onRemoveBenefit(i)} className="text-gray-300 hover:text-red-400">×</button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={tier.benefitInput}
              onChange={(e) => onUpdate('benefitInput', e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onAddBenefit(); } }}
              placeholder="e.g. Front row seating"
              className="input text-sm flex-1"
            />
            <button type="button" onClick={onAddBenefit} className="text-xs font-medium px-3 py-2 border border-gray-200 rounded-lg hover:border-gray-300 text-gray-600 hover:text-gray-900 transition-colors">
              Add
            </button>
          </div>
        </div>

        {/* Early Bird */}
        <div className="border-t border-gray-200 pt-3">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={tier.early_bird_enabled}
              onChange={(e) => onUpdate('early_bird_enabled', e.target.checked)}
              className="rounded"
            />
            <span className="text-xs font-medium text-gray-700">⚡ Enable Early Bird Pricing</span>
          </label>

          {tier.early_bird_enabled && (
            <div className="mt-3 grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-600">Early Bird Price<span className="text-red-500 ml-0.5">*</span></label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input type="number" value={tier.early_bird_price} onChange={(e) => onUpdate('early_bird_price', e.target.value)} min="0" step="0.01" placeholder="0.00" className="input pl-7 text-sm" />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-600">Qty at Early Price</label>
                <input type="number" value={tier.early_bird_quantity} onChange={(e) => onUpdate('early_bird_quantity', e.target.value)} min="1" placeholder="50" className="input text-sm" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-600">Deadline<span className="text-red-500 ml-0.5">*</span></label>
                <input type="datetime-local" value={tier.early_bird_deadline} onChange={(e) => onUpdate('early_bird_deadline', e.target.value)} className="input text-sm" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-gray-700">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
