/** Web-only helper: opens a print window with the given full HTML document (Print / Save as PDF). */
export function openPrintWindow(html: string, autoPrint = true): void {
  const w = window.open('', '_blank', 'width=900,height=1100');
  if (!w) {
    alert('Please allow pop-ups to print this document.');
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  if (autoPrint) {
    const run = () => {
      try {
        w.focus();
        w.print();
      } catch {
        /* ignore */
      }
    };
    if (w.document.readyState === 'complete') setTimeout(run, 300);
    else w.addEventListener('load', () => setTimeout(run, 300));
  }
}
