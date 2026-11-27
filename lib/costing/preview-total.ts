import { decimal } from "./decimal";

// Display-only preview of what the confirmed quantities will cost, using
// the project's CURRENT BoQ version rates. The server costing that runs
// when the note is confirmed is the authority — this preview never sets a
// price, and it is shown only when every costed row can be priced from the
// current rates. A row without a matching rate, or without a quantity,
// makes its line (and the total) unknown rather than guessed.
export type PreviewRate = { item_code: string; rate: string };
export type PreviewBoqItem = { id: string; item_code: string };
export type PreviewRow = { boqId: string; quantity: number | null };
export type PreviewLine = { rate: string; amount: string; quantity: number } | null;
export type PreviewTotal = { lines: PreviewLine[]; total: string | null };

export function previewCostTotal(rows: readonly PreviewRow[], boq: readonly PreviewBoqItem[], rates: readonly PreviewRate[]): PreviewTotal {
  const byId = new Map(boq.map(item => [item.id, item.item_code]));
  const byCode = new Map(rates.map(rate => [rate.item_code, rate.rate]));
  const lines: PreviewLine[] = rows.map(row => {
    if (!row.boqId || row.quantity === null || !Number.isFinite(row.quantity) || row.quantity < 0) return null;
    const code = byId.get(row.boqId);
    if (!code) return null;
    const rate = byCode.get(code);
    if (rate === undefined) return null;
    try {
      return { rate, amount: decimal(rate, "BoQ rate").mul(decimal(row.quantity, "quantity")).toString(), quantity: row.quantity };
    } catch {
      return null;
    }
  });
  if (!lines.length || lines.some(line => line === null)) return { lines, total: null };
  try {
    const total = lines.reduce((sum, line) => sum.add(decimal(line!.amount, "line total")), decimal(0, "total"));
    return { lines, total: total.toString() };
  } catch {
    return { lines, total: null };
  }
}
