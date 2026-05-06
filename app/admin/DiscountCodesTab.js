'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

function generateCode() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

const emptyForm = {
  code: '',
  discount_type: 'percentage',
  discount_value: '',
  max_uses: '',
  valid_from: '',
  valid_until: '',
  event_id: '',
};

export default function DiscountCodesTab({ events }) {
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState(false);

  async function fetchCodes() {
    const { data } = await supabase
      .from('discount_codes')
      .select('*, events(title)')
      .order('created_at', { ascending: false });
    setCodes(data ?? []);
    setLoading(false);
  }

  useEffect(() => { fetchCodes(); }, []);

  function handleChange(e) {
    const val = e.target.name === 'code' ? e.target.value.toUpperCase() : e.target.value;
    setForm((prev) => ({ ...prev, [e.target.name]: val }));
  }

  async function handleCreate(e) {
    e.preventDefault();
    setCreating(true);
    setCreateError('');
    setCreateSuccess(false);

    const { error } = await supabase.from('discount_codes').insert({
      code: form.code.trim().toUpperCase(),
      discount_type: form.discount_type,
      discount_value: parseFloat(form.discount_value),
      max_uses: form.max_uses ? parseInt(form.max_uses, 10) : null,
      valid_from: form.valid_from || null,
      valid_until: form.valid_until || null,
      event_id: form.event_id || null,
      is_active: true,
    });

    if (error) {
      setCreateError(error.code === '23505' ? 'That code already exists.' : error.message);
    } else {
      setCreateSuccess(true);
      setForm(emptyForm);
      fetchCodes();
      setTimeout(() => setCreateSuccess(false), 3000);
    }
    setCreating(false);
  }

  async function toggleActive(id, current) {
    await supabase.from('discount_codes').update({ is_active: !current }).eq('id', id);
    setCodes((prev) => prev.map((c) => c.id === id ? { ...c, is_active: !current } : c));
  }

  async function deleteCode(id) {
    if (!confirm('Delete this discount code?')) return;
    await supabase.from('discount_codes').delete().eq('id', id);
    setCodes((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <div className="space-y-8">
      {/* Create form */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-5">Create Discount Code</h3>

        {createSuccess && (
          <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
            Discount code created successfully.
          </div>
        )}
        {createError && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {createError}
          </div>
        )}

        <form onSubmit={handleCreate} className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">Code<span className="text-red-500 ml-0.5">*</span></label>
            <div className="flex gap-2">
              <input
                type="text"
                name="code"
                value={form.code}
                onChange={handleChange}
                placeholder="SUMMER20"
                required
                className="input flex-1 font-mono uppercase"
              />
              <button
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, code: generateCode() }))}
                className="text-sm font-medium px-3 py-2 border border-gray-200 rounded-lg hover:border-gray-300 text-gray-600 hover:text-gray-900 transition-colors whitespace-nowrap"
              >
                Auto-generate
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">Discount Type</label>
              <select name="discount_type" value={form.discount_type} onChange={handleChange} className="input">
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed Amount ($)</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">Value<span className="text-red-500 ml-0.5">*</span></label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                  {form.discount_type === 'percentage' ? '%' : '$'}
                </span>
                <input
                  type="number"
                  name="discount_value"
                  value={form.discount_value}
                  onChange={handleChange}
                  min="0"
                  max={form.discount_type === 'percentage' ? 100 : undefined}
                  step="0.01"
                  placeholder="20"
                  required
                  className="input pl-7"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">
                Max Uses <span className="text-gray-400 font-normal">(blank = unlimited)</span>
              </label>
              <input type="number" name="max_uses" value={form.max_uses} onChange={handleChange} min="1" placeholder="Unlimited" className="input" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">
                Apply to Event <span className="text-gray-400 font-normal">(blank = all)</span>
              </label>
              <select name="event_id" value={form.event_id} onChange={handleChange} className="input">
                <option value="">All events</option>
                {events.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">Valid From</label>
              <input type="datetime-local" name="valid_from" value={form.valid_from} onChange={handleChange} className="input" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">Valid Until</label>
              <input type="datetime-local" name="valid_until" value={form.valid_until} onChange={handleChange} className="input" />
            </div>
          </div>

          <button
            type="submit"
            disabled={creating}
            className="w-full bg-gray-900 hover:bg-gray-700 disabled:bg-gray-400 text-white text-sm font-medium py-2.5 px-4 rounded-lg transition-colors"
          >
            {creating ? 'Creating…' : 'Create Discount Code'}
          </button>
        </form>
      </div>

      {/* Codes table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-widest">
            All Codes ({codes.length})
          </h3>
        </div>
        {loading ? (
          <p className="text-sm text-gray-400 text-center py-8">Loading…</p>
        ) : codes.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No discount codes yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-widest">Code</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-widest">Discount</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-widest">Uses</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-widest hidden lg:table-cell">Event</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-widest hidden lg:table-cell">Expires</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {codes.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-semibold text-gray-900 tracking-wide">{c.code}</span>
                      <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded-full border ${
                        c.is_active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-400 border-gray-200'
                      }`}>
                        {c.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-700 font-medium">
                    {c.discount_type === 'percentage'
                      ? `${c.discount_value}% off`
                      : `$${parseFloat(c.discount_value).toFixed(2)} off`}
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {c.times_used}
                    {c.max_uses != null && (
                      <span className="text-gray-400"> / {c.max_uses}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-gray-500 text-xs hidden lg:table-cell">
                    {c.events?.title ?? <span className="text-gray-400">All events</span>}
                  </td>
                  <td className="px-6 py-4 text-gray-400 text-xs hidden lg:table-cell">
                    {c.valid_until
                      ? new Date(c.valid_until).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      : '—'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => toggleActive(c.id, c.is_active)}
                        className="text-xs font-medium text-gray-500 hover:text-gray-900 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
                      >
                        {c.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={() => deleteCode(c.id)}
                        className="text-xs font-medium text-red-400 hover:text-red-700 px-3 py-1.5 rounded-lg border border-red-100 hover:border-red-200 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
