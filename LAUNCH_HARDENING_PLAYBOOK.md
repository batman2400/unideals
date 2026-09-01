# UniDeals Launch Hardening Playbook

Three-phase launch checklist mapped onto the **actual** stack: Vite 8 + React 19 SPA on Vercel, Supabase RLS/RPCs, and a handful of serverless routes. The original list assumed Next.js (`NEXT_PUBLIC_`, `@next/third-parties`, MDX, `next.config`). Do not treat those items as literal.

**Campus hubs (`/campuses/kdu`) are out of scope.** Internal linking uses existing category hubs (`/category/:slug`) and brand hubs (`/brand/:slug`).

Implement **one batch at a time**. SQL still has to be applied in the Supabase SQL editor after the matching code lands. This document is the plan only — it does not include implementation.

---

## How to use this document

| Batch | When | What |
| --- | --- | --- |
| **A** | Pre-launch (Blocker) | Security headers, `.env` deny, reveal-RPC (codes not preloaded), sanitize 500s |
| **B** | Pre-launch (High / Bugfix) | 1200×630 OG image (fixes live broken fallback), `llms.txt` |
| **C** | After you have IDs | GA4 + Microsoft Clarity (blocked on external IDs) |
| **D** | Launch week | Breadcrumbs, related deals (requires layout fix), BlogPosting, blog deal embeds, CWV |
| **E** | Merchant onboarding | Partner embed badge (blocked on merchant onboarding) |
| **Ops** | Ongoing / Deferred | Crawls, pentest, CORS tightening, Vercel middleware env check, post-launch CSP, backlinks, weekly Clarity reviews |

**Execution Order:** A → B → D. (Batch C executes once GA4/Clarity IDs are provided; Batch E executes during merchant onboarding).

---

## Stack adaptations

Do not copy the original Next.js checklist verbatim.

- There are **no `NEXT_PUBLIC_` keys**. The only client env vars are `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.example`. The anon key is designed to be public. The service role and Resend key already live only in Supabase Edge Functions.
- There is no `next.config`. Global HTTP headers go in `vercel.json`.
- GA4 cannot use `@next/third-parties/google`. Use a small gtag loader in `index.html` or a React helper.
- There is no MDX blog. Posts already live in Supabase and render with `react-markdown` in `src/pages/BlogPost.jsx`.
- Admin session is in **localStorage** (`src/lib/supabaseClient.js`), so Vercel middleware **cannot** see the JWT. Real admin enforcement is Supabase RLS + `src/components/ProtectedRoute.jsx`. Moving auth into httpOnly cookies is a separate auth rewrite, not a header tweak.
- **`DiscountOffer` is not a schema.org type.** Keep `Offer` (already documented in `src/components/DealOfferSchema.jsx`).
- Redis or Vercel KV on a Vercel API route would **not** stop scraping: the client already calls Supabase RPCs directly. Rate limits must live **inside the RPC** (same pattern as OTP).

```
Browser (Vite SPA)
  └─ VITE_SUPABASE_* (anon key only)
       ├─ RPC get_public_deal_by_id  →  must stop returning student codes on load
       ├─ RPC log_online_code_event  →  analytics; add verify + rate limit
       └─ ProtectedRoute (client)    →  admin UI gate; RLS is the real gate

Vercel
  ├─ middleware.js   →  host redirect, deal 404 (no auth; requires Vercel env vars)
  ├─ api/*.js        →  OG / sitemap
  └─ vercel.json     →  SPA rewrite, cache headers; add security headers here

Supabase
  ├─ RLS on sensitive tables
  ├─ SECURITY DEFINER RPCs for public deal reads
  └─ Edge Functions (service role) → OTP email, notifications
```

---

## Already done

No code unless a production check fails.

### Security

- Anon key only in the client bundle; service role / Resend stay in Edge Functions.
- RLS on `user_roles`, `verification_otps` (no client policies; hashed OTP), `manual_verifications`, `redemption_events`, `online_code_events`, `deals` (direct SELECT revoked from `anon`).
- Student ID bucket private + 300-second signed URLs in `src/lib/verificationProof.js` **if** `supabase_security_hardening.sql` is applied in production.
- OTP send: 3 codes / 15 minutes in `send-verification-otp`; confirm: 5 attempts then delete.
- List RPC `get_public_deals()` does **not** return `redemption_code`.
- Detail RPC `get_public_deal_by_id` returns the code only for verified students / admins / owning partners (`supabase_hide_finished_listings.sql`). The remaining gap is that verified students still receive the code **on page load**, before Reveal.
- Admin pages are lazy-loaded; RLS blocks data even if someone opens `/admin`.
- Edge functions `send-verification-otp` and `send-verification-rejected` already sanitize error messages on 500s.

### Metadata / SEO

- 48×48 favicon is already wired: `public/favicon-48-v9.png` in `index.html`.
- Organization JSON-LD with logo is already in `index.html`.
- Dynamic OG/Twitter on deal and blog pages via `react-helmet-async` plus crawler proxies `api/deal-og-proxy.js` and `api/og-proxy.js`.
- Sitemap (`/sitemap.xml` → `api/sitemap.js`), `public/robots.txt`, faceted canonicals (`/deals?…` → `/deals`), deal depth Home → category/brand → `/deals/:id`.
- `Offer` + `BreadcrumbList` on deal pages; FAQ / WebSite / ItemList / Event schemas exist.
- Skeleton loaders: `src/components/DealsLoader.jsx`, route skeletons in `src/App.jsx`.
- Blog CMS exists (Supabase + markdown, not MDX).

### Production SQL check (run in Supabase)

Confirm all of the following in the live project:

1. `verification-documents` bucket `public = false`.
2. OTP values stored as hashes, not plaintext.
3. Latest `get_public_deal_by_id` is the hide-finished version from `supabase_hide_finished_listings.sql`.
4. `supabase_student_verification_admin_gate.sql` is applied (OTP does not auto-verify).

---

## Phase 1 — Critical (pre-launch blockers)

### Batch A — Security

**Micro-execution order:** A3 → A4 → A2 → A1.

#### A3. Stop sending promo codes until Reveal (Priority #1)

**Gap today:** `get_public_deal_by_id` (see `supabase_hide_finished_listings.sql`) returns `redemption_code` on page load for verified students. `src/pages/DealDetails.jsx` only hides it in the UI (`OnlineRedemption` receives the code via props). A scraper or the Network tab sees the code immediately without clicking Reveal. `log_online_code_event` is not rate-limited and does not require `is_verified`.

**Plan:** new SQL file, e.g. `supabase_reveal_deal_code.sql`.

- Students always get `redemption_code = NULL` from `get_public_deal_by_id`.
- New `reveal_online_deal_code(target_deal_id)` SECURITY DEFINER RPC:
  - requires `auth.uid()` and `user_roles.is_verified`
  - refuses coming-soon / expired / unapproved deals
  - rate-limits from `online_code_events`: **15 reveals per user per 10 minutes**, plus **50 per day (global)**. (Note: per-deal caps can be added as an alternative/fallback if heavy shopping sprees hit the ceiling).
  - inserts the `reveal` event and returns the code
- Tighten `log_online_code_event` for `copy` / `click_through` the same way (`is_verified` + higher cap).
- `OnlineRedemption` in `DealDetails.jsx` calls `reveal_online_deal_code` on Reveal instead of reading a preloaded prop.

Admins/partners keep seeing codes via existing dashboard table policies, not this public RPC.

**Do not add Redis/Vercel KV for this.** A KV-wrapped `/api/reveal` would be skippable by calling the RPC. Database limits are the gate that cannot be bypassed.

#### A4. Sanitize Edge Function 500s

**Scope:** Only `supabase/functions/send-inquiry-notification/index.ts` and `supabase/functions/send-event-approved/index.ts` leak `error.message` on 500. (`send-verification-otp` and `send-verification-rejected` are already sanitized).

Note that both leaking functions are invoked directly from the SPA (`src/pages/Contact.jsx` and `src/pages/admin/AdminPendingEvents.jsx`), not solely by internal database webhooks.

Change production responses in both files to generic error strings (`{ success: false, error: "An unexpected error occurred." }`); log the real error server-side.

#### A2. Global security headers

Add a `source: "/(.*)"` block in `vercel.json`:

- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `Permissions-Policy`: lock mic/geolocation, but **must omit `camera` from the deny list (or explicitly set `camera=*`)** so that the partner QR scanner on `/partner` continues to work.

#### A1. Block `.env*` over HTTP

Add deny rules in `vercel.json` for `/.env`, `/.env.local`, `/.env.*`. Gitignore already excludes them; this is belt-and-suspenders so a misplaced file is never served by Vercel.

#### A5. Admin “middleware” — honest scope

Do **not** pretend Vercel middleware can auth-gate `/admin` while the session lives in localStorage. Keep `ProtectedRoute` + RLS. `noindex` is already on those routes; `robots.txt` already disallows `/admin`. Cookie-based auth is a later project, not this batch.

---

### Batch B — Metadata and discovery

#### B1. 1200×630 default OG / Twitter card (Live Bug Fix)

**Live Bug:** `api/og-proxy.js` currently falls back to `https://www.unideals.co/images/og-default.png`, which **does not exist** on disk. Any blog post shared on social media without an explicit cover image currently has a broken preview card.

- Create `public/og-default.png` (1200×630) and ensure it is also accessible at `public/images/og-default.png` (copy or alias).
- Switch homepage Twitter card in `index.html` from `summary` + 512×512 to `summary_large_image`.
- Update every fallback reference that must point to the 1200×630 asset:
  1. `index.html` (`og:image`, `twitter:image`)
  2. `DEFAULT_OG_IMAGE` in `src/pages/DealDetails.jsx` (L26)
  3. `DEFAULT_OG_IMAGE` in `src/pages/BlogPost.jsx` (L9)
  4. Helmet fallbacks across Home, Deals, Category, Brand, Events
  5. `FALLBACK_IMAGE` in `src/components/DealOfferSchema.jsx`
  6. Fallbacks in `api/og-proxy.js` and `api/deal-og-proxy.js`
- Deal/blog pages keep their own custom images when present; set `og:image:width` (1200) / `og:image:height` (630) metadata on default cards.

#### B2. `llms.txt`

Add `public/llms.txt` describing UniDeals, key public routes (`/deals`, `/category/*`, `/brand/*`, `/blog`, `/events`), contact, and what not to scrape (`/admin`, `/partner`, verification flows). Link it from `public/robots.txt`.

#### B3. Favicon / Organization

Already present. Only touch if adding `sameAs` social profile URLs, or a 32×32 `<link rel="icon">` for completeness.

---

### Batch C — Telemetry (needs IDs)

*Blocked until GA4 measurement ID (`G-…`) and Clarity project ID are provided.*

#### C1. Google Analytics 4

- Env: `VITE_GA_MEASUREMENT_ID` (public by design).
- Load gtag only in production when the ID is set.
- Custom events mapped to existing product actions in `DealDetails.jsx`: `deal_reveal`, `deal_copy`, `affiliate_clickout` (click-through), with `deal_id`, `brand`, `category`.

#### C2. Microsoft Clarity (not Hotjar)

Prefer one session-replay tool. Clarity over Hotjar.

- Env: `VITE_CLARITY_PROJECT_ID`.
- Init with **input masking** (`maskAllInputs: true`) so student emails and registration IDs are not stored in replays.
- Add a one-line GA/Clarity mention in `src/pages/PrivacyPolicy.jsx` when the scripts ship.

Do not install both Clarity and Hotjar.

---

## Phase 2 — High priority (launch week)

### Batch D — Hub linking, schema, blog embeds, CWV

#### D1. Bidirectional hub links + breadcrumbs

Campus hubs skipped.

On `src/pages/DealDetails.jsx`:
- **Current UI:** Breadcrumb trail is only `Deals > {brand}` (JSON-LD matches). Brand at L984 is a `<p>`; category at L999 is a `<span>` — neither is a link.
- **Update:** Change trail to `Home → Category (/category/{slug}) → Brand (/brand/{slug}) → Deal`.
- Convert the Category chip (L999) and Brand title (L984) into real React Router `<Link>` components pointing to `/category/{slug}` and `/brand/{slug}`. Update `BreadcrumbSchema` to match.

On `src/pages/CategoryPage.jsx` and `src/pages/BrandPage.jsx`: listings already link to deals (spoke → leaf). That direction is done.

#### D2. Related deals on the deal page (Requires Layout Adjustment)

- **Layout Constraint:** On desktop, `DealDetails.jsx` (L867) is locked into the viewport with `lg:h-[calc(100dvh-5rem)] lg:overflow-hidden`. Appending related deal rows below T&Cs requires switching the desktop shell to `lg:h-auto` / `lg:overflow-y-auto` (or placing the related deals block outside the locked article stage).
- After T&Cs, add two compact rows using data from `get_public_deals()`: “More from {brand}” and “More in {category}”, excluding the current deal ID. Reuse `src/components/DealCard.jsx` or a small carousel.

#### D3. Schema

- Change blog `@type` from `Article` to `BlogPosting` in `src/pages/BlogPost.jsx` (already contains `mainEntityOfPage`).
- Move the blog JSON-LD `<script>` tag inside `<Helmet>` (currently sits directly in the JSX body at L130).
- Keep `Offer` in `src/components/DealOfferSchema.jsx`; optionally add `eligibleCustomerType` / `priceSpecification` if discount text is parseable. Do **not** emit fake `DiscountOffer`.
- After deploy: test with [Google Rich Results](https://search.google.com/test/rich-results).

#### D4. Blog deal embeds

- Extend `react-markdown` in `src/pages/BlogPost.jsx` so authors can insert `[deal:123]` and render a live `DealCard` component.
- Add an authoring helper hint in `src/pages/admin/AdminBlog.jsx` (e.g. "Use [deal:ID] to embed a live deal card").

#### D5. Core Web Vitals (practical, not Next `<Image>`)

- Deal hero image (`DealDetails.jsx` L934–940): add `fetchPriority="high"`, explicit `width`/`height` or aspect-ratio box to protect CLS; keep `loading="eager"`.
- Blog cover image (`BlogPost.jsx` L178–182): add explicit `width`/`height` or aspect-ratio container and `fetchPriority="high"`.
- Deal cards: ensure reserved aspect ratios are maintained.
- Home LCP is a CSS hero, not an image — leave unless profiling says otherwise.
- Add `<link rel="preconnect" href="https://<your-project>.supabase.co" />` in `index.html` for faster asset loading.

---

## Phase 3 — Post-launch (scaling and distribution)

### Batch E — Partner badge (only in-repo item)

*Triggered during merchant onboarding.*

- Add `public/badges/unideals-partner.svg` (and a PNG).
- Short public page or copy-paste snippet: `<a href="https://www.unideals.co">` + badge, for merchant onboarding partners.

---

## Deferred / Ops Checklist

### 1. Edge Function CORS Tightening
All four Edge Functions (`send-verification-otp`, `send-verification-rejected`, `send-inquiry-notification`, `send-event-approved`) currently use `Access-Control-Allow-Origin: *`.
- OTP is browser-called; inquiry and event-approved are also SPA-invoked from `src/pages/Contact.jsx` and `src/pages/admin/AdminPendingEvents.jsx`.
- Tighten CORS origin to `https://www.unideals.co` (plus localhost / preview URLs if testing functions directly from non-prod).

### 2. Post-Launch Content-Security-Policy (CSP)
Defer CSP to post-launch. The SPA loads Google Fonts, Material Symbols, Resend webhooks, and Supabase endpoints. Adding a rigid CSP during pre-launch risks breaking production without extensive staging validation.

### 3. Vercel Middleware Environment Variables Check
`middleware.js` (L114–118) reads `process.env.VITE_SUPABASE_URL` and `process.env.VITE_SUPABASE_ANON_KEY` to validate `/deals/:id` existences.
- **Ops Check:** Verify that `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are explicitly configured in the **Vercel Project Settings → Environment Variables** (for Production and Preview).
- If unset in Vercel, invalid deal IDs fall through via `next()` (returning a 200 with client-rendered "Deal Not Found") instead of an immediate server-level HTTP 404.

### 4. External Ops Playbook (Growth & Monitoring)
- **Screaming Frog:** Crawl `https://www.unideals.co`. Confirm deal URLs are within 3 clicks (Home → category/brand → deal). Audit status codes from `middleware.js`. Confirm faceted `/deals?` URLs canonicalize to `/deals`.
- **Strix / pentest:** Run against **staging**, not production. After Batch A, defensive checks: unauthenticated `get_public_deal_by_id` returns null codes; unverified `reveal_online_deal_code` fails; IDOR on `manual_verifications` / tickets stays RLS-blocked.
- **CWV field data:** CrUX / Search Console / Lighthouse on production after D5. Target LCP under 2.5s, CLS under 0.1.
- **Backlinks:** Compare profiles with Ahrefs Link Intersect / Linkgap vs regional coupon and lifestyle directories. Pitch university student unions and societies for `.ac.lk` and `.edu` resource directory links.
- **Clarity:** Weekly review of verification-modal rage clicks and mobile layout shifts after Batch C ships.

---

## Prerequisites before a given batch

- **Batch A:** Ability to apply a new migration in the production Supabase SQL editor (`supabase_reveal_deal_code.sql`). Redeploy Edge Functions after A4.
- **Batch B:** Approve generating a branded 1200×630 card from the existing logo, or supply artwork.
- **Batch C:** GA4 measurement ID (`G-…`) and Clarity project ID.
- **Batch D:** Batch B OG fallback live is recommended.
- **Batch E:** Brand lockup for the badge (can reuse logo).

---

## File map (when a batch is implemented)

| Batch | Likely files |
| --- | --- |
| **A** | `vercel.json`<br>`supabase_reveal_deal_code.sql` *(new)*<br>`src/pages/DealDetails.jsx`<br>`supabase/functions/send-inquiry-notification/index.ts`<br>`supabase/functions/send-event-approved/index.ts` |
| **B** | `public/og-default.png` *(to create)*<br>`public/images/og-default.png` *(to create)*<br>`public/llms.txt` *(to create)*<br>`public/robots.txt`<br>`index.html`<br>`api/og-proxy.js`<br>`api/deal-og-proxy.js`<br>`src/pages/DealDetails.jsx`<br>`src/pages/BlogPost.jsx`<br>`src/components/DealOfferSchema.jsx`<br>Helmet pages under `src/pages/` |
| **C** | `.env.example`<br>`index.html` or `src/lib/analytics.js`<br>`src/pages/DealDetails.jsx`<br>`src/pages/PrivacyPolicy.jsx` |
| **D** | `src/pages/DealDetails.jsx`<br>`src/pages/BlogPost.jsx`<br>`src/pages/admin/AdminBlog.jsx`<br>`src/components/DealCard.jsx`<br>`src/components/DealOfferSchema.jsx`<br>`src/components/BreadcrumbSchema.jsx`<br>`index.html` |
| **E** | `public/badges/unideals-partner.svg` *(to create)*<br>Public snippet page or footer component |
