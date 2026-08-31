import crypto from "crypto";
import { getAuthContext } from "./auth";
import { getTextEmbedding } from "./embeddings";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { AppError } from "./errors";

const provider = process.env.NEXT_PUBLIC_EMBEDDING_PROVIDER ?? "gemini";
let geminiClient: GoogleGenerativeAI | null = null;
if (provider === "gemini") {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (apiKey) {
    geminiClient = new GoogleGenerativeAI(apiKey);
  }
}

// Extract primary HTTP(S) URL
function extractUrl(text: string): string | null {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const matches = text.match(urlRegex);
  return matches ? matches[0] : null;
}

function buildPassportSummary(profile: any): string {
  if (!profile) return "No style passport provided.";
  return `Preferred Unit: ${profile.preferred_unit}, Height: ${profile.height}, Weight: ${profile.weight}, Chest: ${profile.chest}, Waist: ${profile.waist}, Inseam: ${profile.inseam}, Shirt Size: ${profile.shirt_size}, Pant Size: ${profile.pant_size}, Shoe Size: ${profile.shoe_size}, Ring Size: ${profile.ring_size}, Fit: ${profile.preferred_fit}, Metal: ${profile.metal_preference}, Style Words: ${profile.style_words}, Brands: ${profile.favorite_brands}, Dealbreakers: ${profile.dealbreakers}, Notes: ${profile.notes}`;
}



async function buildWishContext(supabase: any, matchedWishes: any[], userId: string, friendId: string, groupId: string) {
  let relevantWishesContext = "";

  if (matchedWishes && matchedWishes.length > 0) {
    relevantWishesContext = matchedWishes.map((w: any) => `- ${w.name}: ${w.description || 'No description'} ${w.url ? `(URL: ${w.url})` : '(No URL)'} (Reserved by: ${w.reserved_by === userId ? 'You' : w.reserved_by ? 'Someone else' : 'No one'}) (Inspo: ${w.is_inspo})`).join("\n");
  } 
  
  if (!relevantWishesContext) {
    const { data: allWishes } = await supabase
      .from("wishes")
      .select("*")
      .eq("user_id", friendId)
      .eq("group_id", groupId)
      .limit(50);
    if (allWishes && allWishes.length > 0) {
       relevantWishesContext = allWishes.map((w: any) => `- ${w.name}: ${w.description || ''} ${w.url ? `(URL: ${w.url})` : '(No URL)'} (Reserved by: ${w.reserved_by === userId ? 'You' : w.reserved_by ? 'Someone else' : 'No one'})`).join("\n");
    } else {
       relevantWishesContext = "EMPTY - The user has NO items on their wishlist.";
    }
  }
  return relevantWishesContext;
}

function buildSystemPrompt(passportSummary: string, relevantWishesContext: string, query: string) {
  return `You are an AI Gift Assistant for a wishlist app. 
The user is talking about buying a gift for their friend (or themselves).
Here is the friend's exact Style Passport (their sizing and preferences):
${passportSummary}

Here is the friend's EXACT wishlist:
${relevantWishesContext}

User's Query: ${query}

CRITICAL RULES (ANTI-HALLUCINATION):
1. You are strictly a formatter for the database. DO NOT invent, suggest, or hallucinate ANY gift ideas that are not explicitly listed in the wishlist above.
2. If the wishlist is EMPTY, you must tell the user that their wishlist is empty. Do NOT invent gifts.
3. When referencing items from the wishlist, match them with the sizing from the Style Passport if applicable.
4. If the user just says a greeting like "hello" or "hi", simply greet them back and ask how you can help.
5. Generate MINIMAL, SHORT, and CONDENSED text. DO NOT just paste the entire wishlist list in your response unless explicitly asked to do so. Only bring up items relevant to the user's specific query.
6. If the user asks you to evaluate a link or item against the preferences, you MUST include a "Match Percentage: X%" score based on how well it fits the Style Passport and Wishlist, before giving brief reasoning.
7. If an item has a URL listed, ALWAYS provide the URL as a clickable markdown link when mentioning or recommending the item. If it says '(No URL)', DO NOT create a broken markdown link.
8. If an item is marked as "Reserved by: Someone else", explicitly warn the user that someone else has already reserved it. If it is marked as "Reserved by: You", reassure the user that they have already reserved it.
9. If the user provides a link to an item to evaluate, compare its category and style to the wishlist. If a closely matching item is already on the wishlist AND it has its own exact URL, highly recommend that they buy the item explicitly listed on the wishlist instead (since it's safer), and provide that exact clickable URL.`;
}

export async function askGiftAssistant(query: string, friendId: string, groupId: string, history: any[] = []) {
  if (!geminiClient) throw new AppError("AI_ERROR", "Gemini API key not configured", 503);
  const { userId, supabase } = await getAuthContext();

  const url = extractUrl(query);

  const [profileResult, embeddingResult] = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", friendId).single(),
    getTextEmbedding(url ? `${query} ${url}` : query),
  ]);

  const passportSummary = buildPassportSummary(profileResult.data);
  const queryEmbedding = embeddingResult;
  
  let matchedWishes: any[] = [];
  if (queryEmbedding.length > 0) {
    const { data } = await supabase.rpc("match_wishes_hybrid", {
      query_text: query,
      query_embedding: queryEmbedding,
      match_count: 3,
      p_group_id: groupId,
      p_user_id: friendId
    });
    matchedWishes = data || [];
  }

  const relevantWishesContext = await buildWishContext(supabase, matchedWishes, userId, friendId, groupId);
  
  // Context Hashing for Semantic Cache Invalidation
  const contextHash = crypto.createHash("md5")
    .update(groupId + relevantWishesContext + JSON.stringify(history))
    .digest("hex");
  
  if (queryEmbedding.length > 0) {
    const { data: cacheHits } = await supabase.rpc("check_semantic_cache", {
      query_embedding: queryEmbedding,
      p_context_hash: contextHash,
      match_threshold: 0.95
    });
    
    if (cacheHits && cacheHits.length > 0) {
      console.log("[Semantic Cache] HIT!");
      return {
        stream: (async function* () {
          yield { text: () => cacheHits[0].cached_response };
        })()
      };
    }
  }
  console.log("[Semantic Cache] MISS. Fetching from Gemini...");

  const systemPrompt = buildSystemPrompt(passportSummary, relevantWishesContext, query);

  try {
    const model = geminiClient.getGenerativeModel({ 
      model: "gemini-flash-lite-latest",
      systemInstruction: systemPrompt,
      generationConfig: { temperature: 0.7 }
    });

    let geminiHistory = history.slice(0, -1).map(msg => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }]
    }));

    if (geminiHistory.length > 0 && geminiHistory[0].role === "model") {
      geminiHistory.shift();
    }

    const chat = model.startChat({ history: geminiHistory });
    const result = await chat.sendMessageStream(query);
    
    return {
      stream: (async function* () {
        let fullResponse = "";
        for await (const chunk of result.stream) {
          const text = chunk.text();
          fullResponse += text;
          yield chunk;
        }
        
        // Save to cache asynchronously
        if (queryEmbedding.length > 0) {
          supabase.from("semantic_cache").insert({
            query_text: query,
            query_embedding: queryEmbedding,
            context_hash: contextHash,
            cached_response: fullResponse
          }).then(() => console.log("[Semantic Cache] Saved new response"))
          .catch((err: any) => console.error("[Semantic Cache] Failed to save", err));
        }
      })()
    };
  } catch (err) {
    console.error("Gemini Generation Error:", err);
    throw new AppError("AI_ERROR", "Failed to generate response.", 500);
  }
}
