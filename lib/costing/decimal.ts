import Big from "big.js";

// Independent configuration: addition/multiplication stay exact. Only division
// (completion and productivity ratios) rounds, to 30 decimal places.
const Decimal = Big();
Decimal.DP = 30;
Decimal.RM = Big.roundHalfUp;

export class CostingValidationError extends Error {
  constructor(field: string) {
    super(`Cannot cost the report: check ${field}.`);
    this.name = "CostingValidationError";
  }
}

export function decimal(value: unknown, field: string): Big {
  if ((typeof value !== "string" && typeof value !== "number")
    || (typeof value === "number" && (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER))
    || !/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(String(value))) {
    throw new CostingValidationError(field);
  }
  return new Decimal(String(value));
}
