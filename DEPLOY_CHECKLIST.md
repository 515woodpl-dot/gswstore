# GSW — Deploy Checklist
One page. Tick top to bottom. Don't skip ahead — each step unlocks the next.

---

## ☐ 1. Supabase — database
```
□ Supabase → SQL Editor → run STORE_SCHEMA.sql
□ Supabase → SQL Editor → run CLOUD_SCHEMA.sql
□ Database → Replication → confirm "orders" is in supabase_realtime
```

## ☐ 2. Resend — email (start early, DNS is slow)
```
□ resend.com/api-keys → create key → copy it       → RESEND_API_KEY
□ resend.com/domains → add goldenstonetools.com
□ add Resend's DNS records at your registrar
□ click Verify (can take up to 1 hr — keep going meanwhile)
```

## ☐ 3. DigitalOcean — deploy
```
□ DO → App Platform → Create App
□ Connect GitHub → 515woodpl-dot/gswstore → branch: master
□ Add env vars (see box below)
□ Click Deploy → wait ~4 min → copy the temp .ondigitalocean.app URL
```

**Env vars to paste:**
```
NEXT_PUBLIC_SUPABASE_URL        https://dibfrhhoslucjgvoszto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY   (anon key)
SUPABASE_SERVICE_ROLE_KEY       (service key)   ← mark Encrypted
RESEND_API_KEY                  (your key)       ← mark Encrypted
RESEND_FROM                     orders@goldenstonetools.com
NEXT_PUBLIC_SITE_URL            https://goldenstonetools.com
```

## ☐ 4. Become admin (MUST be after first sign-up)
```
□ Open the temp DO URL → sign up for an account
□ Supabase → SQL Editor → run:
    INSERT INTO admin_users (user_id, role)
    SELECT id, 'owner' FROM auth.users WHERE email = 'YOUR_EMAIL';
```

## ☐ 5. Domains
```
□ DO → app → Settings → Domains → add all three:
    goldenstonetools.com
    admin.goldenstonetools.com
    alerts.goldenstonetools.com
□ Add each DNS record DO gives you, at your registrar
□ Wait for propagation (5 min – 1 hr)
```

## ☐ 6. Supabase Auth URLs (after domains live)
```
□ Supabase → Authentication → URL Configuration
□ Site URL:  https://goldenstonetools.com
□ Redirect URLs — add all four:
    https://goldenstonetools.com/api/auth/callback
    https://admin.goldenstonetools.com/api/auth/callback
    https://alerts.goldenstonetools.com/api/auth/callback
    http://localhost:3000/api/auth/callback
```

## ☐ 7. Add products
```
□ admin.goldenstonetools.com → sign in → Add Product
□ Fill ID, name, category, price, stock, image URL → Save
```

## ☐ 8. Final test
```
□ Open alerts.goldenstonetools.com (signed in as admin) on a screen
□ On another device: goldenstonetools.com → sign up → add to cart → checkout
□ ✓ Alerts screen lights up + chime
□ ✓ Customer gets email from orders@goldenstonetools.com
□ ✓ admin.goldenstonetools.com/orders shows it, status editable
```

---

## The one trap
You can't do **Step 4** (become admin) until **Step 3** is deployed and you've
signed up once — your admin row points at your auth account, which doesn't exist
until you register. Deploy → sign up → THEN promote to admin.

## If something's wrong
- Storefront empty? → No products yet (Step 7), or RLS — confirm CLOUD_SCHEMA ran.
- Can't reach /admin? → You're not an admin yet (Step 4), or not signed in.
- Alerts screen blank/not updating? → Realtime not enabled (Step 1, third box).
- No emails? → Resend domain not verified yet (Step 2), or wrong key.
- Login loops/fails? → Auth redirect URLs not set (Step 6).
