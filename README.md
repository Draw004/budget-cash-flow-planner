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
- Deterministic budget insights
- Country/currency-aware display using the Carrowmont locale architecture
- Downloadable Budget & Cash Flow PDF report

## Privacy model

Budget history is stored locally in the browser/device by default. No account is required. Users can export a JSON backup and restore it in another browser/device.

## Calculation notes

Amounts are translated to monthly equivalents for comparison. Quarterly and annual expenses are therefore treated as monthly reserves. Irregular entries are treated as the monthly average supplied by the user.

This tool is educational planning software, not individualized financial advice.
