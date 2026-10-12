"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { safeNextPath } from "@/lib/safe-next";
import { serverEnv } from "@/lib/env.server";
import { createClient } from "@/lib/supabase/server";

export type AuthFormState = { error?: string; message?: string; email?: string };

const credentials = z.object({
  email: z.email("Enter a valid email address.").trim().toLowerCase(),
  password: z.string().min(8, "Use at least 8 characters.").max(72),
});

export async function signIn(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = credentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  const email = String(formData.get("email") ?? "");
  if (!parsed.success) return { error: parsed.error.issues[0].message, email };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return {
      error: error.code === "email_not_confirmed"
        ? "Confirm your email first. Check your inbox for the link."
        : "Email or password is wrong.",
      email,
    };
  }

  redirect(safeNextPath(formData.get("next")));
}

export async function signUp(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = credentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  const email = String(formData.get("email") ?? "");
  if (!parsed.success) return { error: parsed.error.issues[0].message, email };

  const origin = appOrigin();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    ...parsed.data,
    options: { emailRedirectTo: `${origin}/auth/confirm?next=/onboarding` },
  });
  // Never echo provider errors: "already registered" and similar messages
  // would reveal which emails have accounts. Only a weak password (which says
  // nothing about the account) gets a specific message.
  if (error) {
    if (error.code === "weak_password") return { error: "Choose a stronger password.", email };
    if (error.code !== "user_already_exists" && error.code !== "email_exists") {
      console.error("auth: sign-up failed", { code: error.code, status: error.status });
      if (isEmailSendError(error.code)) return { error: EMAIL_SEND_ERROR, email };
      return { error: "Could not create the account. Try again in a moment.", email };
    }
  }

  // Email confirmation off: signed in straight away.
  if (data?.session) redirect("/onboarding");

  // Same answer whether or not the email already had an account.
  return { message: `If ${parsed.data.email} can be used, we sent a confirmation link to it. Open it to continue.`, email };
}

// Supabase could not send the email. Says nothing about whether the account exists.
const EMAIL_SEND_ERROR = "We could not send the email just now. Try again in an hour, or contact Sellify support.";
function isEmailSendError(code: string | undefined) {
  return code === "over_email_send_rate_limit" || code === "email_address_not_authorized" || code === "unexpected_failure";
}

const emailOnly = z.object({ email: credentials.shape.email });

export async function requestPasswordReset(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "");
  const parsed = emailOnly.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { error: parsed.error.issues[0].message, email };

  const origin = appOrigin();
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/confirm?next=/reset-password`,
  });
  if (error) {
    console.error("auth: password reset email failed", { code: error.code, status: error.status });
    if (isEmailSendError(error.code)) return { error: EMAIL_SEND_ERROR, email };
    return { error: "Could not send the reset link. Try again in a moment.", email };
  }

  // Same answer whether or not the email has an account.
  return { message: `If ${parsed.data.email} has an account, we sent a link to reset the password. Open it on this device.`, email };
}

const newPassword = z
  .object({
    password: credentials.shape.password,
    confirm_password: z.string(),
  })
  .refine((d) => d.password === d.confirm_password, { path: ["confirm_password"], message: "The passwords don't match." });

// Reached from the reset link: /auth/confirm has already signed the user in.
export async function resetPassword(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = newPassword.safeParse({
    password: formData.get("password") ?? "",
    confirm_password: formData.get("confirm_password") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: "The reset link has expired. Ask for a new one." };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "weak_password") return { error: "Choose a stronger password." };
    if (error.code === "same_password") return { error: "Choose a password you haven't used here." };
    console.error("auth: password reset failed", { code: error.code, status: error.status });
    return { error: "Could not save the new password. Try again in a moment." };
  }
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// Links in auth emails are built from the configured APP_URL, never the
// request's Host header: a forged host would send reset tokens elsewhere.
function appOrigin() {
  return serverEnv().APP_URL.replace(/\/$/, "");
}
