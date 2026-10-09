const BASE = "http://internal.invalid";

// Only allow same-site relative paths as post-login destinations. Validates
// the parsed URL, not just the raw prefix: browsers drop tabs/newlines and
// treat `\` like `/`, so `/\t/evil.com` would otherwise become `//evil.com`.
export function safeNextPath(value: unknown, fallback = "/"): string {
  if (typeof value !== "string" || /[\u0000-\u001F\u007F\\]/.test(value)) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  try {
    const url = new URL(value, BASE);
    if (url.origin !== BASE) return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}
