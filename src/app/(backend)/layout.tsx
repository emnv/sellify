import { Suspense } from "react";
import { signOut } from "@/app/(auth)/actions";
import { AppShell, Button, Skeleton } from "@/components/ui";
import { requireShop } from "@/core/shop";
import { backendNav } from "./nav";

// The shell is static; only the account block reads the session, behind
// its own Suspense boundary. Each page checks access itself (requireShop).
export default function BackendLayout({ children }: LayoutProps<"/">) {
  return (
    <AppShell
      nav={backendNav}
      account={
        <Suspense fallback={<Skeleton lines={2} />}>
          <Account />
        </Suspense>
      }
    >
      {children}
    </AppShell>
  );
}

async function Account() {
  const { shop, user } = await requireShop();
  return (
    <div className="flex flex-col gap-3">
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-body font-medium text-fg">{shop.name}</span>
        <span className="truncate text-small text-fg-subtle">{user.email}</span>
      </div>
      <form action={signOut}>
        <Button type="submit" variant="secondary" size="sm" fullWidth>
          Log out
        </Button>
      </form>
    </div>
  );
}
