import React, { useRef, useState } from 'react';
import {
  Bold,
  Italic,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Link2,
  Image as ImageIcon,
  Quote,
  Eye,
  Code2,
  Type,
} from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (nextValue: string) => void;
  placeholder?: string;
  minHeight?: string;
}

export function sanitizeCmsHtml(raw: string): string {
  if (!raw) return '';
  let safe = String(raw)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '');

  // If plain text (no HTML tags), render paragraphs cleanly
  if (!/<[a-z][\s\S]*>/i.test(safe)) {
    safe = safe
      .split(/\n{2,}/)
      .map((para) => `<p>${para.replace(/\n/g, '<br/>')}</p>`)
      .join('\n');
  }
  return safe;
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = 'Write formatted content here...',
  minHeight = '220px',
}: RichTextEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [mode, setMode] = useState<'write' | 'preview'>('write');

  const wrapSelection = (before: string, after: string, fallbackText = 'Text') => {
    const el = textareaRef.current;
    if (!el) {
      onChange(`${value}${before}${fallbackText}${after}`);
      return;
    }
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const selected = value.slice(start, end) || fallbackText;
    const next = `${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`;
    onChange(next);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + before.length, start + before.length + selected.length);
    }, 0);
  };

  const handleInsertLink = () => {
    const url = window.prompt('Enter link URL (e.g. https://directstay.online/pricing or /pricing):', 'https://');
    if (!url || !url.trim()) return;
    const text = window.prompt('Enter link label:', 'Explore DirectStay') || url.trim();
    wrapSelection(`<a href="${url.trim()}" class="text-amber-700 underline font-semibold">`, '</a>', text);
  };

  const handleInsertImage = () => {
    const imgUrl = window.prompt('Enter image URL (https://...):', 'https://');
    if (!imgUrl || !imgUrl.trim()) return;
    const altText = window.prompt('Enter SEO Image Alt Text:', 'DirectStay Hotel PMS Dashboard') || 'DirectStay image';
    const snippet = `\n<figure class="my-4"><img src="${imgUrl.trim()}" alt="${altText.replace(/"/g, '&quot;')}" class="rounded-2xl w-full max-h-96 object-cover border border-stone-200" /><figcaption class="text-xs text-stone-500 mt-1.5">${altText}</figcaption></figure>\n`;
    wrapSelection(snippet, '', '');
  };

  return (
    <div className="border border-luxury-brown-200 rounded-2xl overflow-hidden bg-white">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-luxury-beige-50 border-b border-luxury-brown-100">
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            title="Heading 2"
            onClick={() => wrapSelection('\n<h2>', '</h2>\n', 'Section Heading')}
            className="p-1.5 rounded-lg hover:bg-white border border-transparent hover:border-luxury-brown-200 text-luxury-brown-700 cursor-pointer"
          >
            <Heading2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            title="Heading 3"
            onClick={() => wrapSelection('\n<h3>', '</h3>\n', 'Subheading')}
            className="p-1.5 rounded-lg hover:bg-white border border-transparent hover:border-luxury-brown-200 text-luxury-brown-700 cursor-pointer"
          >
            <Heading3 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            title="Paragraph"
            onClick={() => wrapSelection('\n<p>', '</p>\n', 'Paragraph text')}
            className="p-1.5 rounded-lg hover:bg-white border border-transparent hover:border-luxury-brown-200 text-luxury-brown-700 cursor-pointer"
          >
            <Type className="w-3.5 h-3.5" />
          </button>
          <span className="w-px h-4 bg-luxury-brown-200 mx-0.5" />
          <button
            type="button"
            title="Bold"
            onClick={() => wrapSelection('<strong>', '</strong>', 'Important text')}
            className="p-1.5 rounded-lg hover:bg-white border border-transparent hover:border-luxury-brown-200 text-luxury-brown-700 cursor-pointer"
          >
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            title="Italic"
            onClick={() => wrapSelection('<em>', '</em>', 'Highlighted text')}
            className="p-1.5 rounded-lg hover:bg-white border border-transparent hover:border-luxury-brown-200 text-luxury-brown-700 cursor-pointer"
          >
            <Italic className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            title="Blockquote"
            onClick={() => wrapSelection('\n<blockquote class="border-l-4 border-amber-500 pl-4 italic my-3">', '</blockquote>\n', 'Key hospitality insight')}
            className="p-1.5 rounded-lg hover:bg-white border border-transparent hover:border-luxury-brown-200 text-luxury-brown-700 cursor-pointer"
          >
            <Quote className="w-3.5 h-3.5" />
          </button>
          <span className="w-px h-4 bg-luxury-brown-200 mx-0.5" />
          <button
            type="button"
            title="Bullet List"
            onClick={() => wrapSelection('\n<ul class="list-disc pl-5 space-y-1 my-2">\n  <li>', '</li>\n  <li>Second point</li>\n</ul>\n', 'First point')}
            className="p-1.5 rounded-lg hover:bg-white border border-transparent hover:border-luxury-brown-200 text-luxury-brown-700 cursor-pointer"
          >
            <List className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            title="Numbered List"
            onClick={() => wrapSelection('\n<ol class="list-decimal pl-5 space-y-1 my-2">\n  <li>', '</li>\n  <li>Step two</li>\n</ol>\n', 'Step one')}
            className="p-1.5 rounded-lg hover:bg-white border border-transparent hover:border-luxury-brown-200 text-luxury-brown-700 cursor-pointer"
          >
            <ListOrdered className="w-3.5 h-3.5" />
          </button>
          <span className="w-px h-4 bg-luxury-brown-200 mx-0.5" />
          <button
            type="button"
            title="Insert Link"
            onClick={handleInsertLink}
            className="p-1.5 rounded-lg hover:bg-white border border-transparent hover:border-luxury-brown-200 text-luxury-brown-700 cursor-pointer"
          >
            <Link2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            title="Insert Image with Alt Text"
            onClick={handleInsertImage}
            className="p-1.5 rounded-lg hover:bg-white border border-transparent hover:border-luxury-brown-200 text-luxury-brown-700 cursor-pointer"
          >
            <ImageIcon className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="inline-flex rounded-lg border border-luxury-brown-200 bg-white p-0.5 text-[10px] font-mono font-bold">
          <button
            type="button"
            onClick={() => setMode('write')}
            className={`px-2.5 py-1 rounded-md inline-flex items-center gap-1 cursor-pointer ${
              mode === 'write' ? 'bg-luxury-brown-950 text-luxury-gold-400' : 'text-luxury-brown-600'
            }`}
          >
            <Code2 className="w-3 h-3" /> Edit
          </button>
          <button
            type="button"
            onClick={() => setMode('preview')}
            className={`px-2.5 py-1 rounded-md inline-flex items-center gap-1 cursor-pointer ${
              mode === 'preview' ? 'bg-luxury-brown-950 text-luxury-gold-400' : 'text-luxury-brown-600'
            }`}
          >
            <Eye className="w-3 h-3" /> Preview
          </button>
        </div>
      </div>

      {/* Body */}
      {mode === 'write' ? (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={{ minHeight }}
          className="w-full p-3.5 text-xs text-luxury-brown-900 font-sans leading-relaxed focus:outline-none resize-y"
        />
      ) : (
        <div
          style={{ minHeight }}
          className="p-4 text-sm text-luxury-brown-800 leading-relaxed space-y-2 prose prose-sm max-w-none bg-luxury-beige-50/20"
          dangerouslySetInnerHTML={{
            __html:
              sanitizeCmsHtml(value) ||
              '<p class="text-stone-400 italic">Nothing to preview yet.</p>',
          }}
        />
      )}
    </div>
  );
}
