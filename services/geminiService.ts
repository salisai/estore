import { GoogleGenAI, Type } from "@google/genai";
import { Product } from "@/types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

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
  if (!process.env.GEMINI_API_KEY) {
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
3. If nothing in RETRIEVED PRODUCTS reasonably matches what the user wants, set type to UNAVAILABLE, return an empty array, and say so honestly instead of forcing a recommendation.
4. If the question is about policy, shipping, returns, materials care, etc., use FAQ_ANSWER and answer only from the FAQ entries given. If no FAQ entry covers it, say you don't have that information rather than guessing.
5. If it's a general styling question with no direct product match yet, use GENERAL_ADVICE — give real advice, and optionally point to relevant categories from the retrieved products if any fit.
6. Keep the tone warm, concise, and elegant. No markdown, no bullet lists in "message".
Return ONLY JSON.
`.trim();

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            type: {
              type: Type.STRING,
              enum: ["PRODUCT_RECOMMENDATION", "FAQ_ANSWER", "GENERAL_ADVICE", "UNAVAILABLE"],
            },
            recommendedProductIds: { type: Type.ARRAY, items: { type: Type.STRING } },
            message: { type: Type.STRING },
          },
          required: ["type", "recommendedProductIds", "message"],
        },
      },
    });

    const result = JSON.parse(response.text || "{}");
    return {
      type: result.type ?? "UNAVAILABLE",
      recommendedIds: result.recommendedProductIds ?? [],
      message: result.message ?? "Here's what we found for you.",
    };
  } catch (error) {
    console.error("Gemini API Error:", error);
    return {
      type: "UNAVAILABLE",
      recommendedIds: [],
      message: "We're having trouble reaching our stylist right now.",
    };
  }
};