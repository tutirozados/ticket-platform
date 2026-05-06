'use client';

import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function SignupPage() {
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', confirmPassword: '' });
  const [status, setStatus] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      setErrorMsg('Passwords do not match.');
      setStatus('error');
      return;
    }
    setStatus('loading');
    setErrorMsg('');

    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: { first_name: form.firstName, last_name: form.lastName },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/my-tickets`,
      },
    });

    if (error) {
      setErrorMsg(error.message);
      setStatus('error');
    } else {
      setStatus('confirm');
    }
  }

  if (status === 'confirm') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 w-full max-w-sm text-center">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Check your email</h2>
          <p className="text-sm text-gray-500">
            We sent a confirmation link to <strong>{form.email}</strong>. Click it to activate your account.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 w-full max-w-sm">
        <Link href="/" className="text-xl font-bold text-gray-900 tracking-tight block mb-8">FOMO</Link>

        <h1 className="text-lg font-semibold text-gray-900 mb-1">Create an account</h1>
        <p className="text-sm text-gray-500 mb-6">
          Already have one?{' '}
          <Link href="/login" className="text-gray-900 font-medium hover:underline">Sign in</Link>
        </p>

        {status === 'error' && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">First name<span className="text-red-500 ml-0.5">*</span></label>
              <input type="text" name="firstName" value={form.firstName} onChange={handleChange} required className="input" placeholder="Jane" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">Last name<span className="text-red-500 ml-0.5">*</span></label>
              <input type="text" name="lastName" value={form.lastName} onChange={handleChange} required className="input" placeholder="Smith" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">Email<span className="text-red-500 ml-0.5">*</span></label>
            <input type="email" name="email" value={form.email} onChange={handleChange} required className="input" placeholder="you@example.com" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">Password<span className="text-red-500 ml-0.5">*</span></label>
            <input type="password" name="password" value={form.password} onChange={handleChange} required minLength={6} className="input" placeholder="At least 6 characters" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">Confirm password<span className="text-red-500 ml-0.5">*</span></label>
            <input type="password" name="confirmPassword" value={form.confirmPassword} onChange={handleChange} required className="input" placeholder="••••••••" />
          </div>
          <button
            type="submit"
            disabled={status === 'loading'}
            className="w-full bg-gray-900 hover:bg-gray-700 disabled:bg-gray-400 text-white text-sm font-medium py-2.5 px-4 rounded-lg transition-colors"
          >
            {status === 'loading' ? 'Creating account…' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  );
}
