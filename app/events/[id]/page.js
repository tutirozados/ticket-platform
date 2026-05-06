import { supabase } from '@/lib/supabase';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import CheckoutForm from './CheckoutForm';

export const revalidate = 0;

async function getEvent(id) {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return null;
  return data;
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default async function EventPage({ params }) {
  const { id } = await params;
  const event = await getEvent(id);

  if (!event) notFound();

  const isSoldOut = event.tickets_remaining === 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-gray-900 tracking-tight">
            FOMO
          </Link>
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
            ← All Events
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">

          {/* Event Info */}
          <div className="lg:col-span-2 space-y-8">
            {/* Title block */}
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 bg-gray-100 rounded-full px-3 py-1 mb-4">
                <CalendarIcon />
                {formatDate(event.date)} · {formatTime(event.date)}
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 leading-tight">
                {event.title}
              </h1>
            </div>

            {/* Meta */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3 text-gray-600">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                  <LocationIcon />
                </div>
                <span className="text-sm">{event.location}</span>
              </div>
              <div className="flex items-center gap-3 text-gray-600">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                  <TicketIcon />
                </div>
                <span className="text-sm">
                  {isSoldOut ? (
                    <span className="text-red-500 font-medium">Sold out</span>
                  ) : (
                    <>{event.tickets_remaining} of {event.total_tickets} tickets remaining</>
                  )}
                </span>
              </div>
              <div className="flex items-center gap-3 text-gray-600">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                  <PriceIcon />
                </div>
                <span className="text-sm font-semibold text-gray-900">
                  {event.price === 0 || event.price === '0.00'
                    ? 'Free'
                    : `$${parseFloat(event.price).toFixed(2)} per ticket`}
                </span>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-gray-200" />

            {/* Description */}
            {event.description && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-3">About this event</h2>
                <p className="text-gray-600 leading-relaxed whitespace-pre-line">
                  {event.description}
                </p>
              </div>
            )}
          </div>

          {/* Checkout Card */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sticky top-6">
              <div className="flex items-baseline justify-between mb-6">
                <span className="text-2xl font-bold text-gray-900">
                  {event.price === 0 || event.price === '0.00'
                    ? 'Free'
                    : `$${parseFloat(event.price).toFixed(2)}`}
                </span>
                {event.price > 0 && (
                  <span className="text-sm text-gray-400">per ticket</span>
                )}
              </div>

              {isSoldOut ? (
                <div className="text-center py-6">
                  <p className="text-red-500 font-semibold text-lg">Sold Out</p>
                  <p className="text-gray-400 text-sm mt-1">No tickets available</p>
                </div>
              ) : (
                <CheckoutForm event={event} />
              )}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function LocationIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function TicketIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
    </svg>
  );
}

function PriceIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
