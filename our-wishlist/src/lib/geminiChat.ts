import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { getTextEmbedding } from "./embeddings";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { parseLinkMetadata } from "./linkParser";

const provider = process.env.NEXT_PUBLIC_EMBEDDING_PROVIDER ?? "gemini";
let geminiClient: GoogleGenerativeAI | null = null;
if (provider === "gemini") {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (apiKey) {
    geminiClient = new GoogleGenerativeAI(apiKey);
  }
}

async function getAuthedSupabaseClient() {
  const { getToken } = await auth();
  const token = await getToken({ template: "supabase" });
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

// Extract first HTTP(S) URL from text
function extractUrl(text: string): string | null {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const matches = text.match(urlRegex);
  return matches ? matches[0] : null;
}

export async function askGiftAssistant(query: string, friendId: string, groupId: string, history: any[] = []) {
  if (!geminiClient) throw new Error("Gemini API key not configured");
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = await getAuthedSupabaseClient();

  // Fetch style profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", friendId)
    .single();

  let passportSummary = "No style passport provided.";
  if (profile) {
    passportSummary = `Preferred Unit: ${profile.preferred_unit}, Height: ${profile.height}, Weight: ${profile.weight}, Chest: ${profile.chest}, Waist: ${profile.waist}, Inseam: ${profile.inseam}, Shirt Size: ${profile.shirt_size}, Pant Size: ${profile.pant_size}, Shoe Size: ${profile.shoe_size}, Ring Size: ${profile.ring_size}, Fit: ${profile.preferred_fit}, Metal: ${profile.metal_preference}, Style Words: ${profile.style_words}, Brands: ${profile.favorite_brands}, Dealbreakers: ${profile.dealbreakers}, Notes: ${profile.notes}`;
  }

  // Parse URL metadata if link is present
  const url = extractUrl(query);
  let parsedLinkInfo = "";
  if (url) {
    const meta = await parseLinkMetadata(url);
    if (meta.title || meta.description) {
      parsedLinkInfo = `\n[Context: The user provided a link. Extracted Info: Title: ${meta.title || 'N/A'}, Description: ${meta.description || 'N/A'}, Price: ${meta.price || 'N/A'}]`;
    }
  }

  // Retrieve candidate items via vector similarity
  const embedText = parsedLinkInfo ? `${query} ${parsedLinkInfo}` : query;
  const queryEmbedding = await getTextEmbedding(embedText);
  
  let relevantWishesContext = "";
  
  if (queryEmbedding.length > 0) {
    const { data: matchedWishes, error: matchError } = await supabase.rpc("match_wishes", {
      query_embedding: queryEmbedding,
      match_threshold: 0.1,
      match_count: 3,
      p_group_id: groupId,
      p_user_id: friendId
    });

    if (!matchError && matchedWishes && matchedWishes.length > 0) {
      relevantWishesContext = matchedWishes.map((w: any) => `- ${w.name}: ${w.description || 'No description'} ${w.url ? `(URL: ${w.url})` : '(No URL)'} (Reserved by: ${w.reserved_by === userId ? 'You' : w.reserved_by ? 'Someone else' : 'No one'}) (Inspo: ${w.is_inspo})`).join("\n");
    } 
    
    // Fallback if vector search returns empty or fails
    if (!relevantWishesContext) {
      console.warn("Vector search returned 0 results or failed. Falling back to fetching all wishes.");
      const { data: allWishes } = await supabase
        .from("wishes")
        .select("*")
        .eq("user_id", friendId)
        .eq("group_id", groupId)
        .limit(50);
      if (allWishes && allWishes.length > 0) {
         relevantWishesContext = allWishes.map(w => `- ${w.name}: ${w.description || ''} ${w.url ? `(URL: ${w.url})` : '(No URL)'} (Reserved by: ${w.reserved_by === userId ? 'You' : w.reserved_by ? 'Someone else' : 'No one'})`).join("\n");
      } else {
         relevantWishesContext = "EMPTY - The user has NO items on their wishlist.";
      }
    }
  }

  // Construct prompt and invoke Gemini model
  const systemPrompt = `You are an AI Gift Assistant for a wishlist app. 
The user is talking about buying a gift for their friend (or themselves).
Here is the friend's exact Style Passport (their sizing and preferences):
${passportSummary}

Here is the friend's EXACT wishlist:
${relevantWishesContext}

User's Query: ${query} ${parsedLinkInfo}

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

  try {
    const model = geminiClient.getGenerativeModel({ 
      model: "gemini-flash-lite-latest",
      systemInstruction: systemPrompt,
      generationConfig: { temperature: 0.7 }
    });

    // Map message history to Gemini format
    let geminiHistory = history.slice(0, -1).map(msg => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }]
    }));

    // Ensure session starts with a user turn
    if (geminiHistory.length > 0 && geminiHistory[0].role === "model") {
      geminiHistory.shift();
    }

    const chat = model.startChat({ history: geminiHistory });
    const finalQuery = parsedLinkInfo ? `${query}\n\n${parsedLinkInfo}` : query;
    const result = await chat.sendMessageStream(finalQuery);
    return result;
  } catch (err) {
    console.error("Gemini Generation Error:", err);
    throw new Error("Failed to generate response.");
  }
}
