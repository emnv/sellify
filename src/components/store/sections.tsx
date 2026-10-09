import Image from "next/image";
import Link from "next/link";
import type { PublicProduct } from "@/core/api";
import { formatMoney } from "@/lib/money";
import { HoursList, MapEmbed, storeTabs } from "./chrome";
import { storeHref, type StoreCtx } from "./context";
import { Section, StoreBadge, StoreCard, StoreLinkButton } from "./ui";

// Homepage building blocks. Templates differ in hero, section order, product
// card shape and heading style; all of them render the same content.

export function Hero({ ctx }: { ctx: StoreCtx }) {
  const { content, theme } = ctx.config;
  const tabs = storeTabs(ctx);
  const ctas = (
    <div className="flex flex-wrap gap-3">
      {tabs.map((t, i) => (
        <StoreLinkButton key={t.key} href={t.href} variant={i === 0 ? "primary" : "outline"}>
          {t.key === "shop" ? "Shop now" : t.key === "repair" ? "Book a repair" : "Get a quote for your phone"}
        </StoreLinkButton>
      ))}
    </div>
  );
  const title = (
    <h1 className={`font-store-heading text-store-4xl font-bold tracking-tight sm:text-store-5xl ${theme.template === "bold" ? "uppercase" : ""}`}>
      {content.storeName}
    </h1>
  );

  if (theme.heroStyle === "banner") {
    return (
      <section className="relative isolate overflow-hidden bg-store-surface">
        {content.heroImageUrl ? <Image src={content.heroImageUrl} alt="" fill priority sizes="100vw" className="-z-10 object-cover opacity-40" /> : null}
        <div className="mx-auto flex min-h-96 w-full max-w-6xl flex-col justify-end gap-5 px-4 py-16 sm:px-6 sm:py-24">
          {title}
          {content.tagline ? <p className="max-w-2xl text-store-xl">{content.tagline}</p> : null}
          {ctas}
        </div>
      </section>
    );
  }

  if (theme.heroStyle === "split") {
    return (
      <section className="mx-auto grid w-full max-w-6xl items-center gap-8 px-4 py-12 sm:px-6 lg:grid-cols-2 lg:py-16">
        <div className="flex flex-col gap-5">
          {title}
          {content.tagline ? <p className="text-store-xl text-store-muted">{content.tagline}</p> : null}
          {ctas}
        </div>
        {content.heroImageUrl ? (
          <div className="relative aspect-[4/3] overflow-hidden rounded-store-card">
            <Image src={content.heroImageUrl} alt="" fill priority sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
          </div>
        ) : (
          <StoreCard className="flex flex-col gap-4 p-6">
            <p className="font-store-heading text-store-lg font-bold">Visit us</p>
            {content.contact.address ? <p className="text-store-muted">{content.contact.address}</p> : null}
            <HoursList ctx={ctx} />
          </StoreCard>
        )}
      </section>
    );
  }

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col items-start gap-5 px-4 py-16 sm:px-6 sm:py-20">
      {title}
      {content.tagline ? <p className="max-w-2xl text-store-xl text-store-muted">{content.tagline}</p> : null}
      {ctas}
    </section>
  );
}

export function stockLabel(stock: number) {
  if (stock <= 0) return { text: "Sold out", tone: "muted" as const };
  if (stock <= 2) return { text: `Only ${stock} left`, tone: "accent" as const };
  return null;
}

export function ProductCard({ ctx, product }: { ctx: StoreCtx; product: PublicProduct }) {
  const tall = ctx.config.theme.template === "bold";
  const label = stockLabel(product.stock_qty);
  return (
    <Link href={storeHref(ctx, `/shop/${product.id}`)} className="group flex flex-col gap-3">
      <div className={`relative overflow-hidden rounded-store-card border border-store-border bg-store-surface ${tall ? "aspect-[4/5]" : "aspect-square"}`}>
        {product.images[0] ? (
          <Image
            src={product.images[0]}
            alt={product.name}
            fill
            sizes="(min-width: 1024px) 25vw, 50vw"
            className={`object-cover transition-transform duration-300 group-hover:scale-105 ${product.stock_qty <= 0 ? "opacity-50" : ""}`}
          />
        ) : (
          <div className="flex size-full items-center justify-center text-store-sm text-store-muted">No photo</div>
        )}
        {label ? (
          <span className="absolute top-2 left-2">
            <StoreBadge tone={label.tone}>{label.text}</StoreBadge>
          </span>
        ) : null}
      </div>
      <div className="flex flex-col gap-0.5">
        <p className="font-semibold group-hover:text-store-primary">{product.name}</p>
        <p className="text-store-sm text-store-muted">{formatMoney(product.price_cents, ctx.currency)}</p>
      </div>
    </Link>
  );
}

const COLS = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-2 lg:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" } as const;

export function ProductGrid({ ctx, products }: { ctx: StoreCtx; products: PublicProduct[] }) {
  return (
    <div className={`grid grid-cols-2 gap-x-4 gap-y-8 ${COLS[ctx.config.theme.productColumns]}`}>
      {products.map((p) => (
        <ProductCard key={p.id} ctx={ctx} product={p} />
      ))}
    </div>
  );
}

export function FeaturedProducts({ ctx, products }: { ctx: StoreCtx; products: PublicProduct[] }) {
  if (!ctx.config.content.tabs.shop || products.length === 0) return null;
  return (
    <Section title="In the shop" subtitle="Refurbished phones and accessories, ready to go.">
      <ProductGrid ctx={ctx} products={products.slice(0, ctx.config.theme.productColumns * 2)} />
      <div className="mt-8">
        <StoreLinkButton href={storeHref(ctx, "/shop")} variant="outline">
          See all products
        </StoreLinkButton>
      </div>
    </Section>
  );
}

export function Services({ ctx }: { ctx: StoreCtx }) {
  const { tabs } = ctx.config.content;
  if (!tabs.repair && !tabs.sell) return null;
  return (
    <Section title="How we can help">
      <div className="grid gap-4 sm:grid-cols-2">
        {tabs.repair ? (
          <StoreCard className="flex flex-col gap-3 p-6">
            <p className="font-store-heading text-store-xl font-bold">Repairs</p>
            <p className="text-store-muted">Cracked screen or tired battery? See the price for your phone and book a time that suits you.</p>
            <div>
              <StoreLinkButton href={storeHref(ctx, "/repair")}>Book a repair</StoreLinkButton>
            </div>
          </StoreCard>
        ) : null}
        {tabs.sell ? (
          <StoreCard className="flex flex-col gap-3 p-6">
            <p className="font-store-heading text-store-xl font-bold">Sell your phone</p>
            <p className="text-store-muted">Answer three questions and get an instant offer for your old phone. Drop it in and get paid.</p>
            <div>
              <StoreLinkButton href={storeHref(ctx, "/sell")}>Get an offer</StoreLinkButton>
            </div>
          </StoreCard>
        ) : null}
      </div>
    </Section>
  );
}

export function About({ ctx }: { ctx: StoreCtx }) {
  const { about } = ctx.config.content;
  if (!about) return null;
  return (
    <Section title="About us">
      <p className="max-w-3xl text-store-lg whitespace-pre-line text-store-muted">{about}</p>
    </Section>
  );
}

export function Reviews({ ctx }: { ctx: StoreCtx }) {
  const { reviews } = ctx.config.content;
  if (reviews.length === 0) return null;
  return (
    <Section title="What customers say">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reviews.map((r, i) => (
          <StoreCard key={i} className="flex flex-col gap-3 p-5">
            <p aria-label={`${r.rating} out of 5 stars`} className="text-store-accent">
              {"★".repeat(r.rating)}
              <span className="text-store-border">{"★".repeat(5 - r.rating)}</span>
            </p>
            <p>“{r.text}”</p>
            <p className="text-store-sm font-semibold text-store-muted">{r.author}</p>
          </StoreCard>
        ))}
      </div>
    </Section>
  );
}

export function VisitUs({ ctx }: { ctx: StoreCtx }) {
  const { contact, storeName } = ctx.config.content;
  const showMap = ctx.config.theme.template === "local" || Boolean(contact.address);
  return (
    <Section title="Visit us">
      <div className="grid gap-6 lg:grid-cols-2">
        <StoreCard className="flex flex-col gap-4 p-6">
          {contact.address ? <p className="text-store-lg whitespace-pre-line">{contact.address}</p> : null}
          <HoursList ctx={ctx} />
          <div className="flex flex-wrap gap-4 text-store-sm">
            {contact.phone ? (
              <a className="font-semibold text-store-primary" href={`tel:${contact.phone.replace(/\s/g, "")}`}>
                Call {contact.phone}
              </a>
            ) : null}
            {contact.email ? (
              <a className="font-semibold text-store-primary" href={`mailto:${contact.email}`}>
                {contact.email}
              </a>
            ) : null}
          </div>
        </StoreCard>
        {showMap ? <MapEmbed address={contact.address} title={storeName} /> : null}
      </div>
    </Section>
  );
}

/** The homepage, arranged by template. */
export function StoreHome({ ctx, products }: { ctx: StoreCtx; products: PublicProduct[] }) {
  const t = ctx.config.theme.template;
  if (t === "local") {
    return (
      <>
        <Hero ctx={ctx} />
        <Reviews ctx={ctx} />
        <VisitUs ctx={ctx} />
        <Services ctx={ctx} />
        <FeaturedProducts ctx={ctx} products={products} />
        <About ctx={ctx} />
      </>
    );
  }
  return (
    <>
      <Hero ctx={ctx} />
      <FeaturedProducts ctx={ctx} products={products} />
      <Services ctx={ctx} />
      <About ctx={ctx} />
      <Reviews ctx={ctx} />
      <VisitUs ctx={ctx} />
    </>
  );
}
