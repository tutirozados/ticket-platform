import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export const revalidate = 60;

async function getEvents() {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('status', 'approved')
    .order('date', { ascending: true });

  if (error) return [];
  return data;
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
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

export default async function HomePage() {
  const events = await getEvents();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <span className="text-xl font-bold text-gray-900 tracking-tight">FOMO</span>
          </div>
          <Link
            href="/admin"
            className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            Admin
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-16 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 tracking-tight">
            Find your next experience
          </h1>
          <p className="mt-4 text-lg text-gray-500 max-w-xl mx-auto">
            Discover events happening near you and get your tickets in seconds.
          </p>
        </div>
      </section>

      {/* Events */}
      <main className="max-w-6xl mx-auto px-6 py-12">
        {events.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-gray-400 text-lg">No events yet. Check back soon.</p>
          </div>
        ) : (
          <>
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-6">
              Upcoming Events
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {events.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function EventCard({ event }) {
  const isSoldOut = event.tickets_remaining === 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow">
      {/* Color band */}
      <div className="h-2 bg-gray-900" />

      <div className="p-6 flex flex-col flex-1">
        {/* Date badge */}
        <div className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 bg-gray-100 rounded-full px-3 py-1 self-start mb-4">
          <CalendarIcon />
          {formatDate(event.date)} · {formatTime(event.date)}
        </div>

        <h3 className="text-lg font-semibold text-gray-900 leading-snug mb-2">
          {event.title}
        </h3>

        {event.description && (
          <p className="text-sm text-gray-500 leading-relaxed line-clamp-2 mb-4">
            {event.description}
          </p>
        )}

        <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-1">
          <LocationIcon />
          <span className="truncate">{event.location}</span>
        </div>

        <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-6">
          <TicketIcon />
          <span>
            {isSoldOut ? (
              <span className="text-red-500 font-medium">Sold out</span>
            ) : (
              `${event.tickets_remaining} tickets left`
            )}
          </span>
        </div>

        <div className="mt-auto flex items-center justify-between">
          <span className="text-2xl font-bold text-gray-900">
            {event.price === 0 ? 'Free' : `$${parseFloat(event.price).toFixed(2)}`}
          </span>

          <Link
            href={`/events/${event.id}`}
            className={`text-sm font-medium px-5 py-2.5 rounded-lg transition-colors ${
              isSoldOut
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed pointer-events-none'
                : 'bg-gray-900 text-white hover:bg-gray-700'
            }`}
          >
            {isSoldOut ? 'Sold Out' : 'Get Tickets'}
          </Link>
        </div>
      </div>
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
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function TicketIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
    </svg>
  );
}
