import type { ComponentType, ReactNode, SVGProps } from "react";
import { cn } from "@/lib/cn";

export interface EmptyStateProps {
  /** A lucide icon component, e.g. `icon={Inbox}`. */
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  title: ReactNode;
  text?: ReactNode;
  /** Usually a <Button> or <ButtonLink>. */
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, text, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-12 text-center", className)}>
      {Icon && (
        <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-mint text-accent-strong">
          <Icon className="size-7" aria-hidden="true" />
        </div>
      )}
      <h3 className="text-base font-extrabold text-slate-900">{title}</h3>
      {text && <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-slate-600">{text}</p>}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}
