# t206cards

Working repo for t206cards.com (BigCommerce · Supermarket 7.4 Stencil theme).

## Simplified signup

Reduce account signup to **email + password** so collectors can start tracking collections
without a checkout-length form. Name and billing/shipping are collected at checkout and can be
added by the customer anytime.

👉 **[docs/simplified-signup.md](docs/simplified-signup.md)** — full write-up, exact steps,
test checklist, and rollback.

### What's here

- **`theme/templates/pages/auth/create-account.html`** — modified signup template: shows only
  Email + Password + Confirm Password, and auto-fills the hidden, system-required First/Last
  name from the email (real name captured at checkout).
- **`patches/create-account-simplified-signup.patch`** — the same change as a patch to
  `git apply` on the machine with the full theme.

### It takes two coordinated changes

1. **Theme** (in this repo): hide everything but email/password; auto-fill the name fields
   BigCommerce won't let you make optional.
2. **Admin** (one-time): in **Settings → Account Signup Form**, set the remaining fields
   (Company, Phone, all Address fields) to **not required** — *uncheck "Required"*, which is
   different from *deleting* the field (deletion is the wall you hit before).

Why both: the form is config-driven, and a hidden field that is still "required" silently
blocks submission. First/Last name are system-locked, so the theme auto-fills them; everything
else gets un-required in admin. Details and a CSP-safe bundled variant are in the doc.
