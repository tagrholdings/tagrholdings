# Slack assistant — setup

One manifest, two Slack apps: **TAGR CRM** (prod) and **TAGR CRM (dev)**, in the same Slack workspace. Each app has its
own signing secret, bot token and app id, so a test message in `#crm-test` can never reach the production database.

> **Updating an existing app?** The manifest gained the `im:write` and `commands` scopes (Slack requires `commands` for any shortcut), the app's Messages tab and the **Create CRM task**
> shortcut. Apps → your app → **App Manifest** → paste the new manifest → Save, then **reinstall to the workspace** (the new
> scope needs it). Do it for both the dev and the prod app.

## Create an app (do this once for prod, once for dev)

1. <https://api.slack.com/apps> → **Create New App** → **From a manifest** → pick the Slack workspace → paste
   [`manifest.json`](./manifest.json).
   - **Dev:** before pasting, change the name to `TAGR CRM (dev)` and both `request_url` hosts to your tunnel
     (`cloudflared tunnel --url http://localhost:3000` or `ngrok http 3000`), e.g. `https://abc.trycloudflare.com`.
     The tunnel URL changes each run — update the two URLs in the app's **Event Subscriptions** and **Interactivity** pages.
   - **Prod:** use the file as is (`https://crm.tagrholdings.com/...`; the www host would redirect a POST).
2. **Install App** → install to the workspace → copy the **Bot User OAuth Token** (`xoxb-…`).
3. **Basic Information** → copy the **App ID** (`A…`) and the **Signing Secret**.
4. Set the environment (dev: `.env.local`, prod: Vercel):

   ```
   SLACK_APP_ID=A0123ABCDEF
   SLACK_SIGNING_SECRET=…
   SLACK_BOT_TOKEN=xoxb-…
   GEMINI_API_KEY=…
   GEMINI_MODEL=gemini-2.5-flash   # optional
   ```

   **Dev/preview only:** `SLACK_ALLOW_UNLINKED_USERS=true` lets any Slack user try the bot without a matching CRM
   member (what they create has no creator). Production leaves it unset: there, a Slack e-mail that isn't a member of
   the workspace is refused.

5. In Slack, create the channel (`#crm` / `#crm-test`) and `/invite @TAGR CRM` — a bot only sees channels it is in.
6. In the CRM: **Settings → Slack** (workspace admins) → paste the Slack workspace ID (`T…`, the workspace's About) and the
   channel ID (`C…`, channel details → bottom) → Save.

**Several CRM workspaces on one Slack team:** give each workspace its own command channel (Settings → Slack, in that workspace) — the bot acts in the workspace of the channel you write in. An @mention in any other channel goes to the one workspace you belong to; if you belong to several it asks you to use a command channel. A channel belongs to one workspace.

Everyone is matched to their CRM login by e-mail the first time they write, so people need the same e-mail in Slack and
the CRM.

## How people use it

- In the command channel every top-level message or voice note is a command. Elsewhere, `@TAGR CRM …`.
- Reply **inside the bot's thread** to continue: answer its question, or correct it ("make it Friday", "also assign it to Carlos"). A correction of a card nobody pressed yet replaces that card; once it is created, a correction edits the saved activity. Replies in threads the bot is not part of are ignored.
- It also handles **contacts, companies and cards**: "create a contact Ana Costa, ana@acme.com, at Padaria X", "new lead Bakery Z in outreach", "move Lavanderia Central to closed", "list my leads", "what projects do we have?". Names may be unfinished or slightly misspelled; before creating anything it searches for an existing one and asks instead of duplicating. It cannot create or rename boards (that stays in the CRM).
- Ask about any day or period: "what's on the 28th?", "anything due in November?", "overdue since Monday".
- The bot replies in the message's thread with a card; **Create** saves it, **Cancel** drops it. Anyone in the workspace
  can press it. Questions ("what's due today?") are answered directly.

## What the bot says on its own

All of this rides on the existing reminder cron (`/api/cron/task-reminders`, every 20 minutes), so a message can be up to
20 minutes late. Nothing needs a new scheduler.

- **Task reminders and new assignments** — a DM to the person (or to everyone, for an unassigned task) with **Done** and
  **Snooze 1 day** buttons, next to the push notification. Everyone is found by their e-mail (`users.lookupByEmail`).
- **L10** — a DM to each teammate an hour before the weekly meeting, with the agenda points.
- **New leads** — cards in the workspace's command channel (the best five by fit, then "and N more") with **Add to
  pipeline** and **Dismiss**. Only leads from the last 24 hours are announced, so turning it on doesn't dump a backlog.
- **Daily summary** (opt-in) — 8:00 the person's own time: what is due today and overdue.
- **Weekly report** — Mondays from 8:00 (the workspace's L10 time zone), by DM to workspace **admins**.

People control their own DMs by telling the bot: "stop the reminders", "send me the daily summary", "turn off the weekly
report". The same bot also takes notes ("note on the Padaria lead: …" is appended with the date, never replacing), shows
the pipeline ("how's the pipeline? what's stuck?"), and adds EOS Issues and L10 To-Dos.

**Create CRM task** is a message shortcut: ⋯ More actions on any Slack message → *Create CRM task*. The card arrives in your
DM with a link back to the message.

## Database

Migrations `0032_slack_bot`, `0033_slack_bot_grants`, `0034_slack_multi_workspace`, `0035_slack_notifications` and `0036_slack_notifications_grants` — run them with `scripts/migrate-explicit.ts` (never
`db:migrate`). Production gets them **before** the deploy.
