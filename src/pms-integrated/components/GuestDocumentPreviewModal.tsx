import React, { useEffect, useState } from 'react';
import { X, ZoomIn, ZoomOut, Download, ShieldCheck, Upload, CheckCircle2 } from 'lucide-react';
import { GuestPerson } from '../types';
import { SAMPLE_AADHAAR_SVG_URL } from '../mock-data/initialData';

interface GuestDocumentPreviewModalProps {
  guest: GuestPerson | null;
  bookingNo: string;
  onClose: () => void;
  onUpdateGuestDoc?: (
    bookingNoOrId: string,
    guestId: string,
    updates: Partial<GuestPerson>
  ) => void;
}

export default function GuestDocumentPreviewModal({
  guest,
  bookingNo,
  onClose,
  onUpdateGuestDoc,
}: GuestDocumentPreviewModalProps) {
  const [zoom, setZoom] = useState<number>(1);
  const [docType, setDocType] = useState<GuestPerson['documentType']>('Aadhaar Card');
  const [docNumber, setDocNumber] = useState<string>('');
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  useEffect(() => {
    if (guest) {
      setDocType(guest.documentType || 'Aadhaar Card');
      setDocNumber(guest.documentNumber || '');
      setZoom(1);
      setSavedNotice(null);
    }
  }, [guest]);

  if (!guest) return null;

  const rawImg =
    guest.documentImageUrl ||
    (guest as any).idProofFileData ||
    (guest as any).aadhaarUploadData ||
    (guest as any).passportUploadData ||
    (guest as any).guestPhotoData;

  const hasUploadedScan = Boolean(rawImg && rawImg !== SAMPLE_AADHAAR_SVG_URL);
  const docImg = rawImg || SAMPLE_AADHAAR_SVG_URL;

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = docImg;
    let ext = 'jpg';
    if (docImg.startsWith('data:image/png')) ext = 'png';
    else if (docImg.startsWith('data:image/svg') || docImg === SAMPLE_AADHAAR_SVG_URL) ext = 'svg';
    else if (docImg.startsWith('data:application/pdf')) ext = 'pdf';
    a.download = `${(guest.name || 'Guest').replace(/\s+/g, '_')}_${(
      guest.documentType || 'ID'
    ).replace(/\s+/g, '_')}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string' && onUpdateGuestDoc) {
        onUpdateGuestDoc(bookingNo, guest.id, {
          documentType: docType,
          documentNumber: docNumber || guest.documentNumber,
          documentImageUrl: reader.result,
        });
        setSavedNotice('Guest ID scan uploaded & saved to database!');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveMetadata = () => {
    if (!onUpdateGuestDoc) return;
    onUpdateGuestDoc(bookingNo, guest.id, {
      documentType: docType,
      documentNumber: docNumber,
    });
    setSavedNotice('Guest ID details updated!');
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/65 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-xl overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-[#FBF4E0]">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#C49A3A]" />
            <h3 className="text-sm font-bold text-[#17120F]">
              {guest.name} — Guest Identity Document
            </h3>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                hasUploadedScan
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-amber-100 text-amber-900 border border-amber-300'
              }`}
            >
              {hasUploadedScan ? '✓ Uploaded ID Scan' : 'Digital ID Card'}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-black/10 text-slate-600 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
          {savedNotice && (
            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{savedNotice}</span>
            </div>
          )}

          {/* Guest Metadata Grid */}
          <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div>
              <span className="text-slate-500">Name: </span>
              <strong className="text-slate-900">{guest.name}</strong>
            </div>
            <div>
              <span className="text-slate-500">Contact: </span>
              <strong className="text-slate-900 font-mono">{guest.phone || 'N/A'}</strong>
            </div>
            <div>
              <span className="text-slate-500">Email: </span>
              <strong className="text-slate-900">{guest.email || 'N/A'}</strong>
            </div>
            <div>
              <span className="text-slate-500">Gender: </span>
              <strong className="text-slate-900 capitalize">{guest.gender || 'N/A'}</strong>
            </div>
            <div>
              <span className="text-slate-500">Age: </span>
              <strong className="text-slate-900">{guest.age ? `${guest.age} yrs` : 'N/A'}</strong>
            </div>
            <div>
              <span className="text-slate-500">Booking Id: </span>
              <strong className="text-slate-900 font-mono">{bookingNo}</strong>
            </div>
          </div>

          {/* Document Type & Number Editor + Upload Scan Button */}
          {onUpdateGuestDoc && (
            <div className="p-3 rounded-xl bg-[#FAF6EE] border border-[#E2D6BE] flex flex-wrap items-center gap-2 text-xs">
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value as GuestPerson['documentType'])}
                className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-bold text-slate-800"
              >
                <option value="Aadhaar Card">Aadhaar Card</option>
                <option value="Passport">Passport</option>
                <option value="Pan Card">Pan Card</option>
                <option value="Driving License">Driving License</option>
                <option value="Voter Id Card">Voter Id Card</option>
                <option value="Visa">Visa</option>
                <option value="Other">Other</option>
              </select>
              <input
                type="text"
                value={docNumber}
                onChange={(e) => setDocNumber(e.target.value)}
                onBlur={handleSaveMetadata}
                placeholder="Enter ID / Aadhaar Number"
                className="flex-1 min-w-[140px] px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-mono font-bold text-slate-800"
              />
              <label className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5 cursor-pointer shrink-0 shadow-xs">
                <Upload className="w-3.5 h-3.5" />
                <span>{hasUploadedScan ? 'Replace ID Photo' : 'Upload ID Photo'}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </label>
            </div>
          )}

          {/* Document Preview Frame */}
          <div className="border border-slate-200 rounded-xl p-3 bg-slate-100/70 space-y-2">
            <div className="text-center text-xs font-bold uppercase tracking-wider text-slate-700">
              {docType} {docNumber ? `(${docNumber})` : ''}
            </div>
            <div className="overflow-auto max-h-80 min-h-[200px] flex items-center justify-center bg-white rounded-lg p-3 border border-slate-200">
              <img
                src={docImg}
                alt={docType}
                style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
                className="max-w-full max-h-72 object-contain rounded shadow-xs transition-transform duration-200"
              />
            </div>
            {/* Zoom & Download Controls */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="text-[11px] text-slate-500">
                {hasUploadedScan
                  ? 'Showing original uploaded guest ID scan'
                  : 'Click "Upload ID Photo" above to attach scanned Aadhaar/Passport image'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(0.75, +(z - 0.25).toFixed(2)))}
                  className="p-1.5 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-slate-700 cursor-pointer"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(2.5, +(z + 0.25).toFixed(2)))}
                  className="p-1.5 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-slate-700 cursor-pointer"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="px-3 py-1.5 bg-[#FBF4E0] hover:bg-[#F6E9C8] text-[#8B691E] border border-[#C49A3A]/40 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download ID</span>
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            {onUpdateGuestDoc && (
              <button
                type="button"
                onClick={handleSaveMetadata}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase rounded-xl cursor-pointer"
              >
                Save ID Details
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-[#1E3A8A] hover:bg-[#172554] text-white text-xs font-bold uppercase rounded-xl cursor-pointer"
            >
              CLOSE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
