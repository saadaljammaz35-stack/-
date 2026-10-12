import { cn } from "@/lib/cn";

/** Placeholder block while data loads. Size it with className (e.g. "h-5 w-32"). */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded-lg bg-slate-200/80", className)} aria-hidden="true" />
  );
}

/** A few lines of text-shaped skeletons. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2.5", className)} aria-hidden="true">
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} className={cn("h-4", index === lines - 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}
