import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Smartphone,
  Save,
  CheckCircle2,
  AlertCircle,
  Send,
  Sparkles,
  Copy,
  Check,
  Bell,
  HelpCircle
} from 'lucide-react';
import { Hotel } from '../../types';
import { showToast } from '../../utils/toast';

interface WhatsAppTemplate {
  id: string;
  title: string;
  triggerEvent: string;
  enabled: boolean;
  content: string;
  tokens: string[];
}

const DEFAULT_TEMPLATES: WhatsAppTemplate[] = [
  {
    id: 'tpl-booking',
    title: 'Instant Reservation Confirmation',
    triggerEvent: 'Fires automatically when a booking is confirmed or advance payment received.',
    enabled: true,
    tokens: ['{guest_name}', '{booking_id}', '{hotel_name}', '{check_in_date}', '{room_category}', '{total_amount}'],
    content:
      'Namaste {guest_name}! 🏨\nYour reservation at *{hotel_name}* is confirmed!\n\n📋 *Booking ID:* {booking_id}\n🗓️ *Check-In Date:* {check_in_date}\n🛏️ *Room:* {room_category}\n💰 *Total Amount:* ₹{total_amount}\n\nWe look forward to hosting you. For early check-in or assistance, reply to this message.',
  },
  {
    id: 'tpl-checkin',
    title: 'Check-In Welcome & High-Speed Wi-Fi',
    triggerEvent: 'Fires immediately upon front desk room check-in.',
    enabled: true,
    tokens: ['{guest_name}', '{room_number}', '{wifi_network}', '{wifi_password}'],
    content:
      'Welcome to {hotel_name}, {guest_name}! 🔑\n\nYour room *{room_number}* is ready. Here are your Wi-Fi details:\n📶 *Network:* {wifi_network}\n🔒 *Password:* {wifi_password}\n\nDial 9 from your room intercom for 24/7 Front Desk assistance. Enjoy your stay!',
  },
  {
    id: 'tpl-checkout',
    title: 'Checkout Thank-You & Digital Tax Invoice',
    triggerEvent: 'Fires when the guest folio is settled and checkout is finalized.',
    enabled: true,
    tokens: ['{guest_name}', '{invoice_number}', '{bill_amount}', '{invoice_download_link}'],
    content:
      'Thank you for staying with us, {guest_name}! ✨\n\nYour checkout is complete. Your official GST invoice #{invoice_number} for ₹{bill_amount} is ready.\n\n📄 *Download Digital Invoice:* {invoice_download_link}\n\nHave a safe onward journey! 🚗✈️',
  },
  {
    id: 'tpl-roomservice',
    title: 'Digital Food Menu & Room Service',
    triggerEvent: 'Fires on guest request or 1 hour post-check-in.',
    enabled: true,
    tokens: ['{guest_name}', '{room_number}', '{digital_menu_url}'],
    content:
      'Craving delicious food, {guest_name}? 🍽️\n\nBrowse our fresh kitchen menu and order directly to Room *{room_number}*:\n📲 *Digital Menu:* {digital_menu_url}\n\nHot & fresh food delivered within 25 minutes.',
  },
];

interface WhatsAppViewProps {
  activeHotel: Hotel;
  onUpdateGlobalHotels: (updatedHotels: Hotel[]) => void;
  onAddAuditLog?: (action: string, details: string) => void;
}

export default function WhatsAppView({
  activeHotel,
  onUpdateGlobalHotels,
  onAddAuditLog,
}: WhatsAppViewProps) {
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const storageKey = `directstay_wa_${activeHotel?.id || 'default'}`;

  const [whatsappNumber, setWhatsappNumber] = useState(
    activeHotel?.whatsappNumber || activeHotel?.phoneNumber || '+919464165011'
  );

  const [templates, setTemplates] = useState<WhatsAppTemplate[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_TEMPLATES;
  });

  // Simulator
  const [testMobile, setTestMobile] = useState('+91');
  const [testTemplateId, setTestTemplateId] = useState(DEFAULT_TEMPLATES[0].id);
  const [isSimulating, setIsSimulating] = useState(false);

  useEffect(() => {
    if (activeHotel?.whatsappNumber) {
      setWhatsappNumber(activeHotel.whatsappNumber);
    }
  }, [activeHotel]);

  const toggleTemplate = (id: string) => {
    setTemplates((prev) =>
      prev.map((t) => (t.id === id ? { ...t, enabled: !t.enabled } : t))
    );
  };

  const updateTemplateContent = (id: string, text: string) => {
    setTemplates((prev) =>
      prev.map((t) => (t.id === id ? { ...t, content: text } : t))
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      localStorage.setItem(storageKey, JSON.stringify(templates));

      const updatedHotel: Hotel = {
        ...activeHotel,
        whatsappNumber: whatsappNumber.trim(),
      };
      onUpdateGlobalHotels([updatedHotel]);

      onAddAuditLog?.(
        'WhatsApp Settings Updated',
        `Updated WhatsApp notification number to ${whatsappNumber.trim()} with ${
          templates.filter((t) => t.enabled).length
        } active automated triggers.`
      );

      const msg = `WhatsApp settings and guest message templates saved successfully! (Notification: ${whatsappNumber.trim()})`;
      setSuccessMsg(msg);
      showToast(msg, 'success', 4500, 'WhatsApp Setup Saved');
    } catch (err: any) {
      const eMsg = err?.message || 'Failed to save WhatsApp settings.';
      setErrorMsg(eMsg);
      showToast(eMsg, 'error', 5000, 'Save Failed');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendTest = () => {
    if (!testMobile.trim() || testMobile.length < 10) {
      showToast('Please enter a valid 10-digit mobile number with country code.', 'warning');
      return;
    }
    setIsSimulating(true);
    setTimeout(() => {
      setIsSimulating(false);
      showToast(`Test WhatsApp message dispatched to ${testMobile.trim()}!`, 'success', 5000, 'Simulated Delivery');
    }, 1200);
  };

  return (
    <div className="space-y-6">
      {/* Sub-module Header Card */}
      <div className="bg-white border border-luxury-brown-100 rounded-3xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 text-[10px] font-mono uppercase tracking-wider font-bold mb-2">
              <MessageSquare className="w-3.5 h-3.5 text-emerald-600" /> WhatsApp Automation
            </div>
            <h2 className="text-xl font-serif font-bold text-luxury-brown-950 flex items-center gap-2">
              WhatsApp Guest Messaging &amp; Alerts
            </h2>
            <p className="text-xs text-luxury-brown-500 mt-1">
              Configure automated WhatsApp messages sent to guests for reservation confirmations, Wi-Fi credentials upon check-in, digital tax invoices, and room service.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-mono font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              DirectStay Cloud WhatsApp API: Ready
            </span>
          </div>
        </div>
      </div>

      {/* Status Messages */}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl p-4 flex items-start gap-3 text-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Settings Saved</p>
            <p>{successMsg}</p>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-4 flex items-start gap-3 text-xs">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Save Failed</p>
            <p>{errorMsg}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Section 1: Business Phone & API Gateway */}
        <div className="bg-white border border-luxury-brown-100 rounded-3xl p-6 shadow-sm space-y-4">
          <h3 className="text-sm font-serif font-bold text-luxury-brown-950 flex items-center gap-2 pb-2 border-b border-luxury-brown-50">
            <Smartphone className="w-4 h-4 text-emerald-600" />
            1. WhatsApp Sender &amp; Notification Phone
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-luxury-brown-800">
                Hotel WhatsApp Business / Notification Number *
              </label>
              <input
                type="text"
                required
                placeholder="+919876543210"
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                className="w-full text-xs bg-white border border-luxury-brown-100 rounded-xl px-4 py-2.5 font-mono"
              />
              <p className="text-[11px] text-luxury-brown-500">
                Front desk alert summaries and guest replies will route to this number.
              </p>
            </div>

            {/* Test Simulator */}
            <div className="p-4 rounded-2xl bg-luxury-beige-50/60 border border-luxury-brown-100 space-y-2">
              <label className="text-xs font-bold text-luxury-brown-900 flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5 text-luxury-gold-600" />
                Dispatch Live Test WhatsApp Message
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="+91 Mobile Number"
                  value={testMobile}
                  onChange={(e) => setTestMobile(e.target.value)}
                  className="w-full text-xs bg-white border border-luxury-brown-200 rounded-xl px-3 py-1.5 font-mono"
                />
                <button
                  type="button"
                  disabled={isSimulating}
                  onClick={handleSendTest}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                >
                  {isSimulating ? 'Sending...' : 'Test Send'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Automated Templates */}
        <div className="bg-white border border-luxury-brown-100 rounded-3xl p-6 shadow-sm space-y-5">
          <h3 className="text-sm font-serif font-bold text-luxury-brown-950 flex items-center gap-2 pb-2 border-b border-luxury-brown-50">
            <Sparkles className="w-4 h-4 text-luxury-gold-600" />
            2. Automated Guest Message Templates &amp; Triggers
          </h3>

          <div className="space-y-4">
            {templates.map((tpl) => (
              <div
                key={tpl.id}
                className={`border rounded-2xl p-4 transition-all ${
                  tpl.enabled ? 'bg-white border-luxury-brown-200' : 'bg-luxury-beige-50/40 border-luxury-brown-100 opacity-75'
                }`}
              >
                <div className="flex items-start justify-between gap-3 pb-2">
                  <div>
                    <h4 className="text-xs font-bold text-luxury-brown-950 flex items-center gap-2">
                      {tpl.title}
                      <span
                        className={`text-[9px] font-mono px-2 py-0.5 rounded-full font-bold uppercase ${
                          tpl.enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-zinc-100 text-zinc-600'
                        }`}
                      >
                        {tpl.enabled ? 'Auto-Trigger Active' : 'Disabled'}
                      </span>
                    </h4>
                    <p className="text-[11px] text-luxury-brown-500 mt-0.5">{tpl.triggerEvent}</p>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={tpl.enabled}
                      onChange={() => toggleTemplate(tpl.id)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>

                <div className="space-y-1.5 mt-2">
                  <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                    <span className="text-[10px] text-luxury-brown-400 font-mono">Available Tokens:</span>
                    {tpl.tokens.map((tk) => (
                      <span
                        key={tk}
                        className="px-1.5 py-0.5 rounded bg-luxury-beige-100 text-luxury-brown-700 font-mono text-[10px]"
                      >
                        {tk}
                      </span>
                    ))}
                  </div>
                  <textarea
                    rows={4}
                    value={tpl.content}
                    onChange={(e) => updateTemplateContent(tpl.id, e.target.value)}
                    className="w-full text-xs bg-white border border-luxury-brown-100 rounded-xl p-3 font-mono leading-relaxed focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-luxury-brown-950 hover:bg-luxury-brown-900 text-white font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4 text-luxury-gold-400" />
            {isSaving ? 'Saving WhatsApp Setup...' : 'Save WhatsApp Configuration'}
          </button>
        </div>
      </form>
    </div>
  );
}
