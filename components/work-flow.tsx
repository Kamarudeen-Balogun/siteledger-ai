import type { ReactNode } from "react";
import { DiaryIcon } from "./diary-icon";

export function WorkFlow({ step }: { step: "capture" | "review" | "report" }) {
  const stages = ["capture", "review", "report"] as const;
  return <nav aria-label="Site report steps" className="work-flow"><ol>{stages.map((stage, index) =>
    <li key={stage} aria-current={stage === step ? "step" : undefined} data-passed={stages.indexOf(step) > index || undefined}>
      <strong>Step {index + 1} · {["Add work", "Check", "Cost & lock"][index]}</strong>{index < 2 && <DiaryIcon name="chevron" size={16}/>}
    </li>)}</ol></nav>;
}

export function WorkDisclosure({ title, description, children, open = false }: { title: string; description?: string; children: ReactNode; open?: boolean }) {
  return <details className="work-disclosure" open={open}><summary><span><strong>{title}</strong>{description && <small>{description}</small>}</span><span className="disclosure-mark" aria-hidden="true">+</span></summary><div className="work-disclosure-body">{children}</div></details>;
}
