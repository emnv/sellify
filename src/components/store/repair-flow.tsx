"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { bookRepair, type RepairBookingState } from "@/app/(store)/s/[key]/repair/actions";
import type { SlotDay } from "@/lib/booking/slots";
import { formatMoney } from "@/lib/money";
import { OptionButton, StoreBadge, StoreButton, StoreCard, StoreField, StoreInput, StoreNotice } from "./ui";

/** What the flow needs per priced combination (display only; the server re-reads the price). */
export type RepairChoice = {
  brand_id: number;
  brand: string;
  model_id: number;
  model: string;
  repair_type_id: number;
  repair: string;
  price_cents: number;
  part_in_stock: boolean;
};

// ---------------------------------------------------------------------------
// Shared step helpers (also used by the Sell flow)
// ---------------------------------------------------------------------------

/** Focus `ref` whenever `key` changes to a non-empty value (not on first render). */
export function useFocusOnChange(ref: RefObject<HTMLElement | null>, key: unknown) {
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (key !== null && key !== undefined && key !== "") ref.current?.focus();
  }, [key, ref]);
}

export function Step({ n, title, headingRef, children, hint }: { n: number; title: string; headingRef?: RefObject<HTMLHeadingElement | null>; hint?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 ref={headingRef} tabIndex={-1} className="font-store-heading text-store-xl font-bold focus:outline-none">
          <span className="text-store-muted">{n}.</span> {title}
        </h2>
        {hint ? <p className="text-store-sm text-store-muted">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function OptionGrid({ label, children, cols = "sm:grid-cols-3" }: { label: string; children: ReactNode; cols?: string }) {
  return (
    <div role="group" aria-label={label} className={`grid grid-cols-1 gap-3 ${cols}`}>
      {children}
    </div>
  );
}

export function SummaryRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5">
      <dt className="text-store-muted">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}

const uniqueBy = <T, K>(items: T[], key: (t: T) => K) => {
  const seen = new Set<K>();
  return items.filter((t) => (seen.has(key(t)) ? false : (seen.add(key(t)), true)));
};

// ---------------------------------------------------------------------------
// Repair flow
// ---------------------------------------------------------------------------

export function RepairFlow({ storeKey, currency, options, days, preview }: { storeKey: string; currency: string; options: RepairChoice[]; days: SlotDay[]; preview: boolean }) {
  const router = useRouter();
  const [brandId, setBrandId] = useState<number | null>(null);
  const [modelId, setModelId] = useState<number | null>(null);
  const [repairId, setRepairId] = useState<number | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState<RepairBookingState, FormData>(bookRepair, { status: "idle" });

  const brands = useMemo(() => uniqueBy(options, (o) => o.brand_id), [options]);
  const models = useMemo(() => uniqueBy(options.filter((o) => o.brand_id === brandId), (o) => o.model_id), [options, brandId]);
  const repairs = useMemo(() => options.filter((o) => o.model_id === modelId), [options, modelId]);
  const choice = repairs.find((o) => o.repair_type_id === repairId) ?? null;
  const day = days.find((d) => d.date === date) ?? null;
  const slotLabel = day?.slots.find((s) => s.iso === slot)?.label ?? null;

  const modelRef = useRef<HTMLHeadingElement>(null);
  const repairRef = useRef<HTMLHeadingElement>(null);
  const timeRef = useRef<HTMLHeadingElement>(null);
  const slotRef = useRef<HTMLHeadingElement>(null);
  const detailsRef = useRef<HTMLHeadingElement>(null);
  const doneRef = useRef<HTMLHeadingElement>(null);
  useFocusOnChange(modelRef, brandId);
  useFocusOnChange(repairRef, modelId);
  useFocusOnChange(timeRef, repairId);
  useFocusOnChange(slotRef, date);
  useFocusOnChange(detailsRef, slot);
  useFocusOnChange(doneRef, state.status === "booked" ? "booked" : null);

  // A slot that was just taken: drop it and fetch fresh availability.
  const slotError = state.status === "error" && state.field === "slot";
  const [handled, setHandled] = useState<RepairBookingState | null>(null);
  if (slotError && handled !== state) {
    setHandled(state);
    setSlot(null);
  }
  useEffect(() => {
    if (slotError) router.refresh();
  }, [slotError, state, router]);

  if (state.status === "booked") {
    const c = state.confirmation;
    return (
      <StoreCard className="flex flex-col gap-5 p-6 sm:p-8">
        <h2 ref={doneRef} tabIndex={-1} className="font-store-heading text-store-2xl font-bold focus:outline-none">
          You&rsquo;re booked in
        </h2>
        <dl className="flex flex-col divide-y divide-store-border">
          <SummaryRow label="Device">{c.device}</SummaryRow>
          <SummaryRow label="Repair">{c.repair}</SummaryRow>
          <SummaryRow label="Price">{c.price}</SummaryRow>
          <SummaryRow label="When">{c.when}</SummaryRow>
          <SummaryRow label="Reference">{c.reference}</SummaryRow>
        </dl>
        {c.sameDay ? <p className="font-medium">Same-day repair available: we have the part in stock.</p> : null}
        <p className="text-store-muted">
          {c.emailSent ? `We've emailed a confirmation to ${c.email}.` : "We couldn't send a confirmation email, so note your reference."} Bring your phone to{" "}
          {c.shopName}
          {c.shopAddress ? `, ${c.shopAddress}` : ""} at your booked time.
          {c.shopPhone ? ` Need to change it? Call ${c.shopPhone}.` : ""}
        </p>
      </StoreCard>
    );
  }

  if (!options.length) {
    return <p className="text-store-muted">Online repair booking isn&rsquo;t set up yet. Call or visit the shop for a price.</p>;
  }

  const values = state.status === "error" ? state.values : state.status === "idle" ? state.values : undefined;
  const fe = state.status === "error" ? (state.fieldErrors ?? {}) : {};

  return (
    <div className="flex flex-col gap-10">
      <Step n={1} title="Choose your brand">
        <OptionGrid label="Brand">
          {brands.map((b) => (
            <OptionButton
              key={b.brand_id}
              selected={brandId === b.brand_id}
              onClick={() => {
                setBrandId(b.brand_id);
                setModelId(null);
                setRepairId(null);
              }}
            >
              {b.brand}
            </OptionButton>
          ))}
        </OptionGrid>
      </Step>

      {brandId !== null ? (
        <Step n={2} title="Choose your model" headingRef={modelRef}>
          <OptionGrid label="Model">
            {models.map((m) => (
              <OptionButton
                key={m.model_id}
                selected={modelId === m.model_id}
                onClick={() => {
                  setModelId(m.model_id);
                  setRepairId(null);
                }}
              >
                {m.model}
              </OptionButton>
            ))}
          </OptionGrid>
        </Step>
      ) : null}

      {modelId !== null ? (
        <Step n={3} title="What needs fixing?" headingRef={repairRef}>
          <OptionGrid label="Repair" cols="sm:grid-cols-2">
            {repairs.map((r) => (
              <OptionButton key={r.repair_type_id} selected={repairId === r.repair_type_id} onClick={() => setRepairId(r.repair_type_id)}>
                <span>{r.repair}</span>
                <span className="font-semibold">{formatMoney(r.price_cents, currency)}</span>
              </OptionButton>
            ))}
          </OptionGrid>
        </Step>
      ) : null}

      {choice ? (
        <>
          <StoreCard className="flex flex-col gap-2 p-5">
            <p className="text-store-sm text-store-muted">
              {choice.brand} {choice.model} · {choice.repair}
            </p>
            <p className="font-store-heading text-store-3xl font-bold">{formatMoney(choice.price_cents, currency)}</p>
            {choice.part_in_stock ? (
              <p>
                <StoreBadge tone="accent">Same-day repair available</StoreBadge>
              </p>
            ) : null}
          </StoreCard>

          <Step n={4} title="Pick a day" headingRef={timeRef} hint="Booking is for a one-hour slot during opening hours.">
            {days.length ? (
              <OptionGrid label="Day" cols="grid-cols-2 sm:grid-cols-4 lg:grid-cols-7">
                {days.map((d) => (
                  <OptionButton
                    key={d.date}
                    selected={date === d.date}
                    onClick={() => {
                      setDate(d.date);
                      setSlot(null);
                    }}
                  >
                    {d.label}
                  </OptionButton>
                ))}
              </OptionGrid>
            ) : (
              <p className="text-store-muted">No times are free in the next two weeks. Call the shop to book.</p>
            )}
          </Step>
        </>
      ) : null}

      {choice && day ? (
        <Step n={5} title={`Pick a time on ${day.label}`} headingRef={slotRef}>
          <OptionGrid label="Time" cols="grid-cols-3 sm:grid-cols-6">
            {day.slots.map((s) => (
              <OptionButton key={s.iso} selected={slot === s.iso} onClick={() => setSlot(s.iso)}>
                {s.label}
              </OptionButton>
            ))}
          </OptionGrid>
        </Step>
      ) : null}

      {state.status === "error" && (state.field === "slot" || state.field === "repair") ? <StoreNotice tone="error">{state.error}</StoreNotice> : null}

      {choice && day && slot ? (
        <Step n={6} title="Your details" headingRef={detailsRef}>
          <form action={preview ? undefined : formAction} onSubmit={preview ? (e) => e.preventDefault() : undefined} className="flex flex-col gap-4" noValidate>
            <input type="hidden" name="storeKey" value={storeKey} />
            <input type="hidden" name="modelId" value={choice.model_id} />
            <input type="hidden" name="repairTypeId" value={choice.repair_type_id} />
            <input type="hidden" name="slot" value={slot} />
            <StoreField id="repair-name" label="Name" error={fe.name}>
              <StoreInput id="repair-name" name="name" autoComplete="name" required maxLength={120} defaultValue={values?.name ?? ""} invalid={Boolean(fe.name)} />
            </StoreField>
            <StoreField id="repair-phone" label="Phone" error={fe.phone}>
              <StoreInput id="repair-phone" name="phone" type="tel" autoComplete="tel" required maxLength={40} defaultValue={values?.phone ?? ""} invalid={Boolean(fe.phone)} />
            </StoreField>
            <StoreField id="repair-email" label="Email" error={fe.email} hint="We'll send your booking confirmation here.">
              <StoreInput id="repair-email" name="email" type="email" autoComplete="email" required maxLength={254} defaultValue={values?.email ?? ""} invalid={Boolean(fe.email)} />
            </StoreField>

            <StoreCard className="p-4">
              <dl className="flex flex-col text-store-sm">
                <SummaryRow label="Repair">
                  {choice.brand} {choice.model} · {choice.repair}
                </SummaryRow>
                <SummaryRow label="Price">{formatMoney(choice.price_cents, currency)}</SummaryRow>
                <SummaryRow label="When">
                  {day.label}, {slotLabel}
                </SummaryRow>
              </dl>
            </StoreCard>

            {state.status === "error" && !state.field ? <StoreNotice tone="error">{state.error}</StoreNotice> : null}
            {preview ? <StoreNotice>Booking is turned off in the preview.</StoreNotice> : null}
            <StoreButton type="submit" full disabled={preview || pending}>
              {pending ? "Booking…" : "Book repair"}
            </StoreButton>
          </form>
        </Step>
      ) : null}
    </div>
  );
}
