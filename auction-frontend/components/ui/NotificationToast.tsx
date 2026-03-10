'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { X } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

const DEFAULT_DURATION_MS = 5_000;

interface Toast {
  id:       string;
  title:    string;
  body?:    string;
  duration: number;
}

interface ToastContextValue {
  addToast: (title: string, body?: string, duration?: number) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}

// ─── Individual Toast ─────────────────────────────────────────────────────────

interface ToastItemProps {
  toast:    Toast;
  onRemove: (id: string) => void;
}

function ToastItem({ toast, onRemove }: ToastItemProps) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Slide-in: defer setting visible to true by one tick so the CSS transition fires.
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  const dismiss = useCallback(() => {
    setVisible(false);
    // Wait for the slide-out transition before removing from DOM
    const t = setTimeout(() => onRemove(toast.id), 300);
    return () => clearTimeout(t);
  }, [onRemove, toast.id]);

  // Auto-dismiss after duration
  useEffect(() => {
    timerRef.current = setTimeout(dismiss, toast.duration);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [dismiss, toast.duration]);

  return (
    <div
      className={[
        'pointer-events-auto w-[340px] rounded-[12px] bg-bg-card border border-border-subtle',
        'shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-4 transition-all duration-300 ease-out',
        visible
          ? 'translate-x-0 opacity-100'
          : 'translate-x-full opacity-0',
      ].join(' ')}
    >
      <div className="flex items-start gap-3">
        {/* Accent dot */}
        <div className="mt-0.5 shrink-0 h-2 w-2 rounded-full bg-accent" />

        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-semibold text-text-primary leading-snug">
            {toast.title}
          </p>
          {toast.body && (
            <p className="mt-0.5 text-[11px] text-text-muted leading-relaxed">
              {toast.body}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 p-0.5 rounded text-text-muted hover:text-text-primary transition-colors"
          aria-label="Dismiss notification"
        >
          <X size={12} />
        </button>
      </div>

      {/* Progress bar — depletes over toast.duration */}
      <div className="mt-3 h-[2px] bg-border-subtle rounded-full overflow-hidden">
        <div
          className="h-full bg-accent rounded-full"
          style={{
            animation: `toast-shrink ${toast.duration}ms linear forwards`,
          }}
        />
      </div>
    </div>
  );
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((title: string, body?: string, duration = DEFAULT_DURATION_MS) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts((prev) => [...prev, { id, title, body, duration }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}

      {/* Toast container — fixed top-right, above everything */}
      <div
        className="fixed top-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
        ))}
      </div>

      {/* Keyframe for the progress bar shrink animation */}
      <style>{`
        @keyframes toast-shrink {
          from { width: 100%; }
          to   { width: 0%;   }
        }
      `}</style>
    </ToastContext.Provider>
  );
}
