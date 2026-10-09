import type { ReactNode } from "react";
import { cx } from "./cx";

type NoticeTone = "success" | "warning" | "danger" | "info";

const tones: Record<NoticeTone, string> = {
  success: "border-success-fg/20 bg-success-bg text-success-fg",
  warning: "border-warning-fg/20 bg-warning-bg text-warning-fg",
  danger: "border-danger-fg/20 bg-danger-bg text-danger-fg",
  info: "border-info-fg/20 bg-info-bg text-info-fg",
};

/** Inline message: form errors, saved confirmations, warnings. */
export function Notice({ tone, title, children }: { tone: NoticeTone; title?: string; children?: ReactNode }) {
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cx("rounded-md border px-4 py-3 text-body", tones[tone])}>
      {title ? <p className="font-medium">{title}</p> : null}
      {children ? <div className={cx(title && "mt-0.5")}>{children}</div> : null}
    </div>
  );
}

/** Placeholder for a page or card with nothing in it yet. */
export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <p className="font-heading text-heading font-semibold text-fg">{title}</p>
      {description ? <p className="max-w-md text-body text-fg-muted">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/** Loading placeholder block. */
export function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className={cx("h-4 animate-pulse rounded-sm bg-surface-muted", i === lines - 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}
