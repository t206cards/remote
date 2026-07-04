# t206cards

Working repo for t206cards.com (BigCommerce · Supermarket 7.4 Stencil theme).

## Simplified signup

Reduce account signup to **email + password** so collectors can start tracking collections
without a checkout-length form. Name and billing/shipping are collected at checkout and can be
added by the customer anytime.

👉 **[docs/simplified-signup.md](docs/simplified-signup.md)** — full write-up, deploy + test
steps, and rollback.

### What's here

- **`theme/templates/pages/auth/create-account.html`** — modified signup template (no
  JavaScript; the storefront's CSP blocks inline scripts).
- **`patches/create-account-simplified-signup.patch`** — the same change as a patch.

### The short version (confirmed by testing on the store)

The name and Address fields are **locked as required** ("not configurable"), and the storefront
**blocks inline scripts**, so the fix uses **no JavaScript**:

1. **Theme:** show only **Email + Password + Confirm** (inline CSS), and **remove the address
   block** from the template so no address is submitted.
2. **Admin:** in **Settings → Account Signup Form → Account Signup Fields**, give **First Name**
   and **Last Name** a **Default Value** (e.g. `Collector` / `Member`). A hidden field still
   submits its default, so the required check passes — no script needed. Real name is captured
   at checkout.

If the store rejects an addressless signup even with the address block removed, the clean
fallback is a custom API-based registration (details in the doc).
