# t206cards

Working repo for t206cards.com (BigCommerce).

## Simplified signup

Plan to reduce account signup to **email + password** so collectors can start tracking
collections without a checkout-length form. Name and billing/shipping are collected at
checkout and can be added by the customer anytime.

👉 **[docs/simplified-signup.md](docs/simplified-signup.md)** — full plan, exact admin steps,
ready-to-apply theme code, and rollout recommendation.

**Short version:** the biggest win is a no-code change — remove the *Address* block from
**Settings → Account Signup Form** in the BigCommerce admin. That alone cuts signup down to
First name, Last name, Email, Password. Going fully name-free needs a theme override
(details in the doc).
