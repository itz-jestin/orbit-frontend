// Streaming client for the Python multi-agent research backend.
//
// The backend exposes POST /research which returns a
// `text/event-stream` response. Each SSE frame is a JSON object shaped
// like: { "<node_name>": { ...full pipeline state... } } for every
// LangGraph node that runs (planner, researcher, writer,
// grounding_check, critic), a final { "done": true } frame, or an
// { "error": "..." } frame if the pipeline fails.
//
// EventSource only supports GET requests, so we use fetch() + a
// ReadableStream reader and parse the "data: ...\n\n" frames manually.

export const API_BASE_URL =
  (import.meta.env.VITE_RESEARCH_API_URL as string | undefined) ??
  "http://localhost:8000";

export interface ResearchResultItem {
  question: string;
  answer: string;
  sources: string[];
}

export interface Critique {
  score?: number | null;
  coverage?: number | null;
  clarity?: number | null;
  structure?: number | null;
  source_quality?: number | null;
  accuracy_issue_found?: boolean;
  feedback?: string;
  question_issues?: { question: string; issue: string }[];
  approved?: boolean;
  review_skipped?: boolean;
  force_stop?: boolean;
}

export interface PipelineState {
  query?: string;
  resolved_entity?: string;
  sub_questions?: string[];
  research_results?: ResearchResultItem[];
  critique?: Critique;
  feedback?: string;
  retries?: number;
  final_report?: string;
  revised?: boolean;
}

export type NodeName =
  | "planner"
  | "researcher"
  | "writer"
  | "grounding_check"
  | "critic";

const KNOWN_NODES: NodeName[] = [
  "planner",
  "researcher",
  "writer",
  "grounding_check",
  "critic",
];

export interface StreamEvent {
  node: NodeName;
  state: PipelineState;
}

export interface StreamCallbacks {
  onEvent: (event: StreamEvent) => void;
  onDone: (finalState: PipelineState | null) => void;
  onError: (error: Error) => void;
}

/**
 * Kicks off a research run and streams pipeline events as they happen.
 * Returns an AbortController so the caller can cancel the request
 * (e.g. if the user starts a new query or navigates away).
 */
export function streamResearch(
  query: string,
  { onEvent, onDone, onError }: StreamCallbacks,
): AbortController {
  const controller = new AbortController();

  (async () => {
    let lastState: PipelineState | null = null;

    try {
      const response = await fetch(`${API_BASE_URL}/research`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`Research request failed (${response.status})`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // SSE frames are separated by a blank line.
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";

        for (const frame of frames) {
          const line = frame.trim();
          // Skips keep-alive comments (": keepalive") and anything else non-data
          if (!line.startsWith("data:")) continue;

          const jsonStr = line.slice("data:".length).trim();
          if (!jsonStr) continue;

          let parsed: Record<string, unknown>;
          try {
            parsed = JSON.parse(jsonStr);
          } catch {
            continue; // skip malformed frames rather than crashing the stream
          }

          // Backend reported a pipeline failure
          if (typeof parsed.error === "string") {
            onError(new Error(parsed.error));
            return;
          }

          if (parsed.done) {
            onDone(lastState);
            return;
          }

          const [node, state] = Object.entries(parsed)[0] ?? [];
          if (!KNOWN_NODES.includes(node as NodeName) || typeof state !== "object" || !state) {
            continue; // ignore anything that isn't a pipeline step
          }
          lastState = state as PipelineState;
          onEvent({ node: node as NodeName, state: lastState });
        }
      }

      // Stream ended without an explicit "done" frame.
      if (lastState?.final_report) {
        onDone(lastState);
      } else {
        onError(
          new Error(
            "The connection closed before the report was finished. Please try again.",
          ),
        );
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      onError(err instanceof Error ? err : new Error(String(err)));
    }
  })();

  return controller;
}
