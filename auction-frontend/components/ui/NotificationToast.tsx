'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

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
  // Auto-dismiss: remove from state after duration — AnimatePresence handles the exit animation
  useEffect(() => {
    const t = setTimeout(() => onRemove(toast.id), toast.duration);
    return () => clearTimeout(t);
  }, [onRemove, toast.id, toast.duration]);

  return (
    <motion.div
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0, transition: { duration: 0.2, ease: 'easeIn' } }}
      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
      className="pointer-events-auto w-[340px] rounded-[4px] bg-bg-elevated border border-border-default shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-4"
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

        <motion.button
          type="button"
          onClick={() => onRemove(toast.id)}
          whileHover={{ scale: 1.15 }}
          whileTap={{ scale: 0.9 }}
          className="shrink-0 p-0.5 rounded text-text-muted hover:text-text-primary transition-colors"
          aria-label="Dismiss notification"
        >
          <X size={12} />
        </motion.button>
      </div>

      {/* Progress bar — depletes over toast.duration */}
      <div className="mt-3 h-[2px] bg-border-subtle rounded-full overflow-hidden">
        <div
          className="h-full bg-accent rounded-full"
          style={{ animation: `toast-shrink ${toast.duration}ms linear forwards` }}
        />
      </div>
    </motion.div>
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
        <AnimatePresence>
          {toasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
          ))}
        </AnimatePresence>
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
