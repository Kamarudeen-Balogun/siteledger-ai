"use client";
import { useEffect, useRef, useState } from "react";
import { displayDate, displayTimestamp, formatMoneyPerUnit, formatQuantityWithUnit } from "@/lib/reports/model";
import type { BoqVersion } from "@/lib/projects/boq-data";
import { DiaryIcon } from "./diary-icon";

// Version history opens in a bottom sheet over the BoQ page — never as an
// inline expansion: the old disclosure list pushed the whole page down and
// buried the BoQ under a giant card. The trigger is a small button; the
// sheet lists the versions, and tapping one shows its rows in the same
// sheet. Closing returns to the page unchanged, background locked.
export function BoqVersions({ versions, currency }: { versions: BoqVersion[] | null; currency: string }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<BoqVersion | null>(null);
  const sheet = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!open) return;
    const dialog = sheet.current;
    if (dialog && !dialog.open) dialog.showModal();
    dialog?.querySelector(".action-dialog__body")?.scrollTo(0, 0);
  }, [open, selected]);
  const active = versions?.[0]?.version;
  return <>
    <button type="button" className="boq-versions__trigger" data-tour="boq-history" onClick={() => { setSelected(null); setOpen(true); }} aria-label="Open BoQ version history"><DiaryIcon name="history" size={16}/><span>Version History{versions?.length ? ` (v${versions[0].version} Active)` : ""}</span><DiaryIcon name="chevron" size={16}/></button>
    {open && <dialog ref={sheet} className="action-dialog stitch-sheet" aria-label={selected ? `BoQ version ${selected.version}` : "BoQ version history"} onClose={() => { setOpen(false); setSelected(null); }}>
      <div className="action-dialog__body">
        {selected ? <>
          <h2>Version {selected.version}{selected.version===active?" · Active":""}</h2>
          <p>{selected.created_at ? <>Saved {displayTimestamp(selected.created_at)} · </> : ""}Effective {displayDate(selected.effective_date)} · {selected.items} {selected.items===1?"item":"items"}</p>
          <ul className="boq-versions__rows">{selected.rows.map((row,index)=><li key={row.item_code ?? index}><span className="boq-versions__description">{row.description}</span><span className="boq-versions__value"><span>{formatQuantityWithUnit(row.boq_quantity, row.unit)}</span><span>@</span><span>{formatMoneyPerUnit(row.rate, currency, row.unit)}</span></span></li>)}</ul>
          <p>Locked reports keep the version they were locked with.</p>
        </> : <>
          <h2>Version history</h2>
          {versions?.length ? <><ol className="boq-versions__list">{versions.map(item => <li key={item.version} className="boq-versions__version">
            <button type="button" className="boq-versions__row" onClick={() => setSelected(item)} aria-label={`Open BoQ version ${item.version}`}>
              <span><strong>Version {item.version}</strong><small>{displayDate(item.effective_date)} · {item.items} {item.items===1?"item":"items"}</small></span>
              {item.version===active&&<span className="stitch-kicker stitch-chip" data-tone="green">Active</span>}
              <DiaryIcon name="chevron" size={16}/>
            </button>
          </li>)}</ol>
          <p>Drafts use the current version (Version {versions[0].version}). Locked reports keep the version they were locked with.</p></> : <p>No BoQ versions have been saved yet.</p>}
        </>}
      </div>
      <div className="action-dialog__actions stitch-sheet-actions">
        {selected && <button type="button" className="stitch-button" onClick={() => setSelected(null)}>Back to versions</button>}
        <button type="button" className="stitch-button" onClick={() => { sheet.current?.close(); setOpen(false); setSelected(null); }}>Close</button>
      </div>
    </dialog>}
  </>;
}
