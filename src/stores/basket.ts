"use client";

import { useSyncExternalStore } from "react";

// Basket in localStorage, per store. Holds ONLY product ids and quantities:
// names, prices and stock are always re-read from the database (product
// pages, basket page, checkout). Nothing here is trusted by the server.

export type BasketLine = { productId: string; qty: number };
const MAX_LINES = 50;
const MAX_QTY = 20;

const keyFor = (storeKey: string) => `sellify-basket:${storeKey}`;
const listeners = new Set<() => void>();
const EMPTY: BasketLine[] = [];
const cacheByKey = new Map<string, { raw: string | null; lines: BasketLine[] }>();

function read(storeKey: string): BasketLine[] {
  if (typeof window === "undefined") return EMPTY;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(keyFor(storeKey));
  } catch {
    return EMPTY;
  }
  const cached = cacheByKey.get(storeKey);
  if (cached && cached.raw === raw) return cached.lines;
  let lines: BasketLine[] = EMPTY;
  try {
    const parsed = JSON.parse(raw ?? "[]");
    if (Array.isArray(parsed)) {
      lines = parsed
        .filter((l) => l && typeof l.productId === "string" && /^[0-9a-f-]{36}$/i.test(l.productId) && Number.isInteger(l.qty) && l.qty > 0)
        .slice(0, MAX_LINES)
        .map((l) => ({ productId: l.productId, qty: Math.min(l.qty, MAX_QTY) }));
    }
  } catch {
    lines = EMPTY;
  }
  cacheByKey.set(storeKey, { raw, lines });
  return lines;
}

function write(storeKey: string, lines: BasketLine[]) {
  try {
    window.localStorage.setItem(keyFor(storeKey), JSON.stringify(lines));
  } catch {
    /* storage full or blocked: basket stays in memory for this page */
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = () => cb();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function useBasket(storeKey: string) {
  const lines = useSyncExternalStore(subscribe, () => read(storeKey), () => EMPTY);
  return {
    lines,
    count: lines.reduce((n, l) => n + l.qty, 0),
    add(productId: string, qty = 1, max = MAX_QTY) {
      const current = read(storeKey);
      const existing = current.find((l) => l.productId === productId);
      const next = existing
        ? current.map((l) => (l.productId === productId ? { ...l, qty: Math.min(l.qty + qty, max, MAX_QTY) } : l))
        : [...current, { productId, qty: Math.min(qty, max, MAX_QTY) }].slice(0, MAX_LINES);
      write(storeKey, next);
    },
    setQty(productId: string, qty: number) {
      const current = read(storeKey);
      write(
        storeKey,
        qty <= 0 ? current.filter((l) => l.productId !== productId) : current.map((l) => (l.productId === productId ? { ...l, qty: Math.min(qty, MAX_QTY) } : l)),
      );
    },
    clear() {
      write(storeKey, []);
    },
  };
}
