"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { acceptOffer, getQuote, type QuoteResult, type SellSelection, type SellState } from "@/app/(store)/s/[key]/sell/actions";
import { OptionGrid, Step, SummaryRow, useFocusOnChange } from "./repair-flow";
import { OptionButton, StoreButton, StoreCard, StoreField, StoreInput, StoreNotice } from "./ui";

/** A model and storage the shop buys. No prices: the offer always comes from the server. */
export type SellChoice = { brand_id: number; brand: string; model_id: number; model: string; storage_gb: number };

type YesNo = "yes" | "no" | null;

const QUESTIONS = [
  { key: "screenCracked", label: "Is the screen cracked?" },
  { key: "batteryOk", label: "Is the battery OK?", hint: "It holds a charge for a normal day." },
  { key: "turnsOn", label: "Does it turn on?" },
] as const;
type QuestionKey = (typeof QUESTIONS)[number]["key"];

const storageText = (gb: number) => (gb >= 1024 ? `${gb / 1024} TB` : `${gb} GB`);

export function SellFlow({ storeKey, options, preview }: { storeKey: string; options: SellChoice[]; preview: boolean }) {
  const [brandId, setBrandId] = useState<number | null>(null);
  const [modelId, setModelId] = useState<number | null>(null);
  const [storage, setStorage] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<QuestionKey, YesNo>>({ screenCracked: null, batteryOk: null, turnsOn: null });
  const [quote, setQuote] = useState<{ key: string; result: QuoteResult } | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [loading, startQuote] = useTransition();
  const [state, formAction, pending] = useActionState<SellState, FormData>(acceptOffer, { status: "idle" });

  const brands = useMemo(() => options.filter((o, i) => options.findIndex((x) => x.brand_id === o.brand_id) === i), [options]);
  const models = useMemo(
    () => options.filter((o) => o.brand_id === brandId).filter((o, i, arr) => arr.findIndex((x) => x.model_id === o.model_id) === i),
    [options, brandId],
  );
  const storages = useMemo(() => options.filter((o) => o.model_id === modelId), [options, modelId]);
  const choice = storages.find((o) => o.storage_gb === storage) ?? null;
  const answered = QUESTIONS.every((q) => answers[q.key] !== null);

  const selection: SellSelection | null =
    choice && answered
      ? {
          storeKey,
          modelId: String(choice.model_id),
          storageGb: String(choice.storage_gb),
          screenCracked: answers.screenCracked!,
          batteryOk: answers.batteryOk!,
          turnsOn: answers.turnsOn!,
        }
      : null;
  const selectionKey = selection ? JSON.stringify(selection) : null;
  const current = quote && quote.key === selectionKey ? quote.result : null;

  // Ask the server for the offer whenever the selection is complete or changes.
  useEffect(() => {
    if (!selection || !selectionKey) return;
    let stale = false;
    startQuote(async () => {
      const result = await getQuote(selection, preview);
      if (!stale) setQuote({ key: selectionKey, result });
    });
    return () => {
      stale = true;
    };
    // `selection` is derived from selectionKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionKey, preview]);

  const modelRef = useRef<HTMLHeadingElement>(null);
  const storageRef = useRef<HTMLHeadingElement>(null);
  const conditionRef = useRef<HTMLHeadingElement>(null);
  const offerRef = useRef<HTMLHeadingElement>(null);
  const detailsRef = useRef<HTMLHeadingElement>(null);
  const doneRef = useRef<HTMLHeadingElement>(null);
  useFocusOnChange(modelRef, brandId);
  useFocusOnChange(storageRef, modelId);
  useFocusOnChange(conditionRef, storage);
  useFocusOnChange(offerRef, current?.ok ? selectionKey : null);
  useFocusOnChange(detailsRef, accepted ? "accepted" : null);
  useFocusOnChange(doneRef, state.status === "accepted" ? "done" : null);

  const resetFrom = (level: "brand" | "model" | "storage") => {
    if (level === "brand") setModelId(null);
    if (level !== "storage") setStorage(null);
    setAccepted(false);
  };

  if (state.status === "accepted") {
    const c = state.confirmation;
    return (
      <StoreCard className="flex flex-col gap-5 p-6 sm:p-8">
        <h2 ref={doneRef} tabIndex={-1} className="font-store-heading text-store-2xl font-bold focus:outline-none">
          Offer accepted
        </h2>
        <dl className="flex flex-col divide-y divide-store-border">
          <SummaryRow label="Phone">{c.device}</SummaryRow>
          <SummaryRow label="Our offer">{c.offer}</SummaryRow>
          <SummaryRow label="Handover">Drop in to the shop</SummaryRow>
          <SummaryRow label="Reference">{c.reference}</SummaryRow>
        </dl>
        <p className="text-store-muted">
          {c.emailSent ? `We've emailed the details to ${c.email}.` : "We couldn't send a confirmation email, so note your reference."} Bring the phone in to{" "}
          {c.shopName}
          {c.shopAddress ? `, ${c.shopAddress}` : ""} during opening hours, with photo ID. Sign out of iCloud or Google first. We check the phone when you arrive.
          {c.shopPhone ? ` Questions? Call ${c.shopPhone}.` : ""}
        </p>
      </StoreCard>
    );
  }

  if (!options.length) {
    return <p className="text-store-muted">Online quotes aren&rsquo;t set up yet. Bring your phone in to the shop for an offer.</p>;
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
                resetFrom("brand");
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
                  resetFrom("model");
                }}
              >
                {m.model}
              </OptionButton>
            ))}
          </OptionGrid>
        </Step>
      ) : null}

      {modelId !== null ? (
        <Step n={3} title="How much storage?" headingRef={storageRef}>
          <OptionGrid label="Storage" cols="grid-cols-2 sm:grid-cols-4">
            {storages.map((s) => (
              <OptionButton
                key={s.storage_gb}
                selected={storage === s.storage_gb}
                onClick={() => {
                  setStorage(s.storage_gb);
                  resetFrom("storage");
                }}
              >
                {storageText(s.storage_gb)}
              </OptionButton>
            ))}
          </OptionGrid>
        </Step>
      ) : null}

      {choice ? (
        <Step n={4} title="Tell us about its condition" headingRef={conditionRef} hint="Be honest: we check the phone when you bring it in.">
          <div className="flex flex-col gap-6">
            {QUESTIONS.map((q) => (
              <div key={q.key} className="flex flex-col gap-2">
                <p id={`sell-q-${q.key}`} className="font-semibold">
                  {q.label}
                  {"hint" in q ? <span className="block text-store-sm font-normal text-store-muted">{q.hint}</span> : null}
                </p>
                <div role="group" aria-labelledby={`sell-q-${q.key}`} className="grid grid-cols-2 gap-3 sm:max-w-sm">
                  {(["yes", "no"] as const).map((v) => (
                    <OptionButton
                      key={v}
                      selected={answers[q.key] === v}
                      onClick={() => {
                        setAnswers((a) => ({ ...a, [q.key]: v }));
                        setAccepted(false);
                      }}
                    >
                      {v === "yes" ? "Yes" : "No"}
                    </OptionButton>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Step>
      ) : null}

      {selection ? (
        <section aria-live="polite" className="flex flex-col gap-4">
          {loading && !current ? <p className="text-store-muted">Working out your offer…</p> : null}
          {current && !current.ok ? <StoreNotice tone="error">{current.error}</StoreNotice> : null}
          {current?.ok ? (
            <StoreCard className="flex flex-col gap-3 p-5">
              <h2 ref={offerRef} tabIndex={-1} className="font-store-heading text-store-xl font-bold focus:outline-none">
                Our offer
              </h2>
              <p className="text-store-sm text-store-muted">{current.device}</p>
              <p className="font-store-heading text-store-4xl font-bold">{current.offer}</p>
              <p className="text-store-sm text-store-muted">Based on what you told us. Final once we&rsquo;ve checked the phone in the shop.</p>
              {!accepted ? (
                <div>
                  <StoreButton onClick={() => setAccepted(true)}>Accept offer</StoreButton>
                </div>
              ) : null}
            </StoreCard>
          ) : null}
        </section>
      ) : null}

      {selection && current?.ok && accepted ? (
        <Step n={5} title="How you'll hand it over" headingRef={detailsRef}>
          <OptionGrid label="Handover" cols="sm:grid-cols-2">
            <OptionButton selected>Drop in to the shop</OptionButton>
          </OptionGrid>
          <p className="text-store-sm text-store-muted">No appointment needed: bring it in during opening hours.</p>

          <form action={preview ? undefined : formAction} onSubmit={preview ? (e) => e.preventDefault() : undefined} className="flex flex-col gap-4" noValidate>
            {/* Selections only. There is deliberately no price field: the server recomputes the offer. */}
            <input type="hidden" name="storeKey" value={selection.storeKey} />
            <input type="hidden" name="modelId" value={selection.modelId} />
            <input type="hidden" name="storageGb" value={selection.storageGb} />
            <input type="hidden" name="screenCracked" value={selection.screenCracked} />
            <input type="hidden" name="batteryOk" value={selection.batteryOk} />
            <input type="hidden" name="turnsOn" value={selection.turnsOn} />
            <StoreField id="sell-name" label="Name" error={fe.name}>
              <StoreInput id="sell-name" name="name" autoComplete="name" required maxLength={120} defaultValue={values?.name ?? ""} invalid={Boolean(fe.name)} />
            </StoreField>
            <StoreField id="sell-phone" label="Phone" error={fe.phone}>
              <StoreInput id="sell-phone" name="phone" type="tel" autoComplete="tel" required maxLength={40} defaultValue={values?.phone ?? ""} invalid={Boolean(fe.phone)} />
            </StoreField>
            <StoreField id="sell-email" label="Email" error={fe.email} hint="We'll email you the offer and what to bring.">
              <StoreInput id="sell-email" name="email" type="email" autoComplete="email" required maxLength={254} defaultValue={values?.email ?? ""} invalid={Boolean(fe.email)} />
            </StoreField>
            {state.status === "error" ? <StoreNotice tone="error">{state.error}</StoreNotice> : null}
            {preview ? <StoreNotice>Booking is turned off in the preview.</StoreNotice> : null}
            <StoreButton type="submit" full disabled={preview || pending}>
              {pending ? "Sending…" : `Accept ${current.offer} and drop it in`}
            </StoreButton>
          </form>
        </Step>
      ) : null}
    </div>
  );
}
