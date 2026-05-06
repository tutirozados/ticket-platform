'use client';

import { useState } from 'react';
import CheckoutForm from './CheckoutForm';

const COLOR = {
  gray:   { top: 'bg-gray-900',    badge: 'bg-gray-100 text-gray-800 border-gray-200',     ring: 'ring-2 ring-gray-400',    btn: 'bg-gray-900 hover:bg-gray-700' },
  blue:   { top: 'bg-blue-600',    badge: 'bg-blue-50 text-blue-700 border-blue-200',       ring: 'ring-2 ring-blue-400',    btn: 'bg-blue-600 hover:bg-blue-700' },
  purple: { top: 'bg-purple-600',  badge: 'bg-purple-50 text-purple-700 border-purple-200', ring: 'ring-2 ring-purple-500',  btn: 'bg-purple-600 hover:bg-purple-700' },
  green:  { top: 'bg-green-600',   badge: 'bg-green-50 text-green-700 border-green-200',    ring: 'ring-2 ring-green-400',   btn: 'bg-green-600 hover:bg-green-700' },
  amber:  { top: 'bg-amber-500',   badge: 'bg-amber-50 text-amber-700 border-amber-200',    ring: 'ring-2 ring-amber-400',   btn: 'bg-amber-500 hover:bg-amber-600' },
  rose:   { top: 'bg-rose-600',    badge: 'bg-rose-50 text-rose-700 border-rose-200',       ring: 'ring-2 ring-rose-400',    btn: 'bg-rose-600 hover:bg-rose-700' },
};

export default function TierSelector({ event, tiers }) {
  const [selectedTier, setSelectedTier] = useState(null);

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
        const benefits = Array.isArray(tier.benefits) ? tier.benefits : [];

        return (
          <div
            key={tier.id}
            className={`rounded-2xl border overflow-hidden transition-all ${
              isSelected ? `border-transparent ${c.ring}` : 'border-gray-200'
            } ${isSoldOut ? 'opacity-50' : 'cursor-pointer hover:border-gray-300'}`}
            onClick={() => !isSoldOut && setSelectedTier(isSelected ? null : tier)}
          >
            <div className={`h-1.5 ${c.top}`} />
            <div className="p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${c.badge}`}>
                    {tier.name}
                  </span>
                  {isSoldOut && (
                    <span className="text-xs font-medium text-red-500 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                      Sold Out
                    </span>
                  )}
                </div>
                <span className="text-xl font-bold text-gray-900 shrink-0">
                  {parseFloat(tier.price) === 0 ? 'Free' : `$${parseFloat(tier.price).toFixed(2)}`}
                </span>
              </div>

              {tier.description && (
                <p className="text-sm text-gray-500 mb-2">{tier.description}</p>
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

              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  {isSoldOut ? 'No tickets left' : `${tier.quantity_remaining} left`}
                </span>
                {!isSoldOut && (
                  <span className={`text-xs font-medium px-3 py-1 rounded-lg transition-colors text-white ${isSelected ? c.btn + ' opacity-80' : c.btn}`}>
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
