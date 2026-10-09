import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "./cx";

/** Content column inside the app shell: max width and page padding. */
export function Page({ children }: { children: ReactNode }) {
  return <div className="mx-auto flex w-full max-w-page flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">{children}</div>;
}

type PageHeaderProps = {
  title: string;
  description?: ReactNode;
  /** Buttons on the right. At most one primary. */
  actions?: ReactNode;
  /** Parent page, e.g. { href: "/core/inventory", label: "Inventory" }. */
  back?: { href: string; label: string };
};

/** Top of every backend page: title, one-line description, actions. */
export function PageHeader({ title, description, actions, back }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-3">
      {back ? (
        <Link href={back.href} className="inline-flex w-fit items-center gap-1 text-small font-medium text-fg-subtle hover:text-fg">
          <span aria-hidden="true">←</span> {back.label}
        </Link>
      ) : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="font-heading text-title font-bold text-fg">{title}</h1>
          {description ? <p className="text-body text-fg-muted">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div> : null}
      </div>
    </header>
  );
}

type CardProps = {
  title?: string;
  description?: ReactNode;
  actions?: ReactNode;
  /** `none` for tables that run edge to edge. */
  padding?: "md" | "none";
  children: ReactNode;
};

/** White panel on the canvas. Groups one table, one form or one topic. */
export function Card({ title, description, actions, padding = "md", children }: CardProps) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-surface shadow-card">
      {title ? (
        <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-0.5">
            <h2 className="font-heading text-heading font-semibold text-fg">{title}</h2>
            {description ? <p className="text-small text-fg-subtle">{description}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className={cx(padding === "md" && "p-5")}>{children}</div>
    </section>
  );
}

/** Responsive grid for cards: one column on mobile, `cols` from desktop. */
export function Grid({ cols = 2, children }: { cols?: 2 | 3; children: ReactNode }) {
  return <div className={cx("grid grid-cols-1 gap-6", cols === 2 ? "lg:grid-cols-2" : "lg:grid-cols-3")}>{children}</div>;
}

/** Label / value list for detail views. */
export function DetailList({ items }: { items: Array<{ label: string; value: ReactNode }> }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="flex flex-col gap-0.5">
          <dt className="text-small text-fg-subtle">{item.label}</dt>
          <dd className="text-body text-fg">{item.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Small muted text for secondary info inside tables and cards. */
export function Muted({ children }: { children: ReactNode }) {
  return <span className="text-small text-fg-subtle">{children}</span>;
}

/** Plain text link in body copy. */
export function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="font-medium text-primary underline-offset-2 hover:underline">
      {children}
    </Link>
  );
}
