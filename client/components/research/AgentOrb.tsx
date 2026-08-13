import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type OrbStatus = "idle" | "thinking" | "done";

export default function AgentOrb({
  status,
  className,
}: {
  status: OrbStatus;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex items-center justify-center",
        className,
      )}
    >
      <div
        className={cn(
          "absolute h-full w-full rounded-full blur-2xl transition-colors duration-700",
          status === "idle" && "bg-primary/20",
          status === "thinking" && "bg-primary/40 animate-pulse-glow",
          status === "done" && "bg-secondary/40",
        )}
      />

      <div className="absolute h-[85%] w-[85%] rounded-full border border-primary/20 animate-spin-slow">
        <span className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-primary shadow-[0_0_12px_hsl(var(--primary))]" />
      </div>
      <div className="absolute h-[65%] w-[65%] rounded-full border border-secondary/25 animate-spin-reverse">
        <span className="absolute top-1/2 -right-1 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-secondary shadow-[0_0_10px_hsl(var(--secondary))]" />
      </div>

      <motion.div
        className="relative h-[42%] w-[42%] rounded-full bg-gradient-to-br from-primary via-primary to-secondary shadow-[0_0_50px_hsl(var(--primary)/0.55)]"
        animate={
          status === "thinking"
            ? { scale: [1, 1.08, 1] }
            : { scale: 1 }
        }
        transition={{
          duration: 1.6,
          repeat: status === "thinking" ? Infinity : 0,
          ease: "easeInOut",
        }}
      >
        <div className="absolute inset-[18%] rounded-full bg-background/30 backdrop-blur-sm" />
      </motion.div>
    </div>
  );
}
