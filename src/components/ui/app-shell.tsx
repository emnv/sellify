import { Suspense, type ReactNode } from "react";
import { ActiveNavList, MobileMenu, MobileMenuFallback, NavList, SidebarContent, type NavGroup } from "./app-shell-nav";
import { Logo } from "./logo";

export type { NavGroup, NavItem } from "./app-shell-nav";

type AppShellProps = {
  nav: NavGroup[];
  /** Shop name, user and log out, at the bottom of the sidebar. */
  account: ReactNode;
  children: ReactNode;
};

/**
 * Backend frame: 240px sidebar on desktop, top bar + slide-in drawer on
 * mobile. Every signed-in page renders inside it. The frame is static; the
 * parts that read the URL (active item, drawer) stream in behind Suspense.
 */
export function AppShell({ nav, account, children }: AppShellProps) {
  return (
    <div className="min-h-screen lg:flex">
      <aside className="hidden w-60 shrink-0 border-r border-border bg-surface lg:fixed lg:inset-y-0 lg:block">
        <SidebarContent account={account}>
          <Suspense fallback={<NavList nav={nav} active={null} />}>
            <ActiveNavList nav={nav} />
          </Suspense>
        </SidebarContent>
      </aside>

      <div className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-surface px-4 lg:hidden">
        <Logo />
        <Suspense fallback={<MobileMenuFallback />}>
          <MobileMenu nav={nav} account={account} />
        </Suspense>
      </div>

      <main className="min-w-0 flex-1 lg:pl-60">{children}</main>
    </div>
  );
}
