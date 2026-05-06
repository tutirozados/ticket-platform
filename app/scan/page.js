'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

const STATUS = {
  SCANNING: 'scanning',
  LOADING: 'loading',
  SUCCESS: 'success',
  USED: 'used',
  INVALID: 'invalid',
};

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function ScanPage() {
  const [status, setStatus] = useState(STATUS.SCANNING);
  const [result, setResult] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const scannerRef = useRef(null);
  const processingRef = useRef(false);
  const runningRef = useRef(false);

  useEffect(() => {
    if (status !== STATUS.SCANNING) return;

    let html5QrCode;

    async function startScanner() {
      const { Html5Qrcode } = await import('html5-qrcode');
      html5QrCode = new Html5Qrcode('qr-reader');
      scannerRef.current = html5QrCode;

      try {
        await html5QrCode.start(
          { facingMode: 'environment' },
          { fps: 15, qrbox: { width: 260, height: 260 } },
          handleScan,
          () => {}
        );
        runningRef.current = true;
      } catch {
        setCameraError('Could not access camera. Please allow camera permission and reload.');
      }
    }

    startScanner();

    return () => {
      if (runningRef.current && html5QrCode) {
        runningRef.current = false;
        html5QrCode.stop().catch(() => {}).finally(() => {
          const video = document.querySelector('#qr-reader video');
          if (video?.srcObject) {
            video.srcObject.getTracks().forEach((t) => t.stop());
          }
        });
      }
    };
  }, [status]);

  async function handleScan(decodedText) {
    if (processingRef.current) return;
    processingRef.current = true;

    if (runningRef.current && scannerRef.current) {
      runningRef.current = false;
      await scannerRef.current.stop().catch(() => {});
      const video = document.querySelector('#qr-reader video');
      if (video?.srcObject) {
        video.srcObject.getTracks().forEach((t) => t.stop());
      }
    }

    setStatus(STATUS.LOADING);

    const { data: ticket, error } = await supabase
      .from('tickets')
      .select('*, orders(buyer_name, buyer_email), events(title, date, location)')
      .eq('ticket_code', decodedText)
      .single();

    if (error || !ticket) {
      setStatus(STATUS.INVALID);
      processingRef.current = false;
      return;
    }

    if (ticket.is_used) {
      setResult(ticket);
      setStatus(STATUS.USED);
      processingRef.current = false;
      return;
    }

    await supabase.from('tickets').update({ is_used: true }).eq('id', ticket.id);

    setResult(ticket);
    setStatus(STATUS.SUCCESS);
    processingRef.current = false;
  }

  function reset() {
    processingRef.current = false;
    runningRef.current = false;
    setResult(null);
    setCameraError(null);
    setStatus(STATUS.SCANNING);
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-4">
        <Link href="/" className="text-white font-bold text-lg tracking-tight">FOMO</Link>
        <span className="text-gray-400 text-sm">Scanner</span>
      </header>

      {/* Scanner view */}
      {(status === STATUS.SCANNING || status === STATUS.LOADING) && (
        <div className="flex flex-col flex-1 items-center justify-center px-5">
          <p className="text-gray-400 text-sm mb-6 text-center">
            Point the camera at a ticket QR code
          </p>

          <div className="relative rounded-2xl overflow-hidden w-full max-w-sm aspect-square bg-black">
            <div id="qr-reader" className="w-full h-full" />

            {/* Corner guides */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-48 h-48 relative">
                <span className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-lg" />
                <span className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-lg" />
                <span className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-lg" />
                <span className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-lg" />
              </div>
            </div>

            {status === STATUS.LOADING && (
              <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>

          {cameraError && (
            <p className="mt-6 text-red-400 text-sm text-center max-w-xs">{cameraError}</p>
          )}
        </div>
      )}

      {/* Success screen */}
      {status === STATUS.SUCCESS && result && (
        <ResultScreen
          color="green"
          icon={
            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          }
          title="Valid Ticket"
          badge={{ label: 'Checked In', className: 'bg-green-100 text-green-700' }}
          rows={[
            { label: 'Attendee', value: result.orders?.buyer_name },
            { label: 'Email', value: result.orders?.buyer_email },
            { label: 'Event', value: result.events?.title },
            { label: 'Date', value: result.events?.date ? formatDate(result.events.date) : '—' },
            { label: 'Location', value: result.events?.location },
          ]}
          onReset={reset}
        />
      )}

      {/* Already used screen */}
      {status === STATUS.USED && result && (
        <ResultScreen
          color="yellow"
          icon={
            <svg className="w-10 h-10 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          }
          title="Ticket Already Used"
          badge={{ label: 'Already Scanned', className: 'bg-yellow-100 text-yellow-700' }}
          rows={[
            { label: 'Attendee', value: result.orders?.buyer_name },
            { label: 'Event', value: result.events?.title },
          ]}
          onReset={reset}
        />
      )}

      {/* Invalid screen */}
      {status === STATUS.INVALID && (
        <ResultScreen
          color="red"
          icon={
            <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          }
          title="Invalid Ticket"
          badge={{ label: 'Not Recognised', className: 'bg-red-100 text-red-700' }}
          rows={[{ label: 'Details', value: 'This QR code does not match any ticket in the system.' }]}
          onReset={reset}
        />
      )}
    </div>
  );
}

function ResultScreen({ color, icon, title, badge, rows, onReset }) {
  const colors = {
    green: { bg: 'bg-green-50', border: 'border-green-100', ring: 'bg-green-100' },
    yellow: { bg: 'bg-yellow-50', border: 'border-yellow-100', ring: 'bg-yellow-100' },
    red: { bg: 'bg-red-50', border: 'border-red-100', ring: 'bg-red-100' },
  };
  const c = colors[color];

  return (
    <div className="flex flex-col flex-1 items-center justify-center px-5 py-8">
      <div className={`w-full max-w-sm rounded-2xl border ${c.border} ${c.bg} p-6`}>
        <div className="flex flex-col items-center text-center mb-6">
          <div className={`w-20 h-20 rounded-full ${c.ring} flex items-center justify-center mb-4`}>
            {icon}
          </div>
          <h2 className="text-xl font-bold text-gray-900">{title}</h2>
          <span className={`mt-2 text-xs font-semibold px-3 py-1 rounded-full ${badge.className}`}>
            {badge.label}
          </span>
        </div>

        <div className="space-y-3 mb-6">
          {rows.map(({ label, value }) => value && (
            <div key={label} className="flex justify-between items-start gap-4">
              <span className="text-sm text-gray-400 shrink-0">{label}</span>
              <span className="text-sm font-medium text-gray-900 text-right">{value}</span>
            </div>
          ))}
        </div>

        <button
          onClick={onReset}
          className="w-full bg-gray-900 hover:bg-gray-700 text-white text-sm font-medium py-3 rounded-xl transition-colors"
        >
          Scan Next Ticket
        </button>
      </div>
    </div>
  );
}
