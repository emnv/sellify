import type { Metadata } from "next";
import { requestPasswordReset } from "../actions";
import { PasswordResetForm } from "../password-reset-form";

export const metadata: Metadata = { title: "Reset password · Sellify" };

export default function ForgotPasswordPage() {
  return <PasswordResetForm mode="request" action={requestPasswordReset} />;
}
