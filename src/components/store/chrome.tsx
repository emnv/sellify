import Image from "next/image";
import Link from "next/link";
import { DAY_LABELS, DAYS } from "@/lib/store/config";
import { BasketLink } from "./basket-link";
import { storeHref, type StoreCtx } from "./context";

// Header, banner and footer shared by every store page.

export function StoreBanner({ ctx }: { ctx: StoreCtx }) {
  const { banner } = ctx.config.content;
  if (!banner.enabled || !banner.text) return null;
  return <div className="bg-store-accent px-4 py-2 text-center text-store-sm font-semibold text-store-on-accent">{banner.text}</div>;
}

export function storeTabs(ctx: StoreCtx) {
  const { tabs } = ctx.config.content;
  return [
    tabs.shop ? { href: storeHref(ctx, "/shop"), label: "Shop", key: "shop" } : null,
    tabs.repair ? { href: storeHref(ctx, "/repair"), label: "Repair", key: "repair" } : null,
    tabs.sell ? { href: storeHref(ctx, "/sell"), label: "Sell your phone", key: "sell" } : null,
  ].filter(Boolean) as Array<{ href: string; label: string; key: string }>;
}

export function StoreHeader({ ctx }: { ctx: StoreCtx }) {
  const { content, theme } = ctx.config;
  const tabs = storeTabs(ctx);
  const bold = theme.template === "bold";
  return (
    <header className={`border-b border-store-border ${bold ? "bg-store-bg" : "bg-store-surface"}`}>
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href={storeHref(ctx)} className="flex items-center gap-3">
          {content.logoUrl ? (
            <span className="relative size-10 overflow-hidden rounded-store">
              <Image src={content.logoUrl} alt="" fill sizes="40px" className="object-contain" />
            </span>
          ) : null}
          <span className={`font-store-heading text-store-xl font-bold tracking-tight ${bold ? "uppercase" : ""}`}>{content.storeName}</span>
        </Link>
        <nav aria-label="Store" className="flex flex-wrap items-center gap-1">
          {tabs.map((t) => (
            <Link key={t.key} href={t.href} className="rounded-store px-3 py-2 text-store-sm font-semibold hover:bg-store-surface hover:text-store-primary">
              {t.label}
            </Link>
          ))}
          {content.tabs.shop ? <BasketLink storeKey={ctx.storeKey} href={storeHref(ctx, "/basket")} /> : null}
        </nav>
      </div>
    </header>
  );
}

export function HoursList({ ctx }: { ctx: StoreCtx }) {
  const { hours } = ctx.config.content;
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-store-sm">
      {DAYS.map((d) => (
        <div key={d} className="contents">
          <dt className="text-store-muted">{DAY_LABELS[d]}</dt>
          <dd>{hours[d].closed ? "Closed" : `${hours[d].open} – ${hours[d].close}`}</dd>
        </div>
      ))}
    </dl>
  );
}

export function MapEmbed({ address, title }: { address: string; title: string }) {
  if (!address) return null;
  return (
    <iframe
      title={`Map: ${title}`}
      src={`https://maps.google.com/maps?q=${encodeURIComponent(address)}&output=embed`}
      className="h-64 w-full rounded-store-card border border-store-border"
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
    />
  );
}

export function StoreFooter({ ctx }: { ctx: StoreCtx }) {
  const { content } = ctx.config;
  const { contact } = content;
  return (
    <footer className="mt-auto border-t border-store-border bg-store-surface">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3 sm:px-6">
        <div className="flex flex-col gap-2">
          <p className="font-store-heading text-store-lg font-bold">{content.storeName}</p>
          {content.tagline ? <p className="text-store-sm text-store-muted">{content.tagline}</p> : null}
        </div>
        <div className="flex flex-col gap-1 text-store-sm">
          <p className="mb-1 font-semibold">Contact</p>
          {contact.address ? <p className="whitespace-pre-line">{contact.address}</p> : null}
          {contact.phone ? (
            <a href={`tel:${contact.phone.replace(/\s/g, "")}`} className="hover:text-store-primary">
              {contact.phone}
            </a>
          ) : null}
          {contact.email ? (
            <a href={`mailto:${contact.email}`} className="hover:text-store-primary">
              {contact.email}
            </a>
          ) : null}
        </div>
        <div className="flex flex-col gap-1">
          <p className="mb-1 text-store-sm font-semibold">Opening hours</p>
          <HoursList ctx={ctx} />
        </div>
      </div>
      <p className="border-t border-store-border px-4 py-4 text-center text-store-xs text-store-muted">Powered by Sellify</p>
    </footer>
  );
}
