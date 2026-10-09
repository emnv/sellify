import { completeOnlineSale, expireOnlineSale } from "@/core/api-orders";
import { syncConnectedAccount } from "@/core/payments";
import { constructWebhookEvent, type Stripe } from "@/lib/stripe";

// Stripe webhook, shared by two endpoints that both point here:
//  - the platform endpoint (secret STRIPE_WEBHOOK_SECRET)
//  - the Connect endpoint (secret STRIPE_CONNECT_WEBHOOK_SECRET), which
//    delivers events from shops' connected accounts with `event.account` set.
//    Orders are direct charges on those accounts, so their Checkout events
//    arrive here.
// Subscribe both to: checkout.session.completed,
// checkout.session.async_payment_succeeded, checkout.session.expired, and the
// Connect endpoint also to account.updated. Every event is verified against
// either secret; handling is idempotent, so retries are harmless.

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });

  let event: Stripe.Event;
  try {
    const body = await request.text(); // raw body, exactly as signed
    event = constructWebhookEvent(body, signature);
  } catch (e) {
    console.error("[stripe webhook] rejected", { error: (e as Error).message });
    return new Response("Invalid signature", { status: 400 });
  }

  const account = event.account ?? null; // connected account the event happened on
  try {
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      const session = event.data.object;
      const saleId = session.metadata?.sale_id;
      if (saleId && session.payment_status === "paid") {
        const result = await completeOnlineSale(saleId, session, {}, account);
        console.info("[stripe webhook] order", { saleId, result });
      }
    } else if (event.type === "checkout.session.expired") {
      const session = event.data.object;
      const saleId = session.metadata?.sale_id;
      if (saleId) await expireOnlineSale(saleId, session.id);
    } else if (event.type === "account.updated") {
      await syncConnectedAccount(event.data.object);
    }
  } catch (e) {
    // 500 makes Stripe retry later; completion is idempotent.
    console.error("[stripe webhook] handling failed", { type: event.type, id: event.id, error: (e as Error).message });
    return new Response("Handler error", { status: 500 });
  }

  return Response.json({ received: true });
}
