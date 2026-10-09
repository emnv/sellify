import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "./cx";

export type Tone = "success" | "warning" | "danger" | "info" | "neutral" | "brand";

const tones: Record<Tone, { box: string; dot: string }> = {
  success: { box: "bg-success-bg text-success-fg", dot: "bg-success-fg" },
  warning: { box: "bg-warning-bg text-warning-fg", dot: "bg-warning-fg" },
  danger: { box: "bg-danger-bg text-danger-fg", dot: "bg-danger-fg" },
  info: { box: "bg-info-bg text-info-fg", dot: "bg-info-fg" },
  neutral: { box: "bg-neutral-bg text-neutral-fg", dot: "bg-neutral-fg" },
  brand: { box: "bg-brand-soft text-brand-strong", dot: "bg-brand" },
};

/**
 * Status of a record (Paid, Booked, Sold out…). Always a word, never colour
 * alone. Map domain statuses to tones in one place per domain.
 */
export function StatusBadge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span data-ui="status-badge" className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-small font-medium whitespace-nowrap", tones[tone].box)}>
      <span aria-hidden="true" className={cx("size-1.5 rounded-full", tones[tone].dot)} />
      {children}
    </span>
  );
}

/** Neutral label for a property (category, condition, storage). Not clickable. */
export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-sm border border-border bg-surface-muted px-2 py-0.5 text-small font-medium whitespace-nowrap text-fg-muted">
      {children}
    </span>
  );
}

type PillProps = {
  children: ReactNode;
  selected?: boolean;
  count?: number;
} & ({ href: string; onClick?: undefined } | { href?: undefined; onClick: () => void });

const pillBase =
  "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-small font-medium whitespace-nowrap " +
  "transition-colors ease-standard";
const pillOff = "border-border bg-surface text-fg-muted hover:border-border-strong hover:text-fg";
const pillOn = "border-brand-soft bg-brand-soft text-brand-strong";

/** Filter pill. One size everywhere. Selected state uses the brand colour. */
export function Pill({ children, selected = false, count, href, onClick }: PillProps) {
  const className = cx(pillBase, selected ? pillOn : pillOff);
  const inner = (
    <>
      {children}
      {count !== undefined ? (
        <span className={cx("rounded-full px-1.5 text-small", selected ? "bg-surface text-brand-strong" : "bg-surface-muted text-fg-subtle")}>
          {count}
        </span>
      ) : null}
    </>
  );
  if (href !== undefined) {
    return (
      <Link href={href} className={className} data-ui="pill" aria-current={selected ? "page" : undefined} scroll={false}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className} data-ui="pill" aria-pressed={selected}>
      {inner}
    </button>
  );
}
