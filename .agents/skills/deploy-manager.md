# Skill: Infrastructure & Deploy

Use this skill whenever the request involves deployment, environment configuration, or scheduling the scraping job.

## Next.js app (CRM)

- Deployed on **Vercel**, integrated with the Git repository — every push to the main branch generates a production deploy; PRs generate Preview deployments.
- Environment variables (Neon connection string, Resend API key, Claude API key) are configured in the Vercel dashboard, never committed to the repo, never hardcoded anywhere.
- Drizzle migrations run as part of the deploy process (or manually beforehand, depending on the chosen flow) — never apply a migration directly to production without it already being versioned in the repo.

## Scraping/AI job (Python, separate repo/process)

- **Current phase**: scheduled via **GitHub Actions** (cron syntax), running in short batches (within the 6-hour job limit of GitHub-hosted runners). See `.agents/docs/LEAD_INGESTION.md` for the data contract.
- **Future phase** (once it needs to run continuously for hours/days): moves to a long-running process on a small always-on server (e.g. a DigitalOcean Droplet, ~$6-12/month). The scraper code is containerized (Docker) from the start specifically so this migration doesn't require rewriting anything — just swapping who starts the container (scheduled run vs. continuous loop).
- In both cases, the job only needs: the Neon connection string, and the relevant API keys (Google Places/Geocoding, Brave Search, OpenAI — Claude API once extraction moves back to it) as environment variables/secrets — never committed.

## Checklist before shipping an infrastructure change

1. Does the change break tenant isolation in any way (e.g. a shared environment variable that should be per-tenant)? See `.agents/docs/TENANCY.md`.
2. Have new secrets been added as env vars in every environment that needs them (Vercel + GitHub Actions secrets, or the server, depending on which component needs it)?
3. If the change affects the database schema, was the Drizzle migration generated and committed before the deploy that depends on it?
