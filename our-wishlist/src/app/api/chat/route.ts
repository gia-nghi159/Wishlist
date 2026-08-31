import { auth } from "@clerk/nextjs/server";
import { isAllowed, getRateLimitStatus } from "../../../lib/rateLimiter";
import { askGiftAssistant } from "../../../lib/geminiChat";
import { AppError } from "../../../lib/errors";

export const runtime = "nodejs";
export const maxDuration = 30;  // Vercel: allow up to 30s for streaming

export async function POST(req: Request) {
  // 1. Auth check
  let { userId } = await auth();
  
  // Allow local benchmarking to bypass Clerk auth
  if (!userId) {
    const authHeader = req.headers.get("authorization");
    if (authHeader === "Bearer TEST_BENCHMARK_TOKEN") {
      userId = "mock-friend-id";
    }
  }

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Rate limit check (Bypass for benchmark token to fully test cache load)
  const isBenchmark = userId === "mock-friend-id";
  if (!isBenchmark && !isAllowed(userId)) {
    const status = getRateLimitStatus(userId);
    return Response.json(
      { error: "Rate limit exceeded. Try again shortly." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil(status.resetIn / 1000)),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil((Date.now() + status.resetIn) / 1000)),
        },
      }
    );
  }

  // 3. Request body validation
  const body = await req.json().catch(() => null);
  if (!body || !body.query || !body.friendId || !body.groupId) {
    return Response.json({ error: "Missing required fields" }, { status: 400 });
  }

  // 4. Execute AI pipeline and stream response
  try {
    const result = await askGiftAssistant(body.query, body.friendId, body.groupId, body.history ?? []);
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of result.stream) {
            controller.enqueue(new TextEncoder().encode(chunk.text()));
          }
          controller.close();
        } catch (e) {
          controller.error(e);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-RateLimit-Remaining": String(getRateLimitStatus(userId).remaining),
      },
    });
  } catch (err: any) {
    console.error("[chat-route]", err);
    if (err instanceof AppError) {
      return Response.json(
        { error: err.message },
        { status: err.statusCode }
      );
    }
    return Response.json(
      { error: "Failed to generate response" },
      { status: 500 }
    );
  }
}
