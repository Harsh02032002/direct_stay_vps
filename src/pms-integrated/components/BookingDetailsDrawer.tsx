import React, { useState } from 'react';
import {
  X,
  Phone,
  User,
  IndianRupee,
  Eye,
  Plus,
  FileText,
  Edit3,
  LogOut,
  UserCheck,
  Utensils,
  CreditCard,
  CalendarPlus,
  Printer,
} from 'lucide-react';
import { BookingRecord, GuestPerson } from '../types';
import { formatINRDecimal, getDayName } from '../utils/formatters';

interface BookingDetailsDrawerProps {
  booking: BookingRecord | null;
  onClose: () => void;
  onOpenCheckInModal: (booking: BookingRecord) => void;
  onCheckoutBooking: (booking: BookingRecord) => void;
  onOpenRecordPayment: (booking: BookingRecord) => void;
  onPreviewGuestDoc: (guest: GuestPerson, bookingNo: string) => void;
  onOpenInvoiceModal: (
    booking: BookingRecord,
    scope: 'Only Booking' | 'Booking + Other Services'
  ) => void;
  onEditBooking: (booking: BookingRecord) => void;
  onOpenAddPosOrder: (booking: BookingRecord) => void;
  onExtendStay?: (bookingId: string, extraDays: number) => void;
  onCancelBooking?: (booking: BookingRecord) => void;
  onPrintGrc?: (booking: BookingRecord) => void;
}

export default function BookingDetailsDrawer({
  booking,
  onClose,
  onOpenCheckInModal,
  onCheckoutBooking,
  onOpenRecordPayment,
  onPreviewGuestDoc,
  onOpenInvoiceModal,
  onEditBooking,
  onOpenAddPosOrder,
  onExtendStay,
  onCancelBooking,
  onPrintGrc,
}: BookingDetailsDrawerProps) {
  const [activeTopView, setActiveTopView] = useState<'overview' | 'guestCard'>('overview');
  const [invoiceScope, setInvoiceScope] = useState<'Only Booking' | 'Booking + Other Services'>(
    'Booking + Other Services'
  );

  if (!booking) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex justify-end">
      <div className="bg-white w-full max-w-lg h-full shadow-2xl border-l border-slate-200 flex flex-col justify-between overflow-hidden animate-fade-in">
        {/* Top Bar matching video 03:45–06:20 "#2 | Jay Thakur" */}
        <div className="px-6 py-4 border-b border-slate-200 bg-[#FBF4E0] flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-extrabold text-[#17120F]">
                {booking.bookingNo} | {booking.customerName}
              </h3>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                  booking.status === 'Checked In'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : booking.status === 'Checked Out'
                    ? 'bg-slate-200 text-slate-700'
                    : booking.status === 'Pending'
                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                    : 'bg-blue-100 text-blue-800 border border-blue-300'
                }`}
              >
                {booking.status}
              </span>
            </div>
            <p className="text-xs text-slate-600 flex items-center gap-1 mt-0.5 font-mono">
              <Phone className="w-3 h-3 text-[#C49A3A]" /> {booking.mobile} • {booking.email}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-black/10 text-slate-700 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
          {/* Summary Banner */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-slate-900">{booking.roomCategorySummary}</p>
                <p className="text-[11px] text-slate-500">
                  Total Payable: <strong>{formatINRDecimal(booking.totalPayable)}</strong>
                </p>
              </div>
              <div className="text-right">
                <span className="text-rose-600 font-extrabold font-mono text-sm">
                  DUE ({formatINRDecimal(booking.dueAmount)})
                </span>
              </div>
            </div>

            {/* Guest Card Toggle + Print GRC + Add Order + Record Payment */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    setActiveTopView(activeTopView === 'guestCard' ? 'overview' : 'guestCard')
                  }
                  className="px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 flex items-center gap-1.5 cursor-pointer"
                >
                  <User className="w-3.5 h-3.5 text-[#C49A3A]" />
                  <span>{activeTopView === 'guestCard' ? 'Booking Metadata' : 'Guest ID Card'}</span>
                </button>
                {onPrintGrc && (
                  <button
                    type="button"
                    onClick={() => onPrintGrc(booking)}
                    className="px-2.5 py-1.5 bg-[#17120F] hover:bg-slate-800 text-[#E0BD6B] border border-[#C49A3A]/50 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    title="Print Guest Registration Card (GRC)"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print GRC</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onOpenAddPosOrder(booking)}
                  className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg text-xs font-bold text-emerald-800 flex items-center gap-1 cursor-pointer"
                  title="Add POS Room Service Order to this Booking"
                >
                  <Utensils className="w-3.5 h-3.5" />
                  <span>+ Add Order</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => onOpenRecordPayment(booking)}
                className="px-3 py-1.5 bg-[#C49A3A] hover:bg-[#A67C20] text-[#17120F] rounded-lg text-xs font-bold flex items-center gap-1 shadow-2xs cursor-pointer"
                title="Record Payment"
              >
                <IndianRupee className="w-3.5 h-3.5" />
                <span>Record Payment</span>
              </button>
            </div>

            {activeTopView === 'guestCard' && (
              <div className="pt-2 border-t border-slate-200 space-y-2">
                {booking.guests.map((g) => (
                  <div
                    key={g.id}
                    className="p-3 rounded-xl bg-white border border-[#DFC078] flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {g.documentImageUrl && (
                        <img
                          src={g.documentImageUrl}
                          alt={g.documentType}
                          onClick={() => onPreviewGuestDoc(g, booking.bookingNo)}
                          className="w-16 h-11 object-cover rounded border border-slate-200 cursor-pointer shrink-0"
                        />
                      )}
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 truncate">{g.name}</div>
                        <div className="text-[11px] text-amber-800 font-bold">
                          {g.documentType}: {g.documentNumber || 'Click View ID to add'}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onPreviewGuestDoc(g, booking.bookingNo)}
                      className="px-2.5 py-1.5 rounded-lg bg-[#1E3A8A] text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Inspect ID</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Bill & Stay Metadata Grid + Check In / Check Out Action */}
          <div className="grid grid-cols-2 gap-y-2.5 gap-x-4 p-4 rounded-xl border border-slate-200 bg-white">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Bill ID</span>
              <strong className="font-mono text-slate-800">{booking.billId}</strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">
                Booked On
              </span>
              <strong className="font-mono text-slate-800">{booking.bookedOn}</strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">
                No of Guests
              </span>
              <strong className="text-slate-800">{booking.numGuests} Guests</strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Source</span>
              <strong className="text-slate-800">{booking.source}</strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">
                Start Date ({getDayName(booking.checkInDate)})
              </span>
              <strong className="font-mono text-slate-800">{booking.checkInDate}, 12:00 PM</strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">
                End Date ({booking.isOpenStay ? 'Open 12 PM Rule' : getDayName(booking.checkOutDate)})
              </span>
              <strong className="font-mono text-slate-800">
                {booking.isOpenStay ? 'Open Stay (12:00 PM Daily)' : `${booking.checkOutDate}, 11:00 AM`}
              </strong>
            </div>

            {/* Check-In / 12:00 PM Continue / Check-Out Action Row */}
            <div className="col-span-2 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
              <div>
                <span className="text-slate-500 block text-[11px]">Stay Action</span>
                <span className="text-[11px] font-mono text-emerald-700 font-semibold">
                  {booking.checkInTime ? `Checked In: ${booking.checkInTime}` : 'Awaiting Check-In'}
                </span>
              </div>

              {!booking.isCheckedIn && !booking.isCheckedOut && booking.status !== 'Checked Out' && booking.status !== 'Cancelled' && booking.status !== 'No-Show' && (
                <div className="flex items-center gap-1.5">
                  {onCancelBooking && (
                    <button
                      type="button"
                      onClick={() => onCancelBooking(booking)}
                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 font-bold rounded-lg text-xs cursor-pointer"
                    >
                      Cancel Booking
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onOpenCheckInModal(booking)}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Check In</span>
                  </button>
                </div>
              )}

              {booking.isCheckedIn && !booking.isCheckedOut && (
                <div className="flex items-center gap-1.5">
                  {onExtendStay && (
                    <button
                      type="button"
                      onClick={() => onExtendStay(booking.id, 1)}
                      className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold rounded-lg text-xs flex items-center gap-1 cursor-pointer"
                      title="12:00 PM Continue Stay (+1 Day)"
                    >
                      <CalendarPlus className="w-3.5 h-3.5" />
                      <span>Continue (+1D)</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onCheckoutBooking(booking)}
                    className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Check Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Room Details Breakdown */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Room Details ({booking.nights} Nights)
            </h4>
            {booking.requirements.map((req) => (
              <div
                key={req.id}
                className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900">{req.categoryName}</span>
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-white text-[10px] font-bold">
                    {req.qty} {req.qty === 1 ? 'Room' : 'Rooms'} ({req.assignedRooms.join(', ')})
                  </span>
                  <span className="text-[11px] text-[#8B691E] font-semibold">• {req.planName}</span>
                </div>
                <strong className="font-mono text-slate-900">
                  {formatINRDecimal(req.unitPrice)}/N
                </strong>
              </div>
            ))}
          </div>

          {/* Other Services Section matching video 08:35 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Other Services ({booking.otherServices.length})
              </h4>
              <button
                type="button"
                onClick={() => onOpenAddPosOrder(booking)}
                className="text-[11px] font-bold text-[#1E3A8A] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" /> Add Room Service
              </button>
            </div>
            {booking.otherServices.length === 0 ? (
              <p className="text-slate-400 italic py-2">No room service or laundry orders yet.</p>
            ) : (
              booking.otherServices.map((srv) => (
                <div
                  key={srv.id}
                  className="p-3 rounded-xl border border-slate-200 bg-white flex items-center justify-between"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-900">{srv.orderNumber}</span>
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-white text-[10px] font-bold">
                        {srv.roomName}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      {srv.description} • {srv.dateTime}
                    </p>
                  </div>
                  <strong className="font-mono text-slate-900">
                    {formatINRDecimal(srv.amount)}
                  </strong>
                </div>
              ))
            )}
          </div>

          {/* Guest Info Cards with ID Preview Button (matching video 05:05) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Guest Info & Identity Proofs ({booking.guests.length})
              </h4>
              <button
                type="button"
                onClick={() => onOpenCheckInModal(booking)}
                className="px-2.5 py-1 bg-[#1E3A8A] hover:bg-[#172554] text-white rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                title="Add / Edit Guests & Upload ID Documents"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Manage Guests / Upload ID</span>
              </button>
            </div>
            {booking.guests.map((g) => (
              <div
                key={g.id}
                className="p-3.5 rounded-xl border border-slate-200 bg-white flex items-start justify-between gap-3"
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  {g.documentImageUrl && (
                    <img
                      src={g.documentImageUrl}
                      alt={g.documentType}
                      onClick={() => onPreviewGuestDoc(g, booking.bookingNo)}
                      className="w-20 h-14 object-cover rounded-lg border border-slate-200 cursor-pointer shrink-0 shadow-2xs hover:opacity-90"
                      title="Click to zoom ID document"
                    />
                  )}
                  <div className="space-y-1 min-w-0">
                    <p className="font-bold text-slate-900 text-sm">{g.name}</p>
                    <p className="text-slate-600 font-mono text-[11px]">📞 {g.phone}</p>
                    <p className="text-slate-500 text-[11px]">
                      ✉ {g.email || 'N/A'} • {g.gender} • {g.isAdult ? 'Adult' : 'Child'}
                    </p>
                    <span className="inline-block px-2 py-0.5 rounded bg-[#FBF4E0] text-[#8B691E] text-[10px] font-bold">
                      {g.documentType}: {g.documentNumber || 'Not entered'}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onPreviewGuestDoc(g, booking.bookingNo)}
                  className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-[#1E3A8A] border border-blue-200 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>View / Upload ID</span>
                </button>
              </div>
            ))}
          </div>

          {/* Cancellation & Refund Record Banner (shown when Cancelled or Refunded) */}
          {(booking.status === 'Cancelled' || booking.status === 'No-Show' || (booking.refundAmount || 0) > 0) && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase text-rose-900">
                  Cancellation & Refund Record
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-900 border border-purple-300 text-[10px] font-extrabold">
                  Refunded: {formatINRDecimal(booking.refundAmount || 0)}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1 text-[11px]">
                <div className="p-2 rounded-lg bg-white border border-rose-100">
                  <span className="text-slate-500 block text-[10px]">Advance Collected</span>
                  <strong className="font-mono text-slate-900">
                    {formatINRDecimal(booking.amountPaid)}
                  </strong>
                </div>
                <div className="p-2 rounded-lg bg-white border border-purple-200">
                  <span className="text-purple-700 block text-[10px] font-bold">Refunded to Guest</span>
                  <strong className="font-mono text-purple-800">
                    {formatINRDecimal(booking.refundAmount || 0)}
                  </strong>
                </div>
                <div className="p-2 rounded-lg bg-white border border-emerald-200">
                  <span className="text-emerald-700 block text-[10px]">Cancellation Fee</span>
                  <strong className="font-mono text-emerald-800">
                    {formatINRDecimal(Math.max(0, booking.amountPaid - (booking.refundAmount || 0)))}
                  </strong>
                </div>
              </div>
              {booking.cancellationReason && (
                <p className="text-[11px] text-rose-800 pt-1">
                  <strong>Reason / Refund Info:</strong> {booking.cancellationReason}
                </p>
              )}
            </div>
          )}

          {/* Payment Record Table matching video 06:20 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Payment Record
              </h4>
              <button
                type="button"
                onClick={() => onOpenRecordPayment(booking)}
                className="text-[11px] font-bold text-[#1E3A8A] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <CreditCard className="w-3 h-3" /> + Add Payment
              </button>
            </div>
            {booking.payments.length === 0 ? (
              <p className="text-slate-400 italic py-2">No payment records logged yet.</p>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="py-2 px-2.5 text-left">PAYMENT</th>
                      <th className="py-2 px-2.5 text-right">AMOUNT</th>
                      <th className="py-2 px-2.5 text-left">TRANSID</th>
                      <th className="py-2 px-2.5 text-right">DATE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {booking.payments.map((p) => {
                      const isRefundRow = p.amount < 0 || (p.notes && p.notes.toLowerCase().includes('refund'));
                      return (
                        <tr key={p.id} className={`border-b border-slate-100 ${isRefundRow ? 'bg-purple-50/60' : ''}`}>
                          <td className="py-2 px-2.5 font-bold">
                            {isRefundRow ? `REFUND (${p.paymentMethod})` : p.paymentMethod}
                          </td>
                          <td
                            className={`py-2 px-2.5 text-right font-mono font-bold ${
                              isRefundRow ? 'text-purple-700' : 'text-emerald-700'
                            }`}
                          >
                            {isRefundRow
                              ? `↩ -${formatINRDecimal(Math.abs(p.amount))}`
                              : `✓ ${formatINRDecimal(p.amount)}`}
                          </td>
                          <td className="py-2 px-2.5 font-mono text-slate-500">{p.transactionId}</td>
                          <td className="py-2 px-2.5 text-right font-mono text-slate-600">
                            {p.date}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Financial Breakdown */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-600">Total Room Cost:</span>
              <strong className="font-mono">{formatINRDecimal(booking.roomSubtotal)}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Other Services:</span>
              <strong className="font-mono">{formatINRDecimal(booking.otherServicesTotal)}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Total Tax ({booking.taxRate}%):</span>
              <strong className="font-mono">{formatINRDecimal(booking.taxAmount)}</strong>
            </div>
            <div className="flex justify-between text-emerald-700">
              <span>Discount:</span>
              <strong className="font-mono">- {formatINRDecimal(booking.discountAmount)}</strong>
            </div>
            <div className="flex justify-between pt-2 border-t border-slate-300 text-sm font-extrabold text-[#17120F]">
              <span>Total Payable:</span>
              <span className="font-mono">{formatINRDecimal(booking.totalPayable)}</span>
            </div>
          </div>

          {/* Invoice Scope Pills matching video 08:35: "Only Booking" vs "Booking + Other Services" */}
          <div className="space-y-2">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Select Invoice Mode
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setInvoiceScope('Only Booking')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold border flex items-center justify-between cursor-pointer transition-all ${
                  invoiceScope === 'Only Booking'
                    ? 'bg-[#1E3A8A] text-white border-[#1E3A8A]'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                <span>Only Booking</span>
                <FileText className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setInvoiceScope('Booking + Other Services')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold border flex items-center justify-between cursor-pointer transition-all ${
                  invoiceScope === 'Booking + Other Services'
                    ? 'bg-[#1E3A8A] text-white border-[#1E3A8A]'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                <span>Booking + Other Services</span>
                <FileText className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Footer Buttons: Print GRC | Create Invoice | Edit Details */}
        <div className={`p-4 border-t border-slate-200 bg-slate-50 grid ${onPrintGrc ? 'grid-cols-3' : 'grid-cols-2'} gap-2.5`}>
          {onPrintGrc && (
            <button
              type="button"
              onClick={() => onPrintGrc(booking)}
              className="py-2.5 px-3 bg-[#17120F] hover:bg-slate-800 text-[#E0BD6B] text-xs font-bold rounded-xl shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4 shrink-0" />
              <span>Print GRC</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => onOpenInvoiceModal(booking, invoiceScope)}
            className="py-2.5 px-3 bg-[#1E3A8A] hover:bg-[#172554] text-white text-xs font-bold rounded-xl shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <FileText className="w-4 h-4 shrink-0" />
            <span>Create Invoice</span>
          </button>
          <button
            type="button"
            onClick={() => onEditBooking(booking)}
            className="py-2.5 px-3 bg-white hover:bg-slate-100 text-[#1E3A8A] border border-[#1E3A8A] text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Edit3 className="w-4 h-4 shrink-0" />
            <span>Edit Details</span>
          </button>
        </div>
      </div>
    </div>
  );
}
