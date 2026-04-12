'use client';

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { useStore } from "@/context/StoreContext";
import { Check } from "lucide-react";

const SuccessContent = () => {
  const router = useRouter();
  const { clearCart, refreshOrders } = useStore();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");

  useEffect(() => {
    clearCart();
  }, [clearCart]);

  useEffect(() => {
    void refreshOrders();
  }, [refreshOrders]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-6 animate-in fade-in duration-700">
      <div className="w-16 h-16 bg-neutral-950 rounded-full flex items-center justify-center mb-8">
        <Check className="text-white" size={32} />
      </div>
      <h1 className="text-3xl md:text-5xl font-light tracking-tight text-neutral-950 mb-6 text-center">
        Payment successful
      </h1>
      <p className="text-neutral-500 text-[15px] mb-6 max-w-md text-center leading-relaxed">
        Thank you for your purchase. Your order was created at checkout; once Stripe finishes processing, it will appear as paid in the admin orders list.
      </p>
      {sessionId ? (
        <p className="text-[11px] text-neutral-400 mb-10 max-w-md text-center font-mono break-all">
          Stripe session: {sessionId}
        </p>
      ) : null}
      <button
        onClick={() => router.push("/")}
        className="bg-neutral-950 text-white px-10 py-4 text-[13px] font-medium tracking-widest uppercase hover:bg-neutral-800 transition-colors"
      >
        Continue Shopping
      </button>
    </div>
  );
};

const SuccessPage = () => {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-neutral-400 text-[13px] uppercase tracking-widest">Processing...</div>}>
      <SuccessContent />
    </Suspense>
  );
};

export default SuccessPage;
