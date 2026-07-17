import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/** Keep 768 to match the existing pgvector column size. */
const EMBEDDING_DIMENSIONS = 768;

export async function embedText(
  text: string,
  _taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY" = "RETRIEVAL_QUERY"
) {
  const res = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
    dimensions: EMBEDDING_DIMENSIONS,
  });

  const embedding = res.data[0]?.embedding;

  if (!embedding) {
    throw new Error("Failed to generate embedding: empty response from OpenAI API");
  }

  return embedding;
}
