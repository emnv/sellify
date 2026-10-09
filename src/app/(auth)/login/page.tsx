import type { Metadata } from "next";
import { signIn } from "../actions";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Log in · Sellify" };

export default function LoginPage() {
  return <AuthForm mode="login" action={signIn} />;
}
