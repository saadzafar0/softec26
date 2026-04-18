import * as React from "react";
import { cn } from "@/lib/utils";

type Tone = "default" | "red" | "orange" | "yellow" | "green" | "muted";

const tones: Record<Tone, string> = {
  default: "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50",
  red: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  orange:
    "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200",
  yellow:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-200",
  green: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200",
  muted: "bg-zinc-50 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400",
};

export function Badge({
  className,
  tone = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
