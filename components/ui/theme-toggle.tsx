"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/ui/use-theme";
import { cn } from "@/lib/utils";

type ViewTransitionDocument = Document & {
  startViewTransition: (callback: () => void) => { ready: Promise<void> };
};

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    // Not all browsers support this yet (notably Firefox/Safari as of this
    // writing) — falls back to a plain instant swap, same end state.
    if (!("startViewTransition" in document)) {
      toggleTheme();
      return;
    }

    const x = e.clientX;
    const y = e.clientY;
    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    const transition = (document as ViewTransitionDocument).startViewTransition(() => toggleTheme());

    transition.ready.then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${endRadius}px at ${x}px ${y}px)`] },
        { duration: 500, easing: "ease-in-out", pseudoElement: "::view-transition-new(root)" }
      );
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted",
        className
      )}
    >
      {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}
