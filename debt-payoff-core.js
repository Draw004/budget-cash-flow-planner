(() => {
  'use strict';

  const MAX_MONTHS = 600;
  const EPSILON = 1e-7;

  const finite = value => Number.isFinite(Number(value));
  const n = value => Number(value);

  function normalizeDebts(rawDebts = []) {
    return rawDebts.map((debt, index) => ({
      id: String(debt.id ?? `debt-${index + 1}`),
      label: String(debt.label ?? '').trim(),
      balance: n(debt.balance),
      annualRatePct: n(debt.annualRatePct),
      minimumPayment: n(debt.minimumPayment),
      originalIndex: index
    })).filter(debt =>
      finite(debt.balance) && debt.balance > 0 &&
      finite(debt.annualRatePct) && debt.annualRatePct >= 0 &&
      finite(debt.minimumPayment) && debt.minimumPayment > 0
    ).slice(0, 10);
  }

  function targetSort(method, a, b) {
    if (method === 'avalanche') {
      if (Math.abs(a.annualRatePct - b.annualRatePct) > EPSILON) return b.annualRatePct - a.annualRatePct;
      if (Math.abs(a.balance - b.balance) > EPSILON) return a.balance - b.balance;
      return a.originalIndex - b.originalIndex;
    }
    if (Math.abs(a.balance - b.balance) > EPSILON) return a.balance - b.balance;
    if (Math.abs(a.annualRatePct - b.annualRatePct) > EPSILON) return b.annualRatePct - a.annualRatePct;
    return a.originalIndex - b.originalIndex;
  }

  function simulateStrategy(rawDebts, extraMonthlyPayment = 0, method = 'avalanche', options = {}) {
    const debts = normalizeDebts(rawDebts).map(debt => ({
      ...debt,
      startingBalance: debt.balance,
      monthlyRate: (debt.annualRatePct / 100) / 12,
      payoffMonth: null,
      totalInterest: 0,
      totalPaid: 0
    }));
    const maxMonths = Number.isInteger(options.maxMonths) ? Math.max(1, options.maxMonths) : MAX_MONTHS;
    const extra = Math.max(0, finite(extraMonthlyPayment) ? n(extraMonthlyPayment) : 0);
    const baseMinimumBudget = debts.reduce((sum, debt) => sum + debt.minimumPayment, 0);
    const totalMonthlyBudget = baseMinimumBudget + extra;
    const monthly = [];
    const payoffRecords = [];
    let totalInterest = 0;
    let totalPaid = 0;

    if (!debts.length) {
      return { status: 'invalid', method, months: 0, totalInterest: 0, totalPaid: 0, payoffRecords: [], monthly, baseMinimumBudget: 0, totalMonthlyBudget: 0 };
    }

    for (let month = 1; month <= maxMonths; month += 1) {
      const activeBeforeInterest = debts.filter(debt => debt.balance > EPSILON);
      if (!activeBeforeInterest.length) break;
      const monthPayments = new Map();
      let monthInterest = 0;

      for (const debt of activeBeforeInterest) {
        const interest = debt.balance * debt.monthlyRate;
        debt.balance += interest;
        debt.totalInterest += interest;
        totalInterest += interest;
        monthInterest += interest;
      }

      let minimumPaidTotal = 0;
      for (const debt of debts.filter(d => d.balance > EPSILON)) {
        const paid = Math.min(debt.minimumPayment, debt.balance);
        debt.balance -= paid;
        debt.totalPaid += paid;
        totalPaid += paid;
        minimumPaidTotal += paid;
        monthPayments.set(debt.id, (monthPayments.get(debt.id) || 0) + paid);
        if (debt.balance <= EPSILON) {
          debt.balance = 0;
          if (debt.payoffMonth == null) {
            debt.payoffMonth = month;
            payoffRecords.push({ id: debt.id, label: debt.label, month, startingBalance: debt.startingBalance, annualRatePct: debt.annualRatePct, originalIndex: debt.originalIndex });
          }
        }
      }

      let remainingBudget = Math.max(0, totalMonthlyBudget - minimumPaidTotal);
      let guard = 0;
      while (remainingBudget > EPSILON && guard < debts.length + 2) {
        guard += 1;
        const active = debts.filter(debt => debt.balance > EPSILON).sort((a, b) => targetSort(method, a, b));
        if (!active.length) break;
        const target = active[0];
        const paid = Math.min(remainingBudget, target.balance);
        target.balance -= paid;
        target.totalPaid += paid;
        totalPaid += paid;
        remainingBudget -= paid;
        monthPayments.set(target.id, (monthPayments.get(target.id) || 0) + paid);
        if (target.balance <= EPSILON) {
          target.balance = 0;
          if (target.payoffMonth == null) {
            target.payoffMonth = month;
            payoffRecords.push({ id: target.id, label: target.label, month, startingBalance: target.startingBalance, annualRatePct: target.annualRatePct, originalIndex: target.originalIndex });
          }
        }
      }

      const closingBalance = debts.reduce((sum, debt) => sum + debt.balance, 0);
      monthly.push({
        month,
        interest: monthInterest,
        cumulativeInterest: totalInterest,
        cumulativePaid: totalPaid,
        closingBalance,
        payments: debts.map(debt => ({ id: debt.id, amount: monthPayments.get(debt.id) || 0, closingBalance: debt.balance }))
      });

      if (closingBalance <= EPSILON) break;
    }

    const allPaid = debts.every(debt => debt.balance <= EPSILON);
    const firstPayoff = payoffRecords.length ? payoffRecords[0] : null;
    return {
      status: allPaid ? 'paid_off' : 'unresolved',
      method,
      months: allPaid ? monthly.length : maxMonths,
      totalInterest,
      totalPaid,
      baseMinimumBudget,
      totalMonthlyBudget,
      extraMonthlyPayment: extra,
      firstPayoff,
      payoffRecords,
      debts: debts.map(debt => ({
        id: debt.id,
        label: debt.label,
        startingBalance: debt.startingBalance,
        annualRatePct: debt.annualRatePct,
        minimumPayment: debt.minimumPayment,
        payoffMonth: debt.payoffMonth,
        finalBalance: debt.balance,
        totalInterest: debt.totalInterest,
        totalPaid: debt.totalPaid,
        originalIndex: debt.originalIndex
      })),
      monthly
    };
  }

  function warningsFor(debts) {
    return normalizeDebts(debts).filter(debt => debt.minimumPayment <= debt.balance * ((debt.annualRatePct / 100) / 12) + EPSILON).map(debt => ({
      id: debt.id,
      label: debt.label,
      message: `${debt.label || `Debt ${debt.originalIndex + 1}`} has a minimum payment that may not cover the first modeled month of interest.`
    }));
  }

  function comparePlans(rawDebts, extraMonthlyPayment = 0, options = {}) {
    const normalized = normalizeDebts(rawDebts);
    const extra = Math.max(0, finite(extraMonthlyPayment) ? n(extraMonthlyPayment) : 0);
    const avalanche = simulateStrategy(normalized, extra, 'avalanche', options);
    const snowball = simulateStrategy(normalized, extra, 'snowball', options);
    const avalancheZero = simulateStrategy(normalized, 0, 'avalanche', options);
    const snowballZero = simulateStrategy(normalized, 0, 'snowball', options);
    const startingTotalDebt = normalized.reduce((sum, debt) => sum + debt.balance, 0);
    const baseMinimumBudget = normalized.reduce((sum, debt) => sum + debt.minimumPayment, 0);
    return {
      version: 'DEBT1-1.0',
      inputs: { debts: normalized, extraMonthlyPayment: extra },
      startingTotalDebt,
      baseMinimumBudget,
      totalMonthlyBudget: baseMinimumBudget + extra,
      avalanche,
      snowball,
      zeroExtra: { avalanche: avalancheZero, snowball: snowballZero },
      comparison: {
        interestDifference: avalanche.totalInterest - snowball.totalInterest,
        payoffMonthDifference: avalanche.months - snowball.months,
        firstPayoffMonthDifference: (avalanche.firstPayoff?.month ?? null) != null && (snowball.firstPayoff?.month ?? null) != null
          ? avalanche.firstPayoff.month - snowball.firstPayoff.month : null
      },
      warnings: warningsFor(normalized)
    };
  }

  function runFixtures() {
    const close = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;
    const fixtures = [];
    const add = (name, ok) => fixtures.push({ name, ok: Boolean(ok) });

    let r = comparePlans([{ balance: 1200, annualRatePct: 0, minimumPayment: 100 }], 0);
    add('one debt 0% APR', r.avalanche.status === 'paid_off' && r.avalanche.months === 12 && close(r.avalanche.totalInterest, 0));

    r = comparePlans([{ balance: 1000, annualRatePct: 12, minimumPayment: 100 }], 0);
    add('one debt positive APR', r.avalanche.status === 'paid_off' && r.avalanche.totalInterest > 0);

    r = comparePlans([{ id:'a',balance:5000,annualRatePct:20,minimumPayment:25 },{ id:'b',balance:1000,annualRatePct:5,minimumPayment:25 }],500);
    add('divergent first targets', r.avalanche.firstPayoff?.id === 'a' && r.snowball.firstPayoff?.id === 'b');

    r = comparePlans([{ id:'a',balance:1000,annualRatePct:20,minimumPayment:50 },{ id:'b',balance:5000,annualRatePct:5,minimumPayment:150 }],100);
    add('same first target', r.avalanche.firstPayoff?.id === 'a' && r.snowball.firstPayoff?.id === 'a');

    r = comparePlans([{ id:'a',balance:2000,annualRatePct:10,minimumPayment:50 },{ id:'b',balance:1000,annualRatePct:10,minimumPayment:50 }],100);
    add('APR tie lower balance avalanche', r.avalanche.firstPayoff?.id === 'b');

    r = comparePlans([{ id:'a',balance:1000,annualRatePct:10,minimumPayment:50 },{ id:'b',balance:1000,annualRatePct:20,minimumPayment:58.3333333333 }],500);
    add('balance tie higher APR snowball', r.snowball.firstPayoff?.id === 'b');

    r = comparePlans([{ id:'a',balance:1000,annualRatePct:10,minimumPayment:50 },{ id:'b',balance:1000,annualRatePct:10,minimumPayment:50 }],100);
    add('full tie input order', r.avalanche.firstPayoff?.id === 'a' && r.snowball.firstPayoff?.id === 'a');

    r = comparePlans([{ balance:1200,annualRatePct:0,minimumPayment:100 }],0);
    add('extra payment zero', r.totalMonthlyBudget === 100 && r.avalanche.months === 12);

    r = comparePlans([{ id:'a',balance:50,annualRatePct:0,minimumPayment:10 },{ id:'b',balance:50,annualRatePct:0,minimumPayment:10 }],100);
    add('large extra clears multiple debts same month', r.avalanche.months === 1 && r.avalanche.payoffRecords.length === 2);

    r = comparePlans([{ id:'a',balance:1000,annualRatePct:24,minimumPayment:10 },{ id:'b',balance:100,annualRatePct:0,minimumPayment:20 }],0);
    add('minimum below first-month interest warning', r.warnings.some(w => w.id === 'a'));

    r = comparePlans([{ id:'a',balance:500,annualRatePct:0,minimumPayment:50 },{ id:'b',balance:500,annualRatePct:24,minimumPayment:50 }],100);
    add('0% debt with high-rate debt', r.avalanche.status === 'paid_off' && r.snowball.status === 'paid_off');

    r = comparePlans([{ balance:100.01,annualRatePct:0,minimumPayment:33.34 }],0);
    add('final payment capping', close(r.avalanche.totalPaid, 100.01, 0.001));

    r = comparePlans([{ id:'a',balance:100,annualRatePct:0,minimumPayment:100 },{ id:'b',balance:1000,annualRatePct:0,minimumPayment:50 },{ id:'c',balance:1000,annualRatePct:0,minimumPayment:50 }],0);
    add('three-debt freed minimum roll-forward', r.avalanche.months === 11 && close(r.avalanche.totalPaid, 2100, 0.001));

    r = comparePlans([{ balance:1000,annualRatePct:12,minimumPayment:100 }],50);
    add('zero-extra baseline included', r.zeroExtra.avalanche.totalInterest >= r.avalanche.totalInterest && r.zeroExtra.avalanche.months >= r.avalanche.months);

    r = comparePlans([{ balance:100000,annualRatePct:24,minimumPayment:1 }],0);
    add('unresolved at horizon', r.avalanche.status === 'unresolved' && r.avalanche.months === 600);

    const a = comparePlans([{ balance:5000,annualRatePct:8,minimumPayment:100 }],50);
    const b = comparePlans([{ balance:5000,annualRatePct:8,minimumPayment:100 }],50);
    add('currency-independent math', close(a.avalanche.totalInterest,b.avalanche.totalInterest));

    const r1 = comparePlans([{ id:'a',balance:2000,annualRatePct:10,minimumPayment:100 },{ id:'b',balance:1000,annualRatePct:20,minimumPayment:50 }],100);
    const r2 = comparePlans([{ id:'b',balance:1000,annualRatePct:20,minimumPayment:50 },{ id:'a',balance:2000,annualRatePct:10,minimumPayment:100 }],100);
    add('row order stable outside ties', close(r1.avalanche.totalInterest,r2.avalanche.totalInterest,0.001) && close(r1.snowball.totalInterest,r2.snowball.totalInterest,0.001));

    r = comparePlans([{ balance:1000,annualRatePct:10,minimumPayment:100 },{ balance:0,annualRatePct:5,minimumPayment:50 },{ balance:200,annualRatePct:NaN,minimumPayment:20 }],0);
    add('invalid rows excluded', r.inputs.debts.length === 1);

    r = comparePlans([{ balance:2500,annualRatePct:9,minimumPayment:100 }],25);
    add('one debt method parity', close(r.avalanche.totalInterest,r.snowball.totalInterest,0.001) && r.avalanche.months === r.snowball.months);

    return fixtures;
  }

  window.CarrowmontDebtPayoffCore = { MAX_MONTHS, normalizeDebts, simulateStrategy, comparePlans, runFixtures };
})();
