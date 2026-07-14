import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export async function embedText(
  text: string,
  taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY" = "RETRIEVAL_QUERY"
) {
  const res = await ai.models.embedContent({
    model: "text-embedding-004",
    contents: text,
    config: { outputDimensionality: 768, taskType },
  });

  const embedding = res.embeddings?.[0]?.values;

  if (!embedding) {
    throw new Error("Failed to generate embedding: empty response from Gemini API");
  }


  return embedding;
}