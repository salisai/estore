import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getAssistantResponse } from "@/services/geminiService";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { embedText } from "@/lib/embeddings";

export const POST = async (req: NextRequest) => {
  try {
    const { query, history } = await req.json();

    if (!query?.trim()) {
      return NextResponse.json({ message: "Missing query" }, { status: 400 });
    }
    const supabase = createSupabaseAdmin();
    const queryEmbedding = await embedText(query, "RETRIEVAL_QUERY")

    const [{ data: products, error: pErr }, { data: faqs, error: fErr }] = await Promise.all([
      supabase.rpc("match_products", { query_embedding: queryEmbedding, match_count: 8 }),
      supabase.rpc("match_faqs", { query_embedding: queryEmbedding, match_count: 3 }),
    ]);

    if (pErr) throw pErr;
    if (fErr) throw fErr;


    const result = await getAssistantResponse({
      query,
      history: history ?? [],
      products: products ?? [],
      faqs: faqs ?? [],
    });

    return NextResponse.json(result);

  } catch (error) {
    console.error("ai stylist route error", error);
    return NextResponse.json(
      { type: "UNAVAILABLE", recommendedIds: [], message: "Our stylist is unavailable. Please browse the collection." },
      { status: 500 }
    );
  }
};

