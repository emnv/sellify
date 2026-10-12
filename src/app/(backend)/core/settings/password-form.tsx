"use client";

import { useActionState } from "react";
import { Card, Field, FormActions, FormStack, Input, Notice, SubmitButton } from "@/components/ui";
import { changePassword, type ChangePasswordState } from "./actions";

export function PasswordForm({ email }: { email: string }) {
  const [state, formAction] = useActionState<ChangePasswordState, FormData>(changePassword, {});
  const err = state.fieldErrors ?? {};

  return (
    <Card title="Password" description={`The password you log in with as ${email}.`}>
      <form action={formAction}>
        <FormStack>
          {state.saved ? <Notice tone="success">Password changed. Use the new one next time you log in.</Notice> : null}
          {state.error ? <Notice tone="danger">{state.error}</Notice> : null}
          <Field id="password-current" label="Current password" required error={err.current_password}>
            <Input
              id="password-current"
              name="current_password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={72}
              invalid={!!err.current_password}
            />
          </Field>
          <Field id="password-new" label="New password" hint="At least 8 characters." required error={err.new_password}>
            <Input
              id="password-new"
              name="new_password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={72}
              invalid={!!err.new_password}
              hasHint
            />
          </Field>
          <Field id="password-confirm" label="Confirm new password" required error={err.confirm_password}>
            <Input
              id="password-confirm"
              name="confirm_password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={72}
              invalid={!!err.confirm_password}
            />
          </Field>
          <FormActions>
            <SubmitButton pendingText="Changing…">Change password</SubmitButton>
          </FormActions>
        </FormStack>
      </form>
    </Card>
  );
}
