# GSW — Deploy Checklist
One page. Tick top to bottom. Each step unlocks the next.

---

## ☐ 1. Database (Supabase SQL Editor — browser)
```
□ Open: https://raw.githubusercontent.com/515woodpl-dot/gswstore/master/FULL_SCHEMA.sql
□ Ctrl+A → Ctrl+C → paste into SQL Editor → Run
□ Database → Replication → confirm "orders" is listed
```
> Use FULL_SCHEMA.sql — ONE file, ONE paste. Do NOT use the old
> STORE_SCHEMA.sql + CLOUD_SCHEMA.sql two-file method.
>
> ⚠ If you ever hit "column category_id does not exist", it means a
> half-built table exists. Fix: run RESET_AND_BUILD.sql instead
> (drops + rebuilds clean — only safe before you have real data):
> https://raw.githubusercontent.com/515woodpl-dot/gswstore/master/RESET_AND_BUILD.sql

## ☐ 2. Resend (browser) — start early, DNS is slow
```
□ resend.com/domains → add goldenstonetools.com
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

## Schema files — which is which
| File | Use it for |
|------|-----------|
| **FULL_SCHEMA.sql** | First-time setup. One paste, builds everything. |
| **RESET_AND_BUILD.sql** | Only if you hit the category_id error — wipes & rebuilds. Pre-data only. |
| STORE_SCHEMA.sql / CLOUD_SCHEMA.sql | Old two-file method — DON'T use, kept for reference only. |

## The one trap
Can't become owner (Step 4) until deployed AND signed up once — your admin
row points at your account, which doesn't exist until you register.

## Common issues
- "column category_id does not exist" → run RESET_AND_BUILD.sql (Step 1 note)
- Empty store? → no products yet, or schema didn't finish
- Can't reach /admin? → not an owner yet (Step 4), or not signed in
- Alerts blank? → realtime not enabled (Step 1)
- No emails at all? → Resend domain not verified (Step 2)
- Login loops? → auth redirect URLs not set (Step 6)
- Status email not arriving? → only sends on change away from pending; domain verified?
