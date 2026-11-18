import React from 'react';
import { buildGuestGrcHtml, invoiceRecordToPrintHtml } from '../utils/pdfDownload';
import { openPrintWindow } from '../utils/printDocument';

/**
 * Real document preview for the Front Desk > Documents archive & modals.
 * Uses the exact client PDF HTML templates:
 *  - renderInvoiceHtml ("HOTEL M M PRESTIGE" Tax Invoice / Bill of Supply)
 *  - renderGrcHtml ("HOTEL RAJ RESIDENCY" Guest Registration Card)
 */

function InvoicePreview({ inv, hotel }: { inv: any; hotel: any }) {
  const html = invoiceRecordToPrintHtml(inv, hotel);
  return (
    <div style={{ width: '100%' }}>
      <iframe
        title={`Invoice ${inv?.invoiceNumber || inv?.id || ''}`}
        srcDoc={html}
        style={{
          width: '100%',
          minHeight: 780,
          border: '1px solid #E6DCCF',
          borderRadius: 8,
          background: '#ffffff',
        }}
      />
    </div>
  );
}

function GrcPreview({ c, hotel, fileData }: { c: any; hotel: any; fileData?: string }) {
  const html = buildGuestGrcHtml({
    checkin: c,
    hotelSettings: hotel,
  });
  return (
    <div style={{ width: '100%' }}>
      <iframe
        title={`GRC ${c?.grcNumber || c?.id || ''}`}
        srcDoc={html}
        style={{
          width: '100%',
          minHeight: 780,
          border: '1px solid #E6DCCF',
          borderRadius: 8,
          background: '#ffffff',
        }}
      />
      {fileData && (
        <div style={{ marginTop: 12, border: '1px solid #E6DCCF', borderRadius: 8, padding: 10, background: '#fff' }}>
          <div
            style={{
              background: '#17120F',
              color: '#E5C378',
              fontSize: 10.5,
              fontWeight: 700,
              padding: '4px 8px',
              marginBottom: 8,
              textTransform: 'uppercase',
            }}
          >
            ID Proof Attachment
          </div>
          <div style={{ textAlign: 'center' }}>
            <img
              src={fileData}
              alt="ID Proof"
              style={{ maxWidth: '100%', maxHeight: 260, objectFit: 'contain' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function DocumentPreviewBody({ doc, hotelSettings }: { doc: any; hotelSettings: any }) {
  if (!doc) return null;
  if (doc.type === 'Tax Invoice' && doc.source) return <InvoicePreview inv={doc.source} hotel={hotelSettings} />;
  if (doc.type === 'GRC' && doc.source) return <GrcPreview c={doc.source} hotel={hotelSettings} fileData={doc.fileData} />;
  if (doc.fileData) {
    return <img src={doc.fileData} alt="Document File" style={{ maxWidth: '100%', maxHeight: 420, objectFit: 'contain' }} />;
  }
  return <p style={{ fontSize: 12 }}>No preview available for this document.</p>;
}

/** Print only the preview markup in a clean popup window (using openPrintWindow on the rendered HTML). */
export function printPreviewElement(elementId: string, title: string) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const iframe = el.querySelector('iframe');
  const srcDoc = iframe?.getAttribute('srcdoc');
  if (srcDoc) {
    openPrintWindow(srcDoc, true);
    return;
  }
  openPrintWindow(
    `<!DOCTYPE html><html><head><title>${title.replace(/</g, '&lt;')}</title><style>@page{size:A4;margin:10mm}body{margin:0;padding:12px;font-family:Arial,Helvetica,sans-serif}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}</style></head><body>${el.innerHTML}</body></html>`,
    true
  );
}
