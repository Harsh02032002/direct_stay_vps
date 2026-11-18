import React, { useState, useMemo } from 'react';
import { DeletedItemRecord } from '../types';
import { 
  Trash2, RotateCcw, Search, Filter, ShieldCheck, AlertCircle, 
  Calendar, FileText, User, Bed, Clock, Check, X, ShieldAlert 
} from 'lucide-react';

interface DeletedFolderViewProps {
  deletedItems: DeletedItemRecord[];
  onRestoreItem: (item: DeletedItemRecord) => void;
  onPermanentDelete: (itemId: string) => void;
  hotelName?: string;
}

export default function DeletedFolderView({
  deletedItems = [],
  onRestoreItem,
  onPermanentDelete,
  hotelName
}: DeletedFolderViewProps) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'All' | 'Booking' | 'Invoice' | 'Guest' | 'Document'>('All');
  const [confirmPermanentModal, setConfirmPermanentModal] = useState<DeletedItemRecord | null>(null);

  const filteredItems = useMemo(() => {
    return deletedItems.filter(item => {
      const q = search.trim().toLowerCase();
      const matchesSearch = !q ||
        item.title.toLowerCase().includes(q) ||
        item.itemId.toLowerCase().includes(q) ||
        (item.guestName || '').toLowerCase().includes(q) ||
        (item.roomNumber || '').toLowerCase().includes(q) ||
        (item.deletedBy || '').toLowerCase().includes(q);

      const matchesType = typeFilter === 'All' || item.itemType === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [deletedItems, search, typeFilter]);

  const bookingCount = deletedItems.filter(i => i.itemType === 'Booking').length;
  const invoiceCount = deletedItems.filter(i => i.itemType === 'Invoice').length;
  const guestCount = deletedItems.filter(i => i.itemType === 'Guest').length;
  const docCount = deletedItems.filter(i => i.itemType === 'Document').length;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-luxury-brown-900 via-luxury-brown-950 to-luxury-brown-900 text-white rounded-2xl p-6 shadow-sm border border-luxury-brown-800">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-2 bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/30">
                <Trash2 className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-serif font-bold tracking-wide">
                Deleted Items Folder & Recycle Bin
              </h2>
            </div>
            <p className="text-xs text-luxury-beige-200/80">
              Safe Recovery Storage for {hotelName || 'Property PMS'}. When staff or managers delete any booking, invoice, or guest folio, it is held here. Nothing is permanently erased without authorized approval.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-[10px] font-mono text-luxury-gold-400 uppercase tracking-widest block font-bold">Preserved Records</span>
              <span className="text-2xl font-serif font-bold text-white">{deletedItems.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Safety Notice Card */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3 text-xs text-emerald-900">
        <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        <div>
          <h4 className="font-bold text-emerald-950">Zero Data Loss Policy Active</h4>
          <p className="text-emerald-800 mt-0.5 leading-relaxed">
            All deleted items are retained here with their full original data, timestamps, and staff identity. You can click <strong>"Restore Record"</strong> at any time to instantly restore any booking, invoice, or guest profile back to active operations.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-luxury-brown-100 rounded-2xl p-4 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          {/* Category Tabs */}
          <div className="flex flex-wrap gap-1.5 text-xs">
            <button
              onClick={() => setTypeFilter('All')}
              className={`px-3 py-1.5 rounded-lg font-bold font-mono transition-colors ${
                typeFilter === 'All'
                  ? 'bg-luxury-brown-900 text-luxury-gold-300'
                  : 'bg-luxury-beige-100 text-luxury-brown-800 hover:bg-luxury-beige-200'
              }`}
            >
              All Items ({deletedItems.length})
            </button>
            <button
              onClick={() => setTypeFilter('Booking')}
              className={`px-3 py-1.5 rounded-lg font-bold font-mono transition-colors ${
                typeFilter === 'Booking'
                  ? 'bg-luxury-brown-900 text-luxury-gold-300'
                  : 'bg-luxury-beige-100 text-luxury-brown-800 hover:bg-luxury-beige-200'
              }`}
            >
              Bookings ({bookingCount})
            </button>
            <button
              onClick={() => setTypeFilter('Invoice')}
              className={`px-3 py-1.5 rounded-lg font-bold font-mono transition-colors ${
                typeFilter === 'Invoice'
                  ? 'bg-luxury-brown-900 text-luxury-gold-300'
                  : 'bg-luxury-beige-100 text-luxury-brown-800 hover:bg-luxury-beige-200'
              }`}
            >
              Invoices ({invoiceCount})
            </button>
            <button
              onClick={() => setTypeFilter('Guest')}
              className={`px-3 py-1.5 rounded-lg font-bold font-mono transition-colors ${
                typeFilter === 'Guest'
                  ? 'bg-luxury-brown-900 text-luxury-gold-300'
                  : 'bg-luxury-beige-100 text-luxury-brown-800 hover:bg-luxury-beige-200'
              }`}
            >
              Guests ({guestCount})
            </button>
            <button
              onClick={() => setTypeFilter('Document')}
              className={`px-3 py-1.5 rounded-lg font-bold font-mono transition-colors ${
                typeFilter === 'Document'
                  ? 'bg-luxury-brown-900 text-luxury-gold-300'
                  : 'bg-luxury-beige-100 text-luxury-brown-800 hover:bg-luxury-beige-200'
              }`}
            >
              Documents ({docCount})
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-luxury-brown-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by ID, guest, room, or staff..."
              className="w-full pl-9 pr-3 py-2 bg-luxury-beige-50 border border-luxury-brown-200 rounded-xl text-xs text-luxury-brown-950 focus:outline-none focus:ring-1 focus:ring-luxury-gold-500"
            />
          </div>
        </div>

        {/* Deleted Items Table */}
        <div className="overflow-x-auto rounded-xl border border-luxury-brown-100">
          <table className="w-full text-left text-xs font-sans">
            <thead className="bg-luxury-beige-100/70 border-b border-luxury-brown-200 text-luxury-brown-700 font-mono text-[10px] uppercase font-bold">
              <tr>
                <th className="py-3 px-4">Item Type & Ref ID</th>
                <th className="py-3 px-4">Entity / Guest Details</th>
                <th className="py-3 px-4">Room No.</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Deleted On</th>
                <th className="py-3 px-4">Deleted By / Reason</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-luxury-brown-100 text-luxury-brown-900">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-luxury-brown-400 font-mono">
                    <Trash2 className="w-8 h-8 text-luxury-brown-300 mx-auto mb-2 opacity-50" />
                    No deleted items found in this category. Deleted records will appear here safely.
                  </td>
                </tr>
              ) : (
                filteredItems.map(item => (
                  <tr key={item.id} className="hover:bg-luxury-beige-50/50 transition-colors">
                    <td className="py-3.5 px-4 font-mono">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                        item.itemType === 'Booking' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                        item.itemType === 'Invoice' ? 'bg-purple-100 text-purple-800 border border-purple-200' :
                        item.itemType === 'Guest' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                        'bg-zinc-100 text-zinc-800 border border-zinc-200'
                      }`}>
                        {item.itemType}
                      </span>
                      <div className="font-bold text-luxury-brown-950 mt-1">{item.itemId}</div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-serif font-bold text-luxury-brown-950 text-sm">{item.guestName || item.title}</div>
                      <div className="text-[11px] text-luxury-brown-500 font-mono mt-0.5">{item.title}</div>
                    </td>

                    <td className="py-3.5 px-4 font-mono font-bold text-luxury-brown-800">
                      {item.roomNumber ? `Room ${item.roomNumber}` : '—'}
                    </td>

                    <td className="py-3.5 px-4 font-mono font-bold text-luxury-brown-950">
                      {item.amount !== undefined ? `₹${Number(item.amount || 0).toLocaleString()}` : '—'}
                    </td>

                    <td className="py-3.5 px-4 font-mono text-[11px] text-luxury-brown-600">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-luxury-brown-400" />
                        <span>{item.deletedAt}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-medium text-luxury-brown-950 text-xs">{item.deletedBy}</div>
                      <div className="text-[10px] text-rose-700 italic mt-0.5 font-sans">
                        Reason: {item.reason || 'User deleted'}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => onRestoreItem(item)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                          title="Restore this record back to active operations"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Restore</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmPermanentModal(item)}
                          className="p-1.5 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Permanently remove"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal for Permanent Erase */}
      {confirmPermanentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 border border-rose-300 shadow-2xl animate-fade-in">
            <div className="flex items-center gap-3">
              <span className="p-2.5 rounded-xl bg-rose-100 text-rose-700">
                <ShieldAlert className="w-6 h-6" />
              </span>
              <div>
                <h3 className="font-serif font-bold text-base text-rose-950">Confirm Permanent Erase</h3>
                <p className="text-xs text-rose-700 font-mono">This action cannot be reversed</p>
              </div>
            </div>

            <p className="text-xs text-luxury-brown-700 leading-relaxed">
              Are you sure you want to permanently delete <strong>{confirmPermanentModal.itemType} #{confirmPermanentModal.itemId}</strong> ({confirmPermanentModal.guestName || confirmPermanentModal.title})? Once permanently deleted, it cannot be recovered from the Deleted Folder.
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t border-luxury-brown-100">
              <button
                type="button"
                onClick={() => setConfirmPermanentModal(null)}
                className="px-4 py-2 rounded-xl border border-luxury-brown-200 text-luxury-brown-800 text-xs font-bold hover:bg-luxury-beige-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onPermanentDelete(confirmPermanentModal.id);
                  setConfirmPermanentModal(null);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                Yes, Permanently Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
