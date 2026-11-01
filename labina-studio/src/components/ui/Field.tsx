import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

export const inputClass =
  "w-full rounded-2xl border-2 border-line bg-paper px-4 py-3 text-ink placeholder:text-ink-soft/60 transition-colors duration-200 hover:border-plum/25 focus:border-plum focus:outline-none aria-[invalid=true]:border-coral";

export function Label({ htmlFor, children, optional, className }: { htmlFor?: string; children: ReactNode; optional?: boolean; className?: string }) {
  return (
    <label htmlFor={htmlFor} className={cn("mb-2 block text-sm font-semibold text-ink", className)}>
      {children}
      {optional && <span className="ms-1.5 font-normal text-ink-soft">(اختياري)</span>}
    </label>
  );
}

export function FieldError({ id, message }: { id?: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 text-sm font-medium text-coral-ink">
      {message}
    </p>
  );
}

export function Hint({ children }: { children: ReactNode }) {
  return <p className="mt-1.5 text-xs text-ink-soft">{children}</p>;
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(inputClass, "h-12", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(inputClass, "min-h-28 resize-y leading-7", className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select className={cn(inputClass, "h-12 cursor-pointer appearance-none bg-[length:1rem] bg-[left_1rem_center] bg-no-repeat pe-4 ps-10", className)}
      style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2349285D' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }}
      {...props}>
      {children}
    </select>
  );
}
