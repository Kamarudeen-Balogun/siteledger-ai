# Production deployment

Live app: **https://siteledger-ai.vercel.app**. Telegram: **@SiteLedgerNGbot**.
Deployed on 22 November 2026 using Vercel Hobby, Next.js and Node 22.
The builder's final phone acceptance is pending.

## Configuration

The linked Vercel project is `siteledger-ai` in `kamarudeens-projects`.
All application variables in `.env.example` are configured for production;
server credentials use Vercel's sensitive environment storage. Resend remains
Supabase's custom SMTP sender. No extra Resend API route is needed in the app.

The builder saved these external settings:

- Cloudflare Turnstile allows `siteledger-ai.vercel.app` using the existing widget.
- Supabase Auth Site URL is `https://siteledger-ai.vercel.app`.
- Signup confirmation, native CAPTCHA and the signup hook remain enabled.

The application redeems private-trial CAPTCHA through Siteverify, checking
both the exact production hostname and `siteledger-trial` action. Supabase
redeems account CAPTCHA. Never replace these with a client-only success flag.

The development `.env.local` still uses its existing HTTPS tunnel.
Do not copy its development `SITELEDGER_APP_URL` over the production setting.
Only one webhook is active per bot; starting a local preview does not move it.

## Free-plan CPU use

The public landing/support pages, fictional report and dispute log are
prerendered. The sample PDF is a static asset; `/api/reports/demo/pdf` rewrites
to that asset with download and cache headers. They avoid application-function
CPU during public demonstration visits. The static exports contain only the
original fictional seed, never private uploads or live project totals.

Account/project actions, uploads, AI processing and private PDFs still need
server functions. Their usage depends on actual traffic and work performed;
this setup does not promise unlimited free hosting. AI-processing functions
allow up to 300 seconds of wall time, including provider waits. That ceiling
does not charge five minutes of active CPU in advance. No paid plan,
automatic top-up, scheduled polling or additional messaging service is set up.

The initial deployment used the standard Hobby build machine. Build work is
separate from the Active CPU time meter for application functions. Subsequent
deployment is deliberate through the CLI; no Git auto-deploy connection was
added during this task.

## Updating the deployment

Read the project brief and finish local validation first. Authenticate using
the current Vercel device-code login flow; keep credentials out of commands
and version control. Then deploy the linked project:

```sh
vercel whoami
vercel deploy --prod --yes --scope kamarudeens-projects
node scripts/verify-production-deployment.mjs
```

`.vercelignore` excludes environment files, local dependencies/builds and
temporary verification artifacts. `.vercel` stays ignored. `.kiro` remains
tracked in Git. The verifier makes read-only public/denial checks and saves
screenshots in the ignored `supabase/.temp/task-13` directory; it does not
create accounts, submissions or reports.

For an intentional Telegram cutover, first verify the destination. Register
the webhook and run menu setup with the same origin in that process:

```sh
node scripts/set-telegram-webhook.mjs https://siteledger-ai.vercel.app
```

PowerShell, using the existing ignored environment file without modifying it:

```powershell
node --env-file=.env.local -e 'process.env.SITELEDGER_APP_URL="https://siteledger-ai.vercel.app"; import("./scripts/configure-telegram-menu.mjs");'
```

Registration checks the expected bot and rejects an unauthenticated webhook
request before switching. Pending updates are retained, with one Telegram
connection at a time. Menu setup verifies all seven commands in default,
private-chat and English scopes, and the HTTPS account Mini App.

## Final phone check

Turn Wi-Fi off and use mobile data throughout. Use a separate private project
named clearly as a production test; keep its records after approval because
locked evidence is immutable. Existing genuine records need no modification.

1. Open `/account` in @SiteLedgerNGbot, sign in to your verified website account
   and explicitly connect Telegram if prompted. Cloudflare should complete.
   Passwords belong only in the HTTPS form, never a chat message.
2. Create/select the test project with currency NGN and timezone Africa/Lagos.
   New projects have an empty BoQ. Add the two demo rows below and save them
   through the price-list review dialog before intake.
3. Use `/projects` to select that project, check its name, then send a voice
   note describing 18 m² of 225mm blockwork (six workers), 2 m³ of column
   concrete (four workers), 40 cement bags delivered and a two-hour rain delay.
   Include a natural Pidgin term. Attach the three supplied demo images;
   their filenames/disclosures identify them as synthetic, not real evidence.
4. Open the review button. Check the raw transcript, edit any unclear quantity,
   and review or dismiss possible photo findings. Confirm only accurate values.
5. Confirm and cost, then open the report and download its PDF. With exactly
   those two work quantities, the cost is **₦551,000**: ₦261,000 blockwork plus
   ₦290,000 concrete. Materials/observations do not create invented charges.
6. Use the separate approval action as the owner/PM. Verify the locked stamp
   and absent edit/delete actions. Add a clearly labelled production-test
   amendment; it must appear beside the unchanged original record.
7. Send `/today` and `/reports`; check they show your authorized project and
   production links. Report any failing step and the displayed error.

These rows use section 10's supplied rates and existing fictional-seed quantities:

| Section | Code | Description | Unit | BoQ quantity | Rate in NGN |
| --- | --- | --- | --- | ---: | ---: |
| Blockwork | BLK-01 | Sandcrete blocks 225mm hollow, laid | m² | 420 | 14,500 |
| Concrete | CON-01 | In-situ concrete, columns and beams | m³ | 35 | 145,000 |

The builder's phone result completes task 13. Automated browser checks do not
establish physical-phone performance, real CAPTCHA completion or site accuracy.

## Account codes and returning to a screen

Enter the full email code, including leading zeros. Supabase can issue 6–10
digits; signup confirmation, invitation verification and recovery accept this
supported range while Supabase checks validity and expiry. The existing email
templates need no changes for an eight-digit code.

Work screens provide **Back** and a compact phone **Menu** for Today, Projects,
Account and Help. Desktop shows the same links. Telegram's native Back button
uses the same navigation. A direct link with no previous SiteLedger screen
returns to a useful parent, such as the account page after password recovery.
