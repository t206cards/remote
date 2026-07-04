# Simplifying the t206cards.com Signup (BigCommerce · Supermarket theme)

**Goal:** let collectors create an account with just **email + password** so they can start
tracking collections immediately. Name and billing/shipping are collected at checkout
(native BigCommerce behavior) and/or added by the customer whenever they want.

**Theme:** Supermarket 7.4 (Stencil) · **Date:** 2026-07

---

## TL;DR

Getting to email + password takes **two coordinated changes** — the theme edit alone is not
enough, and the admin change alone is not enough:

1. **Theme edit** (done in this repo): `templates/pages/auth/create-account.html` now shows
   only **Email, Password, Confirm Password**. First/Last name are hidden and auto-filled
   from the email, because BigCommerce hard-requires them on the customer record.
2. **Admin edit** (you do this once): in **Settings → Account Signup Form**, set every other
   still-required field — **Company, Phone, and all Address fields** — to **not required**.
   This means *unchecking "Required"*, which is **different from deleting the field** (deleting
   is what's blocked, and is probably what was tried before).

Why both are required: the signup form is **config-driven**. The theme loops over whatever
fields the Account Signup Form defines, and the theme's own validator
(`assets/js/theme/common/form-validation.js`) adds a "required" check for every field the
config marks required. A field that is hidden **but still required** silently blocks the form
on the client *and* is rejected by the server. So:

- Fields you **can** un-require in admin (Company, Phone, Address, custom) → un-require them.
- Fields you **can't** un-require (First/Last name are system-locked) → the theme hides and
  auto-fills them.

---

## Why signup is heavy today (what I found in the theme)

`templates/pages/auth/create-account.html` renders the form by looping over the signup config:

```handlebars
{{#each forms.create_account.account_fields }}{{{dynamicComponent 'components/common/forms'}}}{{/each}}
{{#each forms.create_account.address_fields }}{{{dynamicComponent 'components/common/forms'}}}{{/each}}
```

- `account_fields` = First Name, Last Name, Company, Phone, Email, Password, Confirm Password
  (+ any custom fields).
- `address_fields` = Address 1/2, City, State/Province, Zip, Country (+ any custom address
  fields).

Every one of those that is marked **Required** in the admin becomes a required input. That
whole address block being required is what makes signup feel like a checkout.

Each field wrapper carries a stable identifier: `data-type="<FieldType>"` on the
`.form-field`, and `data-field-type="<FieldType>"` on the input — e.g. `EmailAddress`,
`Password`, `ConfirmPassword`, `FirstName`, `LastName`, `AddressLine1`, `Country`, `State`.
The theme change targets fields by these identifiers.

---

## The theme change (already applied in this repo)

- **Modified file:** [`theme/templates/pages/auth/create-account.html`](../theme/templates/pages/auth/create-account.html)
- **Patch (apply on the machine with the full theme):**
  [`patches/create-account-simplified-signup.patch`](../patches/create-account-simplified-signup.patch)

What it does:

1. Adds a `simplified-signup` class to the form and a scoped `<style>` that shows **only**
   `EmailAddress`, `Password`, and `ConfirmPassword` and hides everything else on the form.
2. Adds a small **vanilla-JS** `<script>` (no jQuery dependency, so it runs without rebuilding
   the JS bundle) that auto-fills the hidden First/Last name from the email address:
   - `john.smith@…` → First: `John`, Last: `Smith`
   - `justin@…` → First: `Justin`, Last: `Member` (placeholder)
   - Placeholders are two constants (`DEFAULT_FIRST` / `DEFAULT_LAST`) you can change.
   - The real name is captured at checkout and overwrites the placeholder.
3. Leaves the address loop in place but hidden. Once the address fields are **not required**
   (admin step below), they post empty and **no address record is created** — no junk data.
4. Keeps the reCAPTCHA markup and the submit button untouched.

Apply it:

```bash
# from the root of your Supermarket theme working copy
git apply /path/to/patches/create-account-simplified-signup.patch
# or just copy theme/templates/pages/auth/create-account.html over your file
stencil push        # or: stencil bundle && upload the theme
```

No JS bundle rebuild is needed because the style/script are inline in the template.

---

## The required admin step (the other half)

**Settings → Account Signup Form** (older UI: *Advanced Settings → Account Signup Form*).

For each of these, click the field and **uncheck "This field is required"**, then **Save**:

- **Address fields:** Address Line 1, Address Line 2, Suburb/City, Country, State/Province,
  Zip/Postcode
- **Optional account fields:** Company, Phone
- **Any custom fields** you added to signup

Leave **Email, Password, Confirm Password, First Name, Last Name** as-is (system-required).

> Do **not** try to *delete* these fields — deletion is blocked, which is the wall you hit
> before. *Un-requiring* them is allowed for every non-system field, and that's all we need:
> the theme hides them, and once they're optional the form submits with just email + password.

If a field is already optional, leave it — no change needed.

---

## Test checklist (before/after deploying)

- [ ] Create Account page shows only Email, Password, Confirm Password.
- [ ] Signing up with only email + password **succeeds** (no "required field" errors).
- [ ] New customer appears in admin with an email-derived / placeholder name.
- [ ] Login and the account dashboard work for the new customer.
- [ ] Field validation still works: invalid email, weak password, and password mismatch all
      still show errors.
- [ ] reCAPTCHA still appears (if enabled for your store).
- [ ] Checkout as the new customer: real name + shipping/billing address are captured, and
      the placeholder name is overwritten.
- [ ] Existing customers are unaffected.

---

## Rollback

- Reverse the patch: `git apply -R patches/create-account-simplified-signup.patch` (or restore
  your original `create-account.html`) and `stencil push`.
- Re-check "Required" on the admin fields you changed.

---

## Optional: CSP-safe / bundled-asset version

The inline script works on a default BigCommerce storefront. If you enforce a **strict
`script-src` Content-Security-Policy** (inline scripts blocked), move the logic into the
bundled JS instead:

In `assets/js/theme/auth.js`, add a method and call it from `onReady()` when the create
account form is present (right after `this.registerCreateAccountValidator($createAccountForm)`):

```js
simplifyCreateAccount($form) {
    $form.addClass('simplified-signup');
    const $email = $('[data-field-type="EmailAddress"]', $form);
    const $first = $('[data-field-type="FirstName"]', $form);
    const $last = $('[data-field-type="LastName"]', $form);
    if (!$first.length && !$last.length) return;

    const DEFAULT_FIRST = 'Collector';
    const DEFAULT_LAST = 'Member';
    const titleCase = s => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
    const derive = () => {
        const local = ($email.val() || '').split('@')[0];
        const parts = local.split(/[._+\-]+/).filter(Boolean).map(titleCase);
        if ($first.length) $first.val(parts[0] || DEFAULT_FIRST);
        if ($last.length) $last.val(parts.length > 1 ? parts[parts.length - 1] : DEFAULT_LAST);
    };
    derive();
    $email.on('input blur', derive);
    $form.on('submit', () => {
        if ($first.length && !$first.val()) $first.val(DEFAULT_FIRST);
        if ($last.length && !$last.val()) $last.val(DEFAULT_LAST);
    });
}
```

And move the CSS into your theme SCSS (e.g. a custom partial under `assets/scss/`):

```scss
.simplified-signup {
    .form-field { display: none; }
    .form-field[data-type="EmailAddress"],
    .form-field[data-type="Password"],
    .form-field[data-type="ConfirmPassword"] { display: block; }
}
```

Then remove the inline `<style>`/`<script>` from the template and rebuild the bundle
(`stencil bundle`).

---

## Fallback: only if an address field's "Required" cannot be unchecked

On a standard store all non-system fields can be un-required, so you shouldn't need this. If
your configuration locks an address field as required, you have two options:

- **Recommended — custom API registration:** build a small email+password form that creates
  the customer via the Customer Accounts / Customers V3 API with minimal placeholder name and
  a generated password. This bypasses the native form's required-field validation entirely and
  avoids saving any placeholder address. It's a real build (backend endpoint, email
  verification, bot protection) but it's the clean way to fully decouple signup from the
  address requirement.
- **Quick but dirty — auto-fill placeholder address:** extend the script to fill the hidden
  required address inputs with placeholder values so the form submits. **This saves a fake
  address on every customer that will appear in their address book at checkout**, so only use
  it as a stop-gap. If you want this variant, say so and I'll provide it.

---

## Complementary business setting (recommended): don't force an account

Independently of the form, make sure the account wall isn't blocking purchases:

- **Settings → Checkout** → allow **guest checkout** (rather than "accounts required"), and
  optionally **create a customer account after checkout** so guests still get an account with
  their real name/address already filled — without ever seeing the signup form.

This pairs well with the simplified signup: buyers can check out friction-free, and the
signup page is used mainly by collectors who just want to track a collection.

---

## Cross-cutting things to handle

- **Checkout still collects name + billing/shipping**, so simplified signup costs buyers
  nothing. The placeholder name is overwritten with the real one at checkout.
- **"Add later" already exists**: logged-in customers can edit their name and add addresses
  anytime under **Account → Addresses** / account settings. Consider a gentle dashboard prompt
  ("Add your shipping address to check out faster").
- **Klaviyo personalization**: new profiles will carry the placeholder/email-derived name
  until checkout. Audit flows/templates that greet by name and add fallbacks, e.g.
  `Hi {{ first_name|default:'there' }}`. Names captured at checkout sync back and fill the
  profile.
- **Existing customers**: unaffected — this only changes the new-signup experience.
- **Marketing consent**: keep any newsletter/marketing opt-in checkbox on signup if you want
  it; it's independent of the address fields.

---

## Sources

- [Editing Form Fields — BigCommerce Help](https://support.bigcommerce.com/s/article/Editing-Form-Fields?language=en_US)
- [Remove address fields from account signup form (community thread)](https://support.bigcommerce.com/s/question/0D51B00005V5XoySAF/i-want-to-remove-address-fields-from-account-signup-form-on-my-store?language=en_US)
- [First & last name required when creating account (community thread)](https://support.bigcommerce.com/s/question/0D54O00006YZ2D8SAL/first-last-name-required-when-creating-account?language=en_US)
- [Create Customers — Customers V3 API (first_name, last_name, email required)](https://docs.bigcommerce.com/developer/api-reference/rest/admin/management/customers/v3/create-customers)
- [Modifying Forms — Stencil themes (Developer Center)](https://developer.bigcommerce.com/docs/storefront/stencil/themes/templates/login)
- [Passwordless Customer Login (Developer Center)](https://developer.bigcommerce.com/docs/start/authentication/passwordless)
