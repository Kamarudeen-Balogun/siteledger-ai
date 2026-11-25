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
to that asset with download and cache headers. Static content delivery avoids application rendering CPU. The landing page
also makes one lightweight session lookup so active accounts can resume work. The static exports contain only the
original fictional seed, never private uploads or live project totals.

Account/project actions, uploads, AI processing and private PDFs still need
server functions. Their usage depends on actual traffic and work performed;
this setup does not promise unlimited free hosting. AI-processing functions
allow up to 300 seconds of wall time, including provider waits. That ceiling
does not charge five minutes of active CPU in advance. No paid plan,
automatic top-up, scheduled polling or additional messaging service is set up.

The initial deployment used the standard Hobby build machine. Build work is
separate from the Active CPU time meter for application functions. GitHub is connected to this Vercel project. Pushes to `main` trigger production
deployments; other branches produce previews. Build work remains separate from
Fluid Active CPU time. A CLI deployment can still publish a tested checkpoint.

## Updating the deployment

The GitHub repository is `Kamarudeen-Balogun/siteledger-ai`, with `main` verified
as the production branch on 23 November 2026. Push a review branch to test its
preview; merge a tested update into `main` to trigger production. The builder authorizes
merging the current UI checkpoint now; the remaining phone acceptance stays open. The current
public URL already runs the task 13 CLI checkpoint before that merge.

For a deliberate CLI deployment, finish local validation first. Authenticate using
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
node scripts/configure-telegram-menu.mjs https://siteledger-ai.vercel.app
```

Registration checks the expected bot and rejects an unauthenticated webhook
request before switching. Pending updates are retained, with one Telegram
connection at a time. Menu setup verifies all seven commands in default,
private-chat and English scopes, and the HTTPS landing-page Mini App.

## Final phone check

Turn Wi-Fi off and use mobile data throughout. Use a separate private project
named clearly as a production test; keep its records after approval because
locked evidence is immutable. Existing genuine records need no modification.

1. Open SiteLedger from @SiteLedgerNGbot to see the landing page. Choose sign-in,
   or Open your projects when your session is active. Sign in to your verified account
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

Work screens provide **Back** and persistent phone navigation for Today, Projects,
Account and Help. Desktop shows the same links. Telegram's native Back button
uses the same navigation. A direct link with no previous SiteLedger screen
returns to a useful parent, such as the account page after password recovery.

## Focused work views and media

Account uses separate Overview, Profile, Telegram and Email views. Email settings
include password recovery and an expandable current-password check for sensitive
actions. Project Overview keeps the lead figures and recording action; Site
records and Progress contain the detailed history and BoQ. Owners open Team &
settings for separate member, invitation and project-setting views.

Regular capture accepts voice-only, photo-only or both, with at least one
attachment. Saving replaces capture with a receipt and its review link. Photos
alone never supply a work quantity: the person enters and confirms it before
costing. The 24-hour trial still requires voice and allows zero to three photos.
Locked-report amendments open in their own view. Unsaved capture, review,
profile and amendment changes have a leave-page confirmation.

The hosted database must include
`20261122000300_optional_capture_media.sql` before deploying this capture UI.
It replaces four authorized intake/confirmation functions and does not rewrite
stored reports, media or attribution. Validate the hosted function definitions
and compare evidence fingerprints before and after applying it.

## Telegram landing entry

The main bot button and ordinary `/start` reply open the production landing page.
`/account`, project/report links and expiring identity-link challenges retain
appropriate direct destinations. The SDK initializes before website navigation,
so account access can still prove the signed Telegram launch identity.

The landing design stays intact. Its account links share one lightweight,
private session lookup per visit and show **Open your projects** for an active
session. Anonymous visitors retain sign-in and trial choices. The page body is
still prerendered; the session lookup uses a server function, without polling.

## Browser preview

The trusted review branch has its own preview variables and stable origin:
https://siteledger-ai-git-task-13-production-kamarudeens-projects.vercel.app.
The builder added that hostname to the existing Turnstile widget. Vercel may
require its own account login before opening this protected preview. New review
branches need their own environment/hostname setup, or reuse the configured
review branch. The bot's main button remains on production. A Telegram connection
is optional for website account, project, capture and report use.

## Telegram and BoQ update — 25 November

PR #2 is merged and deployed from main. Linked Telegram users can restore their
account from a fresh signed launch on the landing page and continue to projects.
Recording is available before BoQ setup; pricing still requires supplied BoQ
values and explicit human confirmation.

Manual entry asks for description, unit, full planned quantity and rate. Optional
details hold the generated code and section. CSV/XLSX import has sheet/header
selection, column mapping, row correction and an explicit all-or-nothing save.
Use the header-only `/boq-import-template.csv` download; no prices are suggested.
Existing items are edited through their revision check, and approved records
retain their snapshots. PMs can expand Recent BoQ changes.

Hosted migration 20261125024102 is installed and all 37 checked table fingerprints
are preserved. Deployment checks pass; task 13 remains open for the builder’s
real-phone flow. Close and reopen Telegram, select the test project, finish the
BoQ, then continue through a note, confirmation, PDF, approval and amendment.

## Focused project flow — 25 November

The project-flow redesign is deployed from PR #3. Projects now has one Open
project action per site and a separate archived view. New project opens a
two-step form, retaining fields when going back and explicitly reviewing the
supplied budget, currency and timezone before creation.

Project home leads with the next existing step: record, human review, deliberate
costing, draft review or archived history. Its main action sits ahead of supporting
copy and navigation on phones. Records, BoQ, Progress and Manage project are
separate destinations; the default home no longer shows a financial dashboard.

Owner controls open deliberately. Ownership transfer is in Settings, and current
password confirmation is available in Account security without requiring Telegram.
All existing permissions, capture/media rules and approved evidence remain intact.
138 unit/API checks and the full disposable browser workflow pass, including
390×700 next-action checks. Repeat the creation/note/report/approval/amendment flow
on a real phone before closing task 13.
