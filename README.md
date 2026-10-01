# Carrowmont Budget & Cash Flow Planner

Privacy-first, no-login budgeting and cash-flow planning tool for Carrowmont.

## Current capabilities

- Monthly View and Pay Cycle View
- Multiple income sources with independent frequencies
- Essential and flexible expense categories
- Savings and investment categories
- Quarterly / annual bills converted to monthly reserves
- User-selected emergency-reserve target
- Protected categories and exceptional categories/months
- Monthly free cash flow, savings rate, safe weekly/daily spending
- Next-payday context and upcoming dated bills
- Local IndexedDB month history with 3/6/12-month comparison
- JSON export / restore
- Deterministic Smart Suggestions SS2 using up to 12 normal saved months
- Current / Emerging / Established evidence labels
- 6- and 12-month materiality plus consistency tests so one large month does not create a false Established trend
- Deterministic suggestion scoring, thresholding and deduplication; up to three useful cards with no filler requirement
- Stable recurring-cost step-up detection using the latest two observations versus the previous three-month baseline
- Reserve-aware handling for quarterly, annual and irregular entries
- Protected/exceptional-aware flexible-spending opportunity detection
- Low-disruption, Balanced and Aggressive adjustment scenarios derived only from evidenced excess
- Expandable category-level scenario breakdown showing baseline, current amount, evidenced excess and modelled adjustment
- Planning-priority linkage to Goal Planner, SIP/Recurring Investment, Retirement and Financial Independence, including 12-month arithmetic equivalents
- Country/currency-aware display using the Carrowmont locale architecture
- Downloadable Budget & Cash Flow PDF report using the same Smart Suggestions result object as the webpage

## Privacy model

Budget history is stored locally in the browser/device by default. No account is required. Users can export a JSON backup and restore it in another browser/device. Smart Suggestions SS2 runs entirely in the browser and introduces no AI or budget-data network request.

## Smart Suggestions SS2 behavior

Smart Suggestions use deterministic calculations only. The engine first determines whether an observation is supported by enough normal history and whether the change is financially material. Established 6- and 12-month trends must also pass a repeated-observation consistency test.

Protected categories are never proposed as reduction sources. Essential categories are informational only. Exceptional months/items are excluded from normal trend baselines. Quarterly, annual and irregular reserve-style entries are compared as monthly-equivalent reserves and are not included in spending-reduction scenarios.

Suggestion scores are internal only. They are used to rank evidence consistently; scores are not shown to users. The interface shows up to three primary suggestions and deliberately shows a stable/no-strong-trend state when the evidence does not justify an adjustment.

Low-disruption, Balanced and Aggressive are comparison scenarios, not recommendations. Each category adjustment remains capped by its evidenced excess and by the published SS2 scenario rules.

## Calculation notes

Amounts are translated to monthly equivalents for comparison. Quarterly and annual expenses are therefore treated as monthly reserves. Irregular entries are treated as the monthly average supplied by the user.

This tool is educational planning software, not individualized financial advice.
