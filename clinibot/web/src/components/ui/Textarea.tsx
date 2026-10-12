import type { Ref, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { useFieldControl } from "./Field";
import { controlClasses } from "./Input";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  ref?: Ref<HTMLTextAreaElement>;
}

export function Textarea({ className, rows = 4, ref, ...props }: TextareaProps) {
  const merged = useFieldControl(props);
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(controlClasses, "py-2.5 leading-relaxed", className)}
      {...merged}
    />
  );
}
