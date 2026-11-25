import React, { useState } from 'react';
import { Printer, Download, X, CheckCircle2, Crown, ShieldCheck, Building2, Calendar, CreditCard, Sparkles, Receipt } from 'lucide-react';
import { SubscriptionInvoice } from '../types';
import { downloadSubscriptionInvoicePdf } from '../utils/pdfDownload';

interface SubscriptionInvoiceModalProps {
  invoice: SubscriptionInvoice | null;
  onClose: () => void;
  businessName?: string;
  supportPhone?: string;
  supportEmail?: string;
  gstNumber?: string;
  sacCode?: string;
}

export default function SubscriptionInvoiceModal({
  invoice,
  onClose,
  businessName = 'DirectStay SaaS Hub',
  supportPhone = '+91 7978563771',
  supportEmail = 'contact@directstay.online',
  gstNumber = '21AABCU9603R1ZM',
  sacCode = '998315',
}: SubscriptionInvoiceModalProps) {
  const [docMode, setDocMode] = useState<'invoice' | 'receipt'>('invoice');
  if (!invoice) return null;

  const receiptNumber =
    (invoice as any).receiptNumber ||
    String(invoice.invoiceNumber || 'RCPT').replace(/^DS-SUB/i, 'RCPT');

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    downloadSubscriptionInvoicePdf(invoice, businessName, supportPhone, supportEmail);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl border border-luxury-brown-200 shadow-2xl w-full max-w-3xl my-8 overflow-hidden animate-fade-in text-luxury-brown-950">
        {/* Top Action Bar (Hidden in Print) */}
        <div className="bg-gradient-to-r from-luxury-brown-900 via-luxury-brown-950 to-[#140D09] text-white px-6 py-4 flex items-center justify-between border-b border-luxury-gold-500/20 no-print">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-luxury-gold-500/20 border border-luxury-gold-500/40 text-luxury-gold-400">
              <Crown className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-base text-white">
                SaaS Subscription Renewal Tax Invoice
              </h3>
              <p className="text-[11px] text-luxury-gold-300 font-mono">
                Invoice #{invoice.invoiceNumber} • {invoice.packageName} ({invoice.subscriptionPlan})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex rounded-xl bg-white/10 p-0.5 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setDocMode('invoice')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  docMode === 'invoice' ? 'bg-luxury-gold-500 text-luxury-brown-950' : 'text-white/80 hover:text-white'
                }`}
              >
                GST Invoice
              </button>
              <button
                type="button"
                onClick={() => setDocMode('receipt')}
                className={`px-3 py-1.5 rounded-lg inline-flex items-center gap-1 transition-all cursor-pointer ${
                  docMode === 'receipt' ? 'bg-luxury-gold-500 text-luxury-brown-950' : 'text-white/80 hover:text-white'
                }`}
              >
                <Receipt className="w-3.5 h-3.5" /> Payment Receipt
              </button>
            </div>
            <button
              type="button"
              onClick={handleDownloadPdf}
              className="px-4 py-2 bg-luxury-gold-500 hover:bg-luxury-gold-400 text-luxury-brown-950 font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download PDF</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-xl text-luxury-brown-300 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Invoice Sheet */}
        <div className="p-6 md:p-10 space-y-7 bg-white print:p-6" id="printable-subscription-invoice">
          {/* Header: Brand & Tax Invoice Badge */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-6 pb-6 border-b-2 border-luxury-brown-900">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-luxury-beige-100 border border-luxury-gold-500/40 text-luxury-brown-900 text-[10px] font-mono uppercase tracking-widest font-bold">
                <Sparkles className="w-3 h-3 text-luxury-gold-600" />{' '}
                {docMode === 'receipt' ? 'Official Payment Receipt' : 'Official SaaS License Tax Invoice'}
              </div>
              <h1 className="text-2xl md:text-3xl font-serif font-bold text-luxury-brown-950 tracking-tight">
                {businessName}
              </h1>
              <p className="text-xs text-luxury-brown-600">
                Enterprise Hospitality Cloud & Multi-Property PMS Platform
              </p>
              <div className="text-[11px] font-mono text-luxury-brown-600 pt-1 space-y-0.5">
                <p>GSTIN: <strong className="text-luxury-brown-950">{gstNumber}</strong> • SAC Code: <strong className="text-luxury-brown-950">{sacCode}</strong> (Cloud SaaS License)</p>
                <p>Support: {supportPhone} • {supportEmail}</p>
              </div>
            </div>

            <div className="sm:text-right space-y-2 bg-luxury-beige-50/80 border border-luxury-brown-100 rounded-2xl p-4 min-w-[230px]">
              <div className="flex sm:justify-end">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-800 text-[11px] font-mono font-bold uppercase">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  {invoice.paymentStatus} • Verified
                </span>
              </div>
              <div>
                <span className="text-[10px] font-mono uppercase text-luxury-brown-500 block">
                  {docMode === 'receipt' ? 'Payment Receipt No' : 'Invoice Number'}
                </span>
                <span className="font-mono font-bold text-base text-luxury-brown-950">
                  {docMode === 'receipt' ? receiptNumber : invoice.invoiceNumber}
                </span>
              </div>
              {docMode === 'receipt' && (
                <div>
                  <span className="text-[10px] font-mono uppercase text-luxury-brown-500 block">Linked Tax Invoice</span>
                  <span className="font-mono font-semibold text-xs text-luxury-brown-800">{invoice.invoiceNumber}</span>
                </div>
              )}
              <div>
                <span className="text-[10px] font-mono uppercase text-luxury-brown-500 block">
                  {docMode === 'receipt' ? 'Payment Date' : 'Invoice Date'}
                </span>
                <span className="font-mono font-semibold text-xs text-luxury-brown-800">{invoice.createdAt}</span>
              </div>
            </div>
          </div>

          {/* Billed To & Subscription Validity */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-luxury-beige-50/50 border border-luxury-brown-100 space-y-1.5">
              <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-luxury-gold-700 font-bold">
                <Building2 className="w-3.5 h-3.5" /> Billed To (Licensed Hotel Property)
              </div>
              <h4 className="text-base font-serif font-bold text-luxury-brown-950">{invoice.hotelName}</h4>
              {invoice.ownerName && (
                <p className="text-xs text-luxury-brown-700">
                  Proprietor / Owner: <strong>{invoice.ownerName}</strong>
                </p>
              )}
              {invoice.hotelAddress && (
                <p className="text-xs text-luxury-brown-600">{invoice.hotelAddress}</p>
              )}
              <div className="pt-1 text-[11px] font-mono text-luxury-brown-600 space-y-0.5">
                {invoice.hotelPhone && <p>Phone: {invoice.hotelPhone}</p>}
                {invoice.hotelEmail && <p>Email: {invoice.hotelEmail}</p>}
                <p>
                  Customer GSTIN:{' '}
                  <strong className="text-luxury-brown-950">{invoice.hotelGst || 'Unregistered / B2C'}</strong>
                </p>
                <p>
                  Tenant Property ID: <strong className="text-luxury-brown-900">{invoice.hotelId}</strong>
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-luxury-beige-50/50 border border-luxury-brown-100 space-y-2">
              <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-luxury-gold-700 font-bold">
                <Calendar className="w-3.5 h-3.5" /> Selected Package & Validity Schedule
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                <div>
                  <span className="text-[10px] font-mono uppercase text-luxury-brown-400 block">Selected Package</span>
                  <span className="font-serif font-bold text-sm text-luxury-brown-950">{invoice.packageName}</span>
                </div>
                <div>
                  <span className="text-[10px] font-mono uppercase text-luxury-brown-400 block">Billing Cycle</span>
                  <span className="font-mono font-bold text-xs text-luxury-gold-700 uppercase">
                    {invoice.subscriptionPlan === 'HalfYearly' ? '6-Month Plan' : invoice.subscriptionPlan}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-mono uppercase text-luxury-brown-400 block">License Valid From</span>
                  <span className="font-mono font-semibold text-luxury-brown-900">{invoice.validFrom}</span>
                </div>
                <div>
                  <span className="text-[10px] font-mono uppercase text-luxury-brown-400 block">License Valid Until</span>
                  <span className="font-mono font-bold text-emerald-700">{invoice.validUntil}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-[10px] font-mono uppercase text-luxury-brown-400 block">Authorized Room Capacity</span>
                  <span className="font-mono font-bold text-xs text-luxury-brown-900">{invoice.roomCapacityLabel}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Line Item Table */}
          <div className="border border-luxury-brown-200 rounded-2xl overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-luxury-brown-950 text-white font-mono text-[10px] uppercase tracking-wider">
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">Package & License Description</th>
                  <th className="py-3 px-4">Validity Period</th>
                  <th className="py-3 px-4 text-right">Base Tariff</th>
                  <th className="py-3 px-4 text-right">GST ({invoice.gstRate}%)</th>
                  <th className="py-3 px-4 text-right">Total (INR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-luxury-brown-100">
                <tr className="bg-white">
                  <td className="py-4 px-4 font-mono font-bold text-luxury-brown-600 align-top">01</td>
                  <td className="py-4 px-4 space-y-2">
                    <div>
                      <p className="font-serif font-bold text-sm text-luxury-brown-950">
                        {invoice.packageName} — {invoice.subscriptionPlan === 'HalfYearly' ? 'Half-Yearly (180 Days)' : `${invoice.subscriptionPlan} Subscription License`}
                      </p>
                      <p className="text-[11px] text-luxury-brown-600">
                        Room Capacity: <strong>{invoice.roomCapacityLabel}</strong> • Full Cloud MongoDB Sync & Multi-Role Access
                      </p>
                    </div>
                    {Array.isArray(invoice.includedModules) && invoice.includedModules.length > 0 && (
                      <div className="pt-1">
                        <span className="text-[10px] font-mono uppercase text-luxury-brown-500 font-bold block mb-1">
                          Included Package Modules:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {invoice.includedModules.map((mod, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded-md bg-luxury-beige-100 border border-luxury-brown-200/70 text-[10px] font-mono font-semibold text-luxury-brown-900"
                            >
                              ✓ {mod}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="py-4 px-4 font-mono text-[11px] text-luxury-brown-800 align-top whitespace-nowrap">
                    {invoice.validFrom} <br />
                    <span className="text-luxury-brown-400">to</span> <br />
                    <strong className="text-emerald-700">{invoice.validUntil}</strong>
                  </td>
                  <td className="py-4 px-4 font-mono font-semibold text-right text-luxury-brown-900 align-top whitespace-nowrap">
                    ₹{Number(invoice.baseAmount || 0).toLocaleString('en-IN')}
                  </td>
                  <td className="py-4 px-4 font-mono text-right text-luxury-brown-700 align-top whitespace-nowrap">
                    ₹{Number(invoice.gstAmount || 0).toLocaleString('en-IN')}
                  </td>
                  <td className="py-4 px-4 font-mono font-bold text-sm text-right text-luxury-brown-950 align-top whitespace-nowrap">
                    ₹{Number(invoice.totalAmount || 0).toLocaleString('en-IN')}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Payment Verification & Tax Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-2 text-xs">
              <div className="flex items-center gap-1.5 text-emerald-800 font-mono text-[10px] uppercase font-bold">
                <CreditCard className="w-3.5 h-3.5" /> Payment Settlement & Super Admin Approval
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <span className="text-[10px] font-mono text-emerald-700 block uppercase">Payment Mode</span>
                  <span className="font-bold text-emerald-950">{invoice.paymentMethod}</span>
                </div>
                <div>
                  <span className="text-[10px] font-mono text-emerald-700 block uppercase">Transaction / UTR Ref</span>
                  <span className="font-mono font-bold text-emerald-950">{invoice.transactionReference || 'VERIFIED-DIRECT'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-mono text-emerald-700 block uppercase">Verified & Approved By</span>
                  <span className="font-bold text-emerald-950">{invoice.approvedBy}</span>
                </div>
                <div>
                  <span className="text-[10px] font-mono text-emerald-700 block uppercase">Payment Status</span>
                  <span className="font-mono font-bold text-emerald-700 uppercase">PAID IN FULL</span>
                </div>
              </div>
              {invoice.notes && (
                <p className="text-[11px] text-emerald-800 pt-1 border-t border-emerald-200/60">
                  Remarks: {invoice.notes}
                </p>
              )}
            </div>

            <div className="bg-luxury-beige-50/80 border border-luxury-brown-200 rounded-2xl p-4 space-y-2 text-xs">
              <div className="flex justify-between text-luxury-brown-700">
                <span>Package Base Amount</span>
                <span className="font-mono font-semibold">₹{Number(invoice.baseAmount || 0).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-luxury-brown-600">
                <span>CGST ({invoice.gstRate / 2}%)</span>
                <span className="font-mono">₹{Number(invoice.cgstAmount || 0).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-luxury-brown-600">
                <span>SGST ({invoice.gstRate / 2}%)</span>
                <span className="font-mono">₹{Number(invoice.sgstAmount || 0).toLocaleString('en-IN')}</span>
              </div>
              <div className="border-t border-luxury-brown-200 pt-2.5 flex justify-between items-center text-sm font-bold text-luxury-brown-950">
                <span>Grand Total Paid</span>
                <span className="font-mono text-lg text-emerald-700">₹{Number(invoice.totalAmount || 0).toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          {/* Footer Sign-off */}
          <div className="pt-4 border-t border-luxury-brown-100 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 text-[11px] text-luxury-brown-500">
            <div className="space-y-1">
              <p className="font-semibold text-luxury-brown-800 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-luxury-gold-600" /> Computer Generated SaaS License Tax Invoice
              </p>
              <p>Membership license is activated immediately upon Super Admin payment verification.</p>
            </div>
            <div className="sm:text-right">
              <p className="font-serif font-bold text-luxury-brown-900">For {businessName}</p>
              <p className="font-mono text-[10px] text-emerald-700 font-bold mt-1">✓ Digitally Authorized by Super Admin</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
