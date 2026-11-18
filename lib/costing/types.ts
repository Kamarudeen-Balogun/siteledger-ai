/** Pass large database numeric values as decimal strings, never through Number(). */
export type DecimalInput = string | number;
export type BoqUnit = "m3" | "m2" | "tonne" | "point" | "day";

export type BoqPrice = {
  id: string;
  unit: BoqUnit;
  boq_quantity: DecimalInput;
  rate: DecimalInput;
  /** Sum from locked reports only, excluding the report being calculated. */
  cumulative_locked_quantity: DecimalInput;
  /** The plan for this report's date; absent/null means no plan. */
  planned_percentage?: DecimalInput | null;
};

/** The trusted caller loads saved human-confirmed values and their author. */
export type ConfirmedCostItem = {
  boq_item_id: string;
  quantity_done: DecimalInput;
  unit: BoqUnit;
  crew?: number | null;
  confirmed_by: string;
};

/** Decimal strings serialize without losing precision; no display rounding here. */
export type CostedItem = {
  boq_item_id: string;
  quantity_done: string;
  unit: BoqUnit;
  crew: number | null;
  confirmed_by: string;
  rate: string;
  cost_today: string;
  cumulative_quantity: string;
  percentage_complete: string;
  value_earned: string;
  planned_percentage: string | null;
  variance_percentage_points: string | null;
  is_overrun: boolean;
  is_behind_plan: boolean;
  variance_color: "red" | null;
  /** Quantity in `unit` per person per day, or null when crew is not recorded. */
  productivity: string | null;
};

export type CostedReport = { items: CostedItem[]; total_cost: string };
