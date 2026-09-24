import { NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";

// Hardware-probing route — request-time only, never `next build` evaluation.
export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);

/**
 * Reads the current display brightness (0-100) via WMI.
 * Returns null when the platform/monitor doesn't expose it — many external
 * monitors (HDMI/DP) don't implement WMI brightness, so the UI must be able
 * to degrade honestly instead of pretending.
 */
async function readBrightness(): Promise<number | null> {
  try {
    const { stdout } = await execFileAsync(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        "(Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightness).CurrentBrightness",
      ],
      { windowsHide: true, timeout: 8000 }
    );
    const value = parseInt(stdout.trim(), 10);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

/** Sets display brightness (0-100). Awaited: failures propagate as errors. */
async function setBrightness(level: number): Promise<void> {
  // WmiSetBrightness(timeoutMs, level). Member enumeration applies the call
  // to every connected monitor that supports WMI brightness.
  await execFileAsync(
    "powershell",
    [
      "-NoProfile",
      "-Command",
      `(Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightnessMethods).WmiSetBrightness(1, ${level})`,
    ],
    { windowsHide: true, timeout: 8000 }
  );
}

/** Pre-optimization brightness, remembered once per server session for restore. */
let originalBrightness: number | null = null;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const level =
      typeof body?.level === "number"
        ? Math.max(10, Math.min(100, Math.round(body.level)))
        : 40;

    // Read the current level first — this doubles as the WMI capability probe.
    const before = await readBrightness();
    if (before === null) {
      return NextResponse.json(
        {
          success: false,
          error:
            "This system does not expose display brightness via WMI (common on external monitors). Adjust brightness in Windows settings instead.",
        },
        { status: 501 }
      );
    }

    // Capture the pre-optimization level once so PUT can restore it later.
    if (originalBrightness === null) originalBrightness = before;

    if (Math.abs(before - level) <= 1) {
      return NextResponse.json({
        success: true,
        message: `Brightness already at ${before}%.`,
        level: before,
        previous_level: before,
        changed: false,
      });
    }

    // Execute — and actually await the result so failures are real failures.
    try {
      await setBrightness(level);
    } catch {
      return NextResponse.json(
        {
          success: false,
          error:
            "Windows refused the brightness change (WMI error). Ensure the app server runs in an interactive user session.",
        },
        { status: 500 }
      );
    }

    // Verify the OS actually applied the change — never report success on faith.
    const confirmed = await readBrightness();
    if (confirmed === null || Math.abs(confirmed - level) > 2) {
      return NextResponse.json(
        {
          success: false,
          error: `Brightness readback shows ${confirmed ?? "no"}% instead of the ${level}% target.`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Brightness reduced ${before}% → ${confirmed}%.`,
      level: confirmed,
      previous_level: before,
      changed: true,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to adjust brightness." },
      { status: 500 }
    );
  }
}

/** GET — capability probe: current brightness + remembered original level. */
export async function GET() {
  const current = await readBrightness();
  return NextResponse.json({
    success: current !== null,
    level: current,
    original_level: originalBrightness,
  });
}

/** PUT — restore the brightness level captured before the optimization. */
export async function PUT() {
  const target = originalBrightness;
  if (target === null) {
    return NextResponse.json(
      { success: false, error: "No original brightness captured in this session yet." },
      { status: 400 }
    );
  }
  try {
    await setBrightness(target);
    return NextResponse.json({
      success: true,
      message: `Brightness restored to ${target}%.`,
      level: target,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to restore brightness." },
      { status: 500 }
    );
  }
}
