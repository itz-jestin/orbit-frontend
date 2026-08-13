import { useMemo } from "react";

export default function BackgroundField() {
  const particles = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        top: Math.random() * 100,
        size: 2 + Math.random() * 3,
        duration: 5 + Math.random() * 6,
        delay: Math.random() * 5,
      })),
    [],
  );

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background">
      <div
        className="absolute inset-0 opacity-[0.07] animate-grid-pan"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      <div className="absolute -top-40 left-1/4 h-[32rem] w-[32rem] rounded-full bg-primary/25 blur-[120px]" />
      <div className="absolute -bottom-40 right-1/4 h-[28rem] w-[28rem] rounded-full bg-secondary/20 blur-[120px]" />

      {particles.map((p) => (
        <span
          key={p.id}
          className="absolute rounded-full bg-primary/40 animate-float"
          style={{
            left: `${p.left}%`,
            top: `${p.top}%`,
            width: p.size,
            height: p.size,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}

      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/40 to-background" />
    </div>
  );
}
