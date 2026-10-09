import type { ComponentProps, ReactNode } from "react";
import { cx } from "./cx";

/*
 * Data table. Put it in <Card padding="none">. Numbers are right-aligned
 * (`align="right"`); the last column holds row actions.
 */

export function Table({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-body" aria-label={label}>
        {children}
      </table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return <thead className="border-b border-border bg-surface-muted">{children}</thead>;
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-border">{children}</tbody>;
}

export function Tr({ children }: { children: ReactNode }) {
  return <tr className="transition-colors ease-standard hover:bg-canvas">{children}</tr>;
}

type Align = "left" | "right" | "center";
const alignClass: Record<Align, string> = { left: "text-left", right: "text-right", center: "text-center" };

export function Th({ children, align = "left", srOnly }: { children: ReactNode; align?: Align; srOnly?: boolean }) {
  return (
    <th scope="col" className={cx("px-5 py-3 text-small font-medium whitespace-nowrap text-fg-subtle", alignClass[align])}>
      {srOnly ? <span className="sr-only">{children}</span> : children}
    </th>
  );
}

type TdProps = Omit<ComponentProps<"td">, "className" | "style" | "align"> & { align?: Align; nowrap?: boolean };

export function Td({ align = "left", nowrap, ...props }: TdProps) {
  return <td {...props} className={cx("px-5 py-3 align-middle text-fg", alignClass[align], nowrap && "whitespace-nowrap", align === "right" && "tabular-nums")} />;
}

/** Row shown when a table has no data. */
export function TableEmpty({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-5 py-12 text-center text-body text-fg-subtle">
        {children}
      </td>
    </tr>
  );
}

/** Footer under a table: counts and pagination. */
export function TableFooter({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3 text-small text-fg-subtle">{children}</div>;
}
