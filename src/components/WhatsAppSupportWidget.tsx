import React from 'react';
import { MessageCircle, PhoneCall, Sparkles } from 'lucide-react';

export const DEFAULT_WHATSAPP_NUMBER = '+91 7978563771';

export function normalizeWhatsappDigits(phone?: string): string {
  const digits = String(phone || DEFAULT_WHATSAPP_NUMBER).replace(/\D/g, '');
  if (!digits) return '917978563771';
  return digits.length === 10 ? `91${digits}` : digits;
}

export function buildDirectStayWhatsappUrl(options: {
  phone?: string;
  context?: 'website' | 'pricing' | 'renewal' | 'dashboard';
  packageName?: string;
  hotelName?: string;
  customMessage?: string;
}): string {
  const digits = normalizeWhatsappDigits(options.phone);
  if (options.customMessage && options.customMessage.trim()) {
    return `https://wa.me/${digits}?text=${encodeURIComponent(options.customMessage.trim())}`;
  }

  let message = [
    'Hello DirectStay Team,',
    '',
    'I visited directstay.online and would like to know more about DirectStay Hotel PMS & Mobile App.',
    '',
    '• Hotel / Property Name: ',
    '• City & Total Rooms: ',
    '• Looking for: 7-Day Free Trial / Live Demo / Pricing Details',
    '',
    'Please connect with me. Thank you!',
  ].join('\n');

  if (options.context === 'pricing') {
    const planLine = options.packageName
      ? `• Interested Plan: ${options.packageName}`
      : '• Interested Plan: Need help choosing the best PMS package';
    message = [
      'Hello DirectStay Sales Team,',
      '',
      'I am exploring DirectStay Hotel Management Software pricing plans and would like complete details.',
      '',
      planLine,
      '• Hotel / Property Name: ',
      '• City & Total Rooms: ',
      '• Requirement: Pricing / Live Demo / Onboarding Steps',
      '',
      'Please share the details at the earliest. Thank you!',
    ].join('\n');
  } else if (options.context === 'renewal') {
    const lines = [
      'Hello DirectStay Billing Team,',
      '',
      'I need assistance with my DirectStay PMS membership renewal / UPI payment verification.',
      '',
    ];
    if (options.hotelName) lines.push(`• Hotel Name: ${options.hotelName}`);
    if (options.packageName) lines.push(`• Plan / Reference: ${options.packageName}`);
    lines.push('• UPI UTR / Query: ');
    lines.push('');
    lines.push('Kindly verify and confirm activation. Thank you!');
    message = lines.join('\n');
  } else if (options.context === 'dashboard') {
    const lines = [
      'Hello DirectStay Support Team,',
      '',
      'I need support from my DirectStay Hotel Admin Dashboard.',
      '',
    ];
    if (options.hotelName) lines.push(`• Hotel Name: ${options.hotelName}`);
    if (options.packageName) lines.push(`• Current Plan: ${options.packageName}`);
    lines.push('• Module / Query: (e.g. Check-In, Billing/GST, Rooms, POS, Mobile App)');
    lines.push('• Details: ');
    lines.push('');
    lines.push('Please assist at the earliest. Thank you!');
    message = lines.join('\n');
  }

  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

interface WhatsAppSupportWidgetProps {
  phone?: string;
  enabled?: boolean;
  context?: 'website' | 'pricing' | 'renewal' | 'dashboard';
  packageName?: string;
  hotelName?: string;
  customMessage?: string;
  variant?: 'floating' | 'banner' | 'inline-button';
  label?: string;
  onClickTrack?: () => void;
  className?: string;
}

export default function WhatsAppSupportWidget({
  phone = DEFAULT_WHATSAPP_NUMBER,
  enabled = true,
  context = 'dashboard',
  packageName,
  hotelName,
  customMessage,
  variant = 'floating',
  label,
  onClickTrack,
  className = '',
}: WhatsAppSupportWidgetProps) {
  if (!enabled) return null;

  const displayPhone = phone?.trim() || DEFAULT_WHATSAPP_NUMBER;
  const href = buildDirectStayWhatsappUrl({
    phone: displayPhone,
    context,
    packageName,
    hotelName,
    customMessage,
  });

  if (variant === 'inline-button') {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onClickTrack}
        className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm transition-all ${className}`}
      >
        <MessageCircle className="w-4 h-4 shrink-0" />
        <span>{label || `WhatsApp Support (${displayPhone})`}</span>
      </a>
    );
  }

  if (variant === 'banner') {
    return (
      <div
        className={`rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-emerald-50/70 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${className}`}
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
            <MessageCircle className="w-5 h-5" />
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider font-bold text-emerald-700">
              <Sparkles className="w-3 h-3" /> DirectStay Live WhatsApp Desk
            </div>
            <p className="text-xs font-bold text-luxury-brown-950">
              Need help with {context === 'renewal' ? 'payment, UPI verification, or plan upgrade' : 'packages, demos, or PMS setup'}?
            </p>
            <p className="text-[11px] text-luxury-brown-600 font-mono">
              WhatsApp & Call: <strong>{displayPhone}</strong>
              {packageName ? ` • Selected: ${packageName}` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <a
            href={`tel:+${normalizeWhatsappDigits(displayPhone)}`}
            className="px-3 py-2 rounded-xl border border-luxury-brown-200 bg-white hover:bg-luxury-beige-50 text-luxury-brown-800 text-xs font-bold inline-flex items-center gap-1.5 transition-all"
          >
            <PhoneCall className="w-3.5 h-3.5" />
            <span>Call</span>
          </a>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClickTrack}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-sm transition-all"
          >
            <MessageCircle className="w-4 h-4" />
            <span>{label || 'Chat on WhatsApp'}</span>
          </a>
        </div>
      </div>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClickTrack}
      aria-label={`Chat on WhatsApp ${displayPhone}`}
      title={`DirectStay WhatsApp Support (${displayPhone})`}
      className={`fixed bottom-5 right-5 z-[60] no-print group flex items-center gap-2.5 pl-3.5 pr-4 py-3 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white shadow-xl shadow-emerald-950/25 border border-emerald-400/50 transition-all hover:scale-105 ${className}`}
    >
      <span className="relative flex items-center justify-center">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-50" />
        <MessageCircle className="w-5 h-5 relative" />
      </span>
      <span className="text-xs font-bold tracking-wide hidden sm:inline">
        {label || 'WhatsApp Support'}
      </span>
    </a>
  );
}
