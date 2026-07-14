import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { embedText } from "@/lib/embeddings";

export const maxDuration = 60; 

export const GET = async (req: NextRequest) => {
    
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`){
        return new NextResponse("Unauthorized", {status: 401})
    }

    const supabase = createSupabaseAdmin();

    const { data: products, error } = await supabase
        .from("products")
        .select("id, name, category, description")
        .is("embedding", null)
        .limit(200);

    if(error){
        console.error(error);
        return NextResponse.json({error: error.message}, {status: 500})
    }

    let embedded = 0;
    for (const p of products ?? []){
        try{
            const embedding = await embedText(
                `${p.name} | ${p.category} | ${p.description}`, 
                "RETRIEVAL_DOCUMENT"
            );

            await supabase.from("products").update({embedding}).eq("id", p.id);
            embedded++;
        } catch (err){
            console.error("Embedding failed, will be caught by cron backfill:", err);
        }
    }

    const { data: faqs } = await supabase 
        .from("faqs")
        .select("id, question, answer")
        .is("embedding", null)
        .limit(100);

    for (const f of faqs ?? []){
        try {
            const embedding = await embedText(`${f.question} ${f.answer}`, "RETRIEVAL_DOCUMENT");
            await supabase.from("faqs").update({embedding}).eq("id", f.id);
            embedded++;
        } catch (error) {
            console.error(`Failed to embed faq ${f.id}:`, error);
        }
    }

    
    return NextResponse.json({ embeddedProducts: embedded, totalFound: products?.length ?? 0 });
}