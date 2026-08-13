// Client for the FastAPI backend's /history endpoints.

import { authFetch } from "@/lib/auth";
import type { PipelineState } from "@/lib/research-stream";

export interface HistoryListItem {
  id: string;
  query: string;
  created_at: string;
}

export interface HistoryItem extends HistoryListItem {
  final_report?: string | null;
  state_json?: string | null;
}

export async function fetchHistoryList(): Promise<HistoryListItem[]> {
  const res = await authFetch("/history");
  if (!res.ok) throw new Error("Failed to load history");
  return res.json();
}

export async function fetchHistoryItem(id: string): Promise<HistoryItem> {
  const res = await authFetch(`/history/${id}`);
  if (!res.ok) throw new Error("Failed to load that run");
  return res.json();
}

export async function deleteHistoryItem(id: string): Promise<void> {
  const res = await authFetch(`/history/${id}`, { method: "DELETE" });
  if (!res.ok && res.status !== 204) throw new Error("Failed to delete");
}

export async function saveHistory(
  query: string,
  finalReport: string | undefined,
  state: PipelineState | null,
): Promise<void> {
  await authFetch("/history", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      final_report: finalReport ?? null,
      state_json: state ? JSON.stringify(state) : null,
    }),
  });
}

export function parseState(item: HistoryItem): PipelineState | null {
  if (!item.state_json) return null;
  try {
    return JSON.parse(item.state_json) as PipelineState;
  } catch {
    return null;
  }
}
