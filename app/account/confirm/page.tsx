import { SignupConfirmation } from "@/components/account-forms";
import { WorkspaceHeader } from "@/components/workspace-header";
export default function ConfirmSignupPage() { return <main className="mx-auto min-h-screen max-w-5xl px-5 pb-16 pt-7"><WorkspaceHeader current="account" title="Finish account signup"/><SignupConfirmation siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ""} /></main>; }
