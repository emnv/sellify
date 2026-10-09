import { completeOnlineSale, expireOnlineSale } from "@/core/api-orders";
import { stripe, stripeWebhookSecret, type Stripe } from "@/lib/stripe";

// Stripe webhook. Subscribe to: checkout.session.completed,
// checkout.session.expired. Every event is verified against
// STRIPE_WEBHOOK_SECRET; handling is idempotent, so retries are harmless.

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });

  let event: Stripe.Event;
  try {
    const body = await request.text(); // raw body, exactly as signed
    event = stripe().webhooks.constructEvent(body, signature, stripeWebhookSecret());
  } catch (e) {
    console.error("[stripe webhook] rejected", { error: (e as Error).message });
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      const session = event.data.object;
      const saleId = session.metadata?.sale_id;
      if (saleId && session.payment_status === "paid") {
        const result = await completeOnlineSale(saleId, session);
        console.info("[stripe webhook] order", { saleId, result });
      }
    } else if (event.type === "checkout.session.expired") {
      const session = event.data.object;
      const saleId = session.metadata?.sale_id;
      if (saleId) await expireOnlineSale(saleId, session.id);
    }
  } catch (e) {
    // 500 makes Stripe retry later; completion is idempotent.
    console.error("[stripe webhook] handling failed", { type: event.type, id: event.id, error: (e as Error).message });
    return new Response("Handler error", { status: 500 });
  }

  return Response.json({ received: true });
}
