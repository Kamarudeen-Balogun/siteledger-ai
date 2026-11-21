import Link from "next/link";
import { PasswordRecovery } from "@/components/account-forms";
export default function RecoveryPage() {
  return <main className="mx-auto min-h-screen max-w-2xl px-5 pb-16 pt-7"><Link href="/account" className="inline-flex min-h-12 items-center underline">Your account</Link><h1 className="mt-5 font-serif text-3xl">Recover website access</h1><PasswordRecovery siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ""} /></main>;
}
