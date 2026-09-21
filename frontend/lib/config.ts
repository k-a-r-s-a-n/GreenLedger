/** Runtime-configurable service URLs shared by browser and server requests. */
export const BACKEND_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export const AGENT_BASE_URL =
  process.env.NEXT_PUBLIC_LOCAL_AGENT_URL || "http://127.0.0.1:8765";
