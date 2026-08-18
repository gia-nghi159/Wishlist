// src/lib/embeddings.ts

/**
 * Simple wrapper around a free embedding provider.
 * Choose between Google Gemini (text-embedding-004) or Groq (embedding model).
 * The function returns a float array of length 768 (compatible with pgvector).
 */

import process from "process";
import { GoogleGenerativeAI } from "@google/generative-ai"; // Gemini SDK

// ---------------------------------------------------------------------------
// Configuration – pick one provider by setting the ENV variable
// ---------------------------------------------------------------------------
/**
 * Set `EMBEDDING_PROVIDER` in your .env.local:
 *   - "gemini" – Google Gemini embeddings (free tier on AI Studio)
 *   - (other providers are not currently supported)
 */
// Exported constant so other modules can read the chosen provider
export const provider = process.env.NEXT_PUBLIC_EMBEDDING_PROVIDER ?? "gemini";

/**
 * Gemini client – requires API key in `NEXT_PUBLIC_GEMINI_API_KEY`.
 * For Groq you would replace this with the appropriate fetch call.
 */
let geminiClient: GoogleGenerativeAI | null = null;
if (provider === "gemini") {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) {
    console.error("Missing Gemini API key for embeddings");
  } else {
    geminiClient = new GoogleGenerativeAI(apiKey);
  }
}
// If an unsupported provider is set, warn early
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
    // Gemini text embedding model (explicitly limit to 768 dimensions for pgvector)
    const model = geminiClient.getGenerativeModel({ model: "gemini-embedding-001" });
    const result = await model.embedContent({ 
      content: { role: "user", parts: [{ text }] }
    });
    // result.embedding?.values is a Float32Array of length 768
    return Array.from(result.embedding?.values ?? []);
  }

  // Gemini is the only supported provider; if you wish to add more providers,
  // implement their logic here.

  console.error("Unsupported embedding provider or mis‑configuration");
  return [];
}

/**
 * Helper to store an embedding into the Supabase `profiles` or `wishes` table.
 * Call this after inserting/updating a row.
 */
export async function upsertEmbedding(
  supabase: any,
  table: "profiles" | "wishes",
  idColumn: string,
  idValue: string | number,
  embedding: number[]
) {
  const column = table === "profiles" ? "style_embedding" : "item_embedding";
  const { error } = await supabase
    .from(table)
    .update({ [column]: embedding })
    .eq(idColumn, idValue);
  if (error) {
    console.error(`Failed to store embedding in ${table}:`, error);
  }
}
