import { Search } from "lucide-react";
import { Input } from "./input";
import { cn } from "@/lib/utils";

interface SearchInputProps extends Omit<React.ComponentProps<typeof Input>, "type"> {
  containerClassName?: string;
}

/**
 * Standard search field — leading icon + Input, per design.md's "leading
 * icon inside an input" pattern (already used by sign-in's email/lock
 * fields). Use this anywhere a list/board needs a filter-by-text box
 * (Contacts, Pipeline) instead of hand-rolling the icon+padding each time.
 */
export function SearchInput({ className, containerClassName, ...props }: SearchInputProps) {
  return (
    <div className={cn("relative", containerClassName)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input type="search" className={cn("pl-9", className)} {...props} />
    </div>
  );
}
