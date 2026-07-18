import OpenAI from "openai";
import { Product } from "@/types";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface Faq {
  question: string;
  answer: string;
}

interface HistoryTurn {
  role: "user" | "assistant";
  content: string;
}

export const getAssistantResponse = async ({
  query,
  history,
  products,
  faqs,
}: {
  query: string;
  history: HistoryTurn[];
  products: Product[];
  faqs: Faq[];
}) => {
  if (!process.env.OPENAI_API_KEY) {
    console.warn("No API Key found. Returning mock response.");
    return {
      type: "UNAVAILABLE",
      recommendedIds: [],
      message: "API Key missing. Stylist is temporarily offline.",
    };
  }

  const productContext = products
    .map(
      (p) =>
        `ID: ${p.id} | ${p.name} | ${p.category} | $${p.price} | Stock: ${p.stock ?? 0} | ${p.description}`
    )
    .join("\n");

  const faqContext = faqs.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n");

  const historyContext = history
    .slice(-6)
    .map((h) => `${h.role}: ${h.content}`)
    .join("\n");

  const prompt = `
You are the AI stylist for 'Lumière', a minimalist jewelry brand.

CONVERSATION SO FAR:
${historyContext || "(none)"}

RETRIEVED PRODUCTS (the ONLY products you may recommend — never invent products or IDs not listed here):
${productContext || "(none matched)"}

RELEVANT FAQ ENTRIES (use these to answer policy/company questions; do not use outside knowledge):
${faqContext || "(none matched)"}

USER MESSAGE: "${query}"

Rules:
1. Classify the message into exactly one type: PRODUCT_RECOMMENDATION, FAQ_ANSWER, GENERAL_ADVICE, or UNAVAILABLE.
2. Only recommend products from the RETRIEVED PRODUCTS list. Never recommend an item with Stock: 0 — if the user is asking about something that appears with Stock: 0, honestly tell them it's currently out of stock rather than suggesting it.
3. Prefer PRODUCT_RECOMMENDATION whenever retrieved products are in a relevant category (rings, necklaces, etc.), even if metal/color/material is not an exact match — briefly note the difference and still recommend the closest options. Only use UNAVAILABLE with an empty array when the retrieved list is empty or clearly unrelated.
4. If the question is about policy, shipping, returns, materials care, etc., use FAQ_ANSWER and answer only from the FAQ entries given. If no FAQ entry covers it, say you don't have that information rather than guessing.
5. If it's a general styling question with no direct product match yet, use GENERAL_ADVICE — give real advice, and optionally point to relevant categories from the retrieved products if any fit.
6. Keep the tone warm, concise, and elegant. No markdown, no bullet lists in "message".
Return ONLY JSON.
`.trim();

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4.1-nano",
      messages: [{ role: "user", content: prompt }],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "stylist_response",
          strict: true,
          schema: {
            type: "object",
            properties: {
              type: {
                type: "string",
                enum: ["PRODUCT_RECOMMENDATION", "FAQ_ANSWER", "GENERAL_ADVICE", "UNAVAILABLE"],
              },
              recommendedProductIds: {
                type: "array",
                items: { type: "string" },
              },
              message: { type: "string" },
            },
            required: ["type", "recommendedProductIds", "message"],
            additionalProperties: false,
          },
        },
      },
    });

    const result = JSON.parse(response.choices[0]?.message?.content || "{}");
    return {
      type: result.type ?? "UNAVAILABLE",
      recommendedIds: result.recommendedProductIds ?? [],
      message: result.message ?? "Here's what we found for you.",
    };
  } catch (error) {
    console.error("OpenAI API Error:", error);
    return {
      type: "UNAVAILABLE",
      recommendedIds: [],
      message: "We're having trouble reaching our stylist right now.",
    };
  }
};
