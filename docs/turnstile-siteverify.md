# Turnstile integration

The existing SiteLedger widget is used for both account forms and the private
trial. Its public site key is read from NEXT_PUBLIC_TURNSTILE_SITE_KEY. The
builder saved the matching secret in ignored .env.local as TURNSTILE_SECRET_KEY.
Never put that secret in client code, logs or Git.

The linked Cloudflare existing-widget guide was read on 22 November 2026:
https://developers.cloudflare.com/turnstile/spin/prompt.md

The widget was already configured, and its secret was already in the builder's
secret destination. No widget creation, replacement, secret getter, Wrangler
installation or extra backend infrastructure was needed.

## Account forms

Supabase native Auth verifies the account CAPTCHA token using the widget secret
configured in Bot and Abuse Protection. Do not redeem that same token separately
before forwarding it to Supabase: Turnstile tokens are single-use.

## Private trial

The widget's action is siteledger-trial. The existing Next.js server handles
POST /api/trial/start and sends the token to Cloudflare's canonical Siteverify
endpoint with form encoding and a 10-second timeout. It requires success=true,
the exact action and the exact hostname derived from SITELEDGER_APP_URL before
creating a guest session. Production verification does not accept localhost
just because the widget also allows development domains.

Malformed, expired, replayed, unsuccessful, wrong-action and wrong-hostname
responses fail closed. The widget clears its old token and renders a fresh
challenge after a request, failure or expiry. No token or secret is added to URLs.

The existing secret passed a real dummy-token probe: invalid-input-response was
returned, with no invalid-input-secret error. This proves secret recognition and
invalid-token denial. On 22 November 2026, the builder completed the real
widget in a regular browser and submitted its fresh token to the protected
trial endpoint: the first request returned HTTP 200, and replaying the same
token returned HTTP 422. This verifies live server validation and single-use
enforcement. The temporary verification page was removed after the check.

Disposable browser tests preload scripts/fixtures/trial-siteverify.cjs only in
their isolated Node process and use a fake secret. Normal app startup never
loads this fixture. The hosted secret and Supabase native CAPTCHA stay enabled.
