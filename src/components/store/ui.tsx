import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

// Store-side primitives. They use only the store-* tokens, so every element
// follows the shop's own theme (colours, fonts, corner radius, button size).

type Variant = "primary" | "outline" | "ghost";

const btn =
  "inline-flex h-(--store-btn-h) items-center justify-center gap-2 rounded-store px-(--store-btn-px) text-(length:--store-btn-fs) " +
  "font-semibold whitespace-nowrap transition-[filter,background-color] duration-150 hover:brightness-95 " +
  "disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-store-primary";

const variants: Record<Variant, string> = {
  primary: "bg-store-primary text-store-on-primary",
  outline: "border border-store-border bg-store-surface text-store-text",
  ghost: "text-store-text hover:bg-store-surface",
};

export function storeButtonClass(variant: Variant = "primary", full = false) {
  return `${btn} ${variants[variant]} ${full ? "w-full" : ""}`;
}

export function StoreButton({ variant = "primary", full, ...props }: ComponentProps<"button"> & { variant?: Variant; full?: boolean }) {
  return <button type="button" {...props} className={storeButtonClass(variant, full)} />;
}

export function StoreLinkButton({ href, variant = "primary", full, children }: { href: string; variant?: Variant; full?: boolean; children: ReactNode }) {
  return (
    <Link href={href} className={storeButtonClass(variant, full)}>
      {children}
    </Link>
  );
}

export function Section({ title, subtitle, children, id }: { title?: string; subtitle?: string; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      {title ? (
        <div className="mb-6 flex flex-col gap-1">
          <h2 className="font-store-heading text-store-2xl font-bold tracking-tight sm:text-store-3xl">{title}</h2>
          {subtitle ? <p className="text-store-muted">{subtitle}</p> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function StoreCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-store-card border border-store-border bg-store-surface ${className}`}>{children}</div>;
}

export function StoreBadge({ tone = "accent", children }: { tone?: "accent" | "muted" | "primary"; children: ReactNode }) {
  const tones = {
    accent: "bg-store-accent text-store-on-accent",
    primary: "bg-store-primary text-store-on-primary",
    muted: "border border-store-border bg-store-bg text-store-muted",
  };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-store-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

const field =
  "block w-full rounded-store border border-store-border bg-store-surface px-3 py-2.5 text-store-text placeholder:text-store-muted " +
  "focus:outline-2 focus:outline-offset-0 focus:outline-store-primary aria-invalid:border-store-accent";

export function StoreField({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-store-sm font-semibold">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-store-sm font-medium text-store-accent">
          {error}
        </p>
      ) : hint ? (
        <p className="text-store-sm text-store-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function StoreInput({ invalid, ...props }: ComponentProps<"input"> & { invalid?: boolean }) {
  return <input {...props} aria-invalid={invalid || undefined} aria-describedby={invalid && props.id ? `${props.id}-error` : undefined} className={field} />;
}

export function StoreSelect({ invalid, children, ...props }: ComponentProps<"select"> & { invalid?: boolean }) {
  return (
    <select {...props} aria-invalid={invalid || undefined} className={`${field} appearance-none`}>
      {children}
    </select>
  );
}

/** Large tappable option (brand, model, repair, storage, yes/no). */
export function OptionButton({ selected, children, ...props }: ComponentProps<"button"> & { selected?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      aria-pressed={selected}
      className={
        "flex min-h-12 w-full items-center justify-between gap-3 rounded-store border px-4 py-3 text-left font-medium transition-colors " +
        (selected ? "border-store-primary bg-store-primary text-store-on-primary" : "border-store-border bg-store-surface hover:border-store-primary")
      }
    >
      {children}
    </button>
  );
}

export function StoreNotice({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "error" }) {
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-store border px-4 py-3 text-store-sm ${tone === "error" ? "border-store-accent text-store-text" : "border-store-border bg-store-surface"}`}>
      {children}
    </div>
  );
}
