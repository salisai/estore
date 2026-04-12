import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";

export const POST = async (req: NextRequest) => {
  if (!stripe) {
    return NextResponse.json({ message: "Stripe not configured" }, { status: 500 });
  }

  try {
    const user = await requireUser(req);
    const { items = [], successUrl, cancelUrl } = await req.json();
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ message: "Cart is empty" }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();
    const ids = items.map((item: any) => item.id);
    const { data: productRecords, error } = await supabase.from("products").select("*").in("id", ids);

    if (error) {
      throw error;
    }

    const normalizedItems = items.map((item: any) => {
      const quantity = Number(item.quantity) || 0;
      const product = productRecords?.find((record) => record.id === item.id);
      if (!product) {
        throw new Error("Product mismatch");
      }

      const unitPrice = Number(product.price);
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        throw new Error("Invalid product price");
      }

      return {
        id: product.id,
        quantity: Math.max(1, quantity),
        name: product.name,
        price: unitPrice,
        image: product.image,
        category: product.category
      };
    });

    const total = normalizedItems.reduce((acc, item) => acc + item.price * item.quantity, 0);

    const { data: orderRecord, error: orderError } = await supabase
      .from("orders")
      .insert({
        user_id: user.id,
        total,
        items: normalizedItems,
        status: "pending"
      })
      .select()
      .single();

    if (orderError) {
      throw orderError;
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: user.email,
      success_url: successUrl || `${req.nextUrl.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${req.nextUrl.origin}/checkout`,
      metadata: {
        orderId: orderRecord.id,
        userId: user.id
      },
      line_items: normalizedItems.map((item) => ({
        quantity: item.quantity,
        price_data: {
          currency: "usd",
          unit_amount: Math.round(item.price * 100),
          product_data: {
            name: item.name,
            images: item.image ? [item.image] : undefined
          }
        }
      }))
    });

    await supabase.from("orders").update({ stripe_session_id: session.id }).eq("id", orderRecord.id);
    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error("checkout error", error);
    const status = error?.status ?? 500;
    return NextResponse.json({ message: error?.message ?? "Unable to start checkout" }, { status });
  }
};

