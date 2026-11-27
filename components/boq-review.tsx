import { formatMoney } from "@/lib/costing/format-money";
import { decimal } from "@/lib/costing/decimal";
import type { BoqChange } from "@/lib/projects/boq-data";

// A rate that moved by five times or more from its previous version is
// flagged, not silently accepted: the plastering rate read two ways
// (₦4,800 vs ₦48,000) is the case this guards. Tap-to-fix jumps to the
// item's Adjust button; nothing here changes a rate on its own.
function flagged(changes: BoqChange[]): BoqChange[] {
  return changes.filter(change => {
    if (!change.before) return false;
    try {
      const before = decimal(change.before.rate, "previous rate");
      const after = decimal(change.after.rate, "current rate");
      if (before.lte(0) || after.lte(0)) return false;
      const ratio = after.div(before).toNumber();
      return ratio >= 5 || ratio <= 0.2;
    } catch { return false; }
  });
}

export function BoqReview({ changes, currency }: { changes: BoqChange[]; currency: string }) {
  const items = flagged(changes);
  return <details className="work-disclosure" data-tour="boq-review" open={items.length > 0 || undefined}>
    <summary>{items.length ? "Action required" : "Review supplied rates"}{items.length ? <small>{items.length} {items.length === 1 ? "rate" : "rates"} changed by five times or more — check them before the next costing.</small> : <small>Rates that move by five times or more from their previous version are flagged here.</small>}</summary>
    <div className="work-disclosure-body">
      {items.length ? <ul className="diary-list">{items.map(change => <li key={change.id}><a href={`#boq-item-${change.after.item_code}`}><span><strong>{change.after.description}</strong><small>Rate was {formatMoney(change.before!.rate, currency)} per {change.after.unit}, now {formatMoney(change.after.rate, currency)}. Tap to check and correct it.</small></span><span>Fix</span></a></li>)}</ul>
        : <p>No rates need review. Compare the quantities and rates with the supplied BoQ before the next costing.</p>}
    </div>
  </details>;
}
