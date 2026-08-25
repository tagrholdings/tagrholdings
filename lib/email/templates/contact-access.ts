import { emailLayout } from "./layout";

export function contactAccessEmail(name: string | undefined, accessToken: string) {
  const siteUrl = process.env.SITE_URL || "http://localhost:3000";
  const portalUrl = `${siteUrl}/portal?token=${accessToken}`;

  const body = `
    <h1 style="margin:0 0 20px; font-family: Georgia, 'Times New Roman', serif; font-size:22px; font-weight:600; color:#1b1d1f;">
      Welcome to the private portal!
    </h1>
    <p style="margin:0 0 16px;">Hi ${name || "there"},</p>
    <p style="margin:0 0 16px;">
      Thanks for reaching out. You now have access to the TAGR Holdings private
      operating playbook &mdash; use the button below to open it.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0;">
      <tr>
        <td style="border-radius:3px; background-color:#9c7a3c;">
          <a href="${portalUrl}" style="display:inline-block; padding:13px 28px; font-family:Arial, Helvetica, sans-serif; font-size:13px; font-weight:600; letter-spacing:0.04em; text-transform:uppercase; color:#f5f2ec; text-decoration:none;">
            Open your private portal
          </a>
        </td>
      </tr>
    </table>
    <p style="margin:0 0 8px; font-size:13px; color:rgba(27,29,31,0.6);">
      Or copy and paste this link into your browser:
    </p>
    <p style="margin:0; font-size:13px; word-break:break-all;">
      <a href="${portalUrl}" style="color:#9c7a3c;">${portalUrl}</a>
    </p>
  `;

  return emailLayout(body);
}
