# Simplified signup for t206cards.com — SHIPPED

**Goal:** let collectors create an account with just **email + password** (name/address are
collected at checkout, not at signup).

**Status:** ✅ Live. New accounts are created from email + password only, with no address, and
the shopper is logged in automatically. Cloudflare Turnstile guards the endpoint.

---

## Architecture (what's live)

The native BigCommerce signup form is **replaced** by a small custom form that posts to a
**Cloudflare Worker**. The Worker creates the customer through the BigCommerce API (which does
**not** require an address) and logs the shopper straight in.

```
Storefront create-account page
  └─ custom form (email + password + Turnstile)  ──POST──▶  Cloudflare Worker  (t206-signup.t206cards.workers.dev)
                                                               ├─ verify Turnstile token
                                                               ├─ create customer  → BigCommerce Customers V3 API  (no address)
                                                               └─ sign SSO JWT     → 303 redirect to /login/token/<jwt>  → logged in
```

### Components
| Piece | Where | What it does |
|---|---|---|
| Signup form | `theme/templates/pages/auth/create-account.html` (live in the Stencil theme) | Email + password + Turnstile widget; posts to the Worker |
| Worker | `worker/src/index.js` (deployed to Cloudflare) | Customer creation + SSO auto-login + Turnstile check + Origin check |
| Worker config | Cloudflare → Worker → Variables & Secrets | store hash/url + BC API creds + Turnstile secret (see `worker/README.md`) |
| Bot protection | Cloudflare Turnstile (Managed) | site key in the form, secret in the Worker |

---

## Why not something simpler?

Every simpler approach was tried and ruled out — documented here so nobody re-treads them:

1. **Un-require the fields in the BigCommerce admin.** Not possible — First/Last name and the
   Address fields are locked ("Required: This value is not configurable"), because the Address
   fields are shared with checkout.
2. **Hide the fields with an inline `<style>` block + JS auto-fill.** The storefront **CSP
   blocks inline scripts** (and inline `<style>` blocks — they need a nonce we can't add from a
   template). Inline `style=""` *attributes* are allowed, but…
3. **Hide the fields and submit them anyway.** The fields are still `required`, so the theme's
   validator blocks submit **silently** (errors land on hidden fields). Giving them Default
   Values works but those values are **shared with checkout**, polluting the checkout address.
4. **Remove the `address_fields` loop from the template.** Combined with HTML tags inside a
   Handlebars comment, this caused a **theme compile error (TR-3501)**; on compile failure
   BigCommerce serves a degraded page that omits the whole `<form>` and submit button — which
   is why "the button disappeared" and no CSS could fix it. (Lesson: never put literal
   `<form>`/`<style>`/`<script>` text inside `{{!-- … --}}` comments.)

The Worker sidesteps all of it: it never touches the native form, so the locked fields, the
CSP, and the compile constraints are all irrelevant, and **no placeholder data is stored**.

---

## Operations & maintenance

- **BigCommerce API account** (`Settings → Store-level API accounts`): scopes **Customers:
  Modify** + **Customer Login: Login**. Provides `BC_TOKEN`, `BC_CLIENT_ID`, `BC_CLIENT_SECRET`.
  Rotate if ever exposed (update the Worker secrets after).
- **Worker vars/secrets** are set in the Cloudflare dashboard (not in git). Full list in
  `worker/README.md`.
- **Placeholder name:** new records get `first_name = Collector`, `last_name = Member` (set via
  the Worker's `DEFAULT_FIRST_NAME` / `DEFAULT_LAST_NAME` vars). The real name is captured at
  checkout. Change those vars if you prefer different defaults.
- **Turnstile:** Managed mode, so legitimate shoppers usually pass without interaction. Site key
  is in the form; secret is the Worker's `TURNSTILE_SECRET`.
- **Klaviyo / marketing:** profiles carry the placeholder name until checkout — greet with a
  fallback like `Hi {{ first_name|default:'there' }}`.
- **Editing the form:** it's a normal Stencil template. Keep the `action` pointing at the Worker
  and the `name` attributes (`email`, `password`, `password_confirm`) unchanged — the Worker
  reads those.
- **Deploying Worker changes:** edit in the Cloudflare dashboard, or `cd worker && npx wrangler
  deploy` (Node + Wrangler). Code is in `worker/`.

## Error behavior (what shoppers see)
The Worker returns a small branded page on failure with a "back to sign up" link:
- duplicate email → "account already exists — try signing in"
- weak password → the password-requirements message
- missing/failed Turnstile → prompt to complete the check
Success → redirected, logged in, on the account page.

---

## Sources
- [Create Customers — Customers V3 API](https://docs.bigcommerce.com/developer/api-reference/rest/admin/management/customers/v3/create-customers)
- [Customer Login (SSO) API](https://developer.bigcommerce.com/docs/start/authentication/customer-login)
- [Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/)
