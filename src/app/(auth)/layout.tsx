import { Logo } from "@/components/ui";

// Signed-out and setup screens: logo above one centred card.
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-12">
      <Logo href="/login" />
      <div className="w-full max-w-md rounded-lg border border-border bg-surface p-6 shadow-card sm:p-8">{children}</div>
    </div>
  );
}
