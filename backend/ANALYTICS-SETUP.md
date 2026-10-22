# Private site analytics

Open `/dashboard.html` on the backend project, enter the existing importer password, then choose Analytics. Reports are fetched through a server-authenticated endpoint with no-store caching. The static interface contains no report data or password. Anyone who knows the importer password has admin access; no new public access to the database is granted.

## Release order

1. Review and apply `supabase-analytics-schema.sql` to the existing Supabase project. This adds a new isolated table; products, inventory, orders and customers are unchanged. Verify RLS is enabled and anon/authenticated roles cannot SELECT or INSERT.
2. Deploy the backend branch as a preview. Existing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and IMPORT_PASSWORD are reused. Keep ANALYTICS_ENABLED unset until ready.
3. Set ANALYTICS_ENABLED=true on the production backend and deploy it. Configure a Vercel firewall rate limit for POST /api/analytics-event before enabling collection. The endpoint has a per-session ceiling, but origin checks and random IDs are not bot-proof abuse protection.
4. Deploy the storefront changes. This adds a small deferred tracker and the privacy-page disclosure and opt-out. It records page/category views, random browser/session IDs, referral domain, coarse device, product code, add-to-cart, and successful checkout redirects. It does not record purchases, emails, order tokens, payment data, raw IPs, arbitrary query strings or session replay. Existing GA/Vercel tags remain independent.
5. Verify a real storefront visit and category/product/cart/checkout actions appear in admin, then verify the report endpoint returns 401 without the password and the table is inaccessible with the public key. Checkout starts mean a checkout URL was returned, not a paid order. Test in a clean browser with no real payment needed.

## Reporting limits

Time windows are rolling 24-hour periods; chart dates use America/Los_Angeles. Visitors estimate browsers across the selected range; sessions expire after 30 minutes of inactivity and are tab-scoped. First source is based on the earliest recorded event within the selected range, not necessarily the original lifetime session source. Navigation reflects observed page/category views and omits query parameters except product ID, archive and known category. DNT, GPC, opt-out, unavailable storage, blockers, bots and private browsing affect counts. Reports cap at 50,000 events and display a warning at the cap. No historical GA/Vercel import, completed purchase attribution, geographic tracking, or automated retention job is included in this first version.

Disable collection immediately by removing ANALYTICS_ENABLED or setting it to false and redeploying backend. Reports remain available. Browser opt-out lives in localStorage `vcp_analytics_opt_out=1`. Data is retained until deleted by an admin; agree on retention before production enablement.

Run `node --test backend/tests/analytics.test.js` for auth, privacy filtering, aggregation, tracker and endpoint checks.
