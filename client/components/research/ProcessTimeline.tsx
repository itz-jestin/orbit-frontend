import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ResearchStep {
  id: string;
  label: string;
  detail: string;
  icon: LucideIcon;
}

export type StepState = "pending" | "active" | "done";

export default function ProcessTimeline({
  steps,
  activeIndex,
}: {
  steps: ResearchStep[];
  activeIndex: number;
}) {
  return (
    <ol className="relative flex flex-col gap-1">
      {steps.map((step, i) => {
        const state: StepState =
          i < activeIndex ? "done" : i === activeIndex ? "active" : "pending";
        const Icon = step.icon;

        return (
          <li key={step.id} className="relative flex gap-4 pb-7 last:pb-0">
            {i < steps.length - 1 && (
              <span className="absolute left-[15px] top-8 h-[calc(100%-1.5rem)] w-px bg-border">
                <motion.span
                  className="block w-full bg-primary origin-top"
                  initial={{ height: "0%" }}
                  animate={{ height: state === "done" ? "100%" : "0%" }}
                  transition={{ duration: 0.5, ease: "easeInOut" }}
                />
              </span>
            )}

            <span
              className={cn(
                "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors duration-300",
                state === "done" &&
                  "border-primary bg-primary text-primary-foreground",
                state === "active" &&
                  "border-primary bg-primary/15 text-primary",
                state === "pending" &&
                  "border-border bg-card text-muted-foreground",
              )}
            >
              {state === "done" ? (
                <Check className="h-4 w-4" />
              ) : state === "active" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Icon className="h-4 w-4" />
              )}
            </span>

            <div className="pt-0.5">
              <p
                className={cn(
                  "font-display text-sm font-semibold transition-colors duration-300",
                  state === "pending" ? "text-muted-foreground" : "text-foreground",
                )}
              >
                {step.label}
              </p>
              <AnimatePresence mode="wait">
                {state !== "pending" && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35 }}
                    className="mt-1 text-sm text-muted-foreground"
                  >
                    {step.detail}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
