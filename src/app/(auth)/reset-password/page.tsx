import type { Metadata } from "next";
import { resetPassword } from "../actions";
import { PasswordResetForm } from "../password-reset-form";

export const metadata: Metadata = { title: "Choose a new password · Sellify" };

export default function ResetPasswordPage() {
  return <PasswordResetForm mode="update" action={resetPassword} />;
}
