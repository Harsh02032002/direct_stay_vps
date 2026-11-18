import React, { useRef, useState, useEffect } from 'react';
import { PenTool, Upload, RotateCcw, Check } from 'lucide-react';

interface SignaturePadInputProps {
  label: string;
  subLabel?: string;
  value: string;
  onChange: (dataUrl: string) => void;
  required?: boolean;
}

export default function SignaturePadInput({
  label,
  subLabel,
  value,
  onChange,
  required = false,
}: SignaturePadInputProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isDrawingRef = useRef(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  const lastDrawnDataUrlRef = useRef<string>('');
  const [mode, setMode] = useState<'draw' | 'preview'>(value ? 'preview' : 'draw');

  useEffect(() => {
    if (!value) {
      lastDrawnDataUrlRef.current = '';
      setMode('draw');
      clearCanvasBitmap();
    } else if (value !== lastDrawnDataUrlRef.current) {
      setMode('preview');
    }
  }, [value]);

  const clearCanvasBitmap = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const getCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / Math.max(1, rect.width);
    const scaleY = canvas.height / Math.max(1, rect.height);
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    isDrawingRef.current = true;
    const pt = getCanvasPoint(e);
    lastPosRef.current = pt;

    ctx.strokeStyle = '#17120F';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(pt.x, pt.y);
    ctx.lineTo(pt.x + 0.1, pt.y + 0.1);
    ctx.stroke();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    e.preventDefault();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pt = getCanvasPoint(e);
    const last = lastPosRef.current || pt;

    ctx.strokeStyle = '#17120F';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();

    lastPosRef.current = pt;
  };

  const finishStroke = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    lastPosRef.current = null;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    lastDrawnDataUrlRef.current = dataUrl;
    onChange(dataUrl);
  };

  const handleClear = () => {
    clearCanvasBitmap();
    setMode('draw');
    onChange('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUploadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const rawDataUrl = String(reader.result || '');
      const img = new Image();
      img.onload = () => {
        const maxW = 480;
        const maxH = 160;
        const ratio = Math.min(maxW / Math.max(1, img.width), maxH / Math.max(1, img.height), 1);
        const targetW = Math.max(1, Math.round(img.width * ratio));
        const targetH = Math.max(1, Math.round(img.height * ratio));
        const offscreen = document.createElement('canvas');
        offscreen.width = targetW;
        offscreen.height = targetH;
        const octx = offscreen.getContext('2d');
        if (octx) {
          octx.clearRect(0, 0, targetW, targetH);
          octx.drawImage(img, 0, 0, targetW, targetH);
          const optimized = offscreen.toDataURL('image/png');
          setMode('preview');
          onChange(optimized);
        } else {
          setMode('preview');
          onChange(rawDataUrl);
        }
      };
      img.onerror = () => {
        setMode('preview');
        onChange(rawDataUrl);
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <label className="text-xs font-mono text-luxury-brown-700 uppercase font-bold flex items-center gap-1.5">
          <PenTool className="w-3.5 h-3.5 text-[#9E2A2B]" />
          <span>
            {label} {required && <span className="text-[#9E2A2B]">*</span>}
          </span>
        </label>
        <div className="flex items-center gap-1.5">
          {value ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
              <Check className="w-3 h-3" /> Captured
            </span>
          ) : (
            required && (
              <span className="text-[10px] font-mono font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                Required
              </span>
            )
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp"
            className="hidden"
            onChange={handleUploadFile}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-2 py-1 bg-white border border-luxury-brown-200 hover:border-[#C5A059] hover:bg-[#FAF6F0] text-luxury-brown-800 rounded text-[10px] font-mono font-bold flex items-center gap-1 cursor-pointer transition-colors"
            title="Upload signature image (PNG/JPG)"
          >
            <Upload className="w-3 h-3 text-[#8B691E]" /> Upload
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="px-2 py-1 bg-white border border-luxury-brown-200 hover:border-rose-300 hover:bg-rose-50 text-rose-700 rounded text-[10px] font-mono font-bold flex items-center gap-1 cursor-pointer transition-colors"
            title="Clear and re-sign"
          >
            <RotateCcw className="w-3 h-3" /> Clear
          </button>
        </div>
      </div>

      <div
        className={`relative rounded-xl border-2 border-dashed overflow-hidden bg-white transition-colors ${
          value ? 'border-emerald-300' : 'border-luxury-brown-200 hover:border-[#C5A059]'
        }`}
      >
        {value && mode === 'preview' ? (
          <div className="h-[115px] w-full flex flex-col items-center justify-center p-2 bg-white">
            <img
              src={value}
              alt={label}
              className="max-h-[92px] max-w-full object-contain"
            />
          </div>
        ) : (
          <div className="relative h-[115px] w-full bg-white">
            <canvas
              ref={canvasRef}
              width={480}
              height={140}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={finishStroke}
              onPointerCancel={finishStroke}
              onPointerLeave={finishStroke}
              className="w-full h-full cursor-crosshair touch-none block"
            />
            {!value && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center px-3">
                <span className="text-[11px] font-serif italic text-slate-400">
                  Sign here using mouse / touch or click &ldquo;Upload&rdquo;
                </span>
              </div>
            )}
          </div>
        )}
      </div>
      {subLabel && (
        <p className="text-[10px] font-mono text-luxury-brown-500">{subLabel}</p>
      )}
    </div>
  );
}
