import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cx } from "./cx";
import { Spinner } from "./spinner";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

const base =
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap font-medium " +
  "transition-colors ease-standard disabled:cursor-not-allowed disabled:opacity-50 " +
  "aria-disabled:pointer-events-none aria-disabled:opacity-50";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-primary text-fg-inverse shadow-primary hover:bg-primary-hover",
  secondary: "border border-border-strong bg-surface text-fg hover:bg-surface-muted",
  ghost: "text-fg-muted hover:bg-surface-muted hover:text-fg",
  danger: "bg-danger text-fg-inverse hover:bg-danger-hover",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 rounded-md px-3 text-small",
  md: "h-10 rounded-lg px-4 text-body",
};

type Common = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Stretch to the container width (forms, modals on mobile). */
  fullWidth?: boolean;
  /** Shows a spinner and blocks clicks. */
  loading?: boolean;
  icon?: ReactNode;
  children: ReactNode;
};

type AsButton = Common & Omit<ComponentProps<"button">, "className" | "style" | "children"> & { href?: undefined };
type AsLink = Common & Omit<ComponentProps<typeof Link>, "className" | "style" | "children"> & { href: string };

export function buttonClasses(variant: ButtonVariant = "primary", size: ButtonSize = "md", fullWidth = false) {
  return cx(base, variants[variant], sizes[size], fullWidth && "w-full");
}

/**
 * The only button in the backend. One primary action per page or form.
 * Pass `href` to render a link that looks like a button.
 */
export function Button(props: AsButton | AsLink) {
  const { variant = "primary", size = "md", fullWidth, loading, icon, children, ...rest } = props;
  const className = buttonClasses(variant, size, fullWidth);
  const dataUi = `button-${variant}-${size}`;
  const content = (
    <>
      {loading ? <Spinner /> : icon}
      {children}
    </>
  );

  if (rest.href !== undefined) {
    return (
      <Link {...(rest as Omit<AsLink, keyof Common>)} className={className} data-ui={dataUi} aria-disabled={loading || undefined}>
        {content}
      </Link>
    );
  }

  const { type = "button", disabled, ...buttonRest } = rest as Omit<AsButton, keyof Common>;
  return (
    <button
      {...buttonRest}
      type={type}
      className={className}
      data-ui={dataUi}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {content}
    </button>
  );
}
