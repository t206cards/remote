# Simplifying the t206cards.com Signup (BigCommerce · Supermarket theme)

**Goal:** let collectors create an account with just **email + password**. Name and
billing/shipping are collected at checkout and/or added by the customer later.

**Theme:** Supermarket 7.4 (Stencil) · **Date:** 2026-07

---

## Two constraints we confirmed by testing on the store

1. **Name and Address fields are locked as required** — in **Settings → Account Signup Form**
   they show *"Required: This value is not configurable."* The Address fields are shared with
   checkout, so BigCommerce won't let you make them optional. This must be handled in the theme
   (address) and via a field Default Value (name), not by un-requiring.
2. **The storefront blocks inline scripts (CSP).** A first attempt hid the fields with CSS and
   auto-filled the required name with an inline `<script>`. Result: the fields hid correctly
   (CSS is allowed) but the script never ran (blocked), so signup failed with
   *"The 'First Name' field is required."* **The fix therefore uses no JavaScript at all.**

---

## The solution (no JavaScript)

Two parts — a theme edit and one admin setting:

### A. Theme edit — [`theme/templates/pages/auth/create-account.html`](../theme/templates/pages/auth/create-account.html)

- Shows **only Email, Password, Confirm Password** (inline `<style>`, which is allowed).
- **Removes the `address_fields` loop entirely** (pure Handlebars), so no address is submitted.
- Hides First/Last name (and Company/Phone) — they still submit their **Default Value** (below).
- **Force-shows the Create Account button.** In testing, a theme rule of unknown origin was
  hiding the submit button once the form was simplified, and CSS-only `<style>` fixes kept
  losing the cascade. The button is now force-shown with **inline `style="…!important"`
  declarations directly on `.form-actions` and the submit `<input>`. Inline `!important` has the
  highest cascade precedence, so no theme rule (even high-specificity `!important`) can hide,
  clip, collapse, float, or move it off-screen. This was validated in headless Chromium against
  every CSS hide vector (display / visibility / opacity / height+overflow / position /
  transform / clip / clip-path), including high-specificity `!important` rules — 24/24 revealed
  the button. A `<style>` block adds a secondary safety layer (float containment, de-floated
  reCAPTCHA).
- No `<script>`, so the store's CSP can't break it (inline `style=""` attributes are allowed —
  the theme itself uses them).

Patch to apply on the machine with the full theme:
[`patches/create-account-simplified-signup.patch`](../patches/create-account-simplified-signup.patch)

### B. Admin — set a Default Value for the name fields

**Settings → Account Signup Form → Account Signup Fields**, then for **First Name** and
**Last Name**: open the field and fill the **"Default Value"** box (the field *above* the
"Required: not configurable" line — that box *is* editable). Suggested:

- First Name → `Collector`
- Last Name → `Member`

A hidden field still submits its default, so the required check passes without any script. The
customer's real name is captured at checkout and overwrites the placeholder.

> If **Company** or **Phone** turn out to be required on this store (usually they're optional),
> either give them a Default Value the same way, or make them optional — unlike Address, those
> two *are* configurable.

---

## Re-test after applying A + B

1. Re-paste the updated `create-account.html` into your theme copy (Edit Theme Files) and save,
   set the Default Values in the admin, then Apply the copy (or test via `stencil start`).
2. Go to `…/login.php?action=create_account` and sign up with a throwaway email + password.
   - ✅ **Account created** → done. Email+password signup, no placeholder address, name defaults
     to Collector/Member until checkout. Delete the test account.
   - ⚠️ **"First Name/Last Name required"** → the Default Value didn't take; confirm it saved on
     the *Account Signup Fields* tab (not the Address tab) and re-test.
   - ⚠️ **"Address …" error** → this store mandates an address at signup even when it isn't in
     the form. That can't be solved cleanly in-theme (see fallback).

---

## Fallback if the store still requires an address

If removing the address block produces an "address required" error, the only clean, no-junk
path is a **custom API registration**: a small email+password form that creates the customer
via the **Customers V3 API** (`POST /v3/customers`, which needs only `first_name`, `last_name`,
`email` — **no address**), bypassing the native form entirely. This is a real build (a backend
endpoint + a store API token + bot protection). Avoid faking an address with Default Values on
the Address fields — those are shared with checkout, so a placeholder would pollute the
checkout address form for real orders.

---

## Optional later enhancement: real-looking names

With CSP blocking inline scripts, every new account's name defaults to `Collector Member` until
the customer checks out. If you want names derived from the email (e.g. `john.smith@…` →
`John Smith`), that logic has to live in the theme's **bundled** JS (`assets/js/theme/auth.js`)
and be built with `stencil bundle` (the web "Edit Theme Files" editor can't rebundle JS). Not
required for launch — the checkout name overwrites the placeholder anyway. I can provide the
bundled-JS version if/when you're set up with the Stencil CLI.

---

## Test checklist

- [ ] Create Account page shows only Email, Password, Confirm Password.
- [ ] Signup with only email + password succeeds.
- [ ] New customer appears in admin (name = your Default Values until they buy).
- [ ] Login + account dashboard work.
- [ ] Validation still works: invalid email, weak password, password mismatch.
- [ ] reCAPTCHA still appears.
- [ ] Checkout as the new customer captures the real name + address.
- [ ] Existing customers unaffected.

## Rollback

- Re-apply your original theme (nothing was changed on it), and clear the First/Last Name
  Default Values in the admin if you want the fields blank again.

---

## Complementary setting (recommended): don't force an account

**Settings → Checkout** → allow **guest checkout**, and optionally **create a customer account
after checkout**. Buyers then get an account with their real details without ever seeing the
signup form, which also sidesteps the placeholder-name issue for anyone who purchases.

## Cross-cutting notes

- **Klaviyo**: profiles will carry `Collector Member` until checkout — add fallbacks in flows,
  e.g. `Hi {{ first_name|default:'there' }}`, and don't segment on name quality.
- **"Add later"**: customers can edit name/addresses under **Account → Addresses** anytime.
- **Existing customers / marketing consent**: unaffected; keep any newsletter opt-in on signup.

---

## Sources

- [Editing Form Fields — BigCommerce Help](https://support.bigcommerce.com/s/article/Editing-Form-Fields?language=en_US)
- [Account creation without address (community)](https://support.bigcommerce.com/s/question/0D54O00006ESBCcSAP/account-creation-without-address?language=en_US)
- [Create Customers — Customers V3 API (first_name, last_name, email required; address separate)](https://docs.bigcommerce.com/developer/api-reference/rest/admin/management/customers/v3/create-customers)
- [Content Security Policy on BigCommerce storefronts](https://developer.bigcommerce.com/docs/storefront/content-security-policy)
