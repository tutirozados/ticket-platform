'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') ?? '/my-tickets';

  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  async function handleLogin(e) {
    e.preventDefault();
    setStatus('loading');
    setErrorMsg('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setErrorMsg(error.message);
      setStatus('error');
    } else {
      router.push(redirect);
    }
  }

  async function handleForgot(e) {
    e.preventDefault();
    setStatus('loading');
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/my-tickets`,
    });
    if (error) {
      setErrorMsg(error.message);
      setStatus('error');
    } else {
      setStatus('sent');
    }
  }

  if (status === 'sent') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 w-full max-w-sm text-center">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Check your email</h2>
          <p className="text-sm text-gray-500 mb-6">
            We sent a reset link to <strong>{email}</strong>.
          </p>
          <button
            onClick={() => { setMode('login'); setStatus(null); }}
            className="text-sm text-gray-500 hover:text-gray-900"
          >
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 w-full max-w-sm">
        <Link href="/" className="text-xl font-bold text-gray-900 tracking-tight block mb-8">FOMO</Link>

        <h1 className="text-lg font-semibold text-gray-900 mb-1">
          {mode === 'login' ? 'Sign in' : 'Reset password'}
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          {mode === 'login' ? (
            <>Don't have an account?{' '}
              <Link href="/signup" className="text-gray-900 font-medium hover:underline">Sign up</Link>
            </>
          ) : 'Enter your email to receive a reset link.'}
        </p>

        {status === 'error' && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {errorMsg}
          </div>
        )}

        <form onSubmit={mode === 'login' ? handleLogin : handleForgot} className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="input"
              placeholder="you@example.com"
            />
          </div>

          {mode === 'login' && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">Password</label>
                <button
                  type="button"
                  onClick={() => { setMode('forgot'); setStatus(null); setErrorMsg(''); }}
                  className="text-xs text-gray-400 hover:text-gray-700"
                >
                  Forgot password?
                </button>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="input"
                placeholder="••••••••"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={status === 'loading'}
            className="w-full bg-gray-900 hover:bg-gray-700 disabled:bg-gray-400 text-white text-sm font-medium py-2.5 px-4 rounded-lg transition-colors"
          >
            {status === 'loading' ? '…' : mode === 'login' ? 'Sign in' : 'Send reset link'}
          </button>
        </form>

        {mode === 'forgot' && (
          <button
            onClick={() => { setMode('login'); setStatus(null); setErrorMsg(''); }}
            className="mt-4 text-sm text-gray-400 hover:text-gray-700 w-full text-center"
          >
            ← Back to sign in
          </button>
        )}
      </div>
    </div>
  );
}
