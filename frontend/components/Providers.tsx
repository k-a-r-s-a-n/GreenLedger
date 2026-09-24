"use client";

/**
 * Client-side providers mounted once in the root layout.
 * TanStack Query owns all server state (telemetry polling, ML predictions,
 * credits, badges, marketplace); local UI state stays in components.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  // Create the client inside state so it is stable across server and
  // client renders and never shared between requests/users.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  // Auto-boot services if not running when user accesses the app.
  // A side effect, so it belongs in useEffect — never in a state initializer.
  useEffect(() => {
    fetch("/api/start-services").catch(() => {});
  }, []);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
