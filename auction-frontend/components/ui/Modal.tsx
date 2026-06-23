'use client';

import { type ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './dialog';

// ── App-layer Modal wrapper over shadcn base-nova Dialog ───────────────────────
// All application modals use this component. It wraps the Dialog primitives in
// dialog.tsx and exposes a simpler API (onClose instead of onOpenChange, plus
// named size and backdrop-lock props).
//
// Focus trapping and Escape-to-close come from @base-ui/react/dialog automatically.
// disablePointerDismissal is the base-ui API to block backdrop-click-close while
// still allowing Escape and the close button.

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  /**
   * When true, clicking the backdrop does NOT close the modal.
   * Escape key and the X close button still work.
   */
  disableBackdropClose?: boolean;
}

const sizeClasses: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
};

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  size = 'md',
  disableBackdropClose = false,
}: ModalProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      disablePointerDismissal={disableBackdropClose}
    >
      <DialogContent className={sizeClasses[size]} showCloseButton>
        {(title || description) && (
          <DialogHeader>
            {title && <DialogTitle>{title}</DialogTitle>}
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
        )}
        {children}
      </DialogContent>
    </Dialog>
  );
}
