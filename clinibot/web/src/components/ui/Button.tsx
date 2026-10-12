import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";
import { Link, type LinkProps } from "react-router";
import { buttonClasses, type ButtonStyleOptions } from "./buttonStyles";
import { Spinner } from "./Spinner";

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
  extends
    ButtonHTMLAttributes<HTMLButtonElement>,
    Omit<ButtonStyleOptions, "className">,
    ContentProps {
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
  extends
    Omit<LinkProps, "className">,
    Omit<ButtonStyleOptions, "className">,
    Omit<ContentProps, "loading"> {
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
