// Only allow same-site relative paths as post-login destinations
// (blocks open redirects like `//evil.com` or `/\evil.com`).
export function safeNextPath(value: unknown, fallback = "/"): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}
