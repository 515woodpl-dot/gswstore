# GSW — Setup & Maintenance Guide
Two parts:
- **PART 1 — Setup:** all in the browser. No computer, no terminal.
- **PART 2 — Changing the website** (logo, branding, text): on your computer.

**Domain:** goldenstonetools.com
**Supabase project:** dibfrhhoslucjgvoszto
**Repo:** github.com/515woodpl-dot/gswstore
**Hosting:** DigitalOcean App Platform (separate from your /var/www Droplet)
**Shop phone:** +1 253-449-6246
**Order email:** orders@goldenstonetools.com (sends AND receives)

═══════════════════════════════════════════════════════════
# PART 1 — SETUP (browser only)
═══════════════════════════════════════════════════════════

## STEP 1 — Database (Supabase, in the browser)

Paste the schema files into Supabase's web SQL editor, in order.

### 1a. Open the SQL Editor
```
https://supabase.com/dashboard/project/dibfrhhoslucjgvoszto
→ SQL Editor → New query
```

### 1b. Run the schema and migrations IN ORDER
From the gswstore repo on GitHub, open each file, click "Raw", copy all,
paste into a New query, click Run. Start with:
```
1. supabase/schema/FULL_SCHEMA.sql
2. supabase/migrations/20260630195304_reviews_attrs_tax.sql and every
   later dated migration, in filename order
```
> `supabase/schema/STORE_SCHEMA.sql` and `supabase/schema/CLOUD_SCHEMA.sql` are
> the old two-file setup and are kept for reference only.

### 1c. Confirm realtime is on
```
Database → Replication → confirm "orders" is listed
```

---

## STEP 2 — Email (Resend, in the browser)

> Two emails go out per order, BOTH from orders@goldenstonetools.com:
>   • Customer gets an order confirmation
>   • Shop gets a "new order" notice AT orders@goldenstonetools.com
> Plus: when staff change an order's status, the customer is auto-emailed.
> ALL of this requires the domain to be verified first (below).

### 2a. The API key
```
Retrieve RESEND_API_KEY from the team password manager.
(You'll paste it into DigitalOcean in Step 3b.)
```

### 2b. Verify your domain  ← REQUIRED or no email sends
```
https://resend.com/domains → Add → goldenstonetools.com
→ copy the DNS records → add them at your domain registrar → Verify
(can take up to an hour)
```
Until "goldenstonetools.com" shows Verified in Resend, no emails send at all.

---

## STEP 3 — Deploy the app (DigitalOcean, in the browser)

### 3a. Create the app
```
https://cloud.digitalocean.com/apps → Create App
→ GitHub → 515woodpl-dot/gswstore → branch: master → Next
```
> App Platform, NOT your Droplet. /var/www/website and /var/www/yorki untouched.

### 3b. Environment variables (paste all of these)
```
NEXT_PUBLIC_SUPABASE_URL     https://dibfrhhoslucjgvoszto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY  (anon key — in repo .env.local)
SUPABASE_SERVICE_ROLE_KEY    (service key)         ← mark Encrypted
RESEND_API_KEY               (paste from password manager)  ← Encrypted
RESEND_FROM                  orders@goldenstonetools.com
SHOP_NOTIFY_EMAIL            orders@goldenstonetools.com
NEXT_PUBLIC_SHOP_PHONE       +1 253-449-6246
NEXT_PUBLIC_SITE_URL         https://goldenstonetools.com
```

### 3c. Deploy
```
Deploy → wait ~4 min → copy the temporary xxxxx.ondigitalocean.app URL
```

---

## STEP 4 — Make yourself the owner

> You must sign up BEFORE you can be made an admin.

### 4a. Sign up
```
Open the temp URL → /auth/register → create your account → confirm via email
```

### 4b. Promote yourself (browser, one time)
```
Supabase → SQL Editor → run (use YOUR email):

  INSERT INTO admin_users (user_id, role)
  SELECT id, 'owner' FROM auth.users WHERE email = 'YOUR_EMAIL';
```

---

## STEP 5 — Connect your domains

### 5a. Add three domains in DO
```
DO → app → Settings → Domains → add:
  goldenstonetools.com
  admin.goldenstonetools.com
  alerts.goldenstonetools.com
```

### 5b. Add the DNS records at your registrar, wait for propagation.
The app auto-routes each subdomain (store / admin / alerts).

---

## STEP 6 — Supabase Auth URLs
```
Supabase → Authentication → URL Configuration
Site URL:  https://goldenstonetools.com
Redirect URLs (add all):
  https://goldenstonetools.com/api/auth/callback
  https://admin.goldenstonetools.com/api/auth/callback
  https://alerts.goldenstonetools.com/api/auth/callback
  http://localhost:3000/api/auth/callback
```

---

## STEP 7 — Add staff (website UI, no SQL)
```
Staff signs up at goldenstonetools.com/auth/register first.
Then YOU: admin.goldenstonetools.com/staff → enter email → Staff or Owner → Add
```

---

## STEP 8 — Add products
```
admin.goldenstonetools.com → Add Product
Fields: ID, name, category, price, stock, main image URL,
        gallery images (one URL per line), description,
        ☑ Visible in store,  ☑ Featured (homepage slideshow — up to 5)
```

---

## STEP 9 — Open the alerts screen
```
On a tablet/TV/phone: alerts.goldenstonetools.com → sign in as staff → leave open
Live orders appear with a chime.
```

---

## STEP 10 — Test
```
1. alerts.goldenstonetools.com open (staff signed in)
2. goldenstonetools.com on another device → sign up → add to cart → checkout
3. ✓ alerts screen lights up + chime
4. ✓ customer gets confirmation email
5. ✓ shop gets a "new order" email at orders@goldenstonetools.com
6. ✓ admin.goldenstonetools.com/orders shows it
7. Change the order status → ✓ customer gets a status email
```

═══════════════════════════════════════════════════════════
# ORDER STATUS & CUSTOMER MESSAGES
═══════════════════════════════════════════════════════════

Staff change an order's status in admin.goldenstonetools.com/orders.
Each status shows the customer a friendly message on their My Orders page
AND auto-emails them:

| Status            | Customer sees / is emailed |
|-------------------|----------------------------|
| Pending / Confirmed | "We've got your order — we're working on it." |
| Ready for pickup  | "Your order is ready for pickup!" |
| Item Unavailable  | Your typed note + "We'll call you soon, or reach us at +1 253-449-6246" (with a call button) |
| Completed         | "Order complete." |
| Cancelled         | "Order cancelled — call us with questions." |

**Item Unavailable:** when staff pick this status, an amber note box appears.
Staff type which item is unavailable and why. That note is shown to the
customer and included in their email, along with the shop phone number.

═══════════════════════════════════════════════════════════
# PART 2 — CHANGING THE WEBSITE (on your computer)
═══════════════════════════════════════════════════════════

For logo, colors, text, branding — edit the code, push, and App Platform
auto-redeploys. You never touch DO.

## One-time
```bash
git clone https://github.com/515woodpl-dot/gswstore.git
cd gswstore
npm install
```

## Edit → deploy loop
```bash
# make edits, then:
npm run dev          # preview at http://localhost:3000 (optional)
git add -A
git commit -m "update branding"
git push             # auto-redeploys in ~4 min
```

## What to edit
```
Brand name text   src/components/StoreShell.tsx  (4 spots: bar, header, footer, copyright)
Brand colors      tailwind.config.ts  (brand.navy / brand.gold)
Text → image logo public/logo.png + StoreShell.tsx header line
Fonts             src/app/globals.css  (--font-sans / --font-mono)
Hero/slideshow    src/app/page.tsx  (slideshow pulls "featured" products)
Footer + phone    src/components/StoreShell.tsx
Phone number      easiest: change NEXT_PUBLIC_SHOP_PHONE in DO env vars (no code)
```

## Changing the schema later
```bash
# add a new file to supabase/migrations/ then:
supabase db push        # applies only new migrations
# (or paste the new SQL into the Supabase SQL Editor)
```

## Tip — save tokens
For small visual tweaks, edit the file directly on your computer and push —
cheaper and faster than regenerating files.

═══════════════════════════════════════════════════════════
# ENV VARS — QUICK REFERENCE (set in DigitalOcean)
═══════════════════════════════════════════════════════════
| Var | Value | Encrypted? |
|-----|-------|-----------|
| NEXT_PUBLIC_SUPABASE_URL | https://dibfrhhoslucjgvoszto.supabase.co | no |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | (anon key) | no |
| SUPABASE_SERVICE_ROLE_KEY | (service key) | YES |
| RESEND_API_KEY | (password manager) | YES |
| RESEND_FROM | orders@goldenstonetools.com | no |
| SHOP_NOTIFY_EMAIL | orders@goldenstonetools.com | no |
| NEXT_PUBLIC_SHOP_PHONE | +1 253-449-6246 | no |
| NEXT_PUBLIC_SITE_URL | https://goldenstonetools.com | no |

═══════════════════════════════════════════════════════════
# ACCOUNT TYPES
═══════════════════════════════════════════════════════════
| Who | Created how | Can do |
|-----|-------------|--------|
| Customer | Self sign-up at /auth/register | Browse, cart, checkout, track own orders |
| Staff | Signs up, owner adds at /admin/staff | + inventory, all orders, set status, alerts |
| Owner | First via SQL (Step 4b); rest via /admin/staff | + manage staff |

Everyone uses the same registration form. Roles are granted, not separate forms.
