"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { cx } from "./cx";
import { Logo } from "./logo";

export type NavItem = { href: string; label: string };
export type NavGroup = { label: string; note?: string; items: NavItem[] };

/** Navigation list. `active` is null in the static shell, before the URL is known. */
export function NavList({ nav, active }: { nav: NavGroup[]; active: string | null }) {
  return (
    <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 pb-4">
      {nav.map((group) => (
        <div key={group.label} className="mt-4 first:mt-1">
          <p className="px-2 pb-1 text-small font-medium tracking-wide text-fg-subtle uppercase">{group.label}</p>
          {group.note ? <p className="px-2 pb-2 text-small text-fg-subtle">{group.note}</p> : null}
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const isActive = active !== null && (active === item.href || active.startsWith(`${item.href}/`));
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={cx(
                      "flex h-9 items-center rounded-md px-2 text-body font-medium transition-colors ease-standard",
                      isActive ? "bg-brand-soft text-brand-strong" : "text-fg-muted hover:bg-surface-muted hover:text-fg",
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
  );
}

/** Nav with the current page highlighted. Reads the URL, so render it inside <Suspense>. */
export function ActiveNavList({ nav }: { nav: NavGroup[] }) {
  return <NavList nav={nav} active={usePathname()} />;
}

export function SidebarContent({ account, children }: { account: ReactNode; children: ReactNode }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center px-5">
        <Logo />
      </div>
      {children}
      <div className="border-t border-border p-4">{account}</div>
    </div>
  );
}

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      {open ? <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" /> : <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />}
    </svg>
  );
}

const iconButton = "inline-flex size-10 items-center justify-center rounded-md text-fg-muted hover:bg-surface-muted";

/**
 * Mobile menu button + slide-in drawer. The drawer remembers the page it was
 * opened on, so navigating closes it. Reads the URL: render inside <Suspense>.
 */
export function MobileMenu({ nav, account }: { nav: NavGroup[]; account: ReactNode }) {
  const pathname = usePathname();
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;

  return (
    <>
      <button type="button" onClick={() => setOpenOn(pathname)} aria-label="Open menu" aria-expanded={open} aria-controls="mobile-nav" className={iconButton}>
        <MenuIcon open={false} />
      </button>
      {open ? (
        <div className="fixed inset-0 z-30 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpenOn(null)} aria-hidden="true" />
          <div id="mobile-nav" className="absolute inset-y-0 left-0 w-60 bg-surface shadow-popover">
            <button type="button" onClick={() => setOpenOn(null)} aria-label="Close menu" className={cx(iconButton, "absolute top-3 right-3")}>
              <MenuIcon open />
            </button>
            <SidebarContent account={account}>
              <NavList nav={nav} active={pathname} />
            </SidebarContent>
          </div>
        </div>
      ) : null}
    </>
  );
}

/** Placeholder for the menu button in the static shell. */
export function MobileMenuFallback() {
  return (
    <span className={cx(iconButton, "opacity-50")} aria-hidden="true">
      <MenuIcon open={false} />
    </span>
  );
}
