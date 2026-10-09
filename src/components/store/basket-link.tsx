"use client";

import Link from "next/link";
import { useBasket } from "@/stores/basket";

export function BasketLink({ storeKey, href }: { storeKey: string; href: string }) {
  const { count } = useBasket(storeKey);
  return (
    <Link href={href} className="relative inline-flex items-center gap-2 rounded-store px-3 py-2 text-store-sm font-semibold hover:bg-store-surface">
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M6 7h12l-1 13H7L6 7Z" strokeLinejoin="round" />
        <path d="M9 7a3 3 0 0 1 6 0" />
      </svg>
      <span>Basket</span>
      {count > 0 ? (
        <span className="rounded-full bg-store-primary px-2 text-store-xs text-store-on-primary" aria-label={`${count} items`}>
          {count}
        </span>
      ) : null}
    </Link>
  );
}
