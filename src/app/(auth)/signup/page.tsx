import type { Metadata } from "next";
import { signUp } from "../actions";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Sign up · Sellify" };

export default function SignupPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <AuthForm mode="signup" action={signUp} />
    </main>
  );
}
