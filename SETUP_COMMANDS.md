# GSW — Setup & Maintenance Guide
Two parts:
- **PART 1 — Setup:** all in the browser. No computer, no terminal.
- **PART 2 — Changing the website** (logo, branding, text): on your computer.

**Domain:** goldenstonetools.com
**Supabase project:** dibfrhhoslucjgvoszto
**Repo:** github.com/515woodpl-dot/gswstore
**Hosting:** DigitalOcean App Platform (separate from your /var/www Droplet)

═══════════════════════════════════════════════════════════
# PART 1 — SETUP (browser only)
═══════════════════════════════════════════════════════════

## STEP 1 — Database (Supabase, in the browser)

You're pasting two SQL files into Supabase's web editor. No CLI needed.

### 1a. Open the SQL Editor
```
https://supabase.com/dashboard/project/dibfrhhoslucjgvoszto
→ SQL Editor → New query
```

### 1b. Run the customer schema
```
Open the file STORE_SCHEMA.sql (in the gswstore repo on GitHub —
click the file, click "Raw", copy everything)
→ paste into the SQL Editor → click Run
→ should say "Success"
```

### 1c. Run the cloud schema
```
New query → open CLOUD_SCHEMA.sql from the repo → Raw → copy →
paste → Run → "Success"
```
This creates inventory, categories, admin roles, and turns on realtime.
Both files are safe to re-run if something interrupts.

### 1d. Confirm realtime is on
```
Database → Replication → confirm "orders" is listed
(the schema adds it automatically — just verify)
```

---

## STEP 2 — Email (Resend, in the browser)

### 2a. Create an API key
```
https://resend.com/api-keys → Create → copy the key (you'll paste it in Step 3)
```

### 2b. Verify your domain
```
https://resend.com/domains → Add → goldenstonetools.com
→ copy the DNS records it shows
→ add them at your domain registrar (where you bought goldenstonetools.com)
→ click Verify (can take up to an hour)
```

---

## STEP 3 — Deploy the app (DigitalOcean, in the browser)

### 3a. Create the app
```
https://cloud.digitalocean.com/apps → Create App
→ GitHub → authorize → pick 515woodpl-dot/gswstore → branch: master
→ DO auto-detects Next.js → Next
```
> This is App Platform, NOT your Droplet. Your /var/www/website and
> /var/www/yorki are completely untouched.

### 3b. Add environment variables
On the env vars screen, add each of these:
```
NEXT_PUBLIC_SUPABASE_URL        https://dibfrhhoslucjgvoszto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY   (anon key — in repo's .env.local)
SUPABASE_SERVICE_ROLE_KEY       (service key)            ← click Encrypt
RESEND_API_KEY                  (your key from Step 2a)  ← click Encrypt
RESEND_FROM                     orders@goldenstonetools.com
NEXT_PUBLIC_SITE_URL            https://goldenstonetools.com
```

### 3c. Deploy
```
Click Deploy → wait ~4 minutes → copy the temporary
xxxxx.ondigitalocean.app URL it gives you
```

---

## STEP 4 — Make yourself the owner

> You must sign up BEFORE you can be made an admin.

### 4a. Sign up
```
Open the temporary .ondigitalocean.app URL → /auth/register
→ create your account → confirm via the email Supabase sends
```

### 4b. Promote yourself (browser, one time)
```
Supabase → SQL Editor → New query → run (use YOUR email):

  INSERT INTO admin_users (user_id, role)
  SELECT id, 'owner' FROM auth.users WHERE email = 'YOUR_EMAIL';
```
This is the only time you touch SQL for accounts. All other staff are
added through the website (Step 7).

---

## STEP 5 — Connect your domains (DigitalOcean, in the browser)

### 5a. Add three domains
```
DO → your app → Settings → Domains → Add Domain (do this 3 times):
  goldenstonetools.com
  admin.goldenstonetools.com
  alerts.goldenstonetools.com
```

### 5b. Add DNS records at your registrar
```
For each, DO shows a record (usually CNAME). Add them where you bought
the domain. Wait 5 min – 1 hr to go live.
```
The app routes each subdomain automatically:
- goldenstonetools.com → store
- admin.goldenstonetools.com → admin dashboard
- alerts.goldenstonetools.com → live order screen

---

## STEP 6 — Auth URLs (Supabase, in the browser)

```
Supabase → Authentication → URL Configuration

Site URL:
  https://goldenstonetools.com

Redirect URLs (add all four):
  https://goldenstonetools.com/api/auth/callback
  https://admin.goldenstonetools.com/api/auth/callback
  https://alerts.goldenstonetools.com/api/auth/callback
  http://localhost:3000/api/auth/callback
```

---

## STEP 7 — Add staff (website UI, no SQL)

```
Staff member signs up at goldenstonetools.com/auth/register first.
Then YOU: admin.goldenstonetools.com/staff
  → enter their email → choose Staff or Owner → Add
```

---

## STEP 8 — Add products

```
admin.goldenstonetools.com → Add Product
→ ID (P001), name, category, price, stock, image URL → Save
Appears on the store instantly.
```

---

## STEP 9 — Open the alerts screen

```
On a tablet / TV / phone: open alerts.goldenstonetools.com
→ sign in once with a staff account → leave it open
Live orders appear with a chime.
```

---

## STEP 10 — Test everything

```
1. alerts.goldenstonetools.com open on a screen (staff signed in)
2. goldenstonetools.com on another device → sign up as customer
3. add product → checkout → place order
4. ✓ alerts screen lights up + chime
5. ✓ customer gets email from orders@goldenstonetools.com
6. ✓ admin.goldenstonetools.com/orders shows it
```

That completes setup. Everything above was browser-only.

═══════════════════════════════════════════════════════════
# PART 2 — CHANGING THE WEBSITE (on your computer)
═══════════════════════════════════════════════════════════

When you want to change the **logo, colors, text, or branding**, you edit
the code. That's done on your computer, then pushed. App Platform
auto-rebuilds and redeploys — you never touch DO.

## One-time computer setup
```bash
# Install git and Node if you don't have them, then:
git clone https://github.com/515woodpl-dot/gswstore.git
cd gswstore
npm install
```

## The edit → deploy loop (every time you change something)
```bash
# 1. make your edits (see "what to edit" below)

# 2. preview locally (optional but recommended)
npm run dev          # opens http://localhost:3000

# 3. ship it
git add -A
git commit -m "update branding"
git push
# → App Platform auto-rebuilds and redeploys in ~4 min. Done.
```

## What to edit for common changes

### The brand name text ("Golden Stone Tools")
```
File: src/components/StoreShell.tsx
Appears in 4 places: top bar, header logo, footer name, copyright.
Find "Golden Stone Tools" and replace.
```

### Brand colors (navy + gold)
```
File: tailwind.config.ts
  brand: {
    navy: "#1e3a5f",   ← change these hex values
    gold: "#c89b3c",
  }
Used everywhere as bg-brand-navy, text-brand-gold, etc.
```

### Swap the text logo for an image logo
```
1. Put your logo file in:  public/logo.png
2. File: src/components/StoreShell.tsx
   Find the header brand line (~line 47):
     <Link href="/" ...>Golden Stone Tools</Link>
   Replace the text with an image:
     <Link href="/"><img src="/logo.png" alt="Golden Stone Tools" className="h-8" /></Link>
```

### Fonts
```
File: src/app/globals.css  (top: --font-sans / --font-mono)
Currently IBM Plex Sans. Change the font-family values.
```

### Homepage hero text / wording
```
File: src/app/page.tsx
Edit the headline and paragraph text in the hero <section>.
```

### Footer contact info / links
```
File: src/components/StoreShell.tsx  (the <footer> block)
```

## Tip — save tokens
For small visual tweaks (logo, colors, text), editing the file directly on
your computer is faster and cheaper than regenerating files. Clone once,
then make changes locally and push whenever you like.

## Cleanup note
The public/ folder still has leftover starter files (next.svg, vercel.svg,
globe.svg, window.svg, file.svg, and old css/js/vendor/img folders from the
earlier Porto attempt). They're harmless but unused — safe to delete to keep
the repo tidy.

═══════════════════════════════════════════════════════════
# ACCOUNT TYPES
═══════════════════════════════════════════════════════════
| Who | Created how | Can do |
|-----|-------------|--------|
| Customer | Self sign-up at /auth/register | Browse, cart, checkout, own orders |
| Staff | Signs up, owner adds at /admin/staff | + inventory, all orders, alerts |
| Owner | First via SQL (Step 4b); rest via /admin/staff | + manage staff |

Everyone uses the same registration form. Roles are granted, not separate forms.
