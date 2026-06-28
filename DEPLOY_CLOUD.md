# GSW — Cloud-Only Deployment Guide
## No Pi. Everything on DigitalOcean + Supabase.

**Domain:** goldenstonetools.com
**Architecture:** One Next.js app on DO, three subdomains, one Supabase backend.

```
goldenstonetools.com        → storefront (customers)
admin.goldenstonetools.com  → inventory + order management (staff)
alerts.goldenstonetools.com → live order screen (Supabase Realtime)
                ↓
         ONE Supabase project
   (products, orders, auth, realtime)
```

No Pi. No Tailscale. No webhook. No SSE bridge. Every part talks to Supabase.

---

## What changed from the old design

| Old (Pi-based) | New (cloud-only) |
|----------------|------------------|
| Pi hosted inventory app | Inventory lives in Supabase, managed at /admin |
| Store read products from Pi via Tailscale | Store reads products from Supabase |
| Order webhook Pi ← store (could be missed) | Orders go to Supabase; nothing to miss |
| SSE bridge Pi → alerts screen | Supabase Realtime → alerts screen |
| 3 apps, 4 fragile network hops | 1 app + Supabase |

---

## PHASE 1 — Supabase setup

### Step 1 — Run the customer schema (if not already done)
```
Supabase dashboard → SQL Editor → New query
Paste contents of: gswstore/STORE_SCHEMA.sql → Run
```

### Step 2 — Run the cloud schema
```
SQL Editor → New query
Paste contents of: gswstore/CLOUD_SCHEMA.sql → Run
```
This creates: inventory, categories, admin_users tables + Realtime on orders.

### Step 3 — Make yourself an admin
After you've signed up on the site once (Step 9), run in SQL Editor:
```sql
INSERT INTO admin_users (user_id, role)
SELECT id, 'owner' FROM auth.users WHERE email = 'YOUR_EMAIL@example.com';
```

### Step 4 — Confirm Realtime is enabled
```
Supabase → Database → Replication
Ensure "orders" is in the supabase_realtime publication
(CLOUD_SCHEMA.sql already adds it, just verify)
```

---

## PHASE 2 — Resend email

### Step 5 — Get a Resend API key
```
https://resend.com/api-keys → Create → copy key
```

### Step 6 — Verify goldenstonetools.com in Resend
```
https://resend.com/domains → Add domain → goldenstonetools.com
Add the DNS records it shows to your registrar → Verify
```

---

## PHASE 3 — Deploy to DigitalOcean App Platform

### Step 7 — Create the app
```
DO → App Platform → Create App
→ GitHub → 515woodpl-dot/gswstore → branch: master
→ (auto-detected as Next.js)
→ STOP at Environment Variables
```

### Step 8 — Add environment variables
```
NEXT_PUBLIC_SUPABASE_URL
→ https://dibfrhhoslucjgvoszto.supabase.co

NEXT_PUBLIC_SUPABASE_ANON_KEY
→ eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpYmZyaGhvc2x1Y2pndm9zenRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0NDQxMzksImV4cCI6MjA5ODAyMDEzOX0.bfcm3v1omAmoWlmQYwlACa88kJAiAGeQcKzEBYuYy7Y

SUPABASE_SERVICE_ROLE_KEY  ← Encrypted
→ eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpYmZyaGhvc2x1Y2pndm9zenRvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjQ0NDEzOSwiZXhwIjoyMDk4MDIwMTM5fQ.TRrBQD4rR0oqigx_vYxY26GlV-MbmpUTzRVTaF4Io8w

RESEND_API_KEY  ← Encrypted
→ [your key from Step 5]

RESEND_FROM
→ orders@goldenstonetools.com

NEXT_PUBLIC_SITE_URL
→ https://goldenstonetools.com
```

> Note: there is NO INVENTORY_API_BASE or INVENTORY_WEBHOOK_URL anymore. The Pi is gone.

### Step 9 — Deploy
```
Click Deploy → wait ~4 min → get the temp URL
Visit it, sign up for an account (this creates your auth.users row)
Then go back to Supabase Step 3 to make that account an admin
```

---

## PHASE 4 — Domains & subdomains

### Step 10 — Add all three domains in DO
```
DO → your app → Settings → Domains → Add Domain (three times):
  goldenstonetools.com
  admin.goldenstonetools.com
  alerts.goldenstonetools.com
```

### Step 11 — Add DNS records at your registrar
```
For each, DO shows you a record. Typically:
  goldenstonetools.com         CNAME or A → DO app
  admin.goldenstonetools.com   CNAME      → DO app
  alerts.goldenstonetools.com  CNAME      → DO app
Wait for DNS to propagate (5 min – 1 hr)
```

The app's middleware automatically routes:
- alerts.goldenstonetools.com → the /alerts screen
- admin.goldenstonetools.com → the /admin dashboard
- goldenstonetools.com → the storefront

---

## PHASE 5 — Supabase Auth URLs

### Step 12 — Set redirect URLs
```
Supabase → Authentication → URL Configuration

Site URL:
  https://goldenstonetools.com

Redirect URLs (add all):
  https://goldenstonetools.com/api/auth/callback
  https://admin.goldenstonetools.com/api/auth/callback
  https://alerts.goldenstonetools.com/api/auth/callback
  http://localhost:3000/api/auth/callback
```

---

## PHASE 6 — Add your products

### Step 13 — Use the admin panel
```
Go to admin.goldenstonetools.com (sign in as your admin account)
→ Add Product → fill in ID, name, category, price, stock, image URL
→ Save
```
Products appear on the storefront immediately.

> Image URLs: upload images to Supabase Storage (item-images bucket) or
> paste any public image URL.

---

## PHASE 7 — Open the alerts screen

### Step 14 — On any device
```
Open alerts.goldenstonetools.com on a tablet, TV, or phone
Sign in once with a staff/admin account
Leave it open — it shows live orders via Supabase Realtime
```

---

## End-to-end test

```
1. Open alerts.goldenstonetools.com on one screen (signed in as admin)
2. On another device, go to goldenstonetools.com
3. Sign up / sign in as a customer
4. Add a product to cart → checkout → place order
5. ✓ Alerts screen lights up instantly with chime
6. ✓ Customer receives email from orders@goldenstonetools.com
7. ✓ admin.goldenstonetools.com/orders shows the order, status editable
```

---

## Why this is more reliable

- **No order can be missed.** Orders write to Supabase first; the alerts screen
  reads from Supabase. There's no separate machine that has to be online at the
  moment of checkout.
- **Self-healing.** If the alerts screen disconnects, Supabase Realtime
  reconnects automatically and the screen reloads recent orders.
- **No home internet dependency.** Everything is in DO + Supabase datacenters.
- **Manage from anywhere.** Inventory admin is a website — edit stock from your
  phone, home, or the shop. No Tailscale, no being physically present.

---

## What still needs your input

| Item | Action |
|------|--------|
| Resend API key | Get from resend.com/api-keys |
| goldenstonetools.com verified in Resend | Add DNS records |
| STORE_SCHEMA.sql + CLOUD_SCHEMA.sql run | Supabase SQL Editor |
| Your account promoted to admin | Run the INSERT in Step 3 |
| 3 domains added in DO + DNS records | DO dashboard + registrar |
| Supabase Auth redirect URLs | Set to the 3 subdomains |
| Products added | Via admin.goldenstonetools.com |
