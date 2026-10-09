// Product labels that are safe to use anywhere (server or client, store or
// backend). The backend inventory module re-uses these.

export const PRODUCT_CONDITIONS = [
  { value: "new", label: "New" },
  { value: "refurbished", label: "Refurbished" },
  { value: "used", label: "Used" },
] as const;

export function conditionLabel(value: string | null) {
  return PRODUCT_CONDITIONS.find((c) => c.value === value)?.label ?? null;
}
