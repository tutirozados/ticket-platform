'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function EditEventModal({ event, onClose, onSaved }) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    date: '',
    time: '',
    location: '',
    price: '',
    total_tickets: '',
  });
  const [status, setStatus] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!event) return;
    const d = new Date(event.date);
    setForm({
      title: event.title,
      description: event.description || '',
      date: d.toISOString().slice(0, 10),
      time: d.toTimeString().slice(0, 5),
      location: event.location,
      price: event.price,
      total_tickets: event.total_tickets,
    });
  }, [event]);

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus('loading');
    setErrorMsg('');

    const datetime = new Date(`${form.date}T${form.time}`).toISOString();

    const { error } = await supabase
      .from('events')
      .update({
        title: form.title,
        description: form.description,
        date: datetime,
        location: form.location,
        price: parseFloat(form.price),
        total_tickets: parseInt(form.total_tickets, 10),
      })
      .eq('id', event.id);

    if (error) {
      setErrorMsg(error.message);
      setStatus('error');
    } else {
      setStatus(null);
      onSaved?.();
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Edit Event</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {status === 'error' && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {errorMsg || 'Something went wrong.'}
            </div>
          )}

          <Field label="Title" required>
            <input type="text" name="title" value={form.title} onChange={handleChange} required className="input" />
          </Field>

          <Field label="Description">
            <textarea name="description" value={form.description} onChange={handleChange} rows={3} className="input resize-none" />
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
            <input type="text" name="location" value={form.location} onChange={handleChange} required className="input" />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Price (USD)" required>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input type="number" name="price" value={form.price} onChange={handleChange} min="0" step="0.01" required className="input pl-7" />
              </div>
            </Field>
            <Field label="Total Tickets" required>
              <input type="number" name="total_tickets" value={form.total_tickets} onChange={handleChange} min="1" required className="input" />
            </Field>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 text-sm font-medium py-2.5 px-4 rounded-lg hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={status === 'loading'} className="flex-1 bg-gray-900 hover:bg-gray-700 disabled:bg-gray-400 text-white text-sm font-medium py-2.5 px-4 rounded-lg transition-colors">
              {status === 'loading' ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
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
