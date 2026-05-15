import { Resend } from "resend";

const resendKey = process.env.RESEND_API_KEY;
const from = process.env.EMAIL_FROM ?? "Screencaps <noreply@example.com>";
const baseUrl = process.env.BASE_URL ?? "http://localhost:3000";

const resend = resendKey ? new Resend(resendKey) : null;

async function send(to: string, subject: string, html: string) {
  if (!resend) {
    // Dev fallback — log the link to the console so the flow works without SMTP.
    console.log(`\n[email:dev] to=${to} subject="${subject}"\n${html}\n`);
    return;
  }
  const { error } = await resend.emails.send({ from, to, subject, html });
  if (error) throw new Error(`Resend error: ${error.message}`);
}

const wrap = (title: string, body: string, ctaUrl: string, ctaLabel: string) => `
<!doctype html>
<html><body style="margin:0;background:#0a0a0c;color:#e4e4e7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0c;padding:40px 0;">
    <tr><td align="center">
      <table width="540" cellpadding="0" cellspacing="0" style="background:#121214;border:1px solid #27272a;border-radius:14px;padding:32px;">
        <tr><td>
          <div style="font-size:13px;letter-spacing:0.12em;color:#71717a;text-transform:uppercase;">Screencaps</div>
          <h1 style="margin:14px 0 8px;font-size:22px;color:#fafafa;font-weight:600;">${title}</h1>
          <div style="font-size:15px;line-height:1.6;color:#a1a1aa;">${body}</div>
          <div style="margin-top:24px;">
            <a href="${ctaUrl}" style="display:inline-block;background:#fafafa;color:#0a0a0c;padding:11px 18px;border-radius:10px;font-weight:600;font-size:14px;text-decoration:none;">${ctaLabel}</a>
          </div>
          <div style="margin-top:24px;font-size:12px;color:#52525b;">If the button doesn't work, paste this into your browser:<br/><span style="color:#a1a1aa;">${ctaUrl}</span></div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

export async function sendInviteEmail(email: string, token: string) {
  const url = `${baseUrl}/invite/${token}`;
  await send(
    email,
    "You're invited to Screencaps",
    wrap(
      "You've been invited",
      "Set up your account to start creating ad-screenshot projects. This invite expires in 72 hours.",
      url,
      "Set up your account",
    ),
  );
}

export async function sendVerificationEmail(email: string, token: string) {
  const url = `${baseUrl}/verify/${token}`;
  await send(
    email,
    "Verify your Screencaps email",
    wrap(
      "Verify your email",
      "Click below to confirm your account. The link expires in 24 hours.",
      url,
      "Verify email",
    ),
  );
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const url = `${baseUrl}/reset/${token}`;
  await send(
    email,
    "Reset your Screencaps password",
    wrap(
      "Reset your password",
      "If you didn't request this, ignore this email. Link expires in 4 hours.",
      url,
      "Choose a new password",
    ),
  );
}

export type ProjectCompleteStats = {
  brand: string;
  campaign: string;
  projectId: string;
  total: number;
  completed: number;
  noAdSlots: number;
  unreachable: number;
  failed: number;
  screenshots: number;
};

export async function sendProjectCompleteEmail(email: string, stats: ProjectCompleteStats) {
  const url = `${baseUrl}/projects/${stats.projectId}`;
  const downloadUrl = `${baseUrl}/api/projects/${stats.projectId}/download`;

  const rows = [
    stats.completed > 0    ? `<tr><td style="padding:4px 0;color:#a1a1aa;">Captured</td><td style="padding:4px 0;color:#fafafa;font-weight:600;text-align:right;">${stats.completed}</td></tr>` : "",
    stats.noAdSlots > 0    ? `<tr><td style="padding:4px 0;color:#a1a1aa;">No ad slots found</td><td style="padding:4px 0;color:#facc15;text-align:right;">${stats.noAdSlots}</td></tr>` : "",
    stats.unreachable > 0  ? `<tr><td style="padding:4px 0;color:#a1a1aa;">Unreachable</td><td style="padding:4px 0;color:#f87171;text-align:right;">${stats.unreachable}</td></tr>` : "",
    stats.failed > 0       ? `<tr><td style="padding:4px 0;color:#a1a1aa;">Failed</td><td style="padding:4px 0;color:#f87171;text-align:right;">${stats.failed}</td></tr>` : "",
    `<tr><td style="padding:4px 0;color:#a1a1aa;">Screenshots saved</td><td style="padding:4px 0;color:#fafafa;font-weight:600;text-align:right;">${stats.screenshots}</td></tr>`,
  ].filter(Boolean).join("");

  const body = `
    Your project <strong style="color:#fafafa;">${stats.brand} — ${stats.campaign}</strong> has finished processing all ${stats.total} URL${stats.total === 1 ? "" : "s"}.
    <br/><br/>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #27272a;margin-top:8px;">
      <tbody>${rows}</tbody>
    </table>
    <br/>
    Open the project to review results, or download the full ZIP right away:
    <br/><br/>
    <a href="${downloadUrl}" style="display:inline-block;background:#27272a;color:#fafafa;padding:9px 16px;border-radius:8px;font-size:13px;text-decoration:none;margin-right:8px;">⬇ Download ZIP</a>
  `;

  await send(
    email,
    `✅ ${stats.brand} — ${stats.campaign} capture complete`,
    wrap("Project capture complete", body, url, "View results"),
  );
}
