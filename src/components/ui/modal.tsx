"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  /** Buttons, right-aligned. Primary action last. */
  footer?: ReactNode;
};

/**
 * Dialog on top of the page. Native <dialog>: focus is trapped, Esc closes,
 * focus returns to the trigger. Clicking the backdrop closes it.
 */
export function Modal({ open, onClose, title, description, children, footer }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className={
        "m-auto w-[calc(100%-2rem)] max-w-lg rounded-lg border border-border bg-surface p-0 text-fg shadow-popover " +
        "backdrop:bg-black/40"
      }
    >
      <div className="flex flex-col gap-1 border-b border-border px-5 py-4">
        <h2 id={titleId} className="font-heading text-heading font-semibold">
          {title}
        </h2>
        {description ? (
          <p id={descId} className="text-small text-fg-subtle">
            {description}
          </p>
        ) : null}
      </div>
      <div className="px-5 py-4">{children}</div>
      {footer ? <div className="flex flex-wrap justify-end gap-3 border-t border-border px-5 py-4">{footer}</div> : null}
    </dialog>
  );
}
