import { NextResponse, type NextRequest } from "next/server";
import { classifyHost } from "@/lib/hosts";
import { updateSession } from "@/lib/supabase/proxy";

const ROOT = process.env.STORES_ROOT_DOMAIN ?? "";
const APP_HOST = (() => {
  try {
    return process.env.APP_URL ? new URL(process.env.APP_URL).hostname : "";
  } catch {
    return "";
  }
})();

// Routes every request:
//  - store hosts (<slug>.<root>, custom domains) → rewritten to /s/<key>/…,
//    the public store renderer; no session handling
//  - the app host → backend (session refresh + login redirect), and /s/<slug>
//    path-based stores; with a root domain set, /s/<slug> redirects to the subdomain
export async function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const target = classifyHost(host, ROOT, APP_HOST);
  const { pathname, search } = request.nextUrl;

  if (target.kind !== "app") {
    // Internal paths are not reachable on store hosts.
    if (pathname.startsWith("/s/") || pathname.startsWith("/store") || pathname.startsWith("/core")) {
      return new NextResponse("Not found", { status: 404 });
    }
    const key = target.kind === "store" ? target.slug : target.host;
    const url = request.nextUrl.clone();
    url.pathname = `/s/${key}${pathname === "/" ? "" : pathname}`;
    const headers = new Headers(request.headers);
    headers.set("x-store-mode", "host");
    return NextResponse.rewrite(url, { request: { headers } });
  }

  if (pathname.startsWith("/s/")) {
    const slug = pathname.split("/")[2] ?? "";
    if (ROOT && /^[a-z0-9-]+$/.test(slug)) {
      const rest = pathname.slice(`/s/${slug}`.length);
      return NextResponse.redirect(`https://${slug}.${ROOT}${rest || "/"}${search}`, 308);
    }
    const headers = new Headers(request.headers);
    headers.delete("x-store-mode");
    return NextResponse.next({ request: { headers } });
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    // Everything except Next internals and static files.
    "/((?!_next/static|_next/image|favicon.ico|brand/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
};
