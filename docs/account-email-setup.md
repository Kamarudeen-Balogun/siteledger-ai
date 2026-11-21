# SiteLedger account email and bot setup

Task 10A uses confirmed email/password signup, Turnstile, proof of email
ownership before invitation acceptance, and email password recovery.
Use the Free plans; no billing upgrade or automatic top-up is needed.

## Turnstile

1. In Cloudflare Turnstile, create a Managed widget for localhost and the app's
   hostname when available.
2. Set NEXT_PUBLIC_TURNSTILE_SITE_KEY in .env.local and later the hosting settings.
3. In Supabase Authentication / Bot and Abuse Protection, enable CAPTCHA with
   Turnstile and its secret key. Store the secret there, never in Git or chat.
4. Enable Confirm email under the Email provider and keep signup enabled.
   New users enter the signup email code before their first login.
5. Enable the Postgres Before User Created hook public.account_signup_hook after
   its migration is tested and applied. It caps native signup attempts as well.

## Resend sender

Use a fresh verified domain mail.siteledger.codeflowx.dev and sender
SiteLedger AI <noreply@mail.siteledger.codeflowx.dev>. The builder owns the parent
domain. Its existing send.codeflowx.dev sender for LeadFlowX remains separate.

1. Add mail.siteledger.codeflowx.dev in Resend. Publish exactly the DNS records
   Resend supplies in the authoritative DNS provider, then verify the domain.
   A paid mailbox is unnecessary for this sending address.
2. Create a sending-only API key restricted to that new domain.
3. In Supabase Authentication / Emails / SMTP Settings, enable custom SMTP using
   host smtp.resend.com, port 465, username resend, and that API key as password.
   Set the sender address and name above. Keep the credential out of Git/chat.
4. Open Authentication / Emails / Templates. Copy the complete HTML in
   supabase/templates/signup.html into Confirm Signup, with subject
   "Confirm your SiteLedger account". Copy supabase/templates/magic-link.html into Magic Link, with subject
   "Confirm your SiteLedger email". Copy supabase/templates/recovery.html into
   Reset Password, with subject "Reset your SiteLedger password". They use the
   native one-use six-digit code. Keep the Token, Email and SiteURL placeholders
   intact. A successful signup code also proves invitation email ownership;
   older automatically confirmed accounts must complete a separate proof.
   The warm-paper design uses inline styles, table layouts and system-font
   fallbacks. It includes the CodeFlowX / Kamarudeen Balogun creator credit.
   Run npm run preview:account-emails for labelled desktop/mobile previews.
5. Set Supabase Authentication / URL Configuration / Site URL to the app origin
   so the account/recovery buttons open the correct website. The code is entered
   manually; opening the button itself does not consume it.
6. Adjust Supabase Authentication / Rate Limits after custom SMTP is enabled.
   Account quotas apply across all Resend domains; this sender does not create
   a separate free allowance. Use limits within the account's current allowance.
7. Exercise invitation email proof and recovery with disposable fixtures. A
   failed delivery must show a retryable error and preserve all site records.

The Supabase default email sender restricts recipients to organization team
members. The documented default limit is per hour; custom SMTP permits a higher
configured email limit. It does not require a Supabase Pro subscription.

Sources:

- https://developers.cloudflare.com/turnstile/plans/
- https://supabase.com/docs/guides/auth/auth-captcha
- https://supabase.com/docs/guides/auth/testing-auth-flows
- https://supabase.com/docs/guides/auth/auth-smtp
- https://resend.com/docs/send-with-supabase-smtp
- https://resend.com/pricing

The builder reports custom SMTP, Confirm email and native Turnstile enabled
and saved in Supabase. A read-only Auth check confirmed email confirmation on.
Domain verification
and delivery have not been observed by Codex. Preview rendering does not prove
Gmail/Outlook rendering or delivery. The builder later confirms the Before User Created hook, all three HTML templates and the HTTPS Site URL saved. Native local SMTP/browser acceptance passes; actual hosted Resend delivery remains unobserved.
