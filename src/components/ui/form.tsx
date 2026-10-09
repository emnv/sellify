import type { ComponentProps, ReactNode } from "react";
import { cx } from "./cx";

/*
 * Form controls. Every input sits inside a <Field>, which owns the label,
 * hint and error text and links them for screen readers by `id`.
 */

const control =
  "block w-full rounded-md border bg-surface px-3 text-body text-fg placeholder:text-fg-subtle " +
  "transition-colors ease-standard focus:border-accent focus:outline-none focus-visible:outline-none " +
  "focus:ring-2 focus:ring-accent/30 disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-fg-subtle " +
  "aria-invalid:border-danger aria-invalid:focus:ring-danger/30";

type FieldProps = {
  /** Must match the control's `id`. */
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  /** Visually hide the label (keep it for screen readers), e.g. a search box. */
  hideLabel?: boolean;
  children: ReactNode;
};

export function Field({ id, label, hint, error, required, hideLabel, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={cx("text-body font-medium text-fg", hideLabel && "sr-only")}>
        {label}
        {required ? <span className="text-danger-fg"> *</span> : null}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-small text-danger-fg">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-small text-fg-subtle">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

type ControlExtras = { invalid?: boolean; hasHint?: boolean };

function describedBy(id: string | undefined, { invalid, hasHint }: ControlExtras) {
  if (!id) return undefined;
  if (invalid) return `${id}-error`;
  if (hasHint) return `${id}-hint`;
  return undefined;
}

type InputProps = Omit<ComponentProps<"input">, "className" | "style" | "size"> & ControlExtras & {
  /** Text shown inside the field before the value, e.g. "€". */
  prefix?: string;
  /** Text shown inside the field after the value, e.g. "%" or "min". */
  suffix?: string;
};

export function Input({ invalid, hasHint, prefix, suffix, ...props }: InputProps) {
  const input = (
    <input
      {...props}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy(props.id, { invalid, hasHint })}
      data-ui="input"
      className={cx(control, "h-10", invalid ? "border-danger" : "border-border-strong", prefix && "pl-8", suffix && "pr-12")}
    />
  );
  if (!prefix && !suffix) return input;
  const affix = "pointer-events-none absolute inset-y-0 flex items-center text-body text-fg-subtle";
  return (
    <div className="relative">
      {prefix ? <span aria-hidden="true" className={cx(affix, "left-3")}>{prefix}</span> : null}
      {input}
      {suffix ? <span aria-hidden="true" className={cx(affix, "right-3")}>{suffix}</span> : null}
    </div>
  );
}

type TextareaProps = Omit<ComponentProps<"textarea">, "className" | "style"> & ControlExtras;

export function Textarea({ invalid, hasHint, rows = 4, ...props }: TextareaProps) {
  return (
    <textarea
      {...props}
      rows={rows}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy(props.id, { invalid, hasHint })}
      className={cx(control, "py-2", invalid ? "border-danger" : "border-border-strong")}
    />
  );
}

type SelectProps = Omit<ComponentProps<"select">, "className" | "style" | "size"> & ControlExtras & {
  /** First, empty option, e.g. "Choose a model". */
  placeholder?: string;
};

/** Dropdown. Native <select> for accessibility and mobile pickers. */
export function Select({ invalid, hasHint, placeholder, children, ...props }: SelectProps) {
  return (
    <div className="relative">
      <select
        {...props}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy(props.id, { invalid, hasHint })}
        className={cx(control, "h-10 appearance-none pr-9", invalid ? "border-danger" : "border-border-strong")}
      >
        {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
        {children}
      </select>
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-fg-subtle"
        fill="currentColor"
      >
        <path d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z" />
      </svg>
    </div>
  );
}

type SwitchProps = Omit<ComponentProps<"input">, "className" | "style" | "type" | "size"> & {
  label: string;
  description?: string;
};

/** On/off setting (e.g. "Show online", "Publish store"). A checkbox with role="switch". */
export function Switch({ label, description, id, ...props }: SwitchProps) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start justify-between gap-4">
      <span className="flex flex-col gap-0.5">
        <span className="text-body font-medium text-fg">{label}</span>
        {description ? <span className="text-small text-fg-subtle">{description}</span> : null}
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input {...props} id={id} type="checkbox" role="switch" className="peer sr-only" />
        <span
          aria-hidden="true"
          className={
            "h-6 w-11 rounded-full bg-border-strong transition-colors ease-standard " +
            "peer-checked:bg-primary peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 " +
            "peer-focus-visible:outline-accent peer-disabled:opacity-50"
          }
        />
        <span
          aria-hidden="true"
          className="absolute top-1 left-1 size-4 rounded-full bg-white shadow-card transition-transform ease-standard peer-checked:translate-x-5"
        />
      </span>
    </label>
  );
}

type CheckboxProps = Omit<ComponentProps<"input">, "className" | "style" | "type" | "size"> & { label: string };

export function Checkbox({ label, id, ...props }: CheckboxProps) {
  return (
    <label htmlFor={id} className="inline-flex cursor-pointer items-center gap-2 text-body text-fg">
      <input {...props} id={id} type="checkbox" className="size-4 rounded-sm border-border-strong accent-primary" />
      {label}
    </label>
  );
}

/** Hidden form value (ids, return paths). */
export function HiddenField({ name, value }: { name: string; value: string | number }) {
  return <input type="hidden" name={name} value={value} />;
}

/** Vertical stack of fields with consistent spacing. */
export function FormStack({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-4">{children}</div>;
}

/** Two (or three) short fields side by side from tablet width up. */
export function FormRow({ cols = 2, children }: { cols?: 2 | 3; children: ReactNode }) {
  return <div className={cx("grid grid-cols-1 gap-4", cols === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3")}>{children}</div>;
}

/** Bottom row of a form: actions aligned right. */
export function FormActions({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center justify-end gap-3 pt-2">{children}</div>;
}
