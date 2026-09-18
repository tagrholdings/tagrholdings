import { cn } from "@/lib/utils";

// bg-muted, not the raw bg-paper-2 brand token — --muted already flips for
// dark mode (equals --paper-2 in light mode, so this looks identical there)
// while --paper-2 itself is a fixed brand constant and stayed the light tan
// color even on a dark background, which is the "wrong colors" bug.
export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} {...props} />;
}
