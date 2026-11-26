import Image from "next/image";
import { displayDate, displayRatio, displayProductivity, displayTimestamp, displayUnit, lockDate, moneyDisplayNote, type ReportView } from "@/lib/reports/model";
import { formatMoney } from "@/lib/costing/format-money";

export function ReportDocument({ report, trial = false, guestOriginal = false, sharedPath, demoPhotos = false }: { report: ReportView; trial?: boolean; guestOriginal?: boolean; sharedPath?: string; demoPhotos?: boolean }) {
  const { document: doc } = report, source = doc.source;
  const money = (amount: string) => formatMoney(amount, doc.currency);
  const prices = new Map(source.price_list.map(price => [price.id, price]));
  return <article className="report-document" aria-label="Daily site report">
    <header className="report-header">
      <p className="report-eyebrow">Daily site record / {doc.currency}</p>
      <p className="report-firm">{doc.firm_name}</p>
      {report.status === "locked" && <div className="report-stamp">LOCKED<span>{lockDate(report)}</span></div>}
      <h1>Daily site report</h1>
      <dl className="report-meta">{[["Project", source.project.name], ["Client", source.project.client], ["Location", source.project.location],
        ["Date", displayDate(source.date)], ...(source.received_at?[["Recorded",displayTimestamp(source.received_at,source.project.timezone)]]:[]), ...(source.boq_version?[["BoQ",`Version ${source.boq_version}`]]:[]), ["Weather", doc.weather || "Not recorded"]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      <p className="report-reference">{report.status === "locked" ? "Approved and locked" : "Draft — awaiting approval"}</p>
    </header>
    <section className="report-total" data-tour="report-total"><div><h2>Value of work today</h2><p>Confirmed quantities × BoQ rates</p></div><strong>{money(doc.costing.total_cost)}</strong></section>
    <section><h2>Work done and BoQ value</h2>
      <div className="report-table-scroll" tabIndex={0} role="region" aria-label="Work done and BoQ costs">
        <table className="report-table"><caption className="sr-only">Confirmed quantities, BoQ rates, costs and cumulative progress</caption>
          <thead><tr><th scope="col">Work item</th><th scope="col">Quantity</th><th scope="col">Rate</th><th scope="col">Cost today</th></tr></thead>
          <tbody>{doc.costing.items.map((item, i) => <tr key={i} data-tour={i===0?"report-progress":undefined}>
            <td><p className="report-eyebrow">{prices.get(item.boq_item_id)?.section}</p><p className="report-work-title">{source.items[i].description}</p>
              <p className="report-note">{prices.get(item.boq_item_id)?.description}</p>
              <p className={item.variance_color === "red" ? "report-variance" : "report-progress"}>{item.cumulative_quantity} / {prices.get(item.boq_item_id)?.boq_quantity} {displayUnit(item.unit)} · {displayRatio(item.percentage_complete)}% complete</p>
              <p className="report-note">Value earned {money(item.value_earned)}</p>
              {item.is_overrun && <p className="report-variance">Over BoQ quantity — check this item.</p>}
              {item.is_behind_plan && <p className="report-variance">{displayRatio(item.variance_percentage_points!)} percentage points against plan</p>}
              {item.productivity !== null && <p className="report-note">Crew {item.crew} · {displayProductivity(item.productivity)} {displayUnit(item.unit)} per person per day</p>}
            </td><td data-label="Quantity">{item.quantity_done} {displayUnit(item.unit)}</td><td data-label="Rate">{money(item.rate)}</td><td data-label="Cost" className="font-semibold">{money(item.cost_today)}</td>
          </tr>)}</tbody>
        </table>
      </div>
      {!source.items.length && <p>No measured work recorded today.</p>}
    </section>
    <section><h2>Materials recorded</h2>{!source.materials.length ? <p className="report-note">No materials recorded.</p> : <ul>{source.materials.map((item, i) => <li key={i}>{item.quantity} {item.unit} {item.name}{item.action ? ` · ${item.action}` : ""}</li>)}</ul>}</section>
    <section><h2>Delays and site issues</h2>
      {!source.delays.length && <p className="report-note">No delay recorded.</p>}
      {source.delays.map((delay, i) => <p key={i}>{delay.reason} — {delay.hours} hrs</p>)}
      {!source.issues.length && <p className="report-note">No site issue recorded.</p>}
      <ul>{source.issues.map((issue, i) => <li key={i}>{issue}</li>)}</ul>
    </section>
    <section><h2>Photographic evidence</h2>
      {!source.photos.length && !demoPhotos && <p className="report-note">No photos were attached to this record.</p>}
      {demoPhotos&&<figure><Image src="/demo/photos/synthetic-column-voids.jpg" width={800} height={600} alt="Illustrative concrete column showing surface voids" className="h-auto w-full"/><figcaption>Synthetic example · Possible honeycombing. Check the column face before recording a finding.</figcaption></figure>}
      <div className="report-photos">{source.photos.map((photo, i) => <figure key={photo.id}>
        <Image src={sharedPath ? `${sharedPath}/${i+1}` : trial ? `/api/trial/media/${photo.id}` : `/api/confirm/${source.submission_id}/media/${photo.id}`} width={800} height={600}
          alt={`Site evidence photo ${i + 1}`} unoptimized className="h-auto w-full" />
        <figcaption>Photo {i + 1} · {photo.note || "No observation recorded."}</figcaption>
      </figure>)}</div>
    </section>
    {source.guest_origin && !sharedPath && <section><h2>Original guest capture</h2><p>{source.guest_origin.recorded_by} · {displayTimestamp(source.guest_origin.created_at,source.project.timezone)}</p><p>Saved to this account {displayTimestamp(source.guest_origin.handover_at,source.project.timezone)}. Original guest edits and attribution are preserved.</p></section>}
    <section className="report-signatures"><div><h2>{trial || guestOriginal ? "Guest trial / unverified" : source.submitted_role === "pm" ? "Site record / PM" : "Site foreman / site engineer"}</h2><p>Recorded by {source.submitted_by}</p><p className="report-signature-line">Signature / date</p></div>
      <div><h2>Project manager / QS</h2><p>{report.approved_by || "Awaiting approval"}</p><p className="report-signature-line">Signature / date</p></div></section>
    <footer>{source.confirmed_by && <p>Quantities confirmed by {source.confirmed_by}{source.confirmed_role ? ` / ${source.confirmed_role === "pm" ? "PM" : "Foreman"}` : ""}{source.confirmed_at ? ` · ${displayTimestamp(source.confirmed_at, source.project.timezone)}` : ""}</p>}
      {report.locked_at && <p>Locked {displayTimestamp(report.locked_at, source.project.timezone)}</p>}
      <p>{moneyDisplayNote(doc.currency)}</p>
      {source.project.is_demo && <p>Demo project and illustrative rates — verify before real use.</p>}
      <p className="report-reference">SITELEDGER / {source.date} / {doc.currency}</p>
    </footer>
  </article>;
}
