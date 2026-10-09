"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useActionState } from "react";
import { safeNextPath } from "@/lib/safe-next";
import type { AuthFormState } from "./actions";

type Props = {
  mode: "login" | "signup";
  action: (prev: AuthFormState, formData: FormData) => Promise<AuthFormState>;
};

// Phase 1 form. Restyled with the shared UI components in Phase 2.
// The form itself is static; only the URL-driven bits sit behind Suspense,
// so nothing the user types is swapped out while the page streams.
export function AuthForm({ mode, action }: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  const isLogin = mode === "login";

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-4">
      <h1 className="text-2xl font-semibold">{isLogin ? "Log in to Sellify" : "Create your Sellify account"}</h1>
      {isLogin ? (
        <Suspense fallback={null}>
          <LoginParams hideNotice={Boolean(state.error || state.message)} />
        </Suspense>
      ) : null}

      <label className="flex flex-col gap-1 text-sm">
        Email
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.email}
          className="rounded-md border px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Password
        <input
          name="password"
          type="password"
          autoComplete={isLogin ? "current-password" : "new-password"}
          required
          minLength={8}
          className="rounded-md border px-3 py-2"
        />
      </label>

      {state.error ? <p role="alert" className="text-sm text-red-600">{state.error}</p> : null}
      {state.message ? <p role="status" className="text-sm text-green-700">{state.message}</p> : null}

      <button type="submit" disabled={pending} className="rounded-md bg-black px-4 py-2 text-white disabled:opacity-50">
        {pending ? "Please wait…" : isLogin ? "Log in" : "Create account"}
      </button>

      <p className="text-sm">
        {isLogin ? (
          <>No account yet? <Link href="/signup" className="underline">Sign up</Link></>
        ) : (
          <>Already have an account? <Link href="/login" className="underline">Log in</Link></>
        )}
      </p>
    </form>
  );
}

// `?next=` (where to go after login) and `?error=link` (bad email link).
function LoginParams({ hideNotice }: { hideNotice: boolean }) {
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"), "");
  const badLink = params.get("error") === "link";
  return (
    <>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {badLink && !hideNotice ? (
        <p role="alert" className="text-sm text-red-600">
          That link is invalid or has expired. Log in or sign up again.
        </p>
      ) : null}
    </>
  );
}
