'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function CustomerHeader({ backLink }) {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
      setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  }

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-gray-900 tracking-tight">FOMO</Link>
        <div className="flex items-center gap-4">
          {backLink && (
            <Link href={backLink.href} className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
              {backLink.label}
            </Link>
          )}
          {ready && (
            user ? (
              <>
                <Link href="/my-tickets" className="text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors">
                  My Tickets
                </Link>
                <button onClick={handleSignOut} className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
                  Sign in
                </Link>
                <Link href="/signup" className="text-sm font-medium bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors">
                  Sign up
                </Link>
              </>
            )
          )}
          <Link href="/admin" className="text-sm text-gray-400 hover:text-gray-700 transition-colors">
            Admin
          </Link>
        </div>
      </div>
    </header>
  );
}
