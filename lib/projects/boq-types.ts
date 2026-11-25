import { projectText } from "./types";
import type { BoqUnit } from "../costing/types";
export type BoqRow = { id: string; item_code: string; section: string; description: string; unit: BoqUnit; boq_quantity: string; rate: string; revision: string; used: boolean };
export type BoqEdit = Omit<BoqRow, "used" | "revision"> & { revision: string | null };
export const boqUnits: BoqUnit[] = ["m3", "m2", "tonne", "point", "day"];
export function validBoqEdit(value: unknown): value is BoqEdit {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as BoqEdit;
  return Object.keys(row).length === 8 && /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(row.id)
    && (row.revision === null || /^[a-f0-9]{32}$/.test(row.revision))
    && [row.item_code, row.section, row.description].every(text => Boolean(projectText(text)))
    && boqUnits.includes(row.unit) && typeof row.boq_quantity === "string"
    && /^[0-9]{1,10}(\.[0-9]{1,4})?$/.test(row.boq_quantity) && /[1-9]/.test(row.boq_quantity) && Number(row.boq_quantity) < 10000000000
    && typeof row.rate === "string" && row.rate.length <= 40 && /^[0-9]+(\.[0-9]+)?$/.test(row.rate);
}
