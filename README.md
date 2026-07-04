# t206cards

Working repo for t206cards.com (BigCommerce · Supermarket Stencil theme).

## Simplified signup ✅ live

Collectors can create an account with just **email + password** — no address, and they're
logged in automatically afterward. Implemented as a custom form that posts to a Cloudflare
Worker (the native BigCommerce form requires a locked, full address that couldn't be worked
around in-theme).

- **`theme/templates/pages/auth/create-account.html`** — the live signup form (email +
  password + Turnstile) that posts to the Worker.
- **`worker/`** — the Cloudflare Worker: creates the customer via the BigCommerce Customers API
  (no address) and logs them in via the Customer Login SSO API. Setup/deploy in
  [`worker/README.md`](worker/README.md).
- **`docs/simplified-signup.md`** — architecture, the operational runbook, and why the simpler
  in-theme approaches don't work (so they aren't re-attempted).

### At a glance
```
create-account form ──POST──▶ Cloudflare Worker ──▶ BigCommerce API (create customer, no address)
                                                └──▶ SSO login redirect ──▶ shopper logged in
```
Cloudflare Turnstile protects the endpoint; no placeholder data is stored on the customer or
leaks into checkout.
