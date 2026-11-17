---
inclusion: always
---

# Costing rules

Source: `PROJECT_BRIEF.md`, section 10. Do not implement the engine before task 6.

- Cost today = confirmed quantity today × the item's BoQ rate.
- Cumulative quantity = quantities for the item across locked reports, including today.
- Percentage complete = cumulative quantity ÷ BoQ quantity × 100.
- Value earned = cumulative quantity × BoQ rate.
- Planned variance, when a plan exists = percentage complete − planned percentage for that date.
- Otherwise, flag cumulative quantity above BoQ quantity as an overrun and display it red.
- Productivity, when crew is recorded = quantity done ÷ crew count, in units per person per day.
- Report total = sum of item costs today. Keep exact values in storage; round display to the nearest ₦10.

Rates come only from the supplied price list. AI never supplies prices. Demo rates must be labelled **Demo rates — verify before real use**. Confirmed quantities and human-selected BoQ matches are the inputs to costing.

Write tests for these formulas before implementing the pure function.
