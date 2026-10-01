# Carrowmont Budget & Cash Flow Planner

Privacy-first, no-login budgeting and cash-flow planning tool for Carrowmont.

## V1 capabilities

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
- Deterministic Smart Suggestions using up to 12 normal saved months
- Protected/exceptional-aware flexible-spending opportunity detection
- Low-disruption, Balanced and Aggressive adjustment scenarios derived only from evidenced excess
- Planning-priority linkage to Goal Planner, SIP/Recurring Investment, Retirement and Financial Independence
- Country/currency-aware display using the Carrowmont locale architecture
- Downloadable Budget & Cash Flow PDF report

## Privacy model

Budget history is stored locally in the browser/device by default. No account is required. Users can export a JSON backup and restore it in another browser/device. Smart Suggestions V1A runs entirely in the browser and introduces no AI or budget-data network request.

## Calculation notes

Amounts are translated to monthly equivalents for comparison. Quarterly and annual expenses are therefore treated as monthly reserves. Irregular entries are treated as the monthly average supplied by the user.

Smart Suggestions use only deterministic calculations. Protected categories are never proposed as reduction sources, essential categories are informational only, and exceptional months/items are excluded from normal trend baselines.

This tool is educational planning software, not individualized financial advice.
