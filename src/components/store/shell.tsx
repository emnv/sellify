import type { ReactNode } from "react";
import { StoreBanner, StoreFooter, StoreHeader } from "./chrome";
import type { StoreCtx } from "./context";
import { StoreFrame } from "./frame";

export function StoreShell({ ctx, children }: { ctx: StoreCtx; children: ReactNode }) {
  return (
    <StoreFrame theme={ctx.config.theme}>
      <StoreBanner ctx={ctx} />
      <StoreHeader ctx={ctx} />
      <main className="flex flex-1 flex-col">{children}</main>
      <StoreFooter ctx={ctx} />
    </StoreFrame>
  );
}

/** Shown while a store page streams in. Neutral, no theme yet. */
export function StoreLoading() {
  return <div className="min-h-screen" aria-busy="true" />;
}
