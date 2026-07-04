# t206cards

Working repo for t206cards.com (BigCommerce · Supermarket 7.4 Stencil theme).

## Simplified signup

Reduce account signup to **email + password** so collectors can start tracking collections
without a checkout-length form. Name and billing/shipping are collected at checkout and can be
added by the customer anytime.

👉 **[docs/simplified-signup.md](docs/simplified-signup.md)** — full write-up, deploy + test
steps, tradeoffs, and rollback.

### What's here

- **`theme/templates/pages/auth/create-account.html`** — modified signup template.
- **`patches/create-account-simplified-signup.patch`** — the same change as a patch to
  `git apply` on the machine with the full theme.

### The short version

BigCommerce **locks the name and Address fields as required** ("This value is not
configurable"), because the Address fields are shared with checkout — so this **can't** be
fixed in the admin, and must be handled in the theme. The template:

1. Shows only **Email + Password + Confirm**.
2. Hides and auto-fills the required **First/Last name** from the email (real name captured at
   checkout).
3. Handles the required **address block** via one flag, `SUBMIT_PLACEHOLDER_ADDRESS`:
   - **`false` (default):** removes the address block — no address submitted. Clean, *if* your
     store lets an account save without one. **Test this first** (safe: create + delete a
     throwaway account).
   - **`true`:** keeps it hidden and auto-fills placeholder values so signup always submits
     (creates a placeholder address the customer replaces at checkout).

For true email+password signup with **zero** placeholder data, the doc also describes a custom
API-based registration alternative.
