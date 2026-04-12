'use client';

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { useStore } from "@/context/StoreContext";
import { supabaseBrowser } from "@/lib/supabase/client";

const CheckoutPage = () => {
  const { cart, user } = useStore();
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = supabaseBrowser;

  const total = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);

  if (cart.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <p className="text-lg text-neutral-500 mb-6 font-light">Your bag is empty.</p>
        <button
          onClick={() => router.push("/shop")}
          className="text-[13px] tracking-widest uppercase border-b border-neutral-950 pb-1 hover:text-neutral-600 hover:border-neutral-600 transition-colors"
        >
          Return to Shop
        </button>
      </div>
    );
  }

  const handlePayment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) {
      alert("Please login to checkout");
      router.push("/auth");
      return;
    }

    setLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        throw new Error("No active session");
      }

      const origin = window.location.origin;
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          items: cart.map((item) => ({ id: item.id, quantity: item.quantity })),
          successUrl: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${origin}/checkout`
        })
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.message || "Unable to create Stripe session");
      }

      if (payload.url) {
        window.location.href = payload.url;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "Checkout failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-20 md:py-32 animate-in fade-in duration-700">
      <h1 className="text-3xl md:text-4xl font-light tracking-tight text-neutral-950 mb-16 text-center">Secure Checkout</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24">
        {/* Left Column: Form */}
        <div>
          <form onSubmit={handlePayment} className="space-y-12">
            <section>
              <h2 className="text-[13px] font-medium uppercase tracking-widest text-neutral-500 mb-6">Shipping Details</h2>
              <div className="grid grid-cols-2 gap-5">
                <input type="text" placeholder="First Name" required className="border border-neutral-200 p-4 w-full text-sm text-neutral-950 placeholder:text-neutral-400 focus:border-neutral-950 focus:outline-none transition-colors rounded-none" />
                <input type="text" placeholder="Last Name" required className="border border-neutral-200 p-4 w-full text-sm text-neutral-950 placeholder:text-neutral-400 focus:border-neutral-950 focus:outline-none transition-colors rounded-none" />
                <input type="text" placeholder="Address" required className="col-span-2 border border-neutral-200 p-4 w-full text-sm text-neutral-950 placeholder:text-neutral-400 focus:border-neutral-950 focus:outline-none transition-colors rounded-none" />
                <input type="text" placeholder="City" required className="border border-neutral-200 p-4 w-full text-sm text-neutral-950 placeholder:text-neutral-400 focus:border-neutral-950 focus:outline-none transition-colors rounded-none" />
                <input type="text" placeholder="Zip Code" required className="border border-neutral-200 p-4 w-full text-sm text-neutral-950 placeholder:text-neutral-400 focus:border-neutral-950 focus:outline-none transition-colors rounded-none" />
              </div>
            </section>

            <section>
              <h2 className="text-[13px] font-medium uppercase tracking-widest text-neutral-500 mb-6 flex items-center gap-2">
                Payment <Lock size={12} className="text-neutral-400" />
              </h2>
              <div className="bg-neutral-50 p-8 border border-neutral-100">
                <p className="text-[13px] leading-relaxed text-neutral-600">
                  All transactions are secure and encrypted. You will be redirected to Stripe to complete your purchase safely.
                </p>
              </div>
            </section>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-neutral-950 text-white py-4 text-[13px] font-medium tracking-widest uppercase hover:bg-neutral-800 transition-colors disabled:opacity-50"
            >
              {loading ? "Processing..." : `Pay $${total.toFixed(2)}`}
            </button>
          </form>
        </div>

        {/* Right Column: Order Summary */}
        <div className="bg-neutral-50 p-10 h-fit border border-neutral-100">
          <h2 className="text-[13px] font-medium uppercase tracking-widest text-neutral-500 mb-8">Order Summary</h2>
          <div className="space-y-6 mb-8">
            {cart.map((item) => (
              <div key={item.id} className="flex gap-6">
                <div className="w-16 h-20 bg-white relative shrink-0">
                  <Image src={item.image as string} alt={item.name} width={64} height={80} className="object-cover" />
                </div>
                <div className="flex-1 py-1 flex flex-col justify-between">
                  <div className="flex justify-between items-start gap-4">
                    <p className="font-medium text-[13px] text-neutral-950">{item.name}</p>
                    <p className="text-[13px] font-medium text-neutral-950">${(item.price * item.quantity).toFixed(2)}</p>
                  </div>
                  <p className="text-[11px] text-neutral-500">Qty: {item.quantity}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-neutral-200 pt-6 space-y-3">
            <div className="flex justify-between text-[13px]">
              <span className="text-neutral-600">Subtotal</span>
              <span className="text-neutral-950">${total.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-[13px]">
              <span className="text-neutral-600">Shipping</span>
              <span className="text-neutral-950">Free</span>
            </div>
            <div className="flex justify-between text-[15px] font-medium pt-4 border-t border-neutral-200 mt-4">
              <span className="text-neutral-950">Total</span>
              <span className="text-neutral-950">${total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;

