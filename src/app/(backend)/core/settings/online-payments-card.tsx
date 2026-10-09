"use client";

import { useActionState } from "react";
import { Card, DetailList, FormActions, FormStack, Muted, Notice, StatusBadge, SubmitButton, type Tone } from "@/components/ui";
import type { PaymentsStatus } from "@/core/payments";
import { connectStripe, type ConnectStripeState } from "./actions";

const STATUS: Record<PaymentsStatus, { label: string; tone: Tone; help: string }> = {
  not_connected: {
    label: "Not connected",
    tone: "neutral",
    help: "Connect a Stripe account so customers can pay online. Payments go straight to your account.",
  },
  incomplete: {
    label: "Setup incomplete",
    tone: "warning",
    help: "Stripe needs a few more details before you can take payments. Finish the setup to turn on checkout.",
  },
  ready: { label: "Ready to take payments", tone: "success", help: "Customers can pay online. Payouts go to the bank account you gave Stripe." },
};

type Props = {
  status: PaymentsStatus;
  /** Shown after Stripe sends the owner back (?stripe=return|refresh). */
  returned?: "return" | "refresh" | null;
  /** Only owners can connect. */
  canConnect: boolean;
};

export function OnlinePaymentsCard({ status, returned, canConnect }: Props) {
  const [state, formAction] = useActionState<ConnectStripeState, FormData>(connectStripe, {});
  const s = STATUS[status];

  return (
    <Card title="Online payments" description="Customers pay by card on your online store through Stripe.">
      <form action={formAction}>
        <FormStack>
          {returned === "return" && status === "ready" ? <Notice tone="success">Stripe is connected. You can take payments online.</Notice> : null}
          {returned === "return" && status !== "ready" ? (
            <Notice tone="warning">Stripe still needs some details. Finish the setup, or check again in a few minutes.</Notice>
          ) : null}
          {returned === "refresh" ? <Notice tone="info">The setup link expired. Select Finish Stripe setup to continue.</Notice> : null}
          {state.error ? <Notice tone="danger">{state.error}</Notice> : null}
          <DetailList items={[{ label: "Status", value: <StatusBadge tone={s.tone}>{s.label}</StatusBadge> }]} />
          <Muted>{s.help}</Muted>
          {!canConnect && status !== "ready" ? <Notice tone="info">Ask the shop owner to set up online payments.</Notice> : null}
          {canConnect && status !== "ready" ? (
            <FormActions>
              <SubmitButton pendingText="Opening Stripe…">{status === "not_connected" ? "Connect Stripe" : "Finish Stripe setup"}</SubmitButton>
            </FormActions>
          ) : null}
        </FormStack>
      </form>
    </Card>
  );
}
