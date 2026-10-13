import { emailLayout } from "./layout";

const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * The 1-hour-before reminder of the weekly L10, with the points it will cover — so everyone walks in having seen the
 * numbers and the top issues. Titles are teammates' own words, so everything is escaped.
 */
export interface L10ReminderOptions {
  workspaceName: string;
  /** Already formatted in the meeting's time zone, e.g. "Tuesday, Oct 13 · 8:00 AM". */
  when: string;
  meetingUrl: string;
  topIssues: string[];
  offGoal: string[];
  offTrackRocks: string[];
  openTodos: number;
}

function section(title: string, items: string[], empty: string) {
  const list = items.length
    ? `<ul style="margin:0 0 18px; padding-left:20px;">${items.map((i) => `<li style="margin:0 0 4px;">${escapeHtml(i)}</li>`).join("")}</ul>`
    : `<p style="margin:0 0 18px; color:rgba(27,29,31,0.6);">${empty}</p>`;
  return `<p style="margin:0 0 6px; font-size:12px; letter-spacing:0.1em; text-transform:uppercase; color:rgba(27,29,31,0.6);">${title}</p>${list}`;
}

export function l10ReminderEmail(o: L10ReminderOptions) {
  const body = `
    <h1 style="margin:0 0 8px; font-family: Georgia, 'Times New Roman', serif; font-size:22px; font-weight:600; color:#1b1d1f;">
      L10 in one hour
    </h1>
    <p style="margin:0 0 24px;">${escapeHtml(o.workspaceName)} &middot; ${escapeHtml(o.when)}</p>
    ${section("Top issues for IDS", o.topIssues, "No open issues.")}
    ${section("Scorecard off goal", o.offGoal, "Every number with a goal is on it.")}
    ${section("Rocks off track", o.offTrackRocks, "No Rocks off track.")}
    <p style="margin:0 0 24px;">To-Dos still open: <strong>${o.openTodos}</strong>. Done or not done &mdash; the target is 90%.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 0;">
      <tr>
        <td style="border-radius:3px; background-color:#9c7a3c;">
          <a href="${o.meetingUrl}" style="display:inline-block; padding:13px 28px; font-family:Arial, Helvetica, sans-serif; font-size:13px; font-weight:600; letter-spacing:0.04em; text-transform:uppercase; color:#f5f2ec; text-decoration:none;">
            Open the meeting
          </a>
        </td>
      </tr>
    </table>
  `;
  return emailLayout(body);
}

export function l10ReminderEmailText(o: L10ReminderOptions) {
  const list = (items: string[], empty: string) => (items.length ? items.map((i) => `- ${i}`).join("\n") : empty);
  return [
    `L10 in one hour — ${o.workspaceName}, ${o.when}`,
    "",
    "Top issues for IDS:",
    list(o.topIssues, "No open issues."),
    "",
    "Scorecard off goal:",
    list(o.offGoal, "Every number with a goal is on it."),
    "",
    "Rocks off track:",
    list(o.offTrackRocks, "No Rocks off track."),
    "",
    `To-Dos still open: ${o.openTodos}`,
    "",
    `Open the meeting: ${o.meetingUrl}`,
  ].join("\n");
}
