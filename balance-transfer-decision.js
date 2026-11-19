(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const C = window.CarrowmontBalanceTransferDecisionCore;
  const L = window.CarrowmontLocale;
  const fields = {
    balance: $('btBalance'), currentAprPct: $('btCurrentApr'), monthlyPayment: $('btPayment'),
    introAprPct: $('btIntroApr'), introMonths: $('btIntroMonths'), postAprPct: $('btPostApr'),
    transferFeePct: $('btFeePct'), fixedFee: $('btFixedFee'), feeTreatment: $('btFeeTreatment')
  };
  const currencyDigits = () => {
    try { return new Intl.NumberFormat('en', {style:'currency',currency:L.getCurrency()}).resolvedOptions().maximumFractionDigits; }
    catch (_) { return 2; }
  };
  const fmt = n => L.formatMoney(n, {maximumFractionDigits:currencyDigits()});
  const fmtPaymentCeiling = n => {
    const factor = 10 ** currencyDigits();
    return fmt(Math.ceil(n * factor) / factor);
  };
  const term = r => r.status === 'paid_off' ? `${r.months} month${r.months === 1 ? '' : 's'}` : 'Not repaid within 50 years';
  const into = (id, value) => { $(id).textContent = value; };
  function input() { return Object.fromEntries(Object.entries(fields).map(([key,el]) => [key, el.value])); }
  function render() {
    const result = C.calculate(input());
    const error = $('btError');
    error.hidden = result.status === 'ok';
    if (result.status !== 'ok') {
      error.textContent = (result.errors || ['Unable to calculate.']).join(' ');
      into('btSummary', 'Please review your inputs.');
      ['btSavings','btOldInterest','btOldMonths','btOldTotal','btTransferCost','btTransferMonths',
       'btTransferTotal','btFee','btPromoBalance','btPromoPayment'].forEach(id=>into(id,'—'));
      into('btSavingsDetail','Results are hidden until the entered terms are valid.');
      into('btPromoNote','Enter complete terms to model the promotional deadline.');
      $('btWarnings').replaceChildren();
      return;
    }
    error.textContent = '';
    const { current, transfer, comparison, promoClearPayment } = result;
    into('btOldInterest', fmt(current.totalInterest) + (current.status === 'paid_off' ? '' : ' so far'));
    into('btOldMonths', term(current));
    into('btOldTotal', current.status === 'paid_off' ? fmt(current.totalPaid) : 'Cannot compare reliably');
    into('btTransferCost', fmt(transfer.financingCost) + (transfer.status === 'paid_off' ? '' : ' so far'));
    into('btTransferMonths', term(transfer));
    into('btTransferTotal', transfer.status === 'paid_off' ? fmt(transfer.totalOutlay) : 'Cannot compare reliably');
    into('btFee', fmt(result.fee));
    into('btPromoBalance', fmt(transfer.atIntroEnd));
    into('btPromoPayment', promoClearPayment == null ? 'No promotional period' : fmtPaymentCeiling(promoClearPayment));
    into('btPromoNote', result.inputs.introMonths
      ? 'This payment would clear the modeled transfer by the end of the offer; it may be higher than your current budget.'
      : 'The standard rate begins immediately because no promotional months were entered.');
    if (comparison.comparable) {
      const diff = comparison.savings;
      const abs = fmt(Math.abs(diff));
      if (diff > 0.005) {
        into('btSummary','Under these assumptions, transferring costs less than keeping the current card.');
        into('btSavings',abs+' less with transfer');
      } else if (diff < -0.005) {
        into('btSummary','Under these assumptions, keeping your current card costs less than transferring.');
        into('btSavings',abs+' more with transfer');
      } else {
        into('btSummary','The two paths have approximately the same modeled total cost.');
        into('btSavings','Approximately equal');
      }
      into('btSavingsDetail',`Both paths use ${fmt(result.inputs.monthlyPayment)} each month. Fee and any upfront payment are included in the transfer total.`);
    } else {
      into('btSummary','Your monthly payment does not fully repay both paths within the 50-year model.');
      into('btSavings','No reliable savings estimate');
      into('btSavingsDetail','Increase the monthly payment or review the rates before comparing lifetime costs.');
    }
    const warnings = $('btWarnings');
    warnings.replaceChildren();
    if (result.warnings.length) {
      const ul = document.createElement('ul');
      for (const message of result.warnings) {
        const li = document.createElement('li');
        li.textContent = message;
        ul.appendChild(li);
      }
      warnings.appendChild(ul);
    }
  }
  $('btForm').addEventListener('submit', event => {event.preventDefault();render();});
  $('btExample').addEventListener('click', () => {
    Object.entries({balance:5000,currentAprPct:24,monthlyPayment:300,introAprPct:0,introMonths:12,postAprPct:24,transferFeePct:3,fixedFee:0,feeTreatment:'financed'})
      .forEach(([name,v]) => { fields[name].value = String(v); });
    render();
  });
  const panel = document.getElementById('balance-transfer');
  function revealRequestedSection() {
    if (location.hash === '#balance-transfer') panel.open = true;
  }
  window.addEventListener('hashchange', revealRequestedSection);
  ['regionSelect','currencySelect'].forEach(id => document.getElementById(id)?.addEventListener('change',render));
  panel.addEventListener('toggle',()=>{ if(panel.open) render(); });
  revealRequestedSection();
  if (panel.open) render();
})();
