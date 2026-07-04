# Simplifying the t206cards.com Signup (BigCommerce)

**Goal:** Let people create an account with just **email + password** so collectors can
start tracking cards immediately. Name and billing/shipping details get collected at
checkout (BigCommerce does this natively) and/or added by the customer whenever they want.

**Date:** 2026-07 · **Store:** t206cards.com (BigCommerce Stencil)

---

## TL;DR — the important insight

Most of the friction you're describing is **not a code change**. Your signup form is
long because the BigCommerce **Account Signup Form** currently includes the full
**Address block** (Address 1/2, City, State, Zip, Country, often Phone/Company) and those
fields are marked required. That block is what makes signup feel like a checkout.

You can remove that entire block from a settings screen in the admin — **no theme deploy,
no developer** — and the storefront updates automatically, because the theme renders
whatever the Account Signup Form config specifies.

The only thing you *can't* remove from that screen is **First Name / Last Name** — they're
system-required (the BigCommerce customer record and Customers API require them). Dropping
those too is possible but needs a theme override or a custom API-driven form (Tier 2 below).

**Recommendation:** Do Tier 0 + Tier 1 now (10 minutes, no code, fully reversible). That
alone turns signup from "≈10 required fields" into "First name, Last name, Email, Password."
Only pursue Tier 2 if truly name-free signup is a hard requirement.

---

## What signup requires today vs. after each tier

| Field                         | Today (typical heavy setup) | After Tier 1 (admin only) | After Tier 2 (theme) |
|-------------------------------|:---------------------------:|:-------------------------:|:--------------------:|
| Email                         | ✅ required                 | ✅ required               | ✅ required          |
| Password / Confirm            | ✅ required                 | ✅ required               | ✅ required          |
| First name                    | ✅ required                 | ✅ required               | ⬜ hidden/auto        |
| Last name                     | ✅ required                 | ✅ required               | ⬜ hidden/auto        |
| Company                       | often required              | ⬜ removed                | ⬜ removed            |
| Phone                         | often required              | ⬜ removed                | ⬜ removed            |
| Address 1 / 2                 | ✅ required                 | ⬜ removed                | ⬜ removed            |
| City / State / Zip / Country  | ✅ required                 | ⬜ removed                | ⬜ removed            |

Name and address are still collected **at checkout** in every tier — buyers lose nothing.

---

## Tier 0 — Don't force an account at all (business setting, do first)

Many collectors just want to browse or buy. Make sure the account wall isn't in front of a
purchase:

1. **Settings → Checkout** → set customers to be able to **check out as a guest**
   (Guest checkout enabled) rather than "Accounts required."
2. Optionally enable **"Create a customer account after checkout"** so buyers who check out
   as guests still get an account (with their real name/address already filled) without ever
   seeing a signup form.

Result: the signup page becomes opt-in — used mainly by collectors who want to *track a
collection*, which is exactly the low-friction audience you're optimizing for.

---

## Tier 1 — Trim the Account Signup Form (no code, recommended)

This is the main lever and the biggest win.

**Where:** BigCommerce control panel →
- Newer UI: **Settings** → search **"Account Signup Form"**
- Older UI: **Advanced Settings → Account Signup Form**

You'll see two groups: **Account Signup Fields** and **Address Fields**.

**Do this:**
1. In **Address Fields**, delete the whole section (Address Line 1 & 2, Suburb/City,
   Country, State/Province, Zip/Postcode). These are the "info needed for a purchase" fields
   and are the primary reason signup feels heavy. Removing them here removes them from the
   storefront signup page automatically.
2. In **Account Signup Fields**, remove or uncheck **Required** for **Company** and
   **Phone** if present. Remove any *custom* required fields that aren't essential at signup.
3. Leave **Email**, **Password**, **Confirm Password** — these are the ones you want.
4. **First Name / Last Name** will remain (their "Required" toggle is locked — system
   fields). This is expected; see Tier 2 to go further.
5. Save. Load the storefront **Create Account** page in an incognito window to confirm the
   form now shows only: First name, Last name, Email, Password, Confirm Password.

**Risk:** Low. No deploy. Reversible (re-add fields anytime). Existing customers unaffected —
this only governs the *new* signup form. Addresses previously collected are untouched.

> Note: this changes only the **account signup** address block. The **checkout** billing/
> shipping address forms are separate (Settings → Checkout / the checkout form fields) and
> should stay as-is so you still capture shipping/billing when someone actually buys.

---

## Tier 2 — True email + password only (theme override)

Only needed if you want to hide **First/Last name** from signup too. Because those fields
are system-required, the approach is: hide them in the theme and auto-populate a placeholder
so the customer record still validates; the real name is captured later at checkout or in
the account area.

> This requires access to the **Stencil theme** (via `stencil` CLI / WebDAV or a theme repo)
> and a deploy + QA. It's a workaround on top of a required field — test it before shipping.

### Files to edit (Cornerstone-based themes)
- `templates/pages/auth/create-account.html` — the Create Account page.
- The account form partial it includes (e.g. under
  `templates/components/common/forms/` / the account form component). The signup inputs are
  rendered from the server-driven form-field config, so target the first/last name inputs by
  their field markup rather than assuming an exact partial name.

### Approach A — hide + auto-fill (fastest)
Add to the create-account template (or the theme's custom JS/SCSS):

```scss
// hide the system-required name inputs on the create-account page only
.account--fixed .form-field[data-field-type="FirstName"],
.account--fixed .form-field[data-field-type="LastName"] {
  display: none;
}
```

```js
// create-account.js (or inline on the create account page)
// Give the required name fields a harmless default so the record validates.
// Real name is captured at checkout and can overwrite these later.
document.addEventListener('DOMContentLoaded', function () {
  var form = document.querySelector('[data-create-account-form], form[action*="createaccount"]');
  if (!form) return;
  form.addEventListener('submit', function () {
    var first = form.querySelector('input[name*="FirstName"], input[id*="FirstName"]');
    var last  = form.querySelector('input[name*="LastName"], input[id*="LastName"]');
    var email = form.querySelector('input[type="email"], input[name*="Email"]');
    var handle = email && email.value ? email.value.split('@')[0] : 'Collector';
    if (first && !first.value) first.value = handle;   // e.g. "justin"
    if (last  && !last.value)  last.value  = '.';       // placeholder; updated at checkout
  }, true);
});
```

Trade-offs of Approach A:
- Customer records/admin list will show the placeholder name until the person buys or edits
  their profile. Plan for that in reporting and in email personalization (see below).
- It's a hidden required field — keep it in sync if BigCommerce changes field markup.

### Approach B — custom API-driven registration (cleanest, more work)
Build the signup form yourself and create the customer via the **Customer Login / Customer
Accounts** flow:
- Server-to-server: **Customers V3 API** (`POST /v3/customers`) — still requires
  `first_name`, `last_name`, `email`; you supply minimal placeholders and a generated
  password, or
- Storefront: the **Customer Accounts / Storefront GraphQL** registration + login mutations
  for a headless-style form.

This gives you full control of the UX and validation but is a real build (backend endpoint,
password handling, email verification, bot protection). Choose this only if Approach A's
placeholder-name compromise isn't acceptable.

---

## Tier 3 — Passwordless (optional, future)

BigCommerce supports **passwordless customer login** (magic link / one-time code). Combined
with Tier 1, signup could become "enter email → click link." Lowest friction of all, but a
larger change (theme + auth app or headless). Park this as a future enhancement.

---

## Cross-cutting things to handle

- **Checkout still collects name + billing/shipping.** The Optimized One-Page Checkout
  gathers real name and addresses at purchase, so removing them from signup costs you nothing
  for actual buyers.
- **"Add later" already exists.** Logged-in customers can add/edit name and addresses anytime
  under **Account → Addresses** and account settings. Consider a gentle prompt in the account
  dashboard ("Add your shipping address to check out faster").
- **Klaviyo personalization.** t206cards uses Klaviyo. If you do Tier 2, new profiles won't
  have a real `first_name` until checkout — audit any flows/templates that greet by name
  (e.g. `Hi {{ first_name }}`) and add fallbacks like `{{ first_name|default:'there' }}`.
  Names captured at checkout will sync back and fill the profile.
- **Marketing consent.** Keep the newsletter/marketing opt-in checkbox on signup if you want
  it — that's independent of the address fields.
- **Custom fields / integrations.** If any app or custom field was made *required* at signup,
  review it in the same Account Signup Form screen so it doesn't silently block Tier 1.
- **Existing customers.** No migration needed; all tiers affect only the new-signup form.

---

## Recommended rollout

1. **Today, no code:** Tier 0 (guest checkout / post-checkout account creation) + Tier 1
   (delete the Address block, drop Company/Phone). This resolves ~90% of the friction.
2. **Evaluate:** For a collection-tracking audience, "First name, Last name, Email, Password"
   is usually acceptable. If it is, stop here — you've met the goal with zero deploy risk.
3. **If name-free is a hard requirement:** implement Tier 2 (Approach A for speed, Approach B
   for a clean build) with theme access and QA.
4. **Later:** consider Tier 3 passwordless for the lowest-friction experience.

---

## What I need to actually implement each tier

- **Tier 0 / Tier 1** — these are admin settings on the live store. Either you make the two
  changes above (I can screen-share exact clicks), or provide **store API credentials**
  (Settings/Customers scope) and I can script/verify the form-field configuration.
- **Tier 2** — provide the **Stencil theme** (add the theme repo to this session, or share
  `stencil` API credentials / a WebDAV export). Then I can apply the create-account changes
  here, test, and hand back a deployable diff.
- **Tier 3** — scope separately; needs an auth approach decision.

---

## Sources

- [Editing Form Fields — BigCommerce Help](https://support.bigcommerce.com/s/article/Editing-Form-Fields?language=en_US)
- [Account Signup Form Fields (topic) — BigCommerce Help](https://support.bigcommerce.com/s/topic/0TO1B0000005M2uWAE/account-signup-form-fields?language=en_US)
- [Remove address fields from account signup form (community thread)](https://support.bigcommerce.com/s/question/0D51B00005V5XoySAF/i-want-to-remove-address-fields-from-account-signup-form-on-my-store?language=en_US)
- [Show only account signup fields, not address (community thread)](https://support.bigcommerce.com/s/question/0D54O00007Tm48CSAR/is-there-a-way-to-remove-address-fields-from-the-create-account-page-and-show-only-the-account-signup-fields?language=en_US)
- [First & last name required when creating account (community thread)](https://support.bigcommerce.com/s/question/0D54O00006YZ2D8SAL/first-last-name-required-when-creating-account?language=en_US)
- [Create Customers — Customers V3 API (first_name, last_name, email required)](https://docs.bigcommerce.com/developer/api-reference/rest/admin/management/customers/v3/create-customers)
- [Modifying Forms — Stencil themes (Developer Center)](https://developer.bigcommerce.com/docs/storefront/stencil/themes/templates/login)
- [Passwordless Customer Login (Developer Center)](https://developer.bigcommerce.com/docs/start/authentication/passwordless)
