import process from "process";
import { GoogleGenerativeAI } from "@google/generative-ai";

const provider = process.env.NEXT_PUBLIC_EMBEDDING_PROVIDER ?? "gemini";

let geminiClient: GoogleGenerativeAI | null = null;
if (provider === "gemini") {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) {
    console.error("Missing Gemini API key for embeddings");
  } else {
    geminiClient = new GoogleGenerativeAI(apiKey);
  }
}

if (provider !== "gemini") {
  console.warn(`Embedding provider "${provider}" is not recognized. Defaulting to Gemini.`);
}

/**
 * Get a 768‑dimensional embedding for a piece of text.
 * @param text The raw text to embed.
 * @returns Promise<number[]> – array of 768 numbers.
 */
export async function getTextEmbedding(text: string): Promise<number[]> {
  if (!text) return [];

  if (provider === "gemini" && geminiClient) {
    // Text embedding model (768 dimensions for pgvector)
    const model = geminiClient.getGenerativeModel({ model: "gemini-embedding-001" });
    const result = await model.embedContent({ 
      content: { role: "user", parts: [{ text }] }
    });
    // result.embedding.values is Float32Array(768)
    const values = Array.from(result.embedding?.values ?? []);
    return values.slice(0, 768);
  }

  // Supported provider: gemini.
  // Implement additional provider logic here.

  console.error("Unsupported embedding provider or mis‑configuration");
  return [];
}

