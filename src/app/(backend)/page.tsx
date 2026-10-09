import { Suspense } from "react";
import { signOut } from "@/app/(auth)/actions";
import { requireShop } from "@/core/shop";

// Phase 1 placeholder. Phase 2 replaces it with the app shell and sends the
// owner to the first backend page.
export default function BackendHome() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
      <Suspense fallback={<p className="text-sm">Loading…</p>}>
        <Home />
      </Suspense>
    </main>
  );
}

async function Home() {
  const { user, shop, role } = await requireShop();
  return (
    <>
      <h1 className="text-2xl font-semibold">{shop.name}</h1>
      <p className="text-sm">
        Signed in as {user.email} ({role}).
      </p>
      <form action={signOut}>
        <button type="submit" className="rounded-md border px-4 py-2 text-sm">Log out</button>
      </form>
    </>
  );
}
