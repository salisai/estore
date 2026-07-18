'use client';

import { useState } from "react";
import Image from "next/image";
import { X, Sparkles, Send } from "lucide-react";
import { useStore } from "@/context/StoreContext";
import type { Product } from "@/types";

interface AiStylistProps {
  isOpen: boolean;
  onClose: () => void;
}

const AiStylist = ({ isOpen, onClose }: AiStylistProps) => {
  const { products, addToCart } = useStore();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ products: Product[]; reasoning: string } | null>(null);

  if (!isOpen) return null;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/ai-stylist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ query })
      });

      if (!res.ok) {
        throw new Error("Unable to reach stylist");
      }

      const payload = await res.json();
      const matchedProducts = products.filter((p) => payload.recommendedIds?.includes(p.id));
      setResult({
        products: matchedProducts,
        reasoning: payload.message ?? payload.reasoning ?? ""
      });
    } catch (err) {
      console.error(err);
      setError("Our stylist is paused right now. Please try again soon.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-neutral-900/30 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-2xl bg-white shadow-2xl overflow-hidden animate-in zoom-in-95 duration-500 ease-[0.22,1,0.36,1]">
        <div className="p-6 border-b border-neutral-100 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-neutral-950" strokeWidth={1.5} />
            <h2 className="text-lg font-medium tracking-wide text-neutral-950 uppercase">Ai Stylist</h2>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-950 transition-colors"><X size={20} strokeWidth={1.5} /></button>
        </div>

        <div className="p-8 h-[500px] flex flex-col">
          {!result && !loading && (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-neutral-500 space-y-6">
              <Sparkles className="w-10 h-10 text-neutral-300" strokeWidth={1} />
              <p className="max-w-md text-[13px] leading-relaxed">Tell us who you are shopping for, or what occasion you are celebrating. Our AI stylist will curate the perfect selection.</p>
              <div className="flex flex-wrap justify-center gap-2">
                <span className="bg-neutral-50 px-4 py-2 text-[11px] uppercase tracking-wider text-neutral-600">"Gift for anniversary"</span>
                <span className="bg-neutral-50 px-4 py-2 text-[11px] uppercase tracking-wider text-neutral-600">"Minimalist silver rings"</span>
              </div>
            </div>
          )}

          {loading && (
            <div className="flex-1 flex flex-col items-center justify-center space-y-6">
              <div className="w-12 h-12 border-2 border-neutral-950 border-t-transparent rounded-full animate-spin" />
              <p className="text-[11px] uppercase tracking-widest animate-pulse">Curating selection...</p>
            </div>
          )}

          {error && (
            <p className="text-center text-sm text-red-500">{error}</p>
          )}

          {result && !error && (
            <div className="flex-1 overflow-y-auto pr-2">
              <div className="mb-8 p-6 bg-neutral-50 border border-neutral-100">
                <p className="italic text-neutral-600 leading-relaxed text-[13px]">"{result.reasoning}"</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {result.products.map(product => (
                  <div key={product.id} className="flex gap-4 p-4 border border-neutral-100 hover:border-neutral-950 transition-colors group">
                    <div className="w-16 h-20 bg-neutral-50 relative shrink-0">
                      <Image src={product.image as string} alt={product.name} width={64} height={80} className="object-cover" />
                    </div>
                    <div className="flex flex-col justify-between items-start flex-1">
                      <div>
                        <h4 className="font-medium text-[13px] text-neutral-950 line-clamp-1">{product.name}</h4>
                        <p className="text-neutral-500 text-[13px] mt-1">${product.price}</p>
                      </div>
                      <button
                        onClick={() => addToCart(product)}
                        className="text-[11px] uppercase tracking-wider text-neutral-950 hover:underline opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        Add to Bag
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {result.products.length === 0 && (
                <p className="text-center text-neutral-400 mt-10 text-[13px]">We couldn't find exact matches, but please explore our Shop page.</p>
              )}
            </div>
          )}

          <form onSubmit={handleSearch} className="mt-6 pt-6 border-t border-neutral-100 flex gap-3">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Describe what you are looking for..."
              className="flex-1 border border-neutral-200 p-3 text-[13px] focus:outline-none focus:border-neutral-950 placeholder:text-neutral-400"
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="bg-neutral-950 text-white px-6 hover:bg-neutral-800 disabled:opacity-50 transition-colors"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AiStylist;