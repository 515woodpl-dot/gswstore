# GSW — Setup Commands & Order
Complete command reference, in execution order. Cloud-only architecture.

**Domain:** goldenstonetools.com
**Supabase project ref:** dibfrhhoslucjgvoszto
**Repo:** 515woodpl-dot/gswstore

---

## PART A — Database via Supabase CLI

### A1. Install the CLI
```bash
brew install supabase/tap/supabase      # Mac
# or
npm install -g supabase                 # any OS
```

### A2. Log in
```bash
supabase login
# Opens browser → authorize
```

### A3. Get the code
```bash
git clone https://github.com/515woodpl-dot/gswstore.git
cd gswstore
```

### A4. Link to your project
```bash
supabase link --project-ref dibfrhhoslucjgvoszto
# Prompts for your database password
# (Supabase dashboard → Settings → Database → reset if forgotten)
```

### A5. Push the schema
```bash
supabase db push
```
This runs BOTH migrations in order:
- `20260101000000_store_schema.sql` (customers, carts, orders)
- `20260101000001_cloud_schema.sql` (inventory, categories, admin roles, realtime)

Safe to re-run — already-applied migrations are skipped, and the SQL itself
is idempotent (won't error on a second run).

### A6. Verify
```bash
supabase db diff
# "No schema changes found" = everything applied correctly
```

---

## PART B — Resend (email)

### B1. Create an API key
```
https://resend.com/api-keys  →  Create  →  copy key
```

### B2. Add and verify your domain
```
https://resend.com/domains  →  Add  →  goldenstonetools.com
→ copy the DNS records  →  add them at your domain registrar  →  Verify
```

---

## PART C — Deploy the app (DigitalOcean App Platform)

### C1. Create the app
```
DigitalOcean → App Platform → Create App
→ GitHub → 515woodpl-dot/gswstore → branch: master
```

### C2. Environment variables (paste in the DO dashboard)
```
NEXT_PUBLIC_SUPABASE_URL=https://dibfrhhoslucjgvoszto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service key>          ← mark Encrypted
RESEND_API_KEY=<your key from B1>                ← mark Encrypted
RESEND_FROM=orders@goldenstonetools.com
NEXT_PUBLIC_SITE_URL=https://goldenstonetools.com
```
> Keys are in your .env.local. No INVENTORY_* vars — the Pi is gone.

### C3. Deploy
```
Click Deploy → wait ~4 min → copy the temporary .ondigitalocean.app URL
```

---

## PART D — Create the first owner account

> You can't be an admin until your account exists. So: sign up first, then promote.

### D1. Sign up
```
Open the temp DO URL → /auth/register
→ create your account (full name, email, password)
→ confirm via the email Supabase sends
```

### D2. Promote yourself to owner (one-time, via CLI)
```bash
# From inside the gswstore folder:
supabase db remote commit   # optional — skip
# Run the promotion SQL directly:
psql "$(supabase db remote-url 2>/dev/null)" -c \
  "INSERT INTO admin_users (user_id, role) SELECT id, 'owner' FROM auth.users WHERE email = 'YOUR_EMAIL';"
```

**Simpler alternative — paste in the dashboard:**
```
Supabase → SQL Editor → run:
  INSERT INTO admin_users (user_id, role)
  SELECT id, 'owner' FROM auth.users WHERE email = 'YOUR_EMAIL';
```

From now on, every other staff member is added through the UI (Part G) —
this SQL step is only needed for the very first owner.

---

## PART E — Domains & subdomains

### E1. Add three domains in DO
```
DO → your app → Settings → Domains → add:
  goldenstonetools.com
  admin.goldenstonetools.com
  alerts.goldenstonetools.com
```

### E2. Add the DNS records at your registrar
```
For each domain, add the record DO shows you (usually CNAME).
Wait 5 min – 1 hr for propagation.
```
The app routes each subdomain automatically:
- goldenstonetools.com → storefront
- admin.goldenstonetools.com → admin dashboard
- alerts.goldenstonetools.com → live order screen

---

## PART F — Supabase Auth URLs

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

## PART G — Add staff (through the UI — no more SQL)

> This is the new staff management page. Owners only.

### G1. The staff member signs up first
```
They go to goldenstonetools.com/auth/register and create a normal account.
```

### G2. You grant them access
```
Go to admin.goldenstonetools.com/staff  (or /admin → "Staff" button)
→ enter their account email
→ choose role:
    Staff  = manage inventory + orders
    Owner  = also manage staff
→ Add
```

### G3. Remove access anytime
```
Same page → find the person → Remove
(You can't remove yourself.)
```

---

## PART H — Add products

```
admin.goldenstonetools.com  →  Add Product
→ ID (e.g. P001), name, category, price, stock, image URL  →  Save
Products appear on the storefront immediately.
```

---

## PART I — Open the alerts screen

```
On a tablet / TV / phone:  open  alerts.goldenstonetools.com
Sign in once with a staff or owner account.
Leave it open — live orders appear instantly with a chime.
```

---

## PART J — End-to-end test

```
1. alerts.goldenstonetools.com open on one screen (signed in as staff)
2. goldenstonetools.com on another device → sign up as a customer
3. add product → checkout → place order
4. ✓ alerts screen lights up + chime
5. ✓ customer gets email from orders@goldenstonetools.com
6. ✓ admin.goldenstonetools.com/orders shows it, status editable
```

---

## ACCOUNT TYPES — quick reference

| Who | How they're created | What they can do |
|-----|--------------------|------------------|
| **Customer** | Self sign-up at /auth/register | Browse, cart, checkout, see own orders |
| **Staff** | Sign up, then owner adds them at /admin/staff | + manage inventory, see/manage all orders, alerts |
| **Owner** | First one via SQL (D2); others via /admin/staff | + add/remove staff |

**The only form anyone fills out is the normal registration form.**
Staff and owners are just registered accounts that have been granted a role.

---

## RE-RUNNING THE SCHEMA LATER

If you change the database, add a new migration file and push:
```bash
# create a new timestamped migration in supabase/migrations/
supabase db push        # applies only the new one
```

To apply the same schema to a fresh Supabase project, just change the ref:
```bash
supabase link --project-ref NEW_PROJECT_REF
supabase db push
```
