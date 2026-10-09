"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { cx } from "./cx";

type Tab = { href: string; label: string };

function Tabs({ tabs, active }: { tabs: Tab[]; active: string | null }) {
  return (
    <nav aria-label="Sections" className="-mb-px flex gap-1 overflow-x-auto border-b border-border">
      {tabs.map((t) => {
        const isActive = active === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={isActive ? "page" : undefined}
            className={cx(
              "border-b-2 px-3 py-2.5 text-body font-medium whitespace-nowrap transition-colors ease-standard",
              isActive ? "border-brand text-brand-strong" : "border-transparent text-fg-muted hover:border-border-strong hover:text-fg",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

function ActiveTabs({ tabs }: { tabs: Tab[] }) {
  return <Tabs tabs={tabs} active={usePathname()} />;
}

/** Section tabs under a page header (e.g. Online Store: General, Design, …). */
export function TabNav({ tabs }: { tabs: Tab[] }) {
  return (
    <Suspense fallback={<Tabs tabs={tabs} active={null} />}>
      <ActiveTabs tabs={tabs} />
    </Suspense>
  );
}
