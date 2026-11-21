import Link from "next/link";
import { SignupConfirmation } from "@/components/account-forms";
export default function ConfirmSignupPage() { return <main className="mx-auto min-h-screen max-w-2xl px-5 pb-16 pt-7"><Link href="/account" className="inline-flex min-h-12 items-center underline">Your account</Link><h1 className="mt-5 font-serif text-3xl">Finish account signup</h1><SignupConfirmation /></main>; }
