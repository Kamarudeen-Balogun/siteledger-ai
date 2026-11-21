import { decimal, CostingValidationError } from "./decimal";
import { formatNaira } from "./format-naira";
import type { DecimalInput } from "./types";
export const projectCurrencies = Intl.supportedValuesOf("currency");
export function validCurrency(currency: unknown): currency is string { return typeof currency === "string" && projectCurrencies.includes(currency); }
/** Display supplied money in its recorded currency; never convert a rate. */
export function formatMoney(amount: DecimalInput, currency: string): string {
  if (!validCurrency(currency)) throw new CostingValidationError("project currency");
  if (currency === "NGN") return formatNaira(amount);
  const formatter = new Intl.NumberFormat("en-NG", { style: "currency", currency, currencyDisplay: "narrowSymbol" });
  const digits = formatter.resolvedOptions().maximumFractionDigits;
  const exact = decimal(amount, "display amount").round(digits).toFixed(digits);
  const [whole, fraction] = exact.split(".");
  const symbol = formatter.formatToParts(0).find(part => part.type === "currency")!.value;
  return `${symbol}${/[A-Za-z]/.test(symbol) ? " " : ""}${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}${fraction === undefined ? "" : "." + fraction}`;
}
