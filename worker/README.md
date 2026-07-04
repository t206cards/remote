# t206cards — email + password signup Worker

A Cloudflare Worker that lets shoppers create an account with **just email +
password**. It creates the BigCommerce customer server-side via the API (so no
address is required) and logs them straight in via the Customer Login (SSO) API.

This exists because the store's Account Signup Form requires a full, locked
address and the storefront CSP blocks the in-theme workarounds. See
`../docs/simplified-signup.md` for the full backstory.

```
Browser  ──POST email+password──▶  Worker  ──create customer (Customers V3 API)──▶ BigCommerce
                                     │
                                     └──sign SSO JWT──▶  redirect to /login/token/<jwt>  ──▶ logged in
```

---

## 1. Get the BigCommerce credentials

In the BC control panel: **Settings → Store-level API accounts → Create API
account** (type: *Store API Account*). Enable these OAuth scopes:

- **Customers**: *modify*
- **Customer Login**: *login*

Create it, then copy from the download/dialog:

- **Access Token** → this is `BC_TOKEN`
- **Client ID** → `BC_CLIENT_ID`
- **Client Secret** → `BC_CLIENT_SECRET`
- **Store hash** → `STORE_HASH` (also the `s-XXXX` in your CDN URLs — looks like `2781s2b091`)

## 2. Configure & deploy the Worker

```bash
cd worker
npm install
npx wrangler login          # you're already logged in to Cloudflare

# secrets (never commit these):
npx wrangler secret put BC_TOKEN
npx wrangler secret put BC_CLIENT_ID
npx wrangler secret put BC_CLIENT_SECRET
# optional bot protection:
# npx wrangler secret put TURNSTILE_SECRET

# check STORE_HASH / STORE_URL in wrangler.toml, then:
npm run deploy
```

## 3. Choose how the storefront reaches the Worker

**Option A — same-origin route (recommended).** If `t206cards.com` DNS is on
Cloudflare (proxied), uncomment the `routes` block in `wrangler.toml`, redeploy,
and set the theme form's `action="/account/register"`. No CSP issues, cleanest.

**Option B — workers.dev / subdomain.** If the domain is *not* on Cloudflare,
the Worker serves at `https://t206-signup.<subdomain>.workers.dev/register`; set
the theme form `action` to that full URL. Then the storefront CSP must allow
posting there — if the form silently does nothing, the CSP `form-action`
directive is blocking it, in which case Option A (or adding the origin to the
store's CSP) is required.

## 4. Point the signup page at it

Replace `templates/pages/auth/create-account.html` with the custom form in
`../theme/templates/pages/auth/create-account.custom.html` and set its `action`
to match step 3. Then delete the placeholder Default Values from the Account
Signup Form (they're no longer needed — nothing fake is stored).

## 5. Test

- New email + password → account created, logged in, lands on the account page.
- Existing email → "account already exists" message.
- Weak password → clear requirements message.

## Notes / hardening

- **Bot protection:** the Worker rejects posts whose Origin/Referer isn't the
  store. For stronger protection add **Cloudflare Turnstile** (set
  `TURNSTILE_SECRET`, add the widget to the form) — it's Cloudflare-native and free.
- **Password rules** are enforced by BigCommerce; the Worker surfaces the error.
- **No address is stored.** Name defaults to "Collector / Member" on the record
  until the shopper enters real details at checkout; adjust `DEFAULT_FIRST_NAME` /
  `DEFAULT_LAST_NAME` in `wrangler.toml` if you prefer.
- Rotate the API token if it's ever exposed.
