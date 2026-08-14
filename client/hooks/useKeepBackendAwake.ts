import { useEffect } from "react";
import { API_BASE_URL } from "@/lib/research-stream";

/**
 * Pings the backend /health endpoint on an interval to prevent
 * Render's free tier from spinning down due to inactivity.
 * Mount this once near the root of the app (e.g. in App.tsx).
 */
const PING_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes (Render sleeps at ~15 min idle)

export function useKeepBackendAwake() {
  useEffect(() => {
    const ping = () => {
      fetch(`${API_BASE_URL}/health`).catch(() => {
        // Silently ignore — a failed ping just means we try again next interval
      });
    };

    ping(); // ping once immediately on mount
    const interval = setInterval(ping, PING_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);
}