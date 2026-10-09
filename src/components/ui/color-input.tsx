"use client";

import { useState } from "react";
import { cx } from "./cx";

/**
 * Colour picker: swatch (native colour dialog) + hex text field, kept in sync.
 * Submits `name` as #rrggbb. Use inside <Field id={id}>.
 */
export function ColorInput({ id, name, defaultValue, invalid }: { id: string; name: string; defaultValue: string; invalid?: boolean }) {
  const [value, setValue] = useState(defaultValue);
  const valid = /^#[0-9a-fA-F]{6}$/.test(value);
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        aria-label={`${name} colour picker`}
        value={valid ? value : "#000000"}
        onChange={(e) => setValue(e.target.value)}
        className="h-10 w-12 shrink-0 cursor-pointer rounded-md border border-border-strong bg-surface p-1"
      />
      <input
        id={id}
        name={name}
        value={value}
        onChange={(e) => setValue(e.target.value.trim())}
        maxLength={7}
        spellCheck={false}
        aria-invalid={invalid || !valid || undefined}
        data-ui="input"
        className={cx(
          "block h-10 w-full rounded-md border bg-surface px-3 font-mono text-body text-fg uppercase focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none",
          invalid || !valid ? "border-danger" : "border-border-strong",
        )}
      />
    </div>
  );
}
