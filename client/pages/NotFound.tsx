import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Orbit as OrbitIcon, ArrowLeft } from "lucide-react";
import BackgroundField from "@/components/research/BackgroundField";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname,
    );
  }, [location.pathname]);

  return (
    <div className="relative min-h-screen">
      <BackgroundField />

      <header className="border-b border-border/60 bg-background/70 backdrop-blur-lg">
        <div className="container flex h-16 items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-secondary text-primary-foreground shadow-[0_0_20px_hsl(var(--primary)/0.5)]">
            <OrbitIcon className="h-4 w-4" />
          </span>
          <span className="font-display text-lg font-semibold tracking-tight">
            Orbit
          </span>
        </div>
      </header>

      <main className="container flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center text-center">
        <p className="font-display text-7xl font-bold text-primary">404</p>
        <h1 className="mt-4 font-display text-2xl font-semibold">
          This page hasn't been researched yet
        </h1>
        <p className="mt-2 max-w-sm text-muted-foreground">
          Keep prompting Orbit to build this page out, or head back home.
        </p>
        <Button asChild className="mt-6 gap-2">
          <Link to="/">
            <ArrowLeft className="h-4 w-4" />
            Return home
          </Link>
        </Button>
      </main>
    </div>
  );
};

export default NotFound;
