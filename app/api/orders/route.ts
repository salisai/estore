import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireUser, isAdminUser } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const mapOrder = (order: any) => ({
  id: order.id,
  userId: order.user_id,
  items: order.items,
  total: Number(order.total),
  date: order.created_at,
  status: order.status,
  stripeSessionId: order.stripe_session_id ?? undefined
});

export const GET = async (req: NextRequest) => {
  try {
    const user = await requireUser(req);
    const supabase = createSupabaseAdmin();
    const admin = await isAdminUser(user.id);

    let query = supabase.from("orders").select("*").order("created_at", { ascending: false });
    if (!admin) {
      query = query.eq("user_id", user.id);
    }

    const { data, error } = await query;
    if (error) {
      throw error;
    }

    return NextResponse.json({ orders: (data || []).map(mapOrder) });
  } catch (error: any) {
    const status = error?.status ?? 500;
    return NextResponse.json({ message: error?.message ?? "Unable to fetch orders" }, { status });
  }
};

export const POST = async (req: NextRequest) => {
  try {
    const user = await requireUser(req);
    const payload = await req.json();
    const supabase = createSupabaseAdmin();

    const { data, error } = await supabase
      .from("orders")
      .insert({
        user_id: user.id,
        total: payload.total,
        items: payload.items,
        status: payload.status ?? "pending",
        stripe_session_id: payload.stripeSessionId ?? null
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ order: mapOrder(data) }, { status: 201 });
  } catch (error: any) {
    const status = error?.status ?? 500;
    return NextResponse.json({ message: error?.message ?? "Unable to create order" }, { status });
  }
};

