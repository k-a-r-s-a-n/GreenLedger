import { NextResponse } from "next/server";

const AGENT_URL = process.env.NEXT_PUBLIC_LOCAL_AGENT_URL || "http://127.0.0.1:8765";

export async function POST(request: Request) {
  try {
    const response = await fetch(`${AGENT_URL}/optimization/execute`, {
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
      { detail: "Local Windows agent is unreachable on port 8765." },
      { status: 503 }
    );
  }
}
