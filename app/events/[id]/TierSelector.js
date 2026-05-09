'use client';

import { useState, useEffect } from 'react';
import CheckoutForm from './CheckoutForm';

const COLOR = {
  gray:   { top: 'bg-gray-900',    badge: 'bg-gray-100 text-gray-800 border-gray-200',     ring: 'ring-2 ring-gray-400',    btn: 'bg-gray-900 hover:bg-gray-700' },
  blue:   { top: 'bg-blue-600',    badge: 'bg-blue-50 text-blue-700 border-blue-200',       ring: 'ring-2 ring-blue-400',    btn: 'bg-blue-600 hover:bg-blue-700' },
  purple: { top: 'bg-purple-600',  badge: 'bg-purple-50 text-purple-700 border-purple-200', ring: 'ring-2 ring-purple-500',  btn: 'bg-purple-600 hover:bg-purple-700' },
  green:  { top: 'bg-green-600',   badge: 'bg-green-50 text-green-700 border-green-200',    ring: 'ring-2 ring-green-400',   btn: 'bg-green-600 hover:bg-green-700' },
  amber:  { top: 'bg-amber-500',   badge: 'bg-amber-50 text-amber-700 border-amber-200',    ring: 'ring-2 ring-amber-400',   btn: 'bg-amber-500 hover:bg-amber-600' },
  rose:   { top: 'bg-rose-600',    badge: 'bg-rose-50 text-rose-700 border-rose-200',       ring: 'ring-2 ring-rose-400',    btn: 'bg-rose-600 hover:bg-rose-700' },
};

function getTimeLeft(deadline) {
  const diff = new Date(deadline) - Date.now();
  if (diff <= 0) return null;
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
  };
}

function checkEarlyBird(tier) {
  if (!tier.early_bird_price) return false;
  const deadlineOk = !tier.early_bird_deadline || new Date(tier.early_bird_deadline) > new Date();
  const qtyOk = !tier.early_bird_quantity || (tier.early_bird_sold ?? 0) < tier.early_bird_quantity;
  return deadlineOk && qtyOk;
}

function Countdown({ deadline }) {
  const [timeLeft, setTimeLeft] = useState(() => getTimeLeft(deadline));

  useEffect(() => {
    const id = setInterval(() => setTimeLeft(getTimeLeft(deadline)), 1000);
    return () => clearInterval(id);
  }, [deadline]);

  if (!timeLeft) return <span className="text-red-500">Ended</span>;
  const { days, hours, minutes, seconds } = timeLeft;
  return (
    <span className="font-mono tabular-nums">
      {days > 0 && `${days}d `}{String(hours).padStart(2, '0')}h {String(minutes).padStart(2, '0')}m {String(seconds).padStart(2, '0')}s
    </span>
  );
}

function fmtTierPrice(price, currency) {
  const n = parseFloat(price);
  if (n === 0) return 'Free';
  if (currency === 'CRC') return `₡${Math.round(n).toLocaleString('es-CR')}`;
  return `$${n.toFixed(2)}`;
}

export default function TierSelector({ event, tiers }) {
  const [selectedTier, setSelectedTier] = useState(null);
  const currency = event.currency ?? 'USD';

  const allSoldOut = tiers.every((t) => t.quantity_remaining === 0);

  if (allSoldOut) {
    return (
      <div className="text-center py-8">
        <p className="text-red-500 font-semibold text-lg">Sold Out</p>
        <p className="text-gray-400 text-sm mt-1">All ticket tiers are sold out.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Select a Tier</p>

      {tiers.map((tier) => {
        const c = COLOR[tier.color] ?? COLOR.gray;
        const isSoldOut = tier.quantity_remaining === 0;
        const isSelected = selectedTier?.id === tier.id;
        const isEarlyBird = checkEarlyBird(tier);
        const displayPrice = isEarlyBird ? tier.early_bird_price : tier.price;
        const benefits = Array.isArray(tier.benefits) ? tier.benefits : [];
        const ebRemaining = tier.early_bird_quantity
          ? tier.early_bird_quantity - (tier.early_bird_sold ?? 0)
          : null;

        return (
          <div
            key={tier.id}
            className={`rounded-2xl border overflow-hidden transition-all ${
              isSelected ? `border-transparent ${c.ring}` : 'border-gray-200'
            } ${isSoldOut ? 'opacity-50' : 'cursor-pointer hover:border-gray-300'}`}
            onClick={() => !isSoldOut && setSelectedTier(isSelected ? null : {
              ...tier,
              effective_price: displayPrice,
              is_early_bird: isEarlyBird,
            })}
          >
            <div className={`h-1.5 ${c.top}`} />
            <div className="p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${c.badge}`}>
                    {tier.name}
                  </span>
                  {isEarlyBird && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                      ⚡ Early Bird
                    </span>
                  )}
                  {isSoldOut && (
                    <span className="text-xs font-medium text-red-500 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                      Sold Out
                    </span>
                  )}
                </div>
                <div className="text-right shrink-0">
                  {isEarlyBird ? (
                    <>
                      <span className="text-xl font-bold text-gray-900">
                        {fmtTierPrice(tier.early_bird_price, currency)}
                      </span>
                      <span className="block text-xs text-gray-400 line-through">
                        {fmtTierPrice(tier.price, currency)}
                      </span>
                    </>
                  ) : (
                    <span className="text-xl font-bold text-gray-900">
                      {fmtTierPrice(tier.price, currency)}
                    </span>
                  )}
                </div>
              </div>

              {tier.description && (
                <p className="text-sm text-gray-500 mb-2">{tier.description}</p>
              )}

              {/* Early bird countdown */}
              {isEarlyBird && tier.early_bird_deadline && (
                <div className="mb-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 flex items-center justify-between gap-2">
                  <span>Ends in</span>
                  <Countdown deadline={tier.early_bird_deadline} />
                </div>
              )}

              {benefits.length > 0 && (
                <ul className="space-y-1 mb-3">
                  {benefits.map((b, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                      <svg className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-gray-900' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      {b}
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>
                  {isSoldOut ? 'No tickets left' : isEarlyBird && ebRemaining != null
                    ? `${ebRemaining} early bird left`
                    : `${tier.quantity_remaining} left`}
                </span>
                {!isSoldOut && (
                  <span className={`font-medium px-3 py-1 rounded-lg text-white text-xs ${c.btn} transition-colors`}>
                    {isSelected ? '✓ Selected' : 'Select'}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {selectedTier && (
        <div className="pt-4 border-t border-gray-100">
          <CheckoutForm event={event} selectedTier={selectedTier} />
        </div>
      )}
    </div>
  );
}
