import { NextResponse } from "next/server";

import { BACKEND_BASE_URL as BACKEND_URL } from "../../../../../lib/config";

export async function POST(request: Request) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/optimization/recommendations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: await request.text(),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    const body = await response.text();
    return new NextResponse(body, {
      status: response.status,
      headers: { "Content-Type": response.headers.get("content-type") || "application/json" },
    });
  } catch {
    return NextResponse.json(
      { detail: "Optimization backend is unreachable on port 8000." },
      { status: 503 }
    );
  }
}
