// src/app/api/demo-login/route.ts

import { NextResponse } from "next/server";

/**
 * Simple endpoint that sets a short‑lived cookie indicating demo mode.
 * In a real app you would create or fetch a demo user and issue a Clerk
 * token, but for the purpose of a zero‑budget prototype we just mark the
 * client as "demo" and the frontend will treat it specially.
 */
export async function GET() {
  const response = NextResponse.json({ success: true });
  // Cookie lasts for 1 hour
  response.headers.append("Set-Cookie", "demo=true; Path=/; Max-Age=3600; HttpOnly; SameSite=Lax");
  return response;
}
