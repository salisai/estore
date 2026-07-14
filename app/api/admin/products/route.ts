import { embedText } from "@/lib/embeddings";   
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

export const POST = async (req: NextRequest) => {
    const body = await req.json();
    const supabase = createSupabaseAdmin();

    const embedding = await embedText(
        `${body.name} | ${body.category} | ${body.description}`, 
        "RETRIEVAL_DOCUMENT"
    ).catch((err) => {
        console.error("Embedding failed, will be caught by cron backfill:", err);
        return null;
    })


    const { data, error } = await supabase
        .from("products")
        .insert({...body, embedding})
        .select()
        .single();

    if (error) return NextResponse.json({error: error.message}, {status: 500});
    return NextResponse.json(data)
}