# Costing agent scope

Prepared role specification, not a claim of an executed Kiro Crew agent.

- Input: human-confirmed quantities and the shared BoQ price list.
- Output: the pure `costReport` function and tests for all section 10 formulas.
- Boundaries: rates come only from the price list; no AI, database, or network calls inside costing. Begin implementation at task 6.
- Evidence to record after real use: one actual formula or overrun test change and the related commit.
