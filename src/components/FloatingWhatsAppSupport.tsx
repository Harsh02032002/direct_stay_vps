import React, { useState } from 'react';
import { MessageSquare, X, Send, PhoneCall, Sparkles } from 'lucide-react';

interface FloatingWhatsAppSupportProps {
  currentRole?: string;
  hotelName?: string;
}

export default function FloatingWhatsAppSupport({
  currentRole,
  hotelName,
}: FloatingWhatsAppSupportProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');

  const supportNumber = '917978563771'; // +91 7978563771

  const quickPrompts = [
    'Hello DirectStay, I need help with my PMS Membership & Renewal.',
    'I want to upgrade my subscription package plan.',
    'Need support with GST Invoicing & Channel Manager setup.',
    'Please connect me to DirectStay SaaS Support Executive.',
  ];

  const handleSendMessage = (customText?: string) => {
    const textToSend = customText || message || 'Hello DirectStay, I need assistance with our hotel PMS.';
    const encoded = encodeURIComponent(
      `🏨 *DirectStay SaaS Support Inquiry*\n` +
      `Property: ${hotelName || 'DirectStay Hotel'}\n` +
      `Role: ${currentRole || 'Hotel Admin'}\n\n` +
      `${textToSend}`
    );
    const url = `https://wa.me/${supportNumber}?text=${encoded}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    setIsOpen(false);
    setMessage('');
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end no-print">
      {/* Expanded Support Card */}
      {isOpen && (
        <div className="mb-3 w-80 sm:w-96 bg-white rounded-3xl border border-luxury-brown-100 shadow-2xl overflow-hidden animate-fade-in ring-1 ring-black/5">
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-700 via-emerald-600 to-emerald-700 text-white p-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center font-bold text-white shadow-xs">
                <MessageSquare className="w-5 h-5 fill-white text-emerald-700" />
              </div>
              <div>
                <h4 className="font-serif font-bold text-sm">DirectStay WhatsApp Helpdesk</h4>
                <p className="text-[11px] text-emerald-100 flex items-center gap-1 font-mono">
                  <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
                  +91 7978563771 • Online
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg hover:bg-white/10 text-emerald-100 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-4 space-y-3 text-xs bg-luxury-beige-50/30">
            <p className="text-luxury-brown-700 font-medium">
              Namaste! How can our support team assist you today? Select a query or type below:
            </p>

            {/* Quick Chips */}
            <div className="space-y-1.5">
              {quickPrompts.map((q, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendMessage(q)}
                  className="w-full text-left p-2 rounded-xl bg-white border border-luxury-brown-100 hover:border-emerald-500 hover:bg-emerald-50/50 text-[11px] text-luxury-brown-800 transition-colors flex items-center justify-between gap-2 cursor-pointer shadow-3xs"
                >
                  <span className="truncate">{q}</span>
                  <Send className="w-3 h-3 text-emerald-600 shrink-0" />
                </button>
              ))}
            </div>

            {/* Custom Input */}
            <div className="pt-2 border-t border-luxury-brown-50 flex items-center gap-2">
              <input
                type="text"
                placeholder="Type your message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSendMessage();
                }}
                className="flex-1 bg-white border border-luxury-brown-200 rounded-xl px-3 py-2 text-xs text-luxury-brown-900 focus:outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={() => handleSendMessage()}
                className="p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-xs transition-colors cursor-pointer"
                title="Send on WhatsApp"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Action Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="group relative flex items-center justify-center w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 active:scale-95 cursor-pointer ring-4 ring-emerald-500/20"
        title="DirectStay WhatsApp Support (+91 7978563771)"
      >
        <MessageSquare className="w-7 h-7 fill-white text-emerald-600" />
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 rounded-full border-2 border-white flex items-center justify-center text-[9px] font-bold">
          1
        </span>
      </button>
    </div>
  );
}
