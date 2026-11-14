import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Brain,
  Download,
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
import { downloadReportPdf } from "@/lib/report-pdf";
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
      if (!c) return "Reviewing the report...";
      if (c.review_skipped || c.score == null)
