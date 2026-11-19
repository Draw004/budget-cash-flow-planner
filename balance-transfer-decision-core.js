/* Carrowmont Batch 12B-1: deterministic credit-card transfer comparison.
   No external lookups, persistence, approval estimates, or account access.
   Current-card path uses the existing CarrowmontDebtPayoffCore. */
(function (root) {
  'use strict';
  const MAX_MONTHS = 600;
  const EPS = 1e-7;
  const value = v => v === '' || v == null ? NaN : Number(v);
  const validRange = (n, min, max) => Number.isFinite(n) && n >= min && n <= max;

  function normalize(raw = {}) {
    return {
      balance: value(raw.balance),
      currentAprPct: value(raw.currentAprPct),
      monthlyPayment: value(raw.monthlyPayment),
      introAprPct: value(raw.introAprPct),
      introMonths: value(raw.introMonths),
      postAprPct: value(raw.postAprPct),
      transferFeePct: value(raw.transferFeePct),
      fixedFee: value(raw.fixedFee),
      feeTreatment: raw.feeTreatment === 'upfront' ? 'upfront' : raw.feeTreatment === 'financed' ? 'financed' : null
    };
  }

  function validate(i) {
    const errors = [];
    if (!validRange(i.balance, EPS, 1e12)) errors.push('Enter a positive balance.');
    if (!validRange(i.currentAprPct, 0, 100)) errors.push('Current APR must be between 0% and 100%.');
    if (!validRange(i.monthlyPayment, EPS, 1e12)) errors.push('Enter a positive monthly payment.');
    if (!validRange(i.introAprPct, 0, 100)) errors.push('Promotional APR must be between 0% and 100%.');
    if (!Number.isInteger(i.introMonths) || !validRange(i.introMonths, 0, 60)) errors.push('Promotional period must be 0 to 60 whole months.');
    if (!validRange(i.postAprPct, 0, 100)) errors.push('Post-promotion APR must be between 0% and 100%.');
    if (!validRange(i.transferFeePct, 0, 100)) errors.push('Transfer fee percentage must be between 0% and 100%.');
    if (!validRange(i.fixedFee, 0, 1e12)) errors.push('Fixed transfer fee cannot be negative.');
    if (!i.feeTreatment) errors.push('Choose whether the fee is added to the balance or paid upfront.');
    return errors;
  }

  function simulateTransfer(i, monthlyPayment, fee) {
    const financedFee = i.feeTreatment === 'financed' ? fee : 0;
    const upfrontFee = i.feeTreatment === 'upfront' ? fee : 0;
    let outstanding = i.balance + financedFee;
    let cumulativeInterest = 0;
    let paidOnCard = 0;
    let atIntroEnd = i.introMonths === 0 ? outstanding : null;
    let paidOffMonth = null;
    for (let m = 1; m <= MAX_MONTHS; m += 1) {
      const annual = m <= i.introMonths ? i.introAprPct : i.postAprPct;
      const interest = outstanding * annual / 1200;
      const due = outstanding + interest;
      const paid = Math.min(monthlyPayment, due);
      outstanding = Math.max(0, due - paid);
      paidOnCard += paid;
      cumulativeInterest += interest;
      if (m === i.introMonths) atIntroEnd = outstanding;
      if (outstanding <= EPS) {
        outstanding = 0;
        paidOffMonth = m;
        if (atIntroEnd == null) atIntroEnd = 0;
        break;
      }
    }
    return {
      status: paidOffMonth == null ? 'unresolved' : 'paid_off',
      months: paidOffMonth == null ? MAX_MONTHS : paidOffMonth,
      totalInterest: cumulativeInterest,
      fee,
      financedFee,
      upfrontFee,
      financingCost: fee + cumulativeInterest,
      totalOutlay: paidOnCard + upfrontFee,
      atIntroEnd,
      endingBalance: outstanding
    };
  }

  function payoffBeforeOffer(i, fee) {
    if (i.introMonths <= 0) return null;
    const months = i.introMonths;
    // Solve by the SAME monthly interest/payment convention as simulateTransfer.
    let low = 0;
    let high = (i.balance + (i.feeTreatment === 'financed' ? fee : 0)) * (1 + i.introAprPct / 1200) + 0.01;
    for (let j = 0; j < 70; j += 1) {
      const mid = (low + high) / 2;
      const r = simulateTransfer(i, mid, fee);
      if (r.status === 'paid_off' && r.months <= months) high = mid;
      else low = mid;
    }
    // Keep the solved amount precise. The presentation rounds UP to the
    // selected currency's smallest ordinary unit (0/2/3 decimals as applicable).
    return high;
  }

  function calculate(raw = {}, debtCore = root.CarrowmontDebtPayoffCore) {
    const i = normalize(raw);
    const errors = validate(i);
    if (errors.length) return { status: 'invalid', errors, inputs: i };
    if (!debtCore || typeof debtCore.simulateStrategy !== 'function') {
      return { status: 'unavailable', errors: ['The current-card comparison engine is unavailable.'] };
    }
    const fee = i.balance * i.transferFeePct / 100 + i.fixedFee;
    const current = debtCore.simulateStrategy([{
      id: 'card', label: 'Current card', balance: i.balance,
      annualRatePct: i.currentAprPct, minimumPayment: i.monthlyPayment
    }], 0, 'avalanche', { maxMonths: MAX_MONTHS });
    const transfer = simulateTransfer(i, i.monthlyPayment, fee);
    const comparable = current.status === 'paid_off' && transfer.status === 'paid_off';
    const savings = comparable ? current.totalPaid - transfer.totalOutlay : null;
    const warnings = [];
    if (current.status !== 'paid_off') warnings.push('At this payment, the current-card path does not clear within 50 years.');
    if (transfer.status !== 'paid_off') warnings.push('At this payment, the transfer path does not clear within 50 years.');
    if (i.introMonths === 0) warnings.push('No promotional months were entered; the post-promotion rate applies immediately.');
    if (i.introAprPct >= i.currentAprPct && fee > EPS) warnings.push('The promotional rate is not lower than your current rate, and there is also a transfer fee.');
    if (i.feeTreatment === 'upfront' && fee > EPS) warnings.push('Paying the transfer fee upfront requires extra cash now, outside the equal monthly payments.');
    if (transfer.atIntroEnd > EPS && i.introMonths > 0) warnings.push('Part of the balance remains when the promotional rate ends.');
    return {
      status: 'ok', version: 'FRE12B1-1.0', inputs: i, current, transfer, fee,
      comparison: { comparable, savings, payoffMonthsChange: comparable ? current.months - transfer.months : null },
      promoClearPayment: payoffBeforeOffer(i, fee), warnings,
      method: 'Monthly nominal APR / 12; interest accrues before each fixed monthly payment; no new charges, late fees, taxes, or changing issuer minimums.'
    };
  }

  const api = Object.freeze({ calculate, normalize, validate, simulateTransfer, payoffBeforeOffer, MAX_MONTHS });
  root.CarrowmontBalanceTransferDecisionCore = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
