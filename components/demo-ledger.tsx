import seed from "@/lib/data/demo-summary.json";
import { costReport } from "@/lib/costing/cost-report";
import { formatMoney } from "@/lib/costing/format-money";
// Fictional illustration: section 10 seed rates, not a new saved report.
export function DemoLedger() {
  const examples=[{code:"BLK-01",quantity:"18",unit:"m2" as const,label:"Blockwork / East elevation"},{code:"CON-01",quantity:"2",unit:"m3" as const,label:"Concrete / Columns & beams"}];
  const prices=examples.map(item=>{const price=seed.boq_items.find(row=>row.item_code===item.code)!;return {id:item.code,unit:item.unit,rate:String(price.rate),boq_quantity:String(price.boq_quantity),cumulative_locked_quantity:"0"};});
  const costed=costReport(examples.map(item=>({boq_item_id:item.code,quantity_done:item.quantity,unit:item.unit,confirmed_by:"fictional illustration"})),prices);
  return <figure className="demo-ledger"><div className="flex items-start justify-between gap-3 border-b border-rule pb-5"><div><p className="eyebrow">Illustrative daily record</p><p className="mt-3 font-serif text-2xl">Lekki duplex</p></div><span className="sample-stamp">SAMPLE</span></div><p className="my-5 text-sm leading-6">Example confirmed quantities, matched to the demo BoQ.</p>
    <table className="sample-table"><caption className="sr-only">Illustrative cost of work from supplied demo rates</caption><thead><tr><th scope="col">Work item</th><th scope="col">Quantity</th><th scope="col">Value</th></tr></thead><tbody>{examples.map((item,i)=><tr key={item.code}><th scope="row">{item.label}</th><td>{item.quantity} {item.unit==="m2"?"m²":"m³"}</td><td>{formatMoney(costed.items[i].cost_today,"NGN")}</td></tr>)}</tbody></table>
    <div className="sample-total"><span>Value of work</span><strong>{formatMoney(costed.total_cost,"NGN")}</strong></div><div className="mt-6 border-t border-rule pt-4 text-sm leading-6"><p>Voice note → human check → BoQ cost</p><p className="mt-2 text-[#46523B]">Approval is separate. Corrections become amendments.</p></div><figcaption className="mt-6 text-xs leading-5">Fictional example. Illustrative NGN rates from the brief; verify before real use.</figcaption>
  </figure>;
}
