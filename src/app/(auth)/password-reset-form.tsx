"use client";

import { useActionState } from "react";
import { Button, Field, FormStack, Input, Notice, TextLink } from "@/components/ui";
import type { AuthFormState } from "./actions";

type Props = {
  /** request: ask for a reset link by email. update: set the new password after following the link. */
  mode: "request" | "update";
  action: (prev: AuthFormState, formData: FormData) => Promise<AuthFormState>;
};

export function PasswordResetForm({ mode, action }: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  const isRequest = mode === "request";

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-title font-bold">{isRequest ? "Reset your password" : "Choose a new password"}</h1>
        <p className="text-body text-fg-muted">
          {isRequest ? "Enter your email and we'll send you a link to choose a new password." : "You'll use it the next time you log in."}
        </p>
      </div>

      {state.error ? <Notice tone="danger">{state.error}</Notice> : null}
      {state.message ? <Notice tone="success">{state.message}</Notice> : null}

      <FormStack>
        {isRequest ? (
          <Field id="reset-email" label="Email">
            <Input id="reset-email" name="email" type="email" autoComplete="email" required defaultValue={state.email} />
          </Field>
        ) : (
          <>
            <Field id="reset-password" label="New password" hint="At least 8 characters.">
              <Input id="reset-password" name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={72} hasHint />
            </Field>
            <Field id="reset-confirm" label="Confirm new password">
              <Input id="reset-confirm" name="confirm_password" type="password" autoComplete="new-password" required minLength={8} maxLength={72} />
            </Field>
          </>
        )}
      </FormStack>

      <Button type="submit" fullWidth loading={pending}>
        {isRequest ? "Send reset link" : "Save new password"}
      </Button>

      {isRequest ? (
        <p className="text-center text-body text-fg-muted">
          Remembered it? <TextLink href="/login">Log in</TextLink>
        </p>
      ) : null}
    </form>
  );
}
