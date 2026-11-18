export type ToastSeverity = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  title?: string;
  message: string;
  severity: ToastSeverity;
  durationMs: number;
  createdAt: number;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

type ToastListener = (toasts: ToastItem[]) => void;

let activeToasts: ToastItem[] = [];
const listeners = new Set<ToastListener>();
const recentToastFingerprints = new Map<string, number>();

function notifyListeners() {
  const snapshot = [...activeToasts];
  listeners.forEach((fn) => fn(snapshot));
}

export function inferToastSeverity(message: string): ToastSeverity {
  const lower = message.toLowerCase();
  if (
    lower.includes('error') ||
    lower.includes('failed') ||
    lower.includes('denied') ||
    lower.includes('cannot') ||
    lower.includes('conflict') ||
    lower.includes('invalid') ||
    lower.includes('critical')
  ) {
    return 'error';
  }
  if (
    lower.includes('required') ||
    lower.includes('missing') ||
    lower.includes('please ') ||
    lower.includes('kindly ') ||
    lower.includes('already ') ||
    lower.includes('empty') ||
    lower.includes('must ') ||
    lower.includes('minimum') ||
    lower.includes('no additional') ||
    lower.includes('no foreign') ||
    lower.includes('rejected')
  ) {
    return 'warning';
  }
  if (
    lower.includes('success') ||
    lower.includes('saved') ||
    lower.includes('approved') ||
    lower.includes('generated') ||
    lower.includes('standardized') ||
    lower.includes('completed') ||
    lower.includes('verified') ||
    lower.includes('created')
  ) {
    return 'success';
  }
  return 'info';
}

export function showToast(
  message: string,
  severity?: ToastSeverity,
  durationOrTitle?: number | string,
  durationOrTitle2?: number | string
): string {
  const cleanMsg = String(message || '').trim();
  if (!cleanMsg) return '';

  const resolvedSeverity: ToastSeverity = severity || inferToastSeverity(cleanMsg);
  let durationMs = 4500;
  let title: string | undefined = undefined;

  if (typeof durationOrTitle === 'number') {
    durationMs = durationOrTitle;
    if (typeof durationOrTitle2 === 'string') title = durationOrTitle2;
  } else if (typeof durationOrTitle === 'string') {
    title = durationOrTitle;
    if (typeof durationOrTitle2 === 'number') durationMs = durationOrTitle2;
  }

  // Prevent duplicate identical toasts within 1.5 seconds
  const fingerprint = `${resolvedSeverity}:${cleanMsg}`;
  const now = Date.now();
  const lastShown = recentToastFingerprints.get(fingerprint);
  if (lastShown && now - lastShown < 1500) {
    return '';
  }
  recentToastFingerprints.set(fingerprint, now);

  const id = `toast-${now}-${Math.random().toString(36).slice(2, 7)}`;
  const item: ToastItem = {
    id,
    title: title || undefined,
    message: cleanMsg,
    severity: resolvedSeverity,
    durationMs,
    createdAt: now,
  };

  activeToasts = [item, ...activeToasts].slice(0, 5);
  notifyListeners();

  if (durationMs > 0) {
    setTimeout(() => {
      dismissToast(id);
    }, durationMs);
  }

  return id;
}

export function dismissToast(id: string) {
  const target = activeToasts.find((t) => t.id === id);
  const next = activeToasts.filter((t) => t.id !== id);
  if (next.length !== activeToasts.length) {
    activeToasts = next;
    notifyListeners();
    if (target?.onCancel) {
      try {
        target.onCancel();
      } catch {}
    }
  }
}

export function showConfirmToast(params: {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  severity?: ToastSeverity;
  durationMs?: number;
}): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const id = `toast-confirm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const finish = (answer: boolean) => {
      if (settled) return;
      settled = true;
      activeToasts = activeToasts.filter((t) => t.id !== id);
      notifyListeners();
      resolve(answer);
    };
    const item: ToastItem = {
      id,
      title: params.title || 'Confirm Action',
      message: params.message,
      severity: params.severity || 'warning',
      durationMs: params.durationMs ?? 25000,
      createdAt: Date.now(),
      confirmLabel: params.confirmLabel || 'Confirm',
      cancelLabel: params.cancelLabel || 'Cancel',
      onConfirm: () => finish(true),
      onCancel: () => finish(false),
    };
    activeToasts = [item, ...activeToasts.filter((t) => !t.onConfirm)].slice(0, 5);
    notifyListeners();
    if (item.durationMs > 0) {
      setTimeout(() => finish(false), item.durationMs);
    }
  });
}

export function subscribeToasts(listener: ToastListener): () => void {
  listeners.add(listener);
  listener([...activeToasts]);
  return () => {
    listeners.delete(listener);
  };
}

// Intercept any stray native browser alert() calls globally so they always render as luxury toasts
if (typeof window !== 'undefined') {
  window.alert = (msg?: any) => {
    showToast(String(msg ?? ''));
  };
}

