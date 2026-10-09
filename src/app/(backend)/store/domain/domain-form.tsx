"use client";

import { useActionState, useState } from "react";
import { Button, Field, FormActions, FormStack, Input, Modal, Notice, SubmitButton } from "@/components/ui";
import { checkDomainAction, connectDomainAction, removeDomainAction, type DomainFormState } from "./actions";

export function ConnectDomainForm() {
  const [state, action, pending] = useActionState<DomainFormState, FormData>(connectDomainAction, {});
  return (
    <form action={action}>
      <FormStack>
        {state.error ? <Notice tone="danger">{state.error}</Notice> : null}
        <Field
          id="domain-input"
          label="Your domain"
          required
          hint="Type it without https://, like fixitgalway.ie or shop.fixitgalway.ie. If you connect fixitgalway.ie, we set up www.fixitgalway.ie to forward to it too."
          error={state.fieldError}
        >
          <Input
            id="domain-input"
            name="domain"
            required
            autoComplete="off"
            spellCheck={false}
            inputMode="url"
            placeholder="fixitgalway.ie"
            defaultValue={state.values?.domain ?? ""}
            invalid={!!state.fieldError}
            hasHint
          />
        </Field>
        <FormActions>
          <Button type="submit" loading={pending}>
            Connect domain
          </Button>
        </FormActions>
      </FormStack>
    </form>
  );
}

export function CheckStatusButton() {
  return (
    <form action={checkDomainAction}>
      <SubmitButton variant="secondary" pendingText="Checking…">
        Check status
      </SubmitButton>
    </form>
  );
}

export function RemoveDomain({ domain, www }: { domain: string; www: string | null }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="danger" onClick={() => setOpen(true)}>
        Remove domain
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Remove this domain?"
        description={`Your store stops loading at ${domain}${www ? ` and ${www}` : ""}. Your Sellify address keeps working.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Keep domain
            </Button>
            <form action={removeDomainAction}>
              <SubmitButton variant="danger" pendingText="Removing…">
                Remove domain
              </SubmitButton>
            </form>
          </>
        }
      >
        <p className="text-body text-fg-muted">You can connect it again later. You will need to check the DNS records again.</p>
      </Modal>
    </>
  );
}
