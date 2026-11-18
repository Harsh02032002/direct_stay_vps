import React, { useState } from 'react';
import { CashHandover, UserRole } from '../types';
import { Plus, Handshake, Search, Printer, Check, ClipboardCopy } from 'lucide-react';

interface CashHandoverViewProps {
  handovers: CashHandover[];
  currentRole: UserRole;
  onUpdateHandovers: (handovers: CashHandover[]) => void;
  onAddAuditLog?: (action: string, details: string) => void;
}

export default function CashHandoverView({ handovers, currentRole, onUpdateHandovers, onAddAuditLog }: CashHandoverViewProps) {
  const [search, setSearch] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedHandoverPrint, setSelectedHandoverPrint] = useState<CashHandover | null>(null);

  // Form Fields
  const [date, setDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [amount, setAmount] = useState(0);
  const [receivedBy, setReceivedBy] = useState('');
  const [notes, setNotes] = useState('');

  const [formError, setFormError] = useState('');

  const handleSaveHandover = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (amount <= 0) {
      setFormError('Amount must be positive.');
      return;
    }

    if (!receivedBy.trim()) {
      setFormError('Recipient individual name is mandatory.');
      return;
    }

    const newHandover: CashHandover = {
      id: `CH-${String(handovers.length + 1).padStart(3, '0')}`,
      date,
      amount,
      receivedBy,
      notes
    };

    onUpdateHandovers([...handovers, newHandover]);
    onAddAuditLog?.(
      'Cash Handover Recorded',
      `Recorded shift cash handover ${newHandover.id} of ₹${amount.toLocaleString()} to ${receivedBy} (${date}).`
    );
    setSelectedHandoverPrint(newHandover); // open print preview of slip instantly
    setIsFormOpen(false);

    // reset fields
    setAmount(5000);
    setNotes('');
  };

  const filteredHandovers = handovers.filter(ch => {
    return ch.receivedBy.toLowerCase().includes(search.toLowerCase()) || ch.notes.toLowerCase().includes(search.toLowerCase());
  });

  const totalHandoverSum = filteredHandovers.reduce((sum, h) => sum + h.amount, 0);

  const isRestrictedRole = currentRole === 'Receptionist';

  return (
    <div className="space-y-6">
      {/* Hidden container formatted for print of tiny safe handover vouchers */}
      {selectedHandoverPrint && (
        <div className="print-only hidden p-8 bg-white text-black font-sans shrink-0 border max-w-sm mx-auto">
          <div className="border-b pb-3 mb-4 text-center">
            <h2 className="text-xl font-serif font-bold text-slate-900 tracking-wide font-serif">GRAND PAVILION</h2>
            <p className="text-[9px] uppercase tracking-widest text-slate-500 font-mono">Vault Safe Cash Handover Voucher</p>
            <p className="text-[10px] text-slate-500 font-mono mt-1 font-semibold">Voucher ID: {selectedHandoverPrint.id}</p>
          </div>

          <div className="space-y-3.5 text-xs">
            <div className="flex justify-between border-b pb-1">
              <span>Shift Handover Date:</span>
              <strong className="font-mono">{selectedHandoverPrint.date}</strong>
            </div>
            <div className="flex justify-between border-b pb-1">
              <span>Recipent Signatory:</span>
              <strong className="font-serif">{selectedHandoverPrint.receivedBy}</strong>
            </div>
            <div className="flex justify-between border-b pb-1">
              <span>CASH SUM DISBURSED:</span>
              <strong className="text-sm font-mono font-bold">₹{Number(selectedHandoverPrint.amount || 0).toLocaleString()}</strong>
            </div>

            <div className="p-2 border bg-slate-50 text-[10px] text-slate-600 rounded">
              <strong>Voucher Note:</strong> {selectedHandoverPrint.notes || 'None logged.'}
            </div>

            <div className="pt-6 text-[9px] text-slate-400 leading-normal space-y-4">
              <p>Signatures declare that physical cash tallied and was safely relocated to property vaults.</p>
              <div className="flex justify-between pt-4">
                <span className="border-t w-20 text-center">Desk Operator</span>
                <span className="border-t w-20 text-center">Received By</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-luxury-brown-100 pb-4">
        <div>
          <h1 className="text-2xl font-serif text-luxury-brown-950 font-semibold tracking-wide">Cash Handover & Vault Register</h1>
          <p className="text-xs text-luxury-brown-500">Record cash counter dispatches to Raghu Sir, manage shift handovers, and generate physical audit slips</p>
        </div>
        {!isRestrictedRole && (
          <button
            onClick={() => setIsFormOpen(true)}
            className="mt-3 sm:mt-0 px-4 py-2 bg-luxury-gold-500 hover:bg-luxury-gold-400 text-luxury-brown-950 font-medium rounded-lg text-sm transition-all shadow-md flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Declare Vault Handover
          </button>
        )}
      </div>

      {selectedHandoverPrint && (
        <div className="bg-amber-50 border border-amber-300 p-4 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-3 no-print">
          <div className="space-y-1">
            <h4 className="text-amber-900 font-bold text-sm flex items-center gap-1.5">
              <Check className="w-5 h-5 text-amber-600 border rounded-full bg-amber-100" /> Handover Voucher [{selectedHandoverPrint.id}] generated!
            </h4>
            <p className="text-xs text-amber-700 leading-relaxed font-semibold">
              Disbursed cash tally of <span className="underline">₹{Number(selectedHandoverPrint.amount || 0).toLocaleString()}</span> has been certified. Feel free to print this physical transaction slip.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => window.print()}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow"
            >
              <Printer className="w-4 h-4" /> Print Vault Receipt Slip
            </button>
            <button
              onClick={() => setSelectedHandoverPrint(null)}
              className="px-3 py-2 bg-white text-amber-800 border-amber-200 border rounded-lg text-xs font-semibold hover:bg-amber-100/55"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Filter bar */}
      <div className="bg-white border border-luxury-brown-200/50 rounded-xl p-4 shadow-xs grid grid-cols-1 md:grid-cols-4 gap-4 no-print">
        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-3 w-4 h-4 text-luxury-brown-400" />
          <input
            type="text"
            placeholder="Search recipient name, handover shifting notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-luxury-brown-200 rounded-lg text-sm focus:outline-none focus:border-luxury-gold-500 text-luxury-brown-905"
          />
        </div>

        <div className="md:col-span-2 flex items-center justify-end font-mono text-xs text-luxury-brown-500 gap-1.5">
          <span>Combined Vault Handover Total:</span>
          <span className="font-bold text-luxury-brown-900 bg-luxury-beige-100 px-2.5 py-1 rounded">
            ₹{totalHandoverSum.toLocaleString()} (June)
          </span>
        </div>
      </div>

      {/* Handovers list table */}
      <div className="bg-white border border-luxury-brown-200/50 rounded-xl shadow-xs overflow-hidden no-print">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] border-collapse text-left text-xs divide-y divide-luxury-brown-100">
            <thead className="bg-luxury-beige-100/50 text-luxury-brown-700 font-medium">
              <tr>
                <th className="p-4">Handover Slp</th>
                <th className="p-4">Date Declared</th>
                <th className="p-4">Recipent Authority</th>
                <th className="p-4">Operational Shifting notes</th>
                <th className="p-4 text-right">Aggregated cash sum</th>
                <th className="p-4 text-right">Slip Output</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-luxury-brown-100 text-luxury-brown-900 font-medium">
              {filteredHandovers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-luxury-brown-400 font-mono text-[10px] uppercase">
                    No matching vault logs found in the register.
                  </td>
                </tr>
              ) : (
                filteredHandovers.map(ch => (
                  <tr key={ch.id} className="hover:bg-luxury-beige-50/50 transition-colors">
                    <td className="p-4 font-mono font-bold text-luxury-brown-700">{ch.id}</td>
                    <td className="p-4 font-mono">{ch.date}</td>
                    <td className="p-4 font-serif font-bold text-luxury-brown-950 flex items-center gap-1">
                      <Handshake className="w-3.5 h-3.5 text-luxury-gold-500" /> {ch.receivedBy}
                    </td>
                    <td className="p-4 font-normal text-luxury-brown-500">{ch.notes || 'Counter Shift Cleared'}</td>
                    <td className="p-4 text-right font-mono font-bold">₹{Number(ch.amount || 0).toLocaleString()}</td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => setSelectedHandoverPrint(ch)}
                        className="px-2.5 py-1 bg-luxury-brown-900 hover:bg-luxury-brown-800 text-white rounded text-[10px]"
                      >
                        Print Slip
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Save Handover Dialogue Form */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="relative bg-white rounded-2xl border border-luxury-gold-500/20 shadow-2xl max-w-md w-full overflow-hidden">
            
            <div className="bg-luxury-brown-900 text-white p-5 flex justify-between items-center border-b border-luxury-gold-500/20">
              <div>
                <h3 className="text-lg font-serif font-medium text-luxury-gold-300 flex items-center gap-2">
                  <ClipboardCopy className="w-5 h-5 text-luxury-gold-300" /> Declare Safe Vault Dispatch
                </h3>
                <p className="text-[10px] text-luxury-brown-205 uppercase tracking-widest font-mono">
                  Certifies cash counters relocation to hotel vault safe
                </p>
              </div>
              <button 
                onClick={() => setIsFormOpen(false)}
                className="text-white bg-white/10 hover:bg-white/20 px-2.5 py-1 text-xs rounded-md"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="bg-rose-50 text-rose-700 text-xs p-3.5 border-b border-rose-100 font-semibold text-center font-mono">
                ⚠️ {formError}
              </div>
            )}

            <form onSubmit={handleSaveHandover} className="p-6 space-y-4 font-sans">
              <div className="space-y-1">
                <label className="text-xs font-mono text-luxury-brown-600 block uppercase font-bold">Handover Date</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-1.5 border border-luxury-brown-200 rounded-lg text-sm bg-white text-luxury-brown-905 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-mono text-luxury-brown-600 block uppercase font-bold">Cash Sum Relocated (₹)</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={amount}
                  onChange={(e) => setAmount(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg text-sm bg-white text-luxury-brown-905 font-mono font-bold text-emerald-805"
                />
              </div>

              <div className="space-y-1 font-serif">
                <label className="text-xs font-mono text-luxury-brown-600 block uppercase font-bold">Recipient Individual / Authority</label>
                <input
                  type="text"
                  required
                  value={receivedBy}
                  onChange={(e) => setReceivedBy(e.target.value)}
                  placeholder="e.g. Raghu Sir"
                  className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg text-sm bg-white text-luxury-brown-905 font-semibold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-mono text-luxury-brown-600 block uppercase font-bold">Operational Shift Notes</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Collected from main reception counter morning drawer balance"
                  className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg text-sm bg-white text-luxury-brown-905"
                />
              </div>

              {isRestrictedRole && (
                <div className="text-[10px] text-amber-700 bg-amber-50 p-2 border border-amber-100 rounded">
                  ⚠️ Staff Note: Cash relocation declarations command high supervisory credentials. Re-evaluate authority if you are not authorized to disburse funds.
                </div>
              )}

              <div className="flex gap-2 justify-end pt-3 border-t border-luxury-brown-100/50">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 border border-luxury-brown-200 text-luxury-brown-700 text-sm rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-luxury-brown-900 hover:bg-luxury-brown-800 text-white font-medium text-sm rounded-lg shadow-md transition-colors"
                >
                  Certify Relocation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
