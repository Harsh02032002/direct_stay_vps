import sys

with open('src/components/InvoiceView.tsx', 'r', encoding='utf-8') as f:
    c = f.read()

old_header_block = """            <div className="flex items-center gap-3">
              {hotelSettings?.logoUrl ? (
                <img
                  src={hotelSettings.logoUrl}
                  alt={hotelSettings?.name || 'Hotel Logo'}
                  className="w-16 h-16 object-contain rounded"
                />
              ) : (
                <div className="w-16 h-16 bg-[#C49A3A]/20 border border-[#C49A3A]/40 rounded flex items-center justify-center text-[#8B691E]">
                  <span className="text-xl font-bold font-serif">
                    HOTEL
                  </span>
                </div>
              )}
              <div>
                <h1 className="text-2xl font-serif text-[#263449] font-bold tracking-tight uppercase">
                  {hotelSettings?.name || 'GRAND PAVILION HOTEL'}
                </h1>
                {hotelSettings?.address && String(hotelSettings.address).trim() !== '0' && (
                  <p className="text-xs text-[#5A6B82] mt-0.5">{hotelSettings.address}</p>
                )}
                <p className="text-[11px] text-[#5A6B82] font-mono mt-0.5">
                  Phone: {hotelSettings?.phoneNumber || 'N/A'} {hotelSettings?.emailAddress ? `| Email: ${hotelSettings.emailAddress}` : ''}
                </p>
                {(selectedInvoice.gst || 0) > 0 && hotelSettings?.gstNumber && (
                  <p className="text-[11px] font-mono font-bold text-[#8B691E] mt-1">
                    GSTIN: {hotelSettings.gstNumber}
                  </p>
                )}
              </div>
            </div>
            <div className="text-right">
              <span className="px-3 py-1 bg-[#FBF4E0] text-[#8B691E] border border-[#C49A3A] rounded text-xs font-mono font-bold tracking-widest inline-block mb-1.5">
                {(selectedInvoice.gst || 0) > 0 ? 'TAX INVOICE' : 'ROOM BILL'}
              </span>
              <p className="text-xs text-[#263449] font-mono font-bold mt-1">Invoice No: {selectedInvoice.invoiceNumber}</p>
              <p className="text-[11px] text-[#5A6B82] font-mono">GRC / Ref: {selectedInvoice.grcNumber || selectedInvoice.bookingId || selectedInvoice.id}</p>
              <p className="text-[11px] text-[#5A6B82] font-mono">Date: {selectedInvoice.dateCreated}</p>
            </div>
          </div>"""

new_header_block = """            <div className="flex items-start gap-3">
              {hotelSettings?.logoUrl ? (
                <img
                  src={hotelSettings.logoUrl}
                  alt={hotelSettings?.name || 'Hotel Logo'}
                  className="w-14 h-14 object-contain rounded"
                />
              ) : null}
              <div>
                <h1 className="text-2xl font-sans text-black font-extrabold tracking-tight">
                  {hotelSettings?.name || 'Hotel Grant Heights'}
                </h1>
                {hotelSettings?.address && String(hotelSettings.address).trim() !== '0' && (
                  <p className="text-xs text-[#222] mt-0.5">{hotelSettings.address}</p>
                )}
                <p className="text-[11px] text-[#222] font-mono mt-0.5">
                  Phone: {hotelSettings?.phoneNumber || 'N/A'} {hotelSettings?.emailAddress ? `| Email: ${hotelSettings.emailAddress}` : ''}
                  {(selectedInvoice.gst || 0) > 0 && hotelSettings?.gstNumber ? ` | GSTIN: ${hotelSettings.gstNumber}` : ''}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-extrabold uppercase text-black tracking-wider mb-1">
                BOOKING CONFIRMATION &amp; INVOICE
              </p>
              <p className="text-xs text-[#222] font-semibold">
                Conf #: <span className="font-mono">{selectedInvoice.grcNumber || selectedInvoice.bookingId || selectedInvoice.invoiceNumber}</span> | Date: {selectedInvoice.dateCreated}
              </p>
              <p className="text-xs font-bold text-black mt-0.5">
                Status: <span className="uppercase">{selectedInvoice.isPaid ? 'CONFIRMED (PAID)' : 'CONFIRMED'}</span>
              </p>
            </div>
          </div>
          <div className="border-b-2 border-black my-3"></div>"""

if old_header_block in c:
    c = c.replace(old_header_block, new_header_block, 1)
    print('1. Updated InvoiceView header to match Hotel Grant Heights layout')
else:
    print('1. old_header_block not found')

with open('src/components/InvoiceView.tsx', 'w', encoding='utf-8') as f:
    f.write(c)
