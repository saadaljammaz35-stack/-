import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface CardProps extends HTMLAttributes<HTMLElement> {
  /** Render as <section> (default <div>) when the card has its own heading. */
  as?: "div" | "section" | "article";
}

/** White surface with border and soft shadow. Compose with CardHeader / CardBody / CardFooter. */
export function Card({ as: Tag = "div", className, ...props }: CardProps) {
  return (
    <Tag
      className={cn("rounded-2xl border border-slate-200 bg-white shadow-card", className)}
      {...props}
    />
  );
}

export interface CardHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** Buttons at the end side of the header. */
  actions?: ReactNode;
  /** Heading level for the title (default h2). */
  level?: 2 | 3;
  className?: string;
}

export function CardHeader({ title, description, actions, level = 2, className }: CardHeaderProps) {
  const Heading = level === 2 ? "h2" : "h3";
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <Heading className="text-base font-extrabold text-slate-900">{title}</Heading>
        {description && <p className="mt-1 text-sm leading-relaxed text-slate-600">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 py-5 sm:px-6", className)} {...props} />;
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-end gap-2 rounded-b-2xl border-t border-slate-100 bg-slate-50/60 px-5 py-3.5 sm:px-6",
        className,
      )}
      {...props}
    />
  );
}
