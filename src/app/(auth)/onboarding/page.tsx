import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui";
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
  return <OnboardingForm defaultEmail={user.email} />;
}
