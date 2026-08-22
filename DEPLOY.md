# GSW Store — Next.js Deployment Guide

## Architecture

```
Customer → DigitalOcean (Next.js) → Tailscale VPN → Raspberry Pi (Flask :7000)
                                 → Supabase (auth, cart, orders)
```

---

## Step 1 — Run the Supabase schema

1. Open your Supabase project → SQL Editor
2. Run `supabase/schema/STORE_SCHEMA.sql`
3. The existing inventory tables (`inventory`, `categories`, etc.) are untouched

---

## Step 2 — Set up Tailscale

On your Raspberry Pi:
```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```
Note the Tailscale IP (e.g. `100.x.x.x`).

The Flask app must be reachable from the DO droplet on port 7000 via Tailscale.
No public exposure needed — Tailscale keeps it private.

---

## Step 3 — DigitalOcean App Platform

### Option A — App Platform (easiest)
1. Push this repo to GitHub
2. DigitalOcean → Create App → Connect GitHub repo
3. Set environment variables (see below)
4. Deploy — DO auto-detects Next.js

### Option B — Droplet + PM2
```bash
# On DO droplet, install Tailscale first (same as Pi):
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up

# Clone and build
git clone <your-repo> gsw-store
cd gsw-store
npm ci
npm run build

# Run with PM2
npm install -g pm2
pm2 start npm --name gsw-store -- start
pm2 save && pm2 startup
```

---

## Environment Variables

Set these in DigitalOcean App Platform settings (or `.env.local` for local dev):

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://dibfrhhoslucjgvoszto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>

# Raspberry Pi via Tailscale (use Tailscale IP, not LAN IP)
INVENTORY_API_BASE=http://100.x.x.x:7000

# Your deployed domain
NEXT_PUBLIC_SITE_URL=https://yourdomain.com
```

> **Important:** `INVENTORY_API_BASE` uses the Tailscale IP. The DO droplet and
> Pi must both be on the same Tailscale network. Never expose the Flask API
> to the public internet.

---

## Supabase Auth Setup

In Supabase dashboard → Authentication → URL Configuration:
- **Site URL:** `https://yourdomain.com`
- **Redirect URLs:** `https://yourdomain.com/api/auth/callback`

---

## Local Development

```bash
npm install
# Edit .env.local — set INVENTORY_API_BASE to your Pi's LAN IP for dev
# e.g. INVENTORY_API_BASE=http://192.168.1.x:7000
npm run dev
```

Open http://localhost:3000

---

## What's in Stage 1

- ✅ Product catalog (reads from Flask inventory API)
- ✅ Category filtering + search
- ✅ Product detail pages with stock status
- ✅ Customer auth (sign up, login, email confirmation)
- ✅ Cart (persisted in Supabase per user)
- ✅ Checkout → creates order record in Supabase
- ✅ Order history page with status display
- ✅ Middleware protecting account/checkout pages

## Stage 2 (next)

- 🔲 Order pickup notifications (Resend email to customer + inventory app popup)
- 🔲 Admin order management in inventory app
- 🔲 Order status updates pushed to customer
