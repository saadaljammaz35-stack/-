import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** Buttons at the end side; they wrap under the title on phones. */
  actions?: ReactNode;
  /** Small content above the title (back link, breadcrumb, badge). */
  eyebrow?: ReactNode;
  className?: string;
}

/** The page's <h1>. One per page. */
export function PageHeader({ title, description, actions, eyebrow, className }: PageHeaderProps) {
  return (
    <header className={cn("mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow && <div className="mb-2">{eyebrow}</div>}
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-[1.75rem]">{title}</h1>
        {description && (
          <p className="mt-1.5 max-w-2xl text-[0.9375rem] leading-relaxed text-slate-600">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
