import { emailLayout } from "./layout";

const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * The invitation to create an account. `inviterName` is a teammate's own display name, so it is escaped;
 * the link carries the single-use token. `expiresInDays` is stated so nobody is surprised by an expired link.
 */
export function inviteEmail({ acceptUrl, inviterName, expiresInDays }: { acceptUrl: string; inviterName: string; expiresInDays: number }) {
  const inviter = escapeHtml(inviterName);
  const body = `
    <h1 style="margin:0 0 20px; font-family: Georgia, 'Times New Roman', serif; font-size:22px; font-weight:600; color:#1b1d1f;">
      You&rsquo;re invited to the TAGR CRM
    </h1>
    <p style="margin:0 0 16px;">Hi,</p>
    <p style="margin:0 0 16px;">
      <strong>${inviter}</strong> has invited you to join the TAGR Holdings CRM.
      Choose your name and a password to create your account &mdash; it only takes a moment.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0;">
      <tr>
        <td style="border-radius:3px; background-color:#9c7a3c;">
          <a href="${acceptUrl}" style="display:inline-block; padding:13px 28px; font-family:Arial, Helvetica, sans-serif; font-size:13px; font-weight:600; letter-spacing:0.04em; text-transform:uppercase; color:#f5f2ec; text-decoration:none;">
            Create your account
          </a>
        </td>
      </tr>
    </table>
    <p style="margin:0 0 8px; font-size:13px; color:rgba(27,29,31,0.6);">
      Or copy and paste this link into your browser:
    </p>
    <p style="margin:0 0 20px; font-size:13px; word-break:break-all;">
      <a href="${acceptUrl}" style="color:#9c7a3c;">${acceptUrl}</a>
    </p>
    <p style="margin:0; font-size:13px; color:rgba(27,29,31,0.6);">
      This link works once and expires in ${expiresInDays} days. If it has expired you can request a fresh one from the same page.
      If you weren&rsquo;t expecting this invitation, you can ignore this email &mdash; nothing happens until the link is used.
    </p>
  `;
  return emailLayout(body);
}

export function inviteEmailText({ acceptUrl, inviterName, expiresInDays }: { acceptUrl: string; inviterName: string; expiresInDays: number }) {
  return [
    "Hi,",
    "",
    `${inviterName} has invited you to join the TAGR Holdings CRM. Open the link below to choose your name and a password:`,
    "",
    acceptUrl,
    "",
    `The link works once and expires in ${expiresInDays} days. If it has expired you can request a fresh one from the same page.`,
    "If you weren't expecting this invitation, you can ignore this email.",
    "",
    "TAGR Holdings",
  ].join("\n");
}
