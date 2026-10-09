"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { cx } from "./cx";
import { Logo } from "./logo";

export type NavItem = { href: string; label: string };
export type NavGroup = { label: string; note?: string; items: NavItem[] };

type AppShellProps = {
  nav: NavGroup[];
  /** Shop name, user and log out, at the bottom of the sidebar. */
  account: ReactNode;
  children: ReactNode;
};

/**
 * Backend frame: 240px sidebar on desktop, top bar + slide-in drawer on
 * mobile. Every signed-in page renders inside it.
 */
export function AppShell({ nav, account, children }: AppShellProps) {
  const pathname = usePathname();
  // The drawer remembers the page it was opened on, so navigating closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (value: boolean) => setOpenOn(value ? pathname : null);

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center px-5">
        <Logo />
      </div>
      <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 pb-4">
        {nav.map((group) => (
          <div key={group.label} className="mt-4 first:mt-1">
            <p className="px-2 pb-1 text-small font-medium tracking-wide text-fg-subtle uppercase">{group.label}</p>
            {group.note ? <p className="px-2 pb-2 text-small text-fg-subtle">{group.note}</p> : null}
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cx(
                        "flex h-9 items-center rounded-md px-2 text-body font-medium transition-colors ease-standard",
                        active ? "bg-brand-soft text-brand-strong" : "text-fg-muted hover:bg-surface-muted hover:text-fg",
                      )}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-border p-4">{account}</div>
    </div>
  );

  return (
    <div className="min-h-screen lg:flex">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 border-r border-border bg-surface lg:fixed lg:inset-y-0 lg:block">{sidebar}</aside>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-surface px-4 lg:hidden">
        <Logo />
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          aria-controls="mobile-nav"
          className="inline-flex size-10 items-center justify-center rounded-md text-fg-muted hover:bg-surface-muted"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Mobile drawer */}
      {open ? (
        <div className="fixed inset-0 z-30 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div id="mobile-nav" className="absolute inset-y-0 left-0 w-60 bg-surface shadow-popover">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="absolute top-3 right-3 inline-flex size-10 items-center justify-center rounded-md text-fg-muted hover:bg-surface-muted"
            >
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              </svg>
            </button>
            {sidebar}
          </div>
        </div>
      ) : null}

      <main className="min-w-0 flex-1 lg:pl-60">{children}</main>
    </div>
  );
}
