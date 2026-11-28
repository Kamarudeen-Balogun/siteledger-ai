// The one app logo: the simple SL mark — an orange box with "SL", the same
// treatment everywhere (public header, workspace header). There is no
// approved logo beyond this yet; when a better one exists, change it here.
export function SiteLedgerMark({ size = 32 }: { size?: number }) {
  return <span className="flex items-center justify-center rounded bg-primary-container" style={{ width: size, height: size }} aria-hidden="true"><span className="font-stamp-label text-stamp-label text-on-primary">SL</span></span>;
}
