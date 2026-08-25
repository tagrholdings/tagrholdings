import { emailLayout } from "./layout";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function row(label: string, value: string) {
  return `
    <tr>
      <td style="padding:10px 0; border-bottom:1px solid rgba(27,29,31,0.1); font-size:12px; font-weight:600; text-transform:uppercase; letter-spacing:0.04em; color:rgba(27,29,31,0.5); vertical-align:top; width:110px;">
        ${label}
      </td>
      <td style="padding:10px 0; border-bottom:1px solid rgba(27,29,31,0.1); font-size:14px; color:#1b1d1f;">
        ${value}
      </td>
    </tr>
  `;
}

export function notifyTannerEmail(
  name: string | undefined,
  email: string,
  message: string | undefined,
  meta: { submittedAt: Date; ip: string }
) {
  const safeName = escapeHtml(name || "Not provided");
  const safeEmail = escapeHtml(email);
  const safeMessage = escapeHtml(message || "No message provided.").replace(
    /\n/g,
    "<br />"
  );
  const formattedDate = meta.submittedAt.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const body = `
    <h1 style="margin:0 0 20px; font-family: Georgia, 'Times New Roman', serif; font-size:20px; font-weight:600; color:#1b1d1f;">
      New contact form submission
    </h1>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      ${row("Name", safeName)}
      ${row("Email", `<a href="mailto:${safeEmail}" style="color:#9c7a3c; text-decoration:none;">${safeEmail}</a>`)}
      ${row("Submitted", escapeHtml(formattedDate))}
      ${row("IP address", escapeHtml(meta.ip))}
    </table>
    <p style="margin:0 0 8px; font-size:12px; font-weight:600; text-transform:uppercase; letter-spacing:0.04em; color:rgba(27,29,31,0.5);">
      Message
    </p>
    <p style="margin:0; padding:14px 16px; background-color:#ede8df; border-radius:3px; font-size:14px; color:#1b1d1f;">
      ${safeMessage}
    </p>
  `;

  return emailLayout(body);
}
