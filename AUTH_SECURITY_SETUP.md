# Authentication Security Setup

## What the app enforces

- Authenticated users are signed out after five minutes without interaction.
- Supabase browser session cookies use a two-week lifetime and secure cookie settings in production.
- The browser sends an authenticated activity touch at most once per minute while someone is actively using the app. This prevents an active staff member from timing out on a long single-page task.
- Registration and password-reset forms use three concealed honeypot fields, a minimum-completion-time check, and per-IP attempt limits.
- A missing activity record starts fresh. A modified, malformed, or identity-mismatched activity record signs the user out and sends a password-reset email.
- Passwords entered through registration or reset must be at least 12 characters.

## Required production environment variable

Set this in DigitalOcean and any production environment before deploying:

```sh
AUTH_ACTIVITY_SECRET="$(openssl rand -base64 32)"
```

Use one stable random value per environment. Do not expose it to the browser and do not rotate it casually: rotating it invalidates the signed activity marker for current sessions, which intentionally makes users reset their passwords.

## Supabase dashboard setting

In Supabase Auth session settings, set the time-boxed session duration to **1,209,600 seconds (14 days)**, or confirm it is at least that long. The app cookie has the same two-week lifetime; the shorter of the two settings wins.

Also add each deployed origin and its callback URL to Supabase Auth redirect URLs, for example:

```text
https://stoneproductsupply.com/api/auth/callback
https://admin.stoneproductsupply.com/api/auth/callback
https://alerts.stoneproductsupply.com/api/auth/callback
```

## Operational note

The app's request limiter is deliberately an in-process fallback. It blocks repeated attempts on one server instance. For a distributed, stronger bot-control layer, also enable DigitalOcean/WAF rate limits or add a shared Redis-backed limiter.
