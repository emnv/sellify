import type { ReactNode } from "react";
import { Pill } from "./badge";
import { HiddenField, Input } from "./form";

/*
 * Filter bar: sits at the top of a list card, above the table.
 * Search on the left, filter pills after it. Filters live in the URL
 * (?q=…&status=…) so they survive reloads and can be shared.
 */

export function FilterBar({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-3 border-b border-border px-5 py-4 lg:flex-row lg:flex-wrap lg:items-center">{children}</div>;
}

type Params = Record<string, string | undefined>;

function hrefWith(basePath: string, params: Params, key: string, value: string | undefined) {
  const next = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v && k !== key && k !== "page") next.set(k, v);
  if (value) next.set(key, value);
  const qs = next.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

type SearchProps = {
  basePath: string;
  params: Params;
  placeholder: string;
  /** Query param name. */
  name?: string;
};

/** GET search box. Keeps the other active filters. */
export function FilterSearch({ basePath, params, placeholder, name = "q" }: SearchProps) {
  return (
    <form action={basePath} method="get" role="search" className="w-full lg:w-72">
      {Object.entries(params).map(([k, v]) => (v && k !== name && k !== "page" ? <HiddenField key={k} name={k} value={v} /> : null))}
      <label htmlFor={`filter-${name}`} className="sr-only">
        {placeholder}
      </label>
      <Input id={`filter-${name}`} name={name} type="search" placeholder={placeholder} defaultValue={params[name] ?? ""} />
    </form>
  );
}

type PillsProps = {
  basePath: string;
  params: Params;
  /** Query param this group controls. */
  param: string;
  label: string;
  options: Array<{ value: string | undefined; label: string; count?: number }>;
};

/** A group of filter pills. `value: undefined` is the "All" option. */
export function FilterPills({ basePath, params, param, label, options }: PillsProps) {
  const current = params[param];
  return (
    <nav aria-label={label} className="flex flex-wrap items-center gap-2">
      {options.map((o) => (
        <Pill key={o.value ?? "all"} href={hrefWith(basePath, params, param, o.value)} selected={current === o.value} count={o.count}>
          {o.label}
        </Pill>
      ))}
    </nav>
  );
}
