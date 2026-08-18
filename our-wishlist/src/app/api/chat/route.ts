import { NextResponse } from "next/server";
import { askGiftAssistant } from "../../../lib/geminiChat";

export async function POST(req: Request) {
  try {
    const { query, friendId, groupId, history = [] } = await req.json();

    if (!query || !friendId || !groupId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const result = await askGiftAssistant(query, friendId, groupId, history);

    // Convert the Gemini stream to a standard Web ReadableStream
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of result.stream) {
            const chunkText = chunk.text();
            controller.enqueue(new TextEncoder().encode(chunkText));
          }
          controller.close();
        } catch (e) {
          controller.error(e);
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error: any) {
    console.error("Chat API Error:", error);
    return NextResponse.json({ error: "Failed to generate response" }, { status: 500 });
  }
}
