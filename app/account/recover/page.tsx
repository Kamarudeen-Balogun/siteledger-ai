import { PasswordRecovery } from "@/components/account-forms";
import { PublicSite } from "@/components/public-site";
export default function RecoveryPage() {
  return <PublicSite current="account"><div className="mx-auto w-full max-w-md px-4 pb-16 pt-8"><PasswordRecovery siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ""} /></div></PublicSite>;
}
