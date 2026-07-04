/**
 * t206cards — simplified signup Worker
 * ------------------------------------
 * Creates a BigCommerce customer from just an email + password (no address),
 * then logs the shopper straight in via the Customer Login (SSO) API.
 *
 * Why this exists: the store's Account Signup Form requires a full, locked
 * address, and the storefront CSP blocks the inline JS/CSS that could work
 * around it in-theme. This endpoint bypasses the native form and creates the
 * customer server-side through the API, so signup can be email + password only
 * with zero placeholder data stored anywhere.
 *
 * Secrets/vars (see wrangler.toml + README):
 *   STORE_HASH          e.g. 2781s2b091
 *   STORE_URL           e.g. https://t206cards.com   (no trailing slash)
 *   BC_TOKEN            X-Auth-Token for a Store API account (Customers: modify)
 *   BC_CLIENT_ID        API account client id  (used to sign the SSO login JWT)
 *   BC_CLIENT_SECRET    API account client secret
 *   CHANNEL_ID          storefront channel id (default 1)
 *   DEFAULT_FIRST_NAME  placeholder name on the record (default "Collector")
 *   DEFAULT_LAST_NAME   placeholder name on the record (default "Member")
 *   TURNSTILE_SECRET    (optional) Cloudflare Turnstile secret for bot protection
 */

export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        // CORS preflight (only needed if you POST cross-origin via fetch; the
        // recommended plain-form POST does not trigger this).
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders(env) });
        }
        if (request.method === 'POST' && url.pathname.replace(/\/+$/, '').endsWith('/register')) {
            return handleRegister(request, env);
        }
        return new Response('Not found', { status: 404 });
    },
};

const STORE_URL = (env) => (env.STORE_URL || '').replace(/\/+$/, '');
const CHANNEL_ID = (env) => parseInt(env.CHANNEL_ID || '1', 10);

function corsHeaders(env) {
    return {
        'Access-Control-Allow-Origin': STORE_URL(env) || '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    };
}

async function handleRegister(request, env) {
    const backTo = `${STORE_URL(env)}/login.php?action=create_account`;

    // --- Basic abuse protection: only accept posts that originate from the store.
    const origin = request.headers.get('Origin') || '';
    const referer = request.headers.get('Referer') || '';
    const fromStore = (v) => v && STORE_URL(env) && v.startsWith(STORE_URL(env));
    if (!fromStore(origin) && !fromStore(referer)) {
        return errorPage(env, 'This signup form can only be used on t206cards.com.', backTo, 403);
    }

    let form;
    try {
        form = await request.formData();
    } catch (_e) {
        return errorPage(env, 'Could not read the form.', backTo, 400);
    }

    const email = String(form.get('email') || '').trim().toLowerCase();
    const password = String(form.get('password') || '');
    const confirm = String(form.get('password_confirm') || password);

    if (!email || !password) return errorPage(env, 'Please enter an email and a password.', backTo);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return errorPage(env, 'Please enter a valid email address.', backTo);
    if (password !== confirm) return errorPage(env, 'The passwords do not match.', backTo);

    // --- Optional Cloudflare Turnstile check (recommended; enable in the form + set TURNSTILE_SECRET).
    if (env.TURNSTILE_SECRET) {
        const token = String(form.get('cf-turnstile-response') || '');
        const ok = await verifyTurnstile(token, env.TURNSTILE_SECRET, request.headers.get('CF-Connecting-IP'));
        if (!ok) return errorPage(env, 'Please complete the “I’m not a robot” check and try again.', backTo);
    }

    // --- Create the customer (no address).
    const createResp = await fetch(`https://api.bigcommerce.com/stores/${env.STORE_HASH}/v3/customers`, {
        method: 'POST',
        headers: {
            'X-Auth-Token': env.BC_TOKEN,
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify([
            {
                email,
                first_name: env.DEFAULT_FIRST_NAME || 'Collector',
                last_name: env.DEFAULT_LAST_NAME || 'Member',
                origin_channel_id: CHANNEL_ID(env),
                channel_ids: [CHANNEL_ID(env)],
                authentication: { force_password_reset: false, new_password: password },
            },
        ]),
    });

    if (!createResp.ok) {
        const raw = await createResp.text();
        return errorPage(env, mapCreateError(createResp.status, raw), backTo);
    }

    let created;
    try {
        created = JSON.parse(await createResp.text());
    } catch (_e) {
        created = null;
    }
    const customerId = created && created.data && created.data[0] && created.data[0].id;
    if (!customerId) {
        // Account was created but we couldn't read the id — send them to sign in.
        return Response.redirect(`${STORE_URL(env)}/login.php?created=1`, 303);
    }

    // --- Log them straight in via the Customer Login (SSO) API.
    try {
        const jwt = await makeLoginJwt(env, customerId);
        return Response.redirect(`${STORE_URL(env)}/login/token/${jwt}`, 303);
    } catch (_e) {
        return Response.redirect(`${STORE_URL(env)}/login.php?created=1`, 303);
    }
}

function mapCreateError(status, raw) {
    const text = String(raw || '');
    if (status === 409 || /already in use|already exists|unique|duplicate/i.test(text)) {
        return 'An account with that email already exists — try signing in instead.';
    }
    if (/password/i.test(text)) {
        return 'Password must be at least 7 characters and include an uppercase letter, a number, and a special character.';
    }
    if (/email/i.test(text)) {
        return 'Please enter a valid email address.';
    }
    return 'Sorry — we couldn’t create your account. Please try again.';
}

async function verifyTurnstile(token, secret, ip) {
    if (!token) return false;
    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set('remoteip', ip);
    try {
        const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
        const j = await r.json();
        return !!j.success;
    } catch (_e) {
        return false;
    }
}

/** HS256-signed JWT for the BigCommerce Customer Login API. */
async function makeLoginJwt(env, customerId) {
    const header = { alg: 'HS256', typ: 'JWT' };
    const payload = {
        iss: env.BC_CLIENT_ID,
        iat: Math.floor(Date.now() / 1000),
        jti: crypto.randomUUID(),
        operation: 'customer_login',
        store_hash: env.STORE_HASH,
        customer_id: customerId,
        channel_id: CHANNEL_ID(env),
        redirect_to: '/account.php?action=account_details',
    };
    const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
    const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(env.BC_CLIENT_SECRET),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
    );
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signingInput));
    return `${signingInput}.${b64urlBytes(new Uint8Array(sig))}`;
}

function b64url(str) {
    return b64urlBytes(new TextEncoder().encode(str));
}
function b64urlBytes(bytes) {
    let bin = '';
    for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Minimal, on-brand error page with a link back to signup. */
function errorPage(env, message, backTo, status = 400) {
    const safe = String(message).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Create account</title>
<style>
  body{margin:0;font-family:Poppins,system-ui,sans-serif;background:#F5F5F5;color:#2E2226;display:flex;min-height:100vh;align-items:center;justify-content:center}
  .card{background:#fff;max-width:420px;width:calc(100% - 32px);padding:32px;border-radius:8px;box-shadow:0 6px 24px rgba(0,0,0,.08);text-align:center}
  h1{font-size:20px;margin:0 0 12px}
  p{color:#4f4f4f;margin:0 0 24px}
  a{display:inline-block;background:#2E375B;color:#fff;text-decoration:none;padding:12px 24px;border-radius:4px;font-weight:600}
</style></head><body>
  <div class="card"><h1>We couldn’t finish signing you up</h1><p>${safe}</p><a href="${backTo}">Back to sign up</a></div>
</body></html>`;
    return new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', ...corsHeaders(env) } });
}
