"use client";

import { useActionState } from "react";
import { createShop } from "./actions";

// Phase 1 form. Restyled with the shared UI components in Phase 2.
export function OnboardingForm({ defaultEmail }: { defaultEmail: string }) {
  const [state, formAction, pending] = useActionState(createShop, {});

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-4">
      <h1 className="text-2xl font-semibold">Set up your shop</h1>
      <label className="flex flex-col gap-1 text-sm">
        Shop name
        <input name="name" required maxLength={80} defaultValue={state.name} className="rounded-md border px-3 py-2" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Shop email (for booking and order emails)
        <input
          name="email"
          type="email"
          defaultValue={state.email ?? defaultEmail}
          className="rounded-md border px-3 py-2"
        />
      </label>
      {state.error ? <p role="alert" className="text-sm text-red-600">{state.error}</p> : null}
      <button type="submit" disabled={pending} className="rounded-md bg-black px-4 py-2 text-white disabled:opacity-50">
        {pending ? "Creating…" : "Create shop"}
      </button>
    </form>
  );
}
