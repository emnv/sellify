"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useActionState } from "react";
import { Button, Field, FormStack, HiddenField, Input, Notice, TextLink } from "@/components/ui";
import { safeNextPath } from "@/lib/safe-next";
import type { AuthFormState } from "./actions";

type Props = {
  mode: "login" | "signup";
  action: (prev: AuthFormState, formData: FormData) => Promise<AuthFormState>;
};

// The form itself is static; only the URL-driven bits sit behind Suspense,
// so nothing the user types is swapped out while the page streams.
export function AuthForm({ mode, action }: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  const isLogin = mode === "login";

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-title font-bold">{isLogin ? "Log in" : "Create your account"}</h1>
        <p className="text-body text-fg-muted">
          {isLogin ? "Welcome back to Sellify." : "Run your shop and your online store in one place."}
        </p>
      </div>

      {isLogin ? (
        <Suspense fallback={null}>
          <LoginParams hideNotice={Boolean(state.error || state.message)} />
        </Suspense>
      ) : null}
      {state.error ? <Notice tone="danger">{state.error}</Notice> : null}
      {state.message ? <Notice tone="success">{state.message}</Notice> : null}

      <FormStack>
        <Field id={`${mode}-email`} label="Email">
          <Input id={`${mode}-email`} name="email" type="email" autoComplete="email" required defaultValue={state.email} />
        </Field>
        <Field id={`${mode}-password`} label="Password" hint={isLogin ? undefined : "At least 8 characters."}>
          <Input
            id={`${mode}-password`}
            name="password"
            type="password"
            autoComplete={isLogin ? "current-password" : "new-password"}
            required
            minLength={8}
            hasHint={!isLogin}
          />
        </Field>
      </FormStack>

      <Button type="submit" fullWidth loading={pending}>
        {isLogin ? "Log in" : "Create account"}
      </Button>

      <p className="text-center text-body text-fg-muted">
        {isLogin ? (
          <>No account yet? <TextLink href="/signup">Sign up</TextLink></>
        ) : (
          <>Already have an account? <TextLink href="/login">Log in</TextLink></>
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
      {next ? <HiddenField name="next" value={next} /> : null}
      {badLink && !hideNotice ? (
        <Notice tone="danger">That link is invalid or has expired. Log in or sign up again.</Notice>
      ) : null}
    </>
  );
}
