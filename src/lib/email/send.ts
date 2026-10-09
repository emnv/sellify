import "server-only";
import { Resend } from "resend";

// Transactional email via Resend. Failures are logged and reported to the
// caller, never thrown: a booking or order must not fail because an email did.

let client: Resend | null = null;

export type EmailMessage = {
  to: string;
  subject: string;
  /** Plain-text body. Also rendered as simple HTML. */
  text: string;
  replyTo?: string | null;
};

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export async function sendEmail(msg: EmailMessage): Promise<{ ok: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) return { ok: false, error: "Email is not configured" };
  client ??= new Resend(key);
  const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#111">${escapeHtml(msg.text).replace(/\n/g, "<br>")}</div>`;
  try {
    const { error } = await client.emails.send({
      from,
      to: msg.to,
      subject: msg.subject,
      text: msg.text,
      html,
      replyTo: msg.replyTo ?? undefined,
    });
    if (error) {
      console.error("[email] send failed", { subject: msg.subject, error: error.message });
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (e) {
    console.error("[email] send threw", { subject: msg.subject, error: (e as Error).message });
    return { ok: false, error: (e as Error).message };
  }
}

/** Send several emails; returns how many succeeded. */
export async function sendEmails(messages: EmailMessage[]) {
  const results = await Promise.all(messages.map(sendEmail));
  return results.filter((r) => r.ok).length;
}
