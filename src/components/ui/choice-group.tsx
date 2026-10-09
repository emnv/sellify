import type { ChangeEvent } from "react";
import { cx } from "./cx";

type Option = { value: string; label: string };

type ChoiceGroupProps = {
  /** Form field name. The selected value is submitted with the form. */
  name: string;
  label: string;
  options: Option[];
  /** Controlled value (with onChange), or use defaultValue. */
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
};

/**
 * Pick one of a few options (Cash / Card). Native radio buttons styled as
 * pills, in a fieldset with a legend: keyboard arrows and screen readers work.
 * Same size and selected style as filter pills.
 */
export function ChoiceGroup({ name, label, options, value, defaultValue, onChange }: ChoiceGroupProps) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-body font-medium text-fg">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const id = `${name}-${o.value}`;
          return (
            <span key={o.value}>
              <input
                id={id}
                type="radio"
                name={name}
                value={o.value}
                className="peer sr-only"
                {...(value !== undefined
                  ? { checked: value === o.value, onChange: (e: ChangeEvent<HTMLInputElement>) => onChange?.(e.target.value) }
                  : { defaultChecked: defaultValue === o.value })}
              />
              <label
                htmlFor={id}
                data-ui="pill"
                className={cx(
                  "inline-flex h-8 cursor-pointer items-center rounded-full border px-3 text-small font-medium whitespace-nowrap transition-colors ease-standard",
                  "border-border bg-surface text-fg-muted hover:border-border-strong hover:text-fg",
                  "peer-checked:border-brand-soft peer-checked:bg-brand-soft peer-checked:text-brand-strong",
                  "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent",
                )}
              >
                {o.label}
              </label>
            </span>
          );
        })}
      </div>
    </fieldset>
  );
}
