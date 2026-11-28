import "server-only";
import { join } from "node:path";
import { Document, Page, Text, View, Image as PdfImage, Font, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { displayDate, displayRatio, displayProductivity, displayTimestamp, displayUnit, displayWorkTitle, formatQuantity, formatQuantityWithUnit, lockDate, moneyDisplayNote, type ReportView } from "../reports/model";
import { formatMoney } from "../costing/format-money";

Font.register({ family: "PublicSans", fonts: [
  { src: join(process.cwd(), "public/fonts/PublicSans-Regular.ttf") },
  { src: join(process.cwd(), "public/fonts/PublicSans-Bold.ttf"), fontWeight: 700 },
] });
Font.register({ family: "SourceSerif", src: join(process.cwd(), "public/fonts/SourceSerif4-Regular.ttf") });
Font.registerHyphenationCallback(word => [word]);
const styles = StyleSheet.create({
  page: { padding: 36, paddingBottom: 52, fontFamily: "PublicSans", fontSize: 10, color: "#1C1917", backgroundColor: "#FAF7F2" },
  eyebrow: { fontSize: 8, fontFamily: "Courier", color: "#57534E", letterSpacing: 1.5 },
  firm: { fontFamily: "SourceSerif", fontSize: 25, marginTop: 8 },
  title: { fontFamily: "SourceSerif", fontSize: 20, marginTop: 18, marginBottom: 6 },
  rule: { borderBottomWidth: 0.6, borderBottomColor: "#E7E0D4", paddingBottom: 14, marginBottom: 14 },
  meta: { flexDirection: "row", gap: 16, marginTop: 5 },
  label: { width: 55, color: "#57534E", fontSize: 9 },
  value: { flex: 1 },
  total: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1.5, borderTopColor: "#C2410C", paddingTop: 12, paddingBottom: 14 },
  amount: { fontSize: 25, fontWeight: 700, color: "#C2410C" },
  section: { fontFamily: "SourceSerif", fontSize: 15, marginTop: 16, marginBottom: 7 },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#E7E0D4", paddingVertical: 8 },
  colWork: { width: "46%", paddingRight: 12 }, colQty: { width: "13%", textAlign: "right" },
  colMoney: { width: "20.5%", textAlign: "right" },
  small: { fontSize: 8, color: "#57534E" },
  progress: { fontSize: 8, paddingTop: 5, color: "#57534E" },
  red: { color: "#B91C1C" },
  stamp: { position: "absolute", top: 37, right: 36, borderWidth: 1.5, borderColor: "#C2410C", color: "#C2410C", padding: 7, fontSize: 9, fontFamily: "Courier", transform: "rotate(-6deg)" },
  photo: { width: "100%", height: 230, objectFit: "contain", marginBottom: 5 },
  photoBox: { marginTop: 10, borderBottomWidth: 0.5, borderBottomColor: "#E7E0D4", paddingBottom: 10 },
  signatures: { flexDirection: "row", gap: 24, marginTop: 24 },
  signature: { width: "48%", borderTopWidth: 0.6, borderTopColor: "#57534E", paddingTop: 7 },
  footer: { position: "absolute", bottom: 20, left: 36, right: 36, fontSize: 7, color: "#57534E", fontFamily: "Courier" },
});

export async function renderReportPdf(report: ReportView, photos: string[] = []) {
  const { document: doc } = report, source = doc.source;
  const money = (amount: string) => formatMoney(amount, doc.currency);
  if (photos.length !== source.photos.length) throw new Error("Every attached photo is required for export.");
  const prices = new Map(source.price_list.map(price => [price.id, price]));
  const documentDate = new Date(report.locked_at ?? source.confirmed_at ?? source.date + "T12:00:00Z");
  const pdf = <Document title={`Daily site report — ${source.date}`} author={doc.firm_name} subject={source.project.name} creationDate={documentDate} modificationDate={documentDate}>
    <Page size="A4" style={styles.page}>
      <Text style={styles.eyebrow}>DAILY SITE RECORD / {doc.currency}</Text>
      <Text style={styles.firm}>{doc.firm_name}</Text>
      {report.status === "locked" && <View style={styles.stamp}><Text>LOCKED</Text><Text>{lockDate(report)}</Text></View>}
      <Text style={styles.title}>Daily site report</Text>
      <View style={styles.rule}>
        {[['Project', source.project.name], ['Client', source.project.client], ['Location', source.project.location],
          ['Date', displayDate(source.date)], ...(source.boq_version?[["BoQ",`Version ${source.boq_version}`]]:[]), ['Weather', doc.weather || 'Not recorded']].map(([label, value]) =>
          <View key={label} style={styles.meta}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{value}</Text></View>)}
        <Text style={[styles.small, { marginTop: 8 }]}>{report.status === "locked" ? "Approved and locked" : "Draft — awaiting approval"}</Text>
      </View>
      <View style={styles.total} wrap={false}><View><Text>Value of work today</Text><Text style={styles.small}>Confirmed quantities × BoQ rates</Text></View><Text style={styles.amount}>{money(doc.costing.total_cost)}</Text></View>
      <Text style={styles.section}>Work done and BoQ value</Text>
      <View style={styles.row} wrap={false}><Text style={styles.colWork}>Work item</Text><Text style={styles.colQty}>Quantity</Text><Text style={styles.colMoney}>Rate</Text><Text style={styles.colMoney}>Cost today</Text></View>
      {!source.items.length && <Text>No measured work recorded today.</Text>}
      {doc.costing.items.map((item, i) => <View key={i} wrap={displayWorkTitle(prices.get(item.boq_item_id)?.description, source.items[i].description).length > 600} style={{ borderBottomWidth: 0.5, borderBottomColor: "#E7E0D4", paddingBottom: 8 }}>
        <View style={[styles.row, { borderBottomWidth: 0 }]}><View style={styles.colWork}>
          <Text style={styles.eyebrow}>{prices.get(item.boq_item_id)?.section.toUpperCase()}</Text>
          <Text>{displayWorkTitle(prices.get(item.boq_item_id)?.description, source.items[i].description)}</Text>
        </View><Text style={styles.colQty}>{formatQuantity(item.quantity_done)}{"\n"}{displayUnit(item.unit)}</Text>
          <Text style={styles.colMoney}>{money(item.rate)}</Text><Text style={styles.colMoney}>{money(item.cost_today)}</Text></View>
        <Text style={[styles.progress, ...(item.variance_color === "red" ? [styles.red] : [])]}>
          {`Cumulative ${formatQuantityWithUnit(item.cumulative_quantity, item.unit)} · ${displayRatio(item.percentage_complete)}% complete · Value earned ${money(item.value_earned)}`}
          {item.is_overrun ? " · OVER BOQ QUANTITY" : item.is_behind_plan ? ` · ${displayRatio(item.variance_percentage_points!)} percentage points behind plan` : ""}
        </Text>
        {item.productivity !== null && <Text style={styles.progress}>{`Crew ${item.crew} · ${displayProductivity(item.productivity)} ${displayUnit(item.unit)} per person per day`}</Text>}
      </View>)}
      <Text style={styles.section}>Materials</Text>
      {!source.materials.length ? <Text style={styles.small}>No materials recorded.</Text> : source.materials.map((item, i) => <Text key={i}>{item.quantity} {item.unit} {item.name} — {item.action}</Text>)}
      <Text style={styles.section}>Delays and site issues</Text>
      {!source.delays.length && <Text style={styles.small}>No delay recorded.</Text>}
      {source.delays.map((delay, i) => <Text key={i}>{delay.reason} — {delay.hours} hrs</Text>)}
      {!source.issues.length && <Text style={styles.small}>No site issue recorded.</Text>}
      {source.issues.map((issue, i) => <Text key={i} style={{ marginTop: 4 }}>{issue}</Text>)}
      <Text style={styles.section}>Photographic evidence</Text>
      {!source.photos.length && <Text style={styles.small}>No photos were attached to this record.</Text>}
      {source.photos.map((photo, i) => <View key={photo.id} style={styles.photoBox}>
        <View wrap={false}><PdfImage src={photos[i]} style={styles.photo} /><Text>Photo {i + 1}</Text></View><Text>{photo.note || "No observation recorded."}</Text>
      </View>)}
      {source.guest_origin && <View><Text style={styles.section}>Original guest capture</Text><Text>{source.guest_origin.recorded_by} · {displayTimestamp(source.guest_origin.created_at,source.project.timezone)}</Text><Text style={styles.small}>Saved to this account {displayTimestamp(source.guest_origin.handover_at,source.project.timezone)}. Original guest edits and attribution are preserved.</Text></View>}
      <View style={styles.signatures} wrap={false}>
        <View style={styles.signature}><Text>{source.submitted_role === "pm" ? "Site record / PM" : "Site foreman / site engineer"}</Text><Text style={styles.small}>{`Recorded by ${source.submitted_by}`}</Text><Text style={[styles.small, { marginTop: 14 }]}>Signature / date __________________</Text></View>
        <View style={styles.signature}><Text>Project manager / QS</Text><Text style={styles.small}>{report.approved_by || "Awaiting approval"}</Text><Text style={[styles.small, { marginTop: 14 }]}>Signature / date __________________</Text></View>
      </View>
      {source.confirmed_by && <Text style={[styles.small, { marginTop: 14 }]}>{`Quantities confirmed by ${source.confirmed_by}`}{source.confirmed_at ? ` · ${displayTimestamp(source.confirmed_at, source.project.timezone)}` : ""}</Text>}
      {report.locked_at && <Text style={styles.small}>Locked {displayTimestamp(report.locked_at, source.project.timezone)}</Text>}
      <Text style={[styles.small, { marginTop: 10 }]}>{moneyDisplayNote(doc.currency)}</Text>
      {source.project.is_demo && <Text style={styles.small}>Demo project and illustrative rates — verify before real use.</Text>}
      <Text style={styles.footer} fixed render={({ pageNumber, totalPages }) => `SITELEDGER / ${source.date} / ${doc.currency}                              ${pageNumber} / ${totalPages}`} />
    </Page>
  </Document>;
  return renderToBuffer(pdf);
}
