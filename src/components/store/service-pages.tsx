import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getBookedSlots } from "@/core/api";
import { availableSlots, bookingWindow } from "@/lib/booking/slots";
import { storeBuybackOptions, storeRepairOptions } from "@/stores/data";
import type { StoreCtx } from "./context";
import { RepairFlow, type RepairChoice } from "./repair-flow";
import { SellFlow, type SellChoice } from "./sell-flow";
import { Section } from "./ui";

// Repair and Sell tab bodies, shared by the public store and the editor preview.

async function bookedSlots(ctx: StoreCtx, from: Date, to: Date) {
  try {
    return await getBookedSlots(ctx.storeKey, from, to);
  } catch (e) {
    // The preview of a never-published store has no public bookings to read.
    if (ctx.preview) return [];
    throw e;
  }
}

export async function RepairPage({ ctx }: { ctx: StoreCtx }) {
  if (!ctx.config.content.tabs.repair) notFound();
  await connection();
  const now = new Date();
  const { from, to } = bookingWindow(now);
  const [options, taken] = await Promise.all([storeRepairOptions(ctx), bookedSlots(ctx, from, to)]);
  const days = availableSlots({ hours: ctx.config.content.hours, timeZone: ctx.timezone, now, taken });
  const choices: RepairChoice[] = options.map((o) => ({
    brand_id: o.brand_id,
    brand: o.brand,
    model_id: o.model_id,
    model: o.model,
    repair_type_id: o.repair_type_id,
    repair: o.repair,
    price_cents: o.price_cents,
    part_in_stock: o.part_in_stock,
  }));

  return (
    <Section title="Book a repair" subtitle="Pick your phone and the repair to see our price, then choose a time to drop it in.">
      <div className="max-w-3xl">
        <RepairFlow storeKey={ctx.storeKey} currency={ctx.currency} options={choices} days={days} preview={ctx.preview} />
      </div>
    </Section>
  );
}

export async function SellPage({ ctx }: { ctx: StoreCtx }) {
  if (!ctx.config.content.tabs.sell) notFound();
  const { prices } = await storeBuybackOptions(ctx);
  // Prices stay on the server: the offer is computed there from the selections.
  const choices: SellChoice[] = prices.map((p) => ({ brand_id: p.brand_id, brand: p.brand, model_id: p.model_id, model: p.model, storage_gb: p.storage_gb }));

  return (
    <Section title="Sell your phone" subtitle="Answer a few questions to get an instant offer, then drop the phone in to the shop.">
      <div className="max-w-3xl">
        <SellFlow storeKey={ctx.storeKey} options={choices} preview={ctx.preview} />
      </div>
    </Section>
  );
}
