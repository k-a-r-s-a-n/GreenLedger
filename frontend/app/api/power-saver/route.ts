import { NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

/**
 * Windows standard power scheme GUIDs (same values as agent/config.py).
 * These are fixed OS identifiers — powercfg on every Windows install knows them.
 */
const POWER_SAVER_GUID = "a1841308-3541-4fab-bc81-f71556f20b4a";

/** Reads the friendly name + GUID of the active power scheme. */
async function getActiveScheme(): Promise<{ guid: string; name: string } | null> {
  try {
    const { stdout } = await execFileAsync(
      "powershell",
      ["-NoProfile", "-Command", "powercfg /getactivescheme"],
      { windowsHide: true, timeout: 8000 }
    );
    const match = stdout.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
    const name = stdout.split(":").slice(1).join(":").replace(/\(.*?\)/g, "").trim() || "Unknown";
    return match ? { guid: match[1].toLowerCase(), name } : null;
  } catch {
    return null;
  }
}

/** Activates a power scheme by GUID. Awaited: failures propagate. */
async function setActiveScheme(guid: string): Promise<void> {
  const { stderr } = await execFileAsync(
    "powershell",
    ["-NoProfile", "-Command", `powercfg /setactive ${guid}`],
    { windowsHide: true, timeout: 8000 }
  );
  if (stderr.trim()) throw new Error(stderr.trim());
}

/** Scheme active before the first optimization in this server session (for restore). */
let originalScheme: string | null = null;

export async function POST() {
  try {
    const active = await getActiveScheme();
    if (!active) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Could not query the Windows power configuration (powercfg unavailable or non-interactive session).",
        },
        { status: 500 }
      );
    }

    // Remember the pre-optimization plan once so PUT can restore it.
    if (originalScheme === null && active.guid !== POWER_SAVER_GUID) {
      originalScheme = active.guid;
    }

    if (active.guid === POWER_SAVER_GUID) {
      return NextResponse.json({
        success: true,
        message: "Power Saver scheme is already active.",
        scheme: active.name,
        changed: false,
      });
    }

    await setActiveScheme(POWER_SAVER_GUID);

    // Verify the OS actually switched — never report success on faith.
    const confirmed = await getActiveScheme();
    if (!confirmed || confirmed.guid !== POWER_SAVER_GUID) {
      return NextResponse.json(
        {
          success: false,
          error: `powercfg did not apply the switch (active scheme still "${confirmed?.name ?? "unknown"}").`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Power plan switched from "${active.name}" to Power Saver.`,
      scheme: confirmed.name,
      previous_scheme: active.name,
      changed: true,
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error:
          err instanceof Error && err.message
            ? `Power plan switch failed: ${err.message}`
            : "Power plan switch failed.",
      },
      { status: 500 }
    );
  }
}

/** PUT — restore the power scheme captured before the optimization. */
export async function PUT() {
  const target = originalScheme;
  if (target === null) {
    return NextResponse.json(
      { success: false, error: "No previous power scheme captured in this session yet." },
      { status: 400 }
    );
  }
  try {
    await setActiveScheme(target);
    const confirmed = await getActiveScheme();
    return NextResponse.json({
      success: confirmed?.guid === target,
      message:
        confirmed?.guid === target
          ? "Previous power plan restored."
          : "Restore command ran, but the active scheme could not be re-verified.",
      scheme: confirmed?.name ?? null,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to restore the previous power plan." },
      { status: 500 }
    );
  }
}
