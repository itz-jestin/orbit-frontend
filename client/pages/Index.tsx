import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Brain,
  ExternalLink,
  FileText,
  History as HistoryIcon,
  Info,
  Orbit as OrbitIcon,
  RotateCcw,
  Search,
  Shuffle,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import BackgroundField from "@/components/research/BackgroundField";
import AgentOrb from "@/components/research/AgentOrb";
import ProcessTimeline, {
  ResearchStep,
} from "@/components/research/ProcessTimeline";
import {
  streamResearch,
  type NodeName,
  type PipelineState,
} from "@/lib/research-stream";
import { getUser, subscribeAuth, type User } from "@/lib/auth";
import { saveHistory, parseState, type HistoryItem } from "@/lib/history";
import AuthDialog from "@/components/auth/AuthDialog";
import ProfileMenu from "@/components/auth/ProfileMenu";
import HistorySheet from "@/components/history/HistorySheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type Phase = "idle" | "running" | "done";

const SUGGESTIONS = [
  "What are the leading approaches to fusion energy?",
  "How is CRISPR being used to treat disease today?",
  "What's driving the growth of the space economy?",
];

// Order the real backend pipeline runs in. grounding_check is an
// automated pass that happens between the writer and the critic, so it
// shares the "review" timeline step with the critic rather than getting
// its own row.
const NODE_TO_STEP_ID: Record<NodeName, string> = {
  planner: "parse",
  researcher: "search",
  writer: "synthesize",
  grounding_check: "review",
  critic: "review",
};

const STEP_ORDER = ["parse", "search", "synthesize", "review"];

function baseSteps(): ResearchStep[] {
  return [
    {
      id: "parse",
      label: "Parsing intent",
      detail: "Breaking your question down into searchable sub-questions.",
      icon: Brain,
    },
    {
      id: "search",
      label: "Researching sub-questions",
      detail: "Searching the web and reading sources for each sub-question.",
      icon: Search,
    },
    {
      id: "synthesize",
      label: "Drafting the report",
      detail: "Synthesizing findings into a structured report.",
      icon: FileText,
    },
    {
      id: "review",
      label: "Reviewing & fact-checking",
      detail: "Checking grounding, accuracy, and source quality.",
      icon: Shuffle,
    },
  ];
}

function stepDetailFor(node: NodeName, state: PipelineState): string {
  switch (node) {
    case "planner":
      return state.sub_questions?.length
        ? `Broke the question into ${state.sub_questions.length} sub-questions.`
        : "Breaking your question down into searchable sub-questions.";
    case "researcher":
      return state.research_results?.length
        ? `Gathered findings for ${state.research_results.length} sub-questions.`
        : "Searching the web and reading sources for each sub-question.";
    case "writer":
      return state.revised
        ? "Revising the report based on reviewer feedback..."
        : "Drafting the initial report from the research findings...";
    case "grounding_check":
      return "Running an automated check for fabricated quotes, dates, and citations...";
    case "critic": {
      const c = state.critique;
      if (!c || c.score === undefined) return "Reviewing the report...";
      return c.approved
        ? `Report approved — score ${c.score}/100.`
        : `Reviewer flagged issues (score ${c.score}/100). Sending back for revision...`;
    }
    default:
      return "";
  }
}

interface SourceCard {
  domain: string;
  url: string;
  title: string;
  snippet: string;
}

function buildSourceCards(state: PipelineState | null): SourceCard[] {
  if (!state?.research_results) return [];

  const seen = new Set<string>();
  const cards: SourceCard[] = [];

  for (const result of state.research_results) {
    for (const url of result.sources ?? []) {
      let domain = url;
      try {
        domain = new URL(url).hostname.replace(/^www\./, "");
      } catch {
        // leave domain as the raw url if it doesn't parse
      }
      if (seen.has(domain)) continue;
      seen.add(domain);
      cards.push({
        domain,
        url,
        title: result.question,
        snippet:
          result.answer.slice(0, 160).trim() +
          (result.answer.length > 160 ? "..." : ""),
      });
    }
  }

  return cards;
}

// Minimal renderer for the report's markdown-ish output (the writer
// produces "# Heading" / "**bold**" style text) without pulling in a
// full markdown dependency.
function ReportBody({ text }: { text: string }) {
  const lines = text.split("\n");

  return (
    <div className="mt-4 space-y-3 text-[15px] leading-relaxed text-muted-foreground">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return null;

        const headingMatch = trimmed.match(/^#{1,3}\s+(.*)$/);
        const boldHeadingMatch = trimmed.match(/^\*\*(.+)\*\*$/);

        if (headingMatch || boldHeadingMatch) {
          const label = (
            headingMatch?.[1] ??
            boldHeadingMatch?.[1] ??
            ""
          ).replace(/\*\*/g, "");
          return (
            <p
              key={i}
              className="pt-2 text-base font-semibold text-foreground first:pt-0"
            >
              {label}
            </p>
          );
        }

        // Strip stray markdown bold markers for inline text.
        const clean = trimmed.replace(/\*\*(.*?)\*\*/g, "$1");
        return <p key={i}>{clean}</p>;
      })}
    </div>
  );
}

export default function Index() {
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [activeIndex, setActiveIndex] = useState(0);
  const [stepDetails, setStepDetails] = useState<Record<string, string>>({});
  const [pipelineState, setPipelineState] = useState<PipelineState | null>(
    null,
  );
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const [user, setUser] = useState<User | null>(() => getUser());
  const [authOpen, setAuthOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [pendingQuery, setPendingQuery] = useState<string | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);

  useEffect(() => subscribeAuth(setUser), []);

  const steps = useMemo<ResearchStep[]>(() => {
    return baseSteps().map((s) => ({
      ...s,
      detail: stepDetails[s.id] ?? s.detail,
    }));
  }, [stepDetails]);

  const sources = useMemo(
    () => buildSourceCards(pipelineState),
    [pipelineState],
  );

  useEffect(() => {
    return () => controllerRef.current?.abort();
  }, []);

  // Gate every search behind login. If the user isn't logged in, we
  // stash the query and open the auth dialog; AuthDialog's onSuccess
  // calls this again once login/register succeeds, at which point
  // getUser() returns the user and the actual run proceeds below.
  const attemptRunQuery = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;

    if (!getUser()) {
      setPendingQuery(trimmed);
      setAuthOpen(true);
      return;
    }

    controllerRef.current?.abort();

    setSubmittedQuery(trimmed);
    setActiveIndex(0);
    setStepDetails({});
    setPipelineState(null);
    setPhase("running");

    controllerRef.current = streamResearch(trimmed, {
      onEvent: ({ node, state }) => {
        setPipelineState(state);

        const stepId = NODE_TO_STEP_ID[node];
        const stepIndex = STEP_ORDER.indexOf(stepId);
        if (stepIndex >= 0) {
          setActiveIndex((prev) => Math.max(prev, stepIndex));
        }

        setStepDetails((prev) => ({
          ...prev,
          [stepId]: stepDetailFor(node, state),
        }));
      },
      onDone: (finalState) => {
        if (finalState) setPipelineState(finalState);
        setActiveIndex(STEP_ORDER.length);
        setPhase("done");

        if (getUser() && finalState?.final_report) {
          saveHistory(trimmed, finalState.final_report, finalState).catch(
            () => {
              // Non-fatal - the run already completed and is on screen,
              // it just won't show up in history.
            },
          );
        }
      },
      onError: (err) => {
        toast.error("Research failed", { description: err.message });
        setPhase("idle");
      },
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    attemptRunQuery(query);
  };

  const reset = () => {
    controllerRef.current?.abort();
    setPhase("idle");
    setQuery("");
    setSubmittedQuery("");
    setActiveIndex(0);
    setStepDetails({});
    setPipelineState(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const loadFromHistory = (item: HistoryItem) => {
    controllerRef.current?.abort();
    const state = parseState(item);
    setSubmittedQuery(item.query);
    setPipelineState(state);
    setStepDetails({});
    setActiveIndex(STEP_ORDER.length);
    setPhase("done");
  };

  const orbStatus =
    phase === "running" ? "thinking" : phase === "done" ? "done" : "idle";
  const currentStepLabel =
    phase === "running" && steps[activeIndex]
      ? steps[activeIndex].detail
      : phase === "done"
        ? pipelineState?.critique?.approved === false
          ? "Research complete (reviewer flagged unresolved issues)."
          : "Research complete."
        : "Awaiting your question.";

  const critique = pipelineState?.critique;
  const retries = pipelineState?.retries ?? 0;

  return (
    <div className="relative min-h-screen">
      <BackgroundField />

      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-lg">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-6">
            <button onClick={reset} className="flex items-center gap-2">
              <motion.span
                className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-secondary text-primary-foreground shadow-[0_0_20px_hsl(var(--primary)/0.5)]"
                whileHover={{ scale: 1.1 }}
                transition={{ type: "spring", stiffness: 400, damping: 10 }}
              >
                <OrbitIcon className="h-4 w-4" />
              </motion.span>
              <span className="font-display text-lg font-semibold tracking-tight">
                Orbit
              </span>
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setAboutOpen(true)}
              className="hidden items-center gap-1.5 rounded-full border border-border/70 bg-card/60 px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:bg-card hover:text-foreground hover:shadow-[0_0_12px_hsl(var(--primary)/0.25)] sm:flex"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-secondary animate-pulse" />
              Autonomous research agent
              <Info className="h-3 w-3 opacity-60" />
            </button>
            <motion.button
              onClick={() => {
                if (!user) {
                  setAuthOpen(true);
                  return;
                }
                setHistoryOpen(true);
              }}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              whileHover={{ backgroundColor: "hsl(var(--muted))" }}
              whileTap={{ scale: 0.95 }}
            >
              <HistoryIcon className="h-4 w-4" />
              <span className="hidden lg:inline">History</span>
            </motion.button>
            <ProfileMenu user={user} onRequestAuth={() => setAuthOpen(true)} />
          </div>
        </div>
      </header>

      <AuthDialog
        open={authOpen}
        onOpenChange={setAuthOpen}
        onSuccess={() => {
          if (pendingQuery) {
            const q = pendingQuery;
            setPendingQuery(null);
            attemptRunQuery(q);
          }
        }}
      />
      <HistorySheet
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        user={user}
        onSelect={loadFromHistory}
      />

      <Dialog open={aboutOpen} onOpenChange={setAboutOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>About Orbit</DialogTitle>
            <DialogDescription>
              An autonomous research agent that plans, searches, reads,
              and cross-checks sources in real time.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              Orbit takes your question, breaks it into sub-questions,
              searches the web and reads sources for each one, drafts a
              structured report, then runs an automated grounding check
              and a critic pass before handing back a clear, cited
              answer — with every step visible as it happens.
            </p>
            <p>
              Every research run is saved to your account so you can
              revisit past reports at any time.
            </p>
          </div>
          <div className="mt-2 border-t border-border pt-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Developed by
            </p>
            <p className="mt-1 text-sm font-medium text-foreground">
              Jestin Monachan, Rijo Thomas, Vishakha Patki, Joel Varghese
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <main className="container relative py-6 md:py-10">
        <AnimatePresence mode="wait">
          {phase === "idle" ? (
            <motion.section
              key="landing"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.4 }}
              className="mx-auto flex max-w-3xl flex-col items-center pt-4 text-center md:pt-8"
            >
              <AgentOrb
                status="idle"
                className="mb-6 h-40 w-40 md:h-48 md:w-48"
              />

              <span className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                Watch the research happen, live
              </span>

              <h1 className="font-display text-4xl font-bold tracking-tight md:text-6xl">
                Ask anything.
                <br />
                <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                  Watch Orbit think.
                </span>
              </h1>

              <p className="mt-5 max-w-xl text-balance text-base text-muted-foreground md:text-lg">
                Orbit is a research agent that plans, searches, reads and
                cross-checks sources in real time, then hands you a clear,
                cited answer.
              </p>

              <form
                onSubmit={handleSubmit}
                className="mt-10 w-full rounded-2xl border border-border bg-card/80 p-2 shadow-2xl shadow-black/20 backdrop-blur"
              >
                <Textarea
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      attemptRunQuery(query);
                    }
                  }}
                  placeholder="What do you want Orbit to research?"
                  rows={2}
                  className="resize-none border-0 bg-transparent text-base shadow-none focus-visible:ring-0"
                />
                <div className="flex items-center justify-end px-2 pb-1">
                  <Button
                    type="submit"
                    disabled={!query.trim()}
                    className="gap-2 rounded-xl bg-gradient-to-r from-primary to-secondary text-primary-foreground hover:opacity-90"
                  >
                    Start research
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </form>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => attemptRunQuery(s)}
                    className="rounded-full border border-border bg-card/50 px-3.5 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </motion.section>
          ) : (
            <motion.section
              key="session"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.4 }}
              className="grid gap-8 md:grid-cols-[minmax(0,340px)_1fr]"
            >
              <div className="md:sticky md:top-24 md:self-start">
                <div className="rounded-2xl border border-border bg-card/70 p-6 backdrop-blur">
                  <AgentOrb
                    status={orbStatus}
                    className="mx-auto mb-6 h-32 w-32"
                  />

                  <p className="text-center text-xs uppercase tracking-wider text-muted-foreground">
                    Researching
                  </p>
                  <h2 className="mt-1 text-center font-display text-lg font-semibold">
                    "{submittedQuery}"
                  </h2>
                  {retries > 0 && (
                    <p className="mt-1 text-center text-xs text-muted-foreground">
                      Revision {retries} in progress
                    </p>
                  )}

                  <AnimatePresence mode="wait">
                    <motion.p
                      key={currentStepLabel}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="mt-3 min-h-[2.5rem] text-center text-sm text-muted-foreground"
                    >
                      {currentStepLabel}
                      {phase === "running" && (
                        <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-primary align-middle" />
                      )}
                    </motion.p>
                  </AnimatePresence>

                  <div className="mt-6 border-t border-border pt-6">
                    <ProcessTimeline steps={steps} activeIndex={activeIndex} />
                  </div>

                  <Button
                    variant="outline"
                    onClick={reset}
                    className="mt-4 w-full gap-2"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Ask another question
                  </Button>
                </div>
              </div>

              <div>
                <AnimatePresence>
                  {phase === "done" && pipelineState?.final_report && (
                    <motion.div
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5 }}
                      className="space-y-6"
                    >
                      <div className="rounded-2xl border border-border bg-card/70 p-6 backdrop-blur md:p-8">
                        <div className="mb-4 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-sm font-medium text-secondary">
                            <Sparkles className="h-4 w-4" />
                            Answer
                          </div>
                          {critique?.score !== undefined && (
                            <span
                              className={cn(
                                "rounded-full border px-2.5 py-0.5 text-xs font-medium",
                                critique.approved
                                  ? "border-secondary/40 bg-secondary/10 text-secondary"
                                  : "border-yellow-500/40 bg-yellow-500/10 text-yellow-600",
                              )}
                            >
                              {critique.approved ? "Reviewed" : "Needs review"}{" "}
                              · {critique.score}/100
                            </span>
                          )}
                        </div>
                        <h3 className="font-display text-2xl font-semibold md:text-3xl">
                          {submittedQuery}
                        </h3>

                        <ReportBody text={pipelineState.final_report} />

                        {critique?.feedback && (
                          <div className="mt-6 rounded-xl border border-border bg-muted/30 p-4">
                            <p className="mb-2 text-sm font-semibold text-foreground">
                              Reviewer notes
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {critique.feedback}
                            </p>
                          </div>
                        )}
                      </div>

                      {sources.length > 0 && (
                        <div>
                          <p className="mb-3 text-sm font-medium text-muted-foreground">
                            Sources
                          </p>
                          <div className="grid gap-3 sm:grid-cols-2">
                            {sources.map((s, i) => (
                              <motion.a
                                key={s.url}
                                href={s.url}
                                target="_blank"
                                rel="noreferrer"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.05 * i, duration: 0.4 }}
                                className="group rounded-xl border border-border bg-card/60 p-4 transition-colors hover:border-primary/40"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                                    [{i + 1}] {s.domain}
                                  </span>
                                  <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                                </div>
                                <p className="mt-2 text-sm font-medium text-foreground">
                                  {s.title}
                                </p>
                                <p className="mt-1 text-sm text-muted-foreground">
                                  {s.snippet}
                                </p>
                              </motion.a>
                            ))}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}