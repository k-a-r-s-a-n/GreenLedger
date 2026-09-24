import { NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";
import { BACKEND_BASE_URL } from "../../../lib/config";

// This route boots local Windows processes on demand — it must only ever run
// at request time, never during `next build` static route evaluation.
export const dynamic = "force-dynamic";

// Keep track of spawned child process handles in runtime memory
let backendStarted = false;
let agentStarted = false;

async function checkPort(url: string, timeoutMs: number = 1000): Promise<boolean> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Spawns a detached Windows service process. The 'error' listener is required:
 * `spawn` failures (missing executable, non-Windows platform) are emitted as
 * async 'error' events — without a listener they crash the Node process.
 */
function spawnService(cwd: string, script: string, onError: (err: Error) => void) {
  const child = spawn("cmd.exe", ["/c", "start", "python", script], {
    cwd,
    detached: true,
    stdio: "ignore",
  });
  child.on("error", onError);
  child.unref();
  return child;
}

export async function GET() {
  // Windows-only convenience: on any other platform (Linux dev, Vercel build
  // or runtime) report honestly instead of attempting to spawn cmd.exe.
  if (process.platform !== "win32") {
    return NextResponse.json(
      {
        status: "unsupported",
        agent: "offline",
        backend: "offline",
        started: [],
        message: "Service auto-start is only available on Windows.",
      },
      { status: 501 }
    );
  }

  const rootDir = path.resolve(process.cwd(), "..");
  const agentDir = path.join(rootDir, "agent");
  const backendDir = path.join(rootDir, "backend");

  const agentHealthUrl = "http://127.0.0.1:8765/health";
  const backendHealthUrl = `${BACKEND_BASE_URL}/health`;

  const [agentUp, backendUp] = await Promise.all([
    checkPort(agentHealthUrl, 800),
    checkPort(backendHealthUrl, 800),
  ]);

  const startedList: string[] = [];

  // Start agent if not up
  if (!agentUp && !agentStarted) {
    try {
      spawnService(agentDir, "api.py", (err) => {
        agentStarted = false;
        console.error("[ServiceAutoStart] Failed to spawn agent:", err);
      });
      agentStarted = true;
      startedList.push("Windows Telemetry Agent (:8765)");
    } catch (err) {
      console.error("[ServiceAutoStart] Failed to spawn agent:", err);
    }
  }

  // Start backend if not up
  if (!backendUp && !backendStarted) {
    try {
      spawnService(backendDir, "main.py", (err) => {
        backendStarted = false;
        console.error("[ServiceAutoStart] Failed to spawn backend:", err);
      });
      backendStarted = true;
      startedList.push("FastAPI Backend (:8000)");
    } catch (err) {
      console.error("[ServiceAutoStart] Failed to spawn backend:", err);
    }
  }

  return NextResponse.json({
    status: "ok",
    agent: agentUp ? "online" : agentStarted ? "starting" : "offline",
    backend: backendUp ? "online" : backendStarted ? "starting" : "offline",
    started: startedList,
  });
}
