import { NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";
import { BACKEND_BASE_URL } from "../../../lib/config";

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

export async function GET() {
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
      const child = spawn("cmd.exe", ["/c", "start", "python", "api.py"], {
        cwd: agentDir,
        detached: true,
        stdio: "ignore",
      });
      child.unref();
      agentStarted = true;
      startedList.push("Windows Telemetry Agent (:8765)");
    } catch (err) {
      console.error("[ServiceAutoStart] Failed to spawn agent:", err);
    }
  }

  // Start backend if not up
  if (!backendUp && !backendStarted) {
    try {
      const child = spawn("cmd.exe", ["/c", "start", "python", "main.py"], {
        cwd: backendDir,
        detached: true,
        stdio: "ignore",
      });
      child.unref();
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
