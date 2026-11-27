"use client";
import { useEffect, useRef, useState } from "react";
import { displayDate, formatMoneyPerUnit, formatQuantityWithUnit } from "@/lib/reports/model";
import type { BoqVersion } from "@/lib/projects/boq-data";
import { DiaryIcon } from "./diary-icon";

// Compact version history: one slim row per version. Opening a version
// shows its rows in a bottom sheet over the BoQ page — the old inline
// expansion pushed the whole page down and buried the BoQ under a giant
// card. Closing the sheet returns to the page unchanged.
export function BoqVersions({ versions, currency }: { versions: BoqVersion[] | null; currency: string }) {
  const [selected, setSelected] = useState<BoqVersion | null>(null);
  const sheet = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!selected) return;
    const dialog = sheet.current;
    if (dialog && !dialog.open) dialog.showModal();
    dialog?.querySelector(".action-dialog__body")?.scrollTo(0, 0);
  }, [selected]);
  const active = versions?.[0]?.version;
  return <><details className="boq-versions" data-tour="boq-history"><summary><span className="boq-versions__label"><DiaryIcon name="history" size={16}/>Version History{versions?.length ? ` (v${versions[0].version} Active)` : ""}</span><DiaryIcon name="chevron" size={16}/></summary>
    <div className="boq-versions__body">
      {versions?.length ? <><ol className="boq-versions__list">{versions.map(item => <li key={item.version} className="boq-versions__version">
        <button type="button" className="boq-versions__row" onClick={() => setSelected(item)} aria-label={`Open BoQ version ${item.version}`}>
          <span><strong>Version {item.version}</strong><small>{displayDate(item.effective_date)} · {item.items} {item.items===1?"item":"items"}</small></span>
          {item.version===active&&<span className="stitch-kicker stitch-chip" data-tone="green">Active</span>}
          <DiaryIcon name="chevron" size={16}/>
        </button>
      </li>)}</ol>
      <p>Drafts use the current version (Version {versions[0].version}). Locked reports keep the version they were locked with.</p></> : <p>No BoQ versions have been saved yet.</p>}
    </div>
  </details>
  {selected && <dialog ref={sheet} className="action-dialog stitch-sheet" aria-label={`BoQ version ${selected.version}`} onClose={() => setSelected(null)}>
    <div className="action-dialog__body">
      <h2>Version {selected.version}{selected.version===active?" · Active":""}</h2>
      <p>{displayDate(selected.effective_date)} · {selected.items} {selected.items===1?"item":"items"}</p>
      <ul className="boq-versions__rows">{selected.rows.map((row,index)=><li key={row.item_code ?? index}><span>{row.description}</span><span>{formatQuantityWithUnit(row.boq_quantity, row.unit)} @ {formatMoneyPerUnit(row.rate, currency, row.unit)}</span></li>)}</ul>
      <p>Locked reports keep the version they were locked with.</p>
    </div>
    <div className="action-dialog__actions stitch-sheet-actions"><button type="button" className="stitch-button" onClick={() => { sheet.current?.close(); setSelected(null); }}>Close</button></div>
  </dialog>}</>;
}
