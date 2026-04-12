import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = async (req: NextRequest) => {
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !signature || !webhookSecret) {
    return NextResponse.json({ message: "Webhook misconfigured" }, { status: 400 });
  }

  const body = await req.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error("Webhook signature error", err.message);
    return NextResponse.json({ message: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.orderId;
    const paid = session.payment_status === "paid";

    if (orderId && paid) {
      const supabase = createSupabaseAdmin();
      const { error } = await supabase
        .from("orders")
        .update({ status: "paid", stripe_session_id: session.id })
        .eq("id", orderId);

      if (error) {
        console.error("orders update after checkout.session.completed", error);
        return NextResponse.json({ message: "Database update failed" }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ received: true });
};

