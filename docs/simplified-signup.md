# Simplifying the t206cards.com Signup (BigCommerce · Supermarket theme)

**Goal:** let collectors create an account with just **email + password** so they can start
tracking collections immediately. Name and billing/shipping are collected at checkout
(native BigCommerce behavior) and/or added by the customer whenever they want.

**Theme:** Supermarket 7.4 (Stencil) · **Date:** 2026-07

---

## The key constraint (confirmed on the store)

BigCommerce **locks the built-in name and Address fields as required** — in
**Settings → Account Signup Form → Address Fields**, editing e.g. *Address Line 1* shows
**"Required: This value is not configurable."** These Address fields are **shared with
checkout and the address book**, so BigCommerce won't let you make them optional (an address
isn't usable without a street/city/zip).

**Consequences:**
- You **cannot** fix this from the admin by un-requiring fields. (An earlier draft of this
  doc said you could — that was wrong for this store.)
- The theme change **does not** make the admin setting configurable either. The requirement
  has to be **satisfied or bypassed in the theme**.
- First/Last name are also system-required and can't be removed.

So the create-account template has to (a) show only email + password, (b) satisfy the
required name fields itself, and (c) deal with the required address block one of two ways.

---

## What I changed (in this repo)

- **Modified template:** [`theme/templates/pages/auth/create-account.html`](../theme/templates/pages/auth/create-account.html)
- **Patch to apply on the machine with the full theme:**
  [`patches/create-account-simplified-signup.patch`](../patches/create-account-simplified-signup.patch)

The template now:

1. Shows **only Email, Password, Confirm Password** (scoped CSS).
2. Hides and **auto-fills the required First/Last name from the email** (`john.smith@…` →
   John / Smith; `justin@…` → Justin / Member placeholder). Real name is captured at checkout
   and overwrites it. Constants `DEFAULT_FIRST` / `DEFAULT_LAST` are editable.
3. Wraps the address block in `[data-address-fields-block]` and handles it via a single flag,
   `SUBMIT_PLACEHOLDER_ADDRESS`, at the top of the inline script:

| Mode | `SUBMIT_PLACEHOLDER_ADDRESS` | What happens | Data impact |
|------|------------------------------|--------------|-------------|
| **Remove** (default) | `false` | The whole address block is removed from the form, so **no address is submitted**. | None — clean, **if** your store lets an account save without an address. |
| **Placeholder** (fallback) | `true` | Address fields stay hidden and are **auto-filled** with placeholder values so the form always submits. | Creates a placeholder address on each new customer (see tradeoff below). |

Everything is inline (vanilla JS/CSS) so **no JS bundle rebuild is required**.

---

## Deploy + the one test that decides the mode

BigCommerce's storefront may or may not accept account creation with no address at all. I
couldn't verify that against your live store from here, so **test it — it's safe and
reversible** (just create and then delete a throwaway account):

1. Apply the change and push the theme:
   ```bash
   git apply /path/to/patches/create-account-simplified-signup.patch   # or copy the file over
   stencil push
   ```
   (Ships in **Remove mode** by default.)
2. Go to the Create Account page (incognito) — you should see only Email + Password + Confirm.
3. Sign up with a throwaway email + password.
   - **If the account is created** → you're done. Clean email+password signup, **no junk
     data**. Delete the test account.
   - **If you get an "Address is required"-type error** → open the template, set
     `SUBMIT_PLACEHOLDER_ADDRESS = true`, push again, and re-test. Signup will now succeed with
     a hidden placeholder address.

---

## Tradeoff of Placeholder mode (read before shipping it)

If you have to use Placeholder mode, every new account gets a placeholder address
(e.g. `N/A, N/A, <state>, <country>, 00000`) as its default address. Implications:

- Collectors who only track collections and never buy: harmless — they never see it.
- Collectors who later buy: at checkout the placeholder pre-fills the shipping form, so they
  must **overwrite it** with a real address. There's a small risk a careless shopper checks
  out against the placeholder → a bad/undeliverable order. Mitigate with a checkout note or an
  account-dashboard "add your real address" prompt.

If that risk isn't acceptable and Remove mode doesn't work on your store, use the clean
alternative below.

---

## Clean, zero-junk alternative: custom API registration

If you want true email+password signup with **no placeholder data** and Remove mode isn't
accepted by the storefront, build a small custom registration instead of using the native
`save_new_account` form:

- A minimal email+password form that creates the customer via the **Customers V3 API**
  (`POST /v3/customers`, which requires only `first_name`, `last_name`, `email` — **no
  address**) with a placeholder name + generated password, or via the Storefront **Customer
  Accounts / GraphQL** registration + login mutations.
- This bypasses the native form's required-address validation entirely, so nothing fake is
  ever stored.
- It's a real build (a backend endpoint or app, email verification, and bot protection), so
  it's the right choice only if the in-theme options above don't meet your bar. I can scope
  and build this if you want it.

---

## Optional: CSP-safe / bundled-asset version

The inline script works on a default BigCommerce storefront. If you enforce a **strict
`script-src` Content-Security-Policy**, move the same logic into `assets/js/theme/auth.js`
(call it from `onReady()` when the create-account form is present) and the CSS into your theme
SCSS, then rebuild the bundle (`stencil bundle`). The logic is identical to the inline block;
ask if you want it pre-split into those files.

---

## Test checklist

- [ ] Create Account page shows only Email, Password, Confirm Password.
- [ ] Signing up with only email + password succeeds (no "required field" errors).
- [ ] New customer appears in admin with an email-derived / placeholder name.
- [ ] (Placeholder mode) the customer's default address is the placeholder, not blank/broken.
- [ ] Login and the account dashboard work.
- [ ] Validation still works: invalid email, weak password, password mismatch all show errors.
- [ ] reCAPTCHA still appears (if enabled).
- [ ] Checkout as the new customer: real name + address captured; placeholder overwritten.
- [ ] Existing customers unaffected.

## Rollback

- Reverse the patch (`git apply -R …`) or restore the original `create-account.html`, then
  `stencil push`. No admin changes were made, so there's nothing to undo there.

---

## Complementary business setting (recommended): don't force an account

Independently of the form, make sure the account wall isn't blocking purchases:

- **Settings → Checkout** → allow **guest checkout**, and optionally **create a customer
  account after checkout** so guests still get an account with their real name/address already
  filled — without ever seeing the signup form. This pairs well with simplified signup and
  also sidesteps the placeholder-address issue for buyers.

---

## Cross-cutting things to handle

- **Checkout still collects name + billing/shipping**, so simplified signup costs buyers
  nothing; the placeholder name (and, in Placeholder mode, address) is overwritten there.
- **"Add later" already exists**: logged-in customers can edit their name and addresses under
  **Account → Addresses**. Consider a gentle dashboard prompt.
- **Klaviyo personalization**: new profiles carry the placeholder/email-derived name until
  checkout. Add fallbacks in flows/templates, e.g. `Hi {{ first_name|default:'there' }}`.
- **Existing customers**: unaffected — this only changes the new-signup experience.
- **Marketing consent**: keep any newsletter opt-in on signup if you want it; it's independent
  of these fields.

---

## Sources

- [Editing Form Fields — BigCommerce Help](https://support.bigcommerce.com/s/article/Editing-Form-Fields?language=en_US)
- [Account creation without address (community)](https://support.bigcommerce.com/s/question/0D54O00006ESBCcSAP/account-creation-without-address?language=en_US)
- [Is it possible to not require an address on Account Creation? (community)](https://support.bigcommerce.com/s/question/0D51B000044g977SAA/is-it-possible-to-not-require-an-adress-on-account-creation?language=en_US)
- [Address fields to be set as not required during account creation (community)](https://support.bigcommerce.com/s/question/0D51B00004SvEYGSA3/address-fields-to-be-set-as-not-required-during-account-creation?language=en_US)
- [Create Customers — Customers V3 API (first_name, last_name, email required; address separate)](https://docs.bigcommerce.com/developer/api-reference/rest/admin/management/customers/v3/create-customers)
- [Modifying Forms — Stencil themes (Developer Center)](https://developer.bigcommerce.com/docs/storefront/stencil/themes/templates/login)
