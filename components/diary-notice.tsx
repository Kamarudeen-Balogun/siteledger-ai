import type { ReactNode } from "react";
export function DiaryNotice({ title, children, tone = "neutral", busy = false }: { title: string; children?: ReactNode; tone?: "neutral" | "warning" | "confirmed" | "error"; busy?: boolean }) {
  return <section className={`diary-notice diary-notice--${tone}${busy ? " diary-notice--busy" : ""}`} role={tone === "error" ? "alert" : "status"} aria-busy={busy || undefined}>
    <h2>{title}</h2>{children && <div className="diary-notice-copy">{children}</div>}{busy && <span className="diary-loading-line" aria-hidden="true" />}
  </section>;
}
