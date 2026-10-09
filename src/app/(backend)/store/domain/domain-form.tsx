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
          hint="Type it without https://, like fixitgalway.ie or shop.fixitgalway.ie. To use www too, connect www.fixitgalway.ie as its own domain or forward it at your domain provider."
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

export function RemoveDomain({ domain }: { domain: string }) {
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
        description={`Your store stops loading at ${domain}. Your Sellify address keeps working.`}
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
