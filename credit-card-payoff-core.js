(() => {
  'use strict';
  const D = () => window.CarrowmontDebtPayoffCore;
  const finite = v => Number.isFinite(Number(v));
  const num = v => Number(v);

  function normalize(input = {}) {
    const balance = num(input.balance);
    const annualRatePct = num(input.annualRatePct);
    const minimumPayment = num(input.minimumPayment);
    const plannedPayment = num(input.plannedPayment);
    const targetMonths = input.targetMonths == null || input.targetMonths === '' ? null : Math.round(num(input.targetMonths));
    return { balance, annualRatePct, minimumPayment, plannedPayment, targetMonths };
  }

  function validBase(i) {
    return finite(i.balance) && i.balance > 0 && finite(i.annualRatePct) && i.annualRatePct >= 0 && finite(i.minimumPayment) && i.minimumPayment > 0;
  }

  function oneDebt(i) {
    return [{ id: 'card', label: 'Credit card', balance: i.balance, annualRatePct: i.annualRatePct, minimumPayment: i.minimumPayment }];
  }

  function simulate(i, monthlyPayment) {
    const extra = Math.max(0, Number(monthlyPayment) - i.minimumPayment);
    return D().simulateStrategy(oneDebt(i), extra, 'avalanche');
  }

  function solvePaymentForTarget(i, targetMonths) {
    if (!validBase(i) || !Number.isInteger(targetMonths) || targetMonths < 1 || targetMonths > 600) return null;
    const minimumResult = simulate(i, i.minimumPayment);
    if (minimumResult.status === 'paid_off' && minimumResult.months <= targetMonths) return i.minimumPayment;
    let low = i.minimumPayment;
    let high = Math.max(i.minimumPayment * 2, i.balance / Math.max(1, targetMonths) + i.balance * (i.annualRatePct / 100 / 12));
    let highResult = simulate(i, high);
    let guard = 0;
    while ((highResult.status !== 'paid_off' || highResult.months > targetMonths) && guard < 30) {
      high *= 1.8;
      highResult = simulate(i, high);
      guard += 1;
    }
    if (highResult.status !== 'paid_off' || highResult.months > targetMonths) return null;
    for (let n = 0; n < 70; n += 1) {
      const mid = (low + high) / 2;
      const r = simulate(i, mid);
      if (r.status === 'paid_off' && r.months <= targetMonths) high = mid;
      else low = mid;
    }
    return high;
  }

  function calculate(input = {}) {
    const i = normalize(input);
    if (!validBase(i)) return { status: 'invalid', inputs: i, errors: ['Enter a positive balance and minimum payment, and a non-negative annual interest rate.'] };
    const minimum = simulate(i, i.minimumPayment);
    const chosenPayment = finite(i.plannedPayment) && i.plannedPayment > 0 ? Math.max(i.minimumPayment, i.plannedPayment) : i.minimumPayment;
    const planned = simulate(i, chosenPayment);
    const targetPayment = i.targetMonths ? solvePaymentForTarget(i, i.targetMonths) : null;
    const target = targetPayment ? simulate(i, targetPayment) : null;
    const warning = i.minimumPayment <= i.balance * (i.annualRatePct / 100 / 12)
      ? 'The entered minimum payment may not cover the first modeled month of interest.' : null;
    return {
      version: 'FRE2D-1.0', status: 'ok', inputs: i, chosenPayment,
      minimum, planned, targetPayment, target,
      comparison: {
        monthsSaved: minimum.status === 'paid_off' && planned.status === 'paid_off' ? Math.max(0, minimum.months - planned.months) : null,
        interestSaved: minimum.status === 'paid_off' && planned.status === 'paid_off' ? Math.max(0, minimum.totalInterest - planned.totalInterest) : null
      },
      warning
    };
  }

  function runFixtures() {
    const out = [];
    const add = (name, ok) => out.push({name, ok:Boolean(ok)});
    let r = calculate({balance:1200, annualRatePct:0, minimumPayment:100, plannedPayment:200});
    add('zero APR minimum path', r.minimum.months === 12 && r.minimum.totalInterest === 0);
    add('zero APR higher payment', r.planned.months === 6 && r.comparison.monthsSaved === 6);
    r = calculate({balance:5000, annualRatePct:24, minimumPayment:150, plannedPayment:300, targetMonths:24});
    add('higher payment reduces interest', r.planned.totalInterest < r.minimum.totalInterest);
    add('target solver returns payment', Number.isFinite(r.targetPayment) && r.targetPayment >= r.inputs.minimumPayment && r.target.months <= 24);
    r = calculate({balance:1000, annualRatePct:36, minimumPayment:20, plannedPayment:20});
    add('warns when minimum may not cover interest', Boolean(r.warning));
    r = calculate({balance:0, annualRatePct:20, minimumPayment:50});
    add('invalid balance rejected', r.status === 'invalid');
    return out;
  }

  window.CarrowmontCreditCardPayoffCore = { calculate, solvePaymentForTarget, runFixtures };
})();
