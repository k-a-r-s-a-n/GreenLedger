import { NextResponse } from "next/server";

import { BACKEND_BASE_URL as BACKEND_URL } from "../../../../lib/config";

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const response = await fetch(`${BACKEND_URL}/api/ml/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    const responseBody = await response.text();
    return new NextResponse(responseBody, {
      status: response.status,
      headers: { "Content-Type": response.headers.get("content-type") || "application/json" },
    });
  } catch (error) {
    const message =
      error instanceof Error && error.name === "TimeoutError"
        ? "ML backend timed out while producing a power estimate."
        : "ML backend is unreachable. Start the backend service on port 8000.";
    return NextResponse.json({ detail: message }, { status: 503 });
  }
}
