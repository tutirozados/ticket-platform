'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

const initialForm = {
  title: '',
  description: '',
  date: '',
  time: '',
  location: '',
  price: '',
  total_tickets: '',
};

export default function CreateEventForm({ onCreated, userId, userEmail }) {
  const [form, setForm] = useState(initialForm);
  const [status, setStatus] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus('loading');
    setErrorMsg('');

    const datetime = new Date(`${form.date}T${form.time}`).toISOString();

    const { error } = await supabase.from('events').insert({
      title: form.title,
      description: form.description,
      date: datetime,
      location: form.location,
      price: parseFloat(form.price),
      total_tickets: parseInt(form.total_tickets, 10),
      tickets_remaining: parseInt(form.total_tickets, 10),
      user_id: userId,
      organizer_email: userEmail,
      status: 'pending',
    });

    if (error) {
      setErrorMsg(error.message);
      setStatus('error');
    } else {
      setStatus('success');
      setForm(initialForm);
      onCreated?.();
    }
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
          <textarea name="description" value={form.description} onChange={handleChange} rows={4} placeholder="Tell attendees what to expect…" className="input resize-none" />
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

        <div className="pt-2">
          <button type="submit" disabled={status === 'loading'} className="w-full bg-gray-900 hover:bg-gray-700 disabled:bg-gray-400 text-white text-sm font-medium py-2.5 px-4 rounded-lg transition-colors">
            {status === 'loading' ? 'Creating event…' : 'Create Event'}
          </button>
        </div>
      </form>
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
