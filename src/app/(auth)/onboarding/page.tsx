import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Button, Skeleton } from "@/components/ui";
import { signOut } from "../actions";
import { getCurrentShop } from "@/core/shop";
import { requireUser } from "@/lib/auth";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Set up your shop · Sellify" };

export default function OnboardingPage() {
  return (
    <Suspense fallback={<Skeleton lines={5} />}>
      <Onboarding />
    </Suspense>
  );
}

async function Onboarding() {
  const user = await requireUser();
  if (await getCurrentShop()) redirect("/");
  return (
    <div className="flex flex-col gap-6">
      <OnboardingForm defaultEmail={user.email} />
      <form action={signOut} className="flex justify-center border-t border-border pt-4">
        <Button type="submit" variant="ghost" size="sm">
          Log out of {user.email}
        </Button>
      </form>
    </div>
  );
}
