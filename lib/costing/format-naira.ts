import { decimal } from "./decimal";
import type { DecimalInput } from "./types";

/** Section 10's demo display rule; never use the rounded result for storage. */
export function roundNairaForDisplay(amount: DecimalInput): string {
  return decimal(amount, "display amount").div(10).round(0).times(10).toFixed(0);
}

export function formatNaira(amount: DecimalInput): string {
  return `₦${roundNairaForDisplay(amount).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}
