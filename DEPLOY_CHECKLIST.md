# GSW — Deploy Checklist
One page. Tick top to bottom. Each step unlocks the next.

---

## ☐ 1. Database (Supabase SQL Editor — browser)
```
□ run STORE_SCHEMA.sql   (Raw → copy → paste → Run)
□ run CLOUD_SCHEMA.sql    (includes inventory, roles, realtime,
                           featured/images, item-unavailable status)
□ Database → Replication → confirm "orders" is listed
```

## ☐ 2. Resend (browser) — start early, DNS is slow
```
□ Domain: resend.com/domains → add goldenstonetools.com
□ add its DNS records at your registrar → Verify
   (NO email sends until this shows Verified)
□ Key already issued: re_BCvTtaW3_N3cfVcsoDJ6hha34EUhfSHmJ
```

## ☐ 3. Deploy (DigitalOcean App Platform — browser)
```
□ Create App → GitHub → 515woodpl-dot/gswstore → branch master
□ Add env vars (box below)
□ Deploy → copy temp .ondigitalocean.app URL
```
**Env vars:**
```
NEXT_PUBLIC_SUPABASE_URL        https://dibfrhhoslucjgvoszto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY   (anon key)
SUPABASE_SERVICE_ROLE_KEY       (service key)          ← Encrypted
RESEND_API_KEY                  re_BCvTtaW3_N3cfVcsoDJ6hha34EUhfSHmJ  ← Encrypted
RESEND_FROM                     orders@goldenstonetools.com
SHOP_NOTIFY_EMAIL               orders@goldenstonetools.com
NEXT_PUBLIC_SHOP_PHONE          +1 253-449-6246
NEXT_PUBLIC_SITE_URL            https://goldenstonetools.com
```

## ☐ 4. Become owner (AFTER signing up once)
```
□ open temp URL → /auth/register → sign up → confirm email
□ Supabase → SQL Editor:
    INSERT INTO admin_users (user_id, role)
    SELECT id, 'owner' FROM auth.users WHERE email = 'YOUR_EMAIL';
```

## ☐ 5. Domains
```
□ DO → app → Settings → Domains → add:
    goldenstonetools.com / admin.goldenstonetools.com / alerts.goldenstonetools.com
□ add each DNS record at your registrar → wait for propagation
```

## ☐ 6. Supabase Auth URLs
```
□ Site URL: https://goldenstonetools.com
□ Redirect URLs:
    https://goldenstonetools.com/api/auth/callback
    https://admin.goldenstonetools.com/api/auth/callback
    https://alerts.goldenstonetools.com/api/auth/callback
    http://localhost:3000/api/auth/callback
```

## ☐ 7. Products & staff
```
□ admin.goldenstonetools.com → Add Product (tick Featured for slideshow)
□ admin.goldenstonetools.com/staff → add staff by email (owner only)
```

## ☐ 8. Test
```
□ alerts.goldenstonetools.com open (staff signed in)
□ goldenstonetools.com → sign up → add to cart → checkout
□ ✓ alerts screen chimes
□ ✓ customer gets confirmation email
□ ✓ shop gets new-order email at orders@goldenstonetools.com
□ ✓ change status in admin → customer gets a status email
```

---

## The one trap
Can't become owner (Step 4) until deployed AND signed up once — your admin
row points at your account, which doesn't exist until you register.

## Common issues
- Empty store? → no products yet, or CLOUD_SCHEMA didn't run
- Can't reach /admin? → not an owner yet (Step 4), or not signed in
- Alerts blank? → realtime not enabled (Step 1)
- No emails at all? → Resend domain not verified (Step 2)
- Login loops? → auth redirect URLs not set (Step 6)
- Status email not arriving? → only sends on change AWAY from pending; domain verified?
