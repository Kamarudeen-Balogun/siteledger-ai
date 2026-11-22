# Task 10B — private guest capture and verified handover

Implemented by Codex on 22 November 2026, following the builder's 24-hour and
standalone demo-project decisions. No new Kiro review/hook/Crew run is claimed.

## Flow and access

- Website-only guest trial: one voice note, zero to three photos, human review
  and draft costing using frozen section 10 NGN rates. Existing private account
  upload rules keep their normal one-to-five-photo requirement.
- Guest sessions use independent, random 32-byte HttpOnly/SameSite cookies,
  Secure on HTTPS. Only hashes are stored. The server checks 24-hour expiry and
  consumption on every trial request; knowing a note/media UUID grants no access.
- Guest data remains in separate trial tables until handover. No anonymous Auth
  accounts, person profiles, memberships or regular projects are created at start.
- File limits: audio 3 MiB; each compressed JPEG 1 MiB; three photos. Streamed
  size/type/hash checks, immutable manifests, owned leases and no-overwrite
  storage make interrupted uploads retryable with the original files.
- Start limits: 20 globally and three per hashed IP in 24 hours; additional
  challenge/upload limits, a 120 MiB unclaimed-storage reservation budget and
  one durable processing attempt per trial. Provider attempts remain bounded
  behind transcribeAndExtract()/analysePhoto(). A failure allows manual entry.
- Expired unclaimed objects are eligible for cleanup after a ten-minute buffer.
  Saved trials are excluded. Cleanup failure retains eligibility and allocation;
  it never authorizes deletion of claimed or locked evidence.

## Handover and evidence

Explicit modal-confirmed Save this work requires both the active guest cookie
and a recently authenticated, email-verified browser account with confirmed
professional name. SQL atomically creates one private demo-labelled NGN project,
copies its frozen BoQ, preserves original media paths and consumes guest access.
Retries can return the already-saved result only to the same authorized account.
Names, email equality, supplied IDs and expired sessions never authorize a claim.

Original guest capture, confirmation, edits, raw transcript/findings and draft
stay preserved and immutable. The account note carries guest provenance and
prefills the guest edits; professional confirmation is required anew before
normal approval. Report/PDF provenance distinguishes original guest capture
from the verified account intake/confirmation. Membership revocation still
blocks report, PDF, media and original-trial readers.

Reserved guest UUIDs cannot be occupied by a client-generated regular intake.
The private account flow keeps its two work roles, current membership checks,
solo PM separation, archived-history access and immutable report protections.

## Cloudflare

Read the builder-provided existing-widget guide. Use the existing widget and
saved secret; no replacement or credential retrieval was needed. Trial start
uses canonical server Siteverify and checks boolean success, exact application
hostname and siteledger-trial action. Signup/recovery keep Supabase-native
verification without double-redeeming their tokens. A real dummy-token probe
recognized the secret and rejected invalid input. On 22 November, the builder
completed the real widget in a regular browser: the protected start returned
HTTP 200 and reuse of the same token returned HTTP 422. The temporary check
page was removed after this validation and is excluded from the commit.

## Verification status

- 102 unit/API tests pass. Trial SQL, existing account-record/web SQL, fresh
  installation and legacy migration checks pass.
- Final production build, lint and TypeScript pass, including the correction
  that refreshes the confirmation form when extraction finishes.
- The complete disposable browser flow passes: CAPTCHA/replay denial, upload,
  manual review and draft costing, native signup/email code, handover-dialog
  cancellation, account handover, preserved guest edits, verified professional
  confirmation, approval and PDF. Stranger media/original-record access and
  guest approval/PDF export are denied. SQL covers expired and repeated claims,
  immutable originals, cleanup exclusion and direct-role denial.
- Hosted migration `20261122073418_private_guest_trial` was applied to the
  SiteLedger Supabase project. A guarded transaction compared original rows
  across 20 existing tables; 13 locked reports, 2 amendments, 15 submissions
  and 4 photos remain unchanged. All 16 frozen demo prices are present.
  Anonymous handover and direct authenticated trial-table reads are denied.
  Genuine evidence was not modified for denial fixtures.

Native browser fixtures use separate local Auth/SMTP/REST/media and a test-only
Node Siteverify preload with a fake secret. Production startup does not load it.
No hosted email delivery or real-site AI accuracy claim follows from these checks.

Artifacts are ignored under supabase/.temp/task-10a/browser. The README includes
a cropped trial screenshot from the disposable browser run. Keep the unrelated
.kiro/hooks/sessionstart-probe.json untouched and excluded. Task 11 has not begun.
