import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";
import { Link, type LinkProps } from "react-router";
import { cn } from "@/lib/cn";
import { Spinner } from "./Spinner";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const BASE =
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-xl font-bold whitespace-nowrap select-none transition-colors " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-55 " +
  "aria-disabled:cursor-not-allowed aria-disabled:opacity-55";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-white shadow-sm hover:bg-primary-hover active:bg-primary-active focus-visible:outline-primary",
  secondary:
    "bg-mint text-accent-strong hover:bg-emerald-100 active:bg-emerald-200 focus-visible:outline-accent-strong",
  outline:
    "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 active:bg-slate-100 focus-visible:outline-primary",
  ghost: "text-slate-700 hover:bg-slate-100 active:bg-slate-200 focus-visible:outline-primary",
  danger:
    "bg-red-600 text-white shadow-sm hover:bg-red-700 active:bg-red-800 focus-visible:outline-red-600",
};

// 44px minimum on touch screens (Apple HIG); smaller "sm" only with a fine pointer.
const SIZES: Record<ButtonSize, string> = {
  sm: "min-h-9 px-3 text-sm pointer-coarse:min-h-11",
  md: "min-h-11 px-4 text-[0.9375rem]",
  lg: "min-h-12 px-6 text-base",
};

export interface ButtonStyleOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string | undefined;
}

/** Button classes for elements that are not <Button>/<ButtonLink> (e.g. <a href>). */
export function buttonClasses({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
}: ButtonStyleOptions = {}): string {
  return cn(BASE, VARIANTS[variant], SIZES[size], fullWidth && "w-full", className);
}

interface ContentProps {
  loading?: boolean | undefined;
  /** Icon before the label (start side). Use `className="flip-rtl"` on directional icons. */
  icon?: ReactNode;
  /** Icon after the label (end side). */
  trailingIcon?: ReactNode;
  children?: ReactNode;
}

function ButtonContent({ loading, icon, trailingIcon, children }: ContentProps) {
  return (
    <>
      {loading ? <Spinner size="sm" /> : icon}
      {children}
      {!loading && trailingIcon}
    </>
  );
}

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, Omit<ButtonStyleOptions, "className">, ContentProps {
  ref?: Ref<HTMLButtonElement>;
}

/**
 * <Button variant="primary|secondary|outline|ghost|danger" size="sm|md|lg" loading>
 * While `loading`, the button is disabled and shows a spinner; keep the label
 * meaningful ("Saving…").
 */
export function Button({
  variant,
  size,
  fullWidth,
  loading = false,
  icon,
  trailingIcon,
  className,
  disabled,
  type = "button",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses({ variant, size, fullWidth, className })}
      {...rest}
    >
      <ButtonContent loading={loading} icon={icon} trailingIcon={trailingIcon}>
        {children}
      </ButtonContent>
    </button>
  );
}

export interface ButtonLinkProps
  extends Omit<LinkProps, "className">, Omit<ButtonStyleOptions, "className">, Omit<ContentProps, "loading"> {
  className?: string;
}

/** A react-router <Link> that looks like a button: <ButtonLink to="/register">…</ButtonLink> */
export function ButtonLink({
  variant,
  size,
  fullWidth,
  icon,
  trailingIcon,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link className={buttonClasses({ variant, size, fullWidth, className })} {...rest}>
      <ButtonContent icon={icon} trailingIcon={trailingIcon}>
        {children}
      </ButtonContent>
    </Link>
  );
}
