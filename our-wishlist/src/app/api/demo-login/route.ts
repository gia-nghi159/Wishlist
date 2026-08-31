// src/app/api/demo-login/route.ts

import { NextResponse } from "next/server";

/**
 * Sets a short-lived HTTP-only cookie indicating demo mode.
 * Acts as a local-only bypass for authentication in a prototype environment.
 */
export async function GET() {
  const response = NextResponse.json({ success: true });
  // Cookie expiration: 1 hour
  response.headers.append("Set-Cookie", "demo=true; Path=/; Max-Age=3600; HttpOnly; SameSite=Lax");
  return response;
}
