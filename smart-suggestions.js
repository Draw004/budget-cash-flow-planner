(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CarrowmontSmartSuggestions = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null), function () {
  'use strict';

  const VERSION = '2.0.0';
  const SCENARIOS = ['low', 'balanced', 'aggressive'];
  const FREQ = {
    weekly: 52 / 12,
    biweekly: 26 / 12,
    semimonthly: 2,
    fourweekly: 13 / 12,
    monthly: 1,
    quarterly: 1 / 3,
    annual: 1 / 12,
    irregular: 1
  };
  const RESERVE_FREQUENCIES = new Set(['quarterly', 'annual']);

  const PRIORITY_TOOLS = {
    goal: { key: 'goal', href: '/goal-planner/', label: 'Goal Planner' },
    investment: { key: 'investment', href: '/sip-calculator/', label: 'Recurring Investment Calculator' },
    retirement: { key: 'retirement', href: '/retirement-calculator/', label: 'Retirement Planner' },
    fi: { key: 'fi', href: '/financial-independence/', label: 'Financial Independence' }
  };

  function num(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function nonNegative(value) {
    return Math.max(0, num(value));
  }

  function average(values) {
    if (!Array.isArray(values) || !values.length) return null;
    return values.reduce((sum, value) => sum + num(value), 0) / values.length;
  }

  function normalizeName(value) {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function monthlyEquivalent(row) {
    if (!row) return 0;
    return nonNegative(row.amount) * (FREQ[row.frequency] || 1);
  }

  function frequencyClass(row) {
    const frequency = String(row && row.frequency || 'monthly');
    if (RESERVE_FREQUENCIES.has(frequency)) return 'reserve-style';
    if (frequency === 'irregular') return 'irregular';
    return 'recurring';
  }

  function sumRows(rows, excludeExceptional = false) {
    return (Array.isArray(rows) ? rows : []).reduce((sum, row) => {
      if (excludeExceptional && row && row.exceptional) return sum;
      return sum + monthlyEquivalent(row);
    }, 0);
  }

  function normalHistory(history, currentMonth) {
    return (Array.isArray(history) ? history : [])
      .filter(item => item && !item.monthExceptional && item.month !== currentMonth)
      .slice()
      .sort((a, b) => String(a.month || '').localeCompare(String(b.month || '')))
      .slice(-12);
  }

  function matchHistoricRow(month, kind, currentRow) {
    const rows = Array.isArray(month && month[kind]) ? month[kind] : [];
    if (!currentRow) return null;
    const currentId = String(currentRow.id || '');
    if (currentId) {
      const idMatch = rows.find(row => row && String(row.id || '') === currentId);
      if (idMatch) return idMatch.exceptional ? null : idMatch;
    }
    const targetName = normalizeName(currentRow.name);
    if (!targetName) return null;
    return rows.find(row => row && !row.exceptional && normalizeName(row.name) === targetName) || null;
  }

  function categorySeries(history, kind, currentRow) {
    const result = [];
    history.forEach(month => {
      const row = matchHistoricRow(month, kind, currentRow);
      if (!row) return;
      result.push({ month: month.month, value: monthlyEquivalent(row), frequencyClass: frequencyClass(row) });
    });
    return result;
  }

  function historyTotal(month, kind) {
    if (Array.isArray(month && month[kind])) return sumRows(month[kind], true);
    if (kind === 'flexible') return nonNegative(month && month.summary && month.summary.flexible);
    if (kind === 'essential') return nonNegative(month && month.summary && month.summary.essential);
    if (kind === 'savings') return nonNegative(month && month.summary && month.summary.saving);
    return 0;
  }

  function qualityForCount(count) {
    if (count < 3) return 'current-only';
    if (count < 6) return 'emerging';
    return 'established-capable';
  }

  function materiality(delta, percent, income, minimumPercent) {
    if (!(income > 0) || !(delta > 0) || !(Math.abs(percent) >= minimumPercent)) return false;
    return delta >= income * 0.005;
  }

  function materialityAbsolute(delta, percent, income, minimumPercent) {
    const absolute = Math.abs(num(delta));
    if (!(income > 0) || !(absolute > 0) || !(Math.abs(num(percent)) >= minimumPercent)) return false;
    return absolute >= income * 0.005;
  }

  function scenarioAmounts(current, excess) {
    const safeCurrent = nonNegative(current);
    const safeExcess = nonNegative(excess);
    return {
      low: Math.max(0, Math.min(safeExcess * 0.25, safeCurrent * 0.10, safeExcess)),
      balanced: Math.max(0, Math.min(safeExcess * 0.50, safeCurrent * 0.20, safeExcess)),
      aggressive: Math.max(0, Math.min(safeExcess * 0.75, safeCurrent * 0.30, safeExcess))
    };
  }

  function signal(kind, family, data) {
    const seed = data || {};
    return Object.assign({
      id: `${kind}-${String(seed.key || seed.name || family || 'signal').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`,
      kind,
      family,
      severity: 'info',
      confidenceLabel: 'Current',
      comparisonWindow: 'current',
      consistencyCount: 0,
      consistencyRequired: 0,
      historyMonthsUsed: 0,
      eligibleForReduction: false,
      scenarioEligible: false,
      protected: false,
      frequencyClass: 'recurring',
      suppressedBy: null,
      reasonCodes: [],
      score: 0,
      direction: 'neutral',
      evidence: []
    }, seed);
  }

  function financialImpactPoints(delta, income) {
    if (!(income > 0)) return 0;
    const ratio = Math.abs(num(delta)) / income;
    if (ratio >= 0.03) return 35;
    if (ratio >= 0.02) return 30;
    if (ratio >= 0.01) return 20;
    if (ratio >= 0.005) return 10;
    return 0;
  }

  function persistencePoints(months) {
    const count = Math.max(0, Math.floor(num(months)));
    if (count >= 12) return 25;
    if (count >= 6) return 17;
    if (count >= 3) return 8;
    return 0;
  }

  function consistencyPoints(label) {
    if (label === 'Established') return 15;
    if (label === 'Emerging') return 8;
    return 0;
  }

  function severityWeight(severity) {
    return ({ critical: 4, warning: 3, info: 2, positive: 1 })[severity] || 0;
  }

  function actionabilityPoints(item) {
    if (item.scenarioEligible) return 15;
    if (item.kind === 'cashflow_pressure') return 15;
    if (item.family === 'savings' || item.kind === 'free_cashflow' || item.kind === 'emergency_gap') return 10;
    if (item.family === 'essential' || item.family === 'reserve') return 5;
    if (item.severity === 'positive') return 3;
    return 0;
  }

  function priorityRelevancePoints(item, priority) {
    const p = String(priority || 'buffer');
    if (item.family === 'emergency') return p === 'emergency' ? 10 : 0;
    if (item.kind === 'cashflow_pressure') return ['buffer', 'debt'].includes(p) ? 10 : 5;
    if (item.kind === 'free_cashflow') return p === 'buffer' ? 5 : 10;
    if (item.scenarioEligible) return p === 'buffer' ? 5 : 10;
    if (item.family === 'savings') return ['goal', 'investment', 'retirement', 'fi', 'emergency', 'debt'].includes(p) ? 5 : 0;
    return 0;
  }

  function scoreSignal(item, income, priority) {
    let impact = 0;
    if (item.kind === 'cashflow_pressure') impact = 35;
    else if (item.kind === 'free_cashflow') impact = Math.min(10, financialImpactPoints(item.currentValue, income));
    else if (item.kind === 'emergency_gap') impact = 20;
    else if (item.kind === 'emergency_target_covered') impact = 10;
    else if (item.kind === 'irregular_bill_reserve') impact = 5;
    else impact = financialImpactPoints(item.deltaValue, income);
    return Math.min(100,
      impact +
      persistencePoints(item.historyMonthsUsed) +
      consistencyPoints(item.confidenceLabel) +
      actionabilityPoints(item) +
      priorityRelevancePoints(item, priority)
    );
  }

  function persistentComparison(values, income) {
    if (!Array.isArray(values)) return null;
    let previousValues = null;
    let latestValues = null;
    let minimumPercent = 0;
    let consistencyRequired = 0;
    let comparisonWindow = '';
    let historyMonthsUsed = 0;

    if (values.length >= 12) {
      const last12 = values.slice(-12);
      previousValues = last12.slice(0, 6);
      latestValues = last12.slice(6);
      minimumPercent = 8;
      consistencyRequired = 4;
      comparisonWindow = 'latest6-vs-previous6';
      historyMonthsUsed = 12;
    } else if (values.length >= 6) {
      const last6 = values.slice(-6);
      previousValues = last6.slice(0, 3);
      latestValues = last6.slice(3);
      minimumPercent = 10;
      consistencyRequired = 2;
      comparisonWindow = 'latest3-vs-previous3';
      historyMonthsUsed = 6;
    } else {
      return null;
    }

    const baseline = average(previousValues);
    const current = average(latestValues);
    if (!(baseline > 0) || current === null) return null;
    const delta = current - baseline;
    const percent = delta / baseline * 100;
    if (!materialityAbsolute(delta, percent, income, minimumPercent)) return null;
    const direction = delta > 0 ? 'increase' : 'decrease';
    const consistencyCount = latestValues.filter(value => direction === 'increase' ? value >= baseline * 1.05 : value <= baseline * 0.95).length;
    if (consistencyCount < consistencyRequired) return null;
    return {
      baselineValue: baseline,
      currentValue: current,
      deltaValue: delta,
      deltaPercent: percent,
      direction,
      confidenceLabel: 'Established',
      comparisonWindow,
      consistencyCount,
      consistencyRequired,
      historyMonthsUsed,
      period: historyMonthsUsed === 12 ? 'latest 6 months versus previous 6 months' : 'latest 3 months versus previous 3 months'
    };
  }

  function recurringStep(series, current, income) {
    if (!Array.isArray(series) || series.length < 5) return null;
    const last5 = series.slice(-5).map(item => item.value);
    const previous = last5.slice(0, 3);
    const latest = last5.slice(3);
    const baseline = average(previous);
    const stepLevel = average(latest);
    if (!(baseline > 0) || !(stepLevel > baseline)) return null;
    const stableDenominator = Math.max(1, stepLevel);
    const stable = Math.abs(latest[0] - latest[1]) / stableDenominator <= 0.02;
    const historyDelta = stepLevel - baseline;
    const historyPercent = historyDelta / baseline * 100;
    const currentDelta = current - baseline;
    const currentPercent = currentDelta / baseline * 100;
    if (!stable || historyPercent < 8 || !materiality(historyDelta, historyPercent, income, 8)) return null;
    if (!(currentDelta > 0) || !materiality(currentDelta, currentPercent, income, 8)) return null;
    return {
      baselineValue: baseline,
      currentValue: current,
      deltaValue: currentDelta,
      deltaPercent: currentPercent,
      stepLevel,
      historyMonthsUsed: Math.min(12, series.length),
      confidenceLabel: series.length >= 6 ? 'Established' : 'Emerging',
      comparisonWindow: 'latest2-vs-previous3',
      consistencyCount: 2,
      consistencyRequired: 2
    };
  }

  function markSuppressed(loser, winner, reason) {
    if (!loser || !winner || loser === winner || loser.suppressedBy) return;
    loser.suppressedBy = winner.id;
    loser.reasonCodes = [...(loser.reasonCodes || []), reason];
  }

  function applyDeduplication(signals) {
    const active = signals.filter(item => !item.suppressedBy);

    active.filter(item => item.kind === 'recurring_cost_step_up').forEach(recurring => {
      signals.filter(item => item.key === recurring.key && ['flexible_category_change', 'essential_cost_change'].includes(item.kind))
        .forEach(generic => markSuppressed(generic, recurring, 'recurring-step-up-preferred'));
    });

    const persistent = signals.find(item => !item.suppressedBy && ['persistent_flexible_trend', 'persistent_flexible_improvement'].includes(item.kind));
    if (persistent) {
      signals.filter(item => !item.suppressedBy && ['flexible_total_change', 'flexible_total_improvement'].includes(item.kind) && item.direction === persistent.direction)
        .forEach(item => markSuppressed(item, persistent, 'established-total-trend-preferred'));
    }

    signals.filter(item => !item.suppressedBy && ['flexible_total_change', 'persistent_flexible_trend'].includes(item.kind) && item.deltaValue > 0).forEach(total => {
      const dominant = signals
        .filter(item => !item.suppressedBy && item.scenarioEligible && item.deltaValue > 0 && item.deltaValue >= total.deltaValue * 0.60)
        .sort((a, b) => b.deltaValue - a.deltaValue || a.id.localeCompare(b.id))[0];
      if (dominant) markSuppressed(total, dominant, 'category-explains-total-change');
    });
  }

  function primarySignals(signals) {
    const candidates = signals.filter(item => !item.suppressedBy);
    const pressure = candidates.find(item => item.kind === 'cashflow_pressure');
    const sorted = candidates
      .filter(item => item.kind !== 'cashflow_pressure' && item.score >= 35)
      .sort((a, b) => b.score - a.score || severityWeight(b.severity) - severityWeight(a.severity) || Math.abs(num(b.deltaValue)) - Math.abs(num(a.deltaValue)) || a.id.localeCompare(b.id));

    const selected = pressure ? [pressure] : [];
    let categoryCount = 0;
    for (const item of sorted) {
      const categoryLevel = ['category', 'essential', 'recurring'].includes(item.family);
      if (categoryLevel && categoryCount >= 2) continue;
      selected.push(item);
      if (categoryLevel) categoryCount += 1;
      if (selected.length === 3) break;
    }
    return selected;
  }

  function buildReductionCandidates(signals) {
    const byKey = new Map();
    signals.filter(item => !item.suppressedBy && item.scenarioEligible && item.score >= 35 && item.deltaValue > 0).forEach(item => {
      const key = String(item.key || item.id);
      const existing = byKey.get(key);
      if (!existing || item.score > existing.score || (item.score === existing.score && item.id.localeCompare(existing.id) < 0)) byKey.set(key, item);
    });
    return [...byKey.values()].map(item => {
      const excess = nonNegative(item.deltaValue);
      const amounts = scenarioAmounts(item.currentValue, excess);
      return {
        key: String(item.key || item.id),
        sourceSignalId: item.id,
        name: String(item.name || 'Flexible category'),
        currentValue: nonNegative(item.currentValue),
        baselineValue: nonNegative(item.baselineValue),
        excess,
        deltaPercent: num(item.deltaPercent),
        historyMonthsUsed: item.historyMonthsUsed || 0,
        confidenceLabel: item.confidenceLabel || 'Current',
        score: item.score,
        scenarioAmounts: amounts,
        frequencyClass: item.frequencyClass || 'recurring'
      };
    }).sort((a, b) => b.score - a.score || b.excess - a.excess || a.key.localeCompare(b.key));
  }

  function buildScenarios(candidates, selected) {
    const totals = { low: 0, balanced: 0, aggressive: 0 };
    const breakdown = { low: [], balanced: [], aggressive: [] };
    candidates.forEach(candidate => {
      SCENARIOS.forEach(key => {
        const adjustmentValue = nonNegative(candidate.scenarioAmounts[key]);
        totals[key] += adjustmentValue;
        breakdown[key].push({
          candidateId: candidate.key,
          sourceSignalId: candidate.sourceSignalId,
          name: candidate.name,
          baselineValue: candidate.baselineValue,
          currentValue: candidate.currentValue,
          excessValue: candidate.excess,
          adjustmentValue,
          scenarioKey: key,
          historyMonthsUsed: candidate.historyMonthsUsed,
          confidenceLabel: candidate.confidenceLabel
        });
      });
    });
    return {
      available: candidates.length > 0 && totals.balanced > 0,
      selected: SCENARIOS.includes(selected) ? selected : 'balanced',
      totals,
      breakdown,
      candidateCount: candidates.length
    };
  }

  function analyze(input) {
    input = input || {};
    const state = input.state || {};
    const summary = input.summary || {};
    const history = Array.isArray(input.history) ? input.history : [];
    const normal = normalHistory(history, state.month);
    const income = nonNegative(summary.income);
    const remaining = num(summary.remaining);
    const currentFlexible = sumRows(state.flexible, true);
    const currentEssential = sumRows(state.essential, true);
    const selectedScenario = SCENARIOS.includes(state.smartScenario) ? state.smartScenario : 'balanced';
    const priority = String(state.priority || 'buffer');
    const signals = [];

    if (remaining < 0) {
      signals.push(signal('cashflow_pressure', 'cashflow', {
        severity: 'critical', shortfall: Math.abs(remaining), currentValue: remaining, direction: 'decrease',
        reasonCodes: ['negative-monthly-cashflow'], evidence: [{ key: 'monthlyShortfall', value: Math.abs(remaining) }]
      }));
    } else {
      signals.push(signal('free_cashflow', 'cashflow', {
        severity: 'positive', currentValue: remaining, direction: 'increase',
        reasonCodes: ['positive-monthly-cashflow'], evidence: [{ key: 'moneyRemaining', value: remaining }]
      }));
    }

    const essentialTotal = nonNegative(summary.essential);
    const targetMonths = nonNegative(state.emergencyTargetMonths);
    const coverage = nonNegative(summary.coverage);
    const emergencyGap = nonNegative(summary.emergencyGap);
    if (essentialTotal > 0 && targetMonths > 0) {
      if (emergencyGap > 0) {
        signals.push(signal('emergency_gap', 'emergency', {
          severity: 'info', currentValue: coverage, targetValue: targetMonths, deltaValue: emergencyGap,
          reasonCodes: ['selected-emergency-target-not-covered'],
          evidence: [{ key: 'coverageMonths', value: coverage }, { key: 'targetMonths', value: targetMonths }, { key: 'gapAmount', value: emergencyGap }]
        }));
      } else {
        signals.push(signal('emergency_target_covered', 'emergency', {
          severity: 'positive', currentValue: coverage, targetValue: targetMonths,
          reasonCodes: ['selected-emergency-target-covered'],
          evidence: [{ key: 'coverageMonths', value: coverage }, { key: 'targetMonths', value: targetMonths }]
        }));
      }
    }

    const flexibleTotals = normal.map(month => ({ month: month.month, value: historyTotal(month, 'flexible') }));
    const persistent = persistentComparison(flexibleTotals.map(item => item.value), income);
    if (persistent) {
      const increase = persistent.direction === 'increase';
      signals.push(signal(increase ? 'persistent_flexible_trend' : 'persistent_flexible_improvement', 'trend', Object.assign({}, persistent, {
        severity: increase ? 'warning' : 'positive',
        reasonCodes: [increase ? 'persistent-flexible-increase' : 'persistent-flexible-decrease', 'materiality-and-consistency-passed'],
        evidence: [{ key: 'baselineAverage', value: persistent.baselineValue }, { key: 'latestAverage', value: persistent.currentValue }]
      })));
    }

    if (flexibleTotals.length >= 3 && income > 0) {
      const baseline = average(flexibleTotals.slice(-3).map(item => item.value));
      if (baseline !== null && baseline > 0 && currentFlexible !== baseline) {
        const delta = currentFlexible - baseline;
        const percent = delta / baseline * 100;
        if (materialityAbsolute(delta, percent, income, 12)) {
          const increase = delta > 0;
          signals.push(signal(increase ? 'flexible_total_change' : 'flexible_total_improvement', 'trend', {
            severity: increase ? 'warning' : 'positive', confidenceLabel: 'Emerging', comparisonWindow: 'current-vs-3',
            historyMonthsUsed: 3, currentValue: currentFlexible, baselineValue: baseline, deltaValue: delta, deltaPercent: percent,
            direction: increase ? 'increase' : 'decrease', consistencyCount: 0, consistencyRequired: 0,
            reasonCodes: [increase ? 'current-flexible-above-recent3' : 'current-flexible-below-recent3'],
            evidence: [{ key: 'currentFlexible', value: currentFlexible }, { key: 'recent3Average', value: baseline }]
          }));
        }
      }
    }

    const flexRows = Array.isArray(state.flexible) ? state.flexible : [];
    const essentialRows = Array.isArray(state.essential) ? state.essential : [];

    function categoryCurrentSignal(kind, row, rowType) {
      if (!row || row.exceptional || !(income > 0)) return;
      const series = categorySeries(normal, kind, row);
      if (series.length < 3) return;
      const baseline = average(series.slice(-3).map(item => item.value));
      const current = monthlyEquivalent(row);
      if (!(baseline > 0) || current === baseline) return;
      const delta = current - baseline;
      const percent = delta / baseline * 100;
      if (!materialityAbsolute(delta, percent, income, 12)) return;
      const fClass = frequencyClass(row);
      const increase = delta > 0;
      let signalKind;
      let family = rowType === 'essential' ? 'essential' : 'category';
      let severity = increase ? 'warning' : 'positive';
      let scenarioEligible = false;
      let eligibleForReduction = false;

      if (fClass === 'reserve-style') {
        signalKind = 'reserve_style_change';
        family = 'reserve';
        severity = 'info';
      } else if (fClass === 'irregular') {
        signalKind = 'irregular_average_change';
        family = 'reserve';
        severity = 'info';
      } else if (rowType === 'essential') {
        signalKind = increase ? 'essential_cost_change' : 'essential_cost_improvement';
        severity = increase ? 'info' : 'positive';
      } else {
        signalKind = increase ? 'flexible_category_change' : 'flexible_category_improvement';
        scenarioEligible = increase && !row.protected;
        eligibleForReduction = scenarioEligible;
      }

      const amounts = scenarioEligible ? scenarioAmounts(current, delta) : null;
      signals.push(signal(signalKind, family, {
        key: String(row.id || normalizeName(row.name)), name: String(row.name || (rowType === 'essential' ? 'Essential category' : 'Flexible category')),
        severity, confidenceLabel: 'Emerging', comparisonWindow: 'current-vs-3', historyMonthsUsed: 3,
        currentValue: current, baselineValue: baseline, deltaValue: delta, deltaPercent: percent,
        direction: increase ? 'increase' : 'decrease', eligibleForReduction, scenarioEligible,
        protected: !!row.protected, frequencyClass: fClass, scenarioAmounts: amounts,
        reasonCodes: [fClass === 'reserve-style' ? 'reserve-style-monthly-equivalent-change' : fClass === 'irregular' ? 'irregular-monthly-average-change' : increase ? 'current-category-above-recent3' : 'current-category-below-recent3'],
        evidence: [{ key: 'currentCategory', value: current }, { key: 'recent3Average', value: baseline }]
      }));
    }

    flexRows.forEach(row => categoryCurrentSignal('flexible', row, 'flexible'));
    essentialRows.forEach(row => categoryCurrentSignal('essential', row, 'essential'));

    function recurringSignal(kind, row, rowType) {
      if (!row || row.exceptional || frequencyClass(row) !== 'recurring' || !(income > 0)) return;
      const series = categorySeries(normal, kind, row);
      const current = monthlyEquivalent(row);
      const step = recurringStep(series, current, income);
      if (!step) return;
      const scenarioEligible = rowType === 'flexible' && !row.protected;
      signals.push(signal('recurring_cost_step_up', 'recurring', Object.assign({}, step, {
        key: String(row.id || normalizeName(row.name)), name: String(row.name || 'Recurring cost'), rowType,
        severity: scenarioEligible ? 'warning' : 'info', direction: 'increase',
        eligibleForReduction: scenarioEligible, scenarioEligible, protected: !!row.protected, frequencyClass: 'recurring',
        scenarioAmounts: scenarioEligible ? scenarioAmounts(current, step.deltaValue) : null,
        reasonCodes: ['stable-latest2-step-up', rowType === 'essential' ? 'essential-informational-only' : scenarioEligible ? 'flexible-unprotected-actionable' : 'protected-not-actionable'],
        evidence: [{ key: 'previous3Average', value: step.baselineValue }, { key: 'latest2Average', value: step.stepLevel }, { key: 'currentCategory', value: current }]
      })));
    }

    flexRows.forEach(row => recurringSignal('flexible', row, 'flexible'));
    essentialRows.forEach(row => recurringSignal('essential', row, 'essential'));

    const savingHistory = normal.map(month => historyTotal(month, 'savings'));
    if (savingHistory.length >= 3 && income > 0) {
      const baseline = average(savingHistory.slice(-3));
      const current = nonNegative(summary.saving);
      if (baseline !== null && current !== baseline) {
        const delta = current - baseline;
        const percent = baseline > 0 ? delta / baseline * 100 : (current > 0 ? 100 : 0);
        if (materialityAbsolute(delta, percent, income, 8)) {
          const increase = delta > 0;
          signals.push(signal(increase ? 'savings_progress' : 'savings_decline', 'savings', {
            severity: increase ? 'positive' : 'warning', confidenceLabel: 'Emerging', comparisonWindow: 'current-vs-3', historyMonthsUsed: 3,
            currentValue: current, baselineValue: baseline, deltaValue: delta, deltaPercent: percent, direction: increase ? 'increase' : 'decrease',
            reasonCodes: [increase ? 'current-saving-above-recent3' : 'current-saving-below-recent3'],
            evidence: [{ key: 'currentSaving', value: current }, { key: 'recent3Average', value: baseline }]
          }));
        }
      }
    }

    const reserves = nonNegative(summary.reserves);
    if (reserves > 0) {
      signals.push(signal('irregular_bill_reserve', 'reserve', {
        severity: 'info', currentValue: reserves, frequencyClass: 'reserve-style',
        reasonCodes: ['reserve-already-included-in-expenses'], evidence: [{ key: 'monthlyReserve', value: reserves }]
      }));
    }

    signals.forEach(item => { item.score = scoreSignal(item, income, priority); });
    applyDeduplication(signals);
    const primary = primarySignals(signals);
    const reductionCandidates = buildReductionCandidates(signals);
    const scenarios = buildScenarios(reductionCandidates, selectedScenario);
    const excludedExceptionalMonths = history.filter(item => item && item.monthExceptional && item.month !== state.month).length;

    let noAction = null;
    if (!primary.length) {
      noAction = normal.length < 3
        ? { reason: 'insufficient-history', title: 'No strong adjustable trend stands out yet.', body: 'There is not enough normal saved history to support a stronger trend suggestion. Keep saving normal months for a clearer comparison.' }
        : { reason: 'stable', title: 'No strong adjustable trend stands out right now.', body: 'Your recent entries are relatively stable, or the changes do not meet Carrowmont\'s materiality and consistency rules. Keep saving normal months for a clearer comparison.' };
    }

    return {
      version: VERSION,
      generatedFrom: 'deterministic-local-engine',
      context: {
        normalHistoryMonths: normal.length,
        quality: qualityForCount(normal.length),
        months: normal.map(item => item.month),
        excludedExceptionalMonths
      },
      summaryFacts: {
        income, remaining, emergencyGap, coverage, targetMonths, reserves, currentFlexible, currentEssential
      },
      signals,
      primary,
      noAction,
      reductionCandidates,
      scenarios,
      priority: { key: priority, relatedTool: PRIORITY_TOOLS[priority] || null }
    };
  }

  function historyMeta(item) {
    const count = item && item.historyMonthsUsed || 0;
    const matchingCategory = item && ['category', 'essential', 'recurring', 'reserve'].includes(item.family);
    if (!count) return 'Current-month calculation.';
    const base = matchingCategory
      ? `Based on ${count} matching non-exceptional saved month${count === 1 ? '' : 's'}.`
      : `Based on ${count} non-exceptional saved month${count === 1 ? '' : 's'}.`;
    return `${item.confidenceLabel || 'Current'} evidence · ${base}`;
  }

  function comparisonDescription(item, money) {
    const amount = money || (value => String(Math.round(num(value))));
    if (item.comparisonWindow === 'current-vs-3') return `Current ${amount(item.currentValue)} compared with a recent 3-month baseline of ${amount(item.baselineValue)}.`;
    if (item.comparisonWindow === 'latest3-vs-previous3') return `Latest 3-month average ${amount(item.currentValue)} compared with the previous 3-month average of ${amount(item.baselineValue)}.`;
    if (item.comparisonWindow === 'latest6-vs-previous6') return `Latest 6-month average ${amount(item.currentValue)} compared with the previous 6-month average of ${amount(item.baselineValue)}.`;
    if (item.comparisonWindow === 'latest2-vs-previous3') return `A stable two-month step-up is being compared with the previous 3-month average of ${amount(item.baselineValue)}.`;
    return 'This is a current-plan fact and does not rely on a history-based trend claim.';
  }

  function whyDescription(item) {
    if (item.kind === 'recurring_cost_step_up') return `The latest two matching monthly-equivalent values stayed within 2% of each other and were materially above the previous three-month average.${item.protected || item.rowType === 'essential' ? ' This entry remains informational and is not used as a reduction source.' : ''}`;
    if (item.confidenceLabel === 'Established') return `This pattern passed both the materiality rule and the consistency test: ${item.consistencyCount} of the recent values met the directional threshold, with ${item.consistencyRequired} required.`;
    if (item.confidenceLabel === 'Emerging') return 'This is an emerging comparison supported by at least three normal saved months. It is not labelled Established until a 6- or 12-month consistency test is passed.';
    if (item.frequencyClass === 'reserve-style') return 'Quarterly and annual entries are compared as monthly-equivalent reserves and are not used as spending-reduction sources.';
    if (item.frequencyClass === 'irregular') return 'Irregular entries are treated as the monthly average you supplied and remain informational in Smart Suggestions.';
    if (item.kind === 'cashflow_pressure') return 'The current plan has negative monthly money remaining, so cash-flow pressure is shown first regardless of other signal scores.';
    return 'This is a deterministic observation from the current entries and selected planning settings.';
  }

  function presentSignal(item, money, scenarioKey) {
    const amount = money || (value => String(Math.round(num(value))));
    const pct = value => `${Math.abs(num(value)).toFixed(0)}%`;
    const key = SCENARIOS.includes(scenarioKey) ? scenarioKey : 'balanced';
    const labels = { low: 'Low-disruption', balanced: 'Balanced', aggressive: 'Aggressive' };
    const base = {
      id: item.id,
      kind: item.kind,
      type: item.severity === 'critical' ? 'critical' : item.severity === 'warning' ? 'warning' : item.severity === 'positive' ? 'positive' : '',
      historyMonthsUsed: item.historyMonthsUsed || 0,
      eligibleForReduction: !!item.eligibleForReduction,
      confidenceLabel: item.confidenceLabel || 'Current',
      comparisonWindow: item.comparisonWindow || 'current',
      title: '', body: '', kicker: 'SMART SUGGESTION',
      meta: historyMeta(item),
      evidenceText: comparisonDescription(item, amount),
      whyText: whyDescription(item),
      actionText: ''
    };

    if (item.scenarioEligible && item.scenarioAmounts && nonNegative(item.scenarioAmounts[key]) > 0) {
      const action = nonNegative(item.scenarioAmounts[key]);
      base.actionText = `${labels[key]} scenario: about ${amount(action)} per month (${amount(action * 12)} over 12 months) from this category.`;
    }

    switch (item.kind) {
      case 'cashflow_pressure':
        base.kicker = 'CASH-FLOW PRESSURE';
        base.title = `Planned outflows exceed income by ${amount(item.shortfall)}.`;
        base.body = 'Review timing, one-time entries and unprotected flexible spending to see whether the gap is temporary or recurring.';
        break;
      case 'free_cashflow':
        base.kicker = 'FREE CASH FLOW';
        base.title = `${amount(item.currentValue)} remains unassigned this month.`;
        base.body = 'This amount can remain as a buffer or support the planning priority you selected.';
        break;
      case 'emergency_gap':
        base.kicker = 'EMERGENCY RESERVE';
        base.title = `Your reserve covers about ${num(item.currentValue).toFixed(1)} months of essentials.`;
        base.body = `Against your selected ${num(item.targetValue).toFixed(0)}-month target, the current modelled gap is ${amount(item.deltaValue)}.`;
        break;
      case 'emergency_target_covered':
        base.kicker = 'EMERGENCY RESERVE';
        base.title = `Your selected ${num(item.targetValue).toFixed(0)}-month reserve target is covered.`;
        base.body = `The entered reserve currently represents about ${num(item.currentValue).toFixed(1)} months of essential expenses.`;
        break;
      case 'persistent_flexible_trend':
        base.kicker = 'ESTABLISHED SPENDING TREND';
        base.title = `Flexible spending is ${pct(item.deltaPercent)} higher across the ${item.period}.`;
        base.body = `The newer period averages ${amount(item.currentValue)} per month versus about ${amount(item.baselineValue)} in the earlier period.`;
        break;
      case 'persistent_flexible_improvement':
        base.kicker = 'ESTABLISHED IMPROVEMENT';
        base.title = `Flexible spending is ${pct(item.deltaPercent)} lower across the ${item.period}.`;
        base.body = `The newer period averages ${amount(item.currentValue)} per month versus about ${amount(item.baselineValue)} in the earlier period.`;
        break;
      case 'flexible_total_change':
        base.kicker = 'EMERGING FLEXIBLE-SPENDING CHANGE';
        base.title = `Flexible spending is ${pct(item.deltaPercent)} above its recent baseline.`;
        base.body = `Current non-exceptional flexible spending is ${amount(item.currentValue)} versus a recent average near ${amount(item.baselineValue)}.`;
        break;
      case 'flexible_total_improvement':
        base.kicker = 'EMERGING IMPROVEMENT';
        base.title = `Flexible spending is ${pct(item.deltaPercent)} below its recent baseline.`;
        base.body = `Current non-exceptional flexible spending is ${amount(item.currentValue)} versus a recent average near ${amount(item.baselineValue)}.`;
        break;
      case 'flexible_category_change':
        base.kicker = item.protected ? 'PROTECTED CATEGORY CHANGE' : 'FLEXIBLE CATEGORY';
        base.title = `${item.name} is about ${amount(item.deltaValue)} above its recent baseline.`;
        base.body = item.protected
          ? 'The change is visible for context, but this category is protected and is not used in adjustment scenarios.'
          : `The current monthly equivalent is ${amount(item.currentValue)} versus about ${amount(item.baselineValue)}. This unprotected category can be used in scenario modelling.`;
        break;
      case 'flexible_category_improvement':
        base.kicker = 'FLEXIBLE CATEGORY IMPROVEMENT';
        base.title = `${item.name} is about ${amount(Math.abs(item.deltaValue))} below its recent baseline.`;
        base.body = `The current monthly equivalent is ${amount(item.currentValue)} versus about ${amount(item.baselineValue)} recently.`;
        break;
      case 'recurring_cost_step_up':
        base.kicker = 'RECURRING COST STEP-UP';
        base.title = `${item.name} appears to have moved to a higher recurring level.`;
        base.body = `${item.name} is currently ${amount(item.currentValue)} per month versus a previous baseline near ${amount(item.baselineValue)}.${item.scenarioEligible ? ' The entry is flexible and unprotected, so the evidenced excess can be modelled.' : ' This entry remains informational only.'}`;
        break;
      case 'essential_cost_change':
        base.kicker = 'ESSENTIAL COST CHANGE';
        base.title = `${item.name} is about ${amount(item.deltaValue)} above its recent baseline.`;
        base.body = 'This is informational only. Smart Suggestions does not propose reducing essential categories.';
        break;
      case 'essential_cost_improvement':
        base.kicker = 'ESSENTIAL COST CHANGE';
        base.title = `${item.name} is about ${amount(Math.abs(item.deltaValue))} below its recent baseline.`;
        base.body = 'This improvement is informational. Essential categories are never used as spending-reduction sources.';
        break;
      case 'reserve_style_change':
        base.kicker = 'PLANNED RESERVE CHANGE';
        base.title = `${item.name} monthly reserve is ${item.deltaValue >= 0 ? 'higher' : 'lower'} by about ${amount(Math.abs(item.deltaValue))}.`;
        base.body = 'Quarterly and annual entries are compared as monthly-equivalent reserves, not ordinary monthly overspending.';
        break;
      case 'irregular_average_change':
        base.kicker = 'IRREGULAR AVERAGE CHANGE';
        base.title = `${item.name} monthly average is ${item.deltaValue >= 0 ? 'higher' : 'lower'} by about ${amount(Math.abs(item.deltaValue))}.`;
        base.body = 'The irregular amount is treated as the monthly average you supplied and is not included in reduction scenarios.';
        break;
      case 'savings_progress':
        base.kicker = 'SAVINGS PROGRESS';
        base.title = `Planned saving is up ${amount(Math.abs(item.deltaValue))} versus the recent baseline.`;
        base.body = `Current planned savings and investments are ${amount(item.currentValue)} per month versus about ${amount(item.baselineValue)} recently.`;
        break;
      case 'savings_decline':
        base.kicker = 'SAVINGS CHANGE';
        base.title = `Planned saving is down ${amount(Math.abs(item.deltaValue))} versus the recent baseline.`;
        base.body = `Current planned savings and investments are ${amount(item.currentValue)} per month versus about ${amount(item.baselineValue)} recently.`;
        break;
      case 'irregular_bill_reserve':
        base.kicker = 'IRREGULAR BILLS';
        base.title = `${amount(item.currentValue)} per month is reserved for quarterly or annual bills.`;
        base.body = 'That reserve is already included in the expense totals, helping future bills stay visible in the monthly plan.';
        break;
      default:
        base.title = 'Your budget has an additional planning observation.';
        base.body = 'Review the entered amounts and saved history for context.';
    }
    return base;
  }

  function contextText(analysis) {
    const count = analysis && analysis.context ? analysis.context.normalHistoryMonths : 0;
    const excluded = analysis && analysis.context ? analysis.context.excludedExceptionalMonths : 0;
    if (count === 0) return 'Based on the current month only. Save at least 3 normal months to unlock history-based Emerging suggestions.';
    if (count < 3) return `Based on the current month + ${count} normal saved month${count === 1 ? '' : 's'}. Trend claims wait until at least 3 normal months are available.`;
    const established = count >= 6 ? ' Established patterns require both materiality and a 6- or 12-month consistency test.' : ' Emerging evidence compares the current month with the latest 3 normal months.';
    return `Based on the current month + ${count} normal saved months.${established}${excluded ? ` ${excluded} exceptional month${excluded === 1 ? '' : 's'} excluded from the normal baseline.` : ' Exceptional months and entries are excluded from normal baselines.'}`;
  }

  function priorityPresentation(analysis, scenarioAmount, money, investmentLabel) {
    const priority = analysis.priority && analysis.priority.key || 'buffer';
    const facts = analysis.summaryFacts || {};
    const amount = nonNegative(scenarioAmount);
    const annual = amount * 12;
    const result = { text: '', relatedTool: null };

    if (facts.remaining < 0) {
      const shortfall = Math.abs(facts.remaining);
      if (amount >= shortfall) {
        const remainder = amount - shortfall;
        result.text = remainder > 0
          ? `Applied to the current plan, this could cover the ${money(shortfall)} monthly shortfall and leave about ${money(remainder)} before other changes.`
          : `Applied to the current plan, this could cover the ${money(shortfall)} monthly shortfall.`;
      } else {
        result.text = `Applied to the current plan, this could reduce the ${money(shortfall)} monthly shortfall by about ${money(amount)}.`;
      }
      return result;
    }

    if (priority === 'emergency') {
      if (facts.emergencyGap > 0 && amount > 0) {
        const months = Math.max(1, Math.ceil(facts.emergencyGap / amount));
        result.text = `${money(amount)} per month (${money(annual)} over 12 months) could be directed toward your selected emergency-reserve target. The current modelled gap of ${money(facts.emergencyGap)} is about ${months} month${months === 1 ? '' : 's'} at that monthly amount, assuming inputs stay unchanged.`;
      } else {
        result.text = `Your selected emergency-reserve target is already covered under the current entries. ${money(amount)} per month (${money(annual)} over 12 months) could remain as extra buffer or support another goal.`;
      }
      return result;
    }
    if (priority === 'debt') {
      result.text = `${money(amount)} per month (${money(annual)} over 12 months) could become additional debt-payment capacity. Carrowmont does not estimate interest saved or a payoff date without debt-specific inputs.`;
      return result;
    }
    if (priority === 'goal') {
      result.text = `${money(amount)} per month (${money(annual)} over 12 months) could be used as a contribution input in Goal Planner.`;
      result.relatedTool = PRIORITY_TOOLS.goal;
      return result;
    }
    if (priority === 'investment') {
      result.text = `${money(amount)} per month (${money(annual)} over 12 months) could be used as a contribution input in ${investmentLabel || 'Recurring Investment Calculator'}.`;
      result.relatedTool = Object.assign({}, PRIORITY_TOOLS.investment, { label: investmentLabel || PRIORITY_TOOLS.investment.label });
      return result;
    }
    if (priority === 'retirement') {
      result.text = `${money(amount)} per month (${money(annual)} over 12 months) could be used as a contribution input in Retirement Planner.`;
      result.relatedTool = PRIORITY_TOOLS.retirement;
      return result;
    }
    if (priority === 'fi') {
      result.text = `${money(amount)} per month (${money(annual)} over 12 months) could be used as a monthly investment input in Financial Independence.`;
      result.relatedTool = PRIORITY_TOOLS.fi;
      return result;
    }
    result.text = `${money(amount)} per month (${money(annual)} over 12 months) could remain as additional cash buffer.`;
    return result;
  }

  function presentScenario(analysis, options) {
    options = options || {};
    const money = typeof options.money === 'function' ? options.money : (value => String(Math.round(num(value))));
    const key = SCENARIOS.includes(options.scenario) ? options.scenario : (analysis.scenarios && analysis.scenarios.selected || 'balanced');
    const labels = { low: 'Low-disruption', balanced: 'Balanced', aggressive: 'Aggressive' };
    const amount = nonNegative(analysis.scenarios && analysis.scenarios.totals && analysis.scenarios.totals[key]);
    if (!(analysis.scenarios && analysis.scenarios.available) || amount <= 0) return null;
    const priority = priorityPresentation(analysis, amount, money, options.investmentLabel);
    const breakdown = ((analysis.scenarios && analysis.scenarios.breakdown && analysis.scenarios.breakdown[key]) || []).filter(item => item.adjustmentValue > 0);
    return {
      key,
      label: labels[key],
      amount,
      annualAmount: amount * 12,
      candidateCount: breakdown.length,
      breakdown,
      text: `This scenario adjusts only evidenced excess in eligible unprotected flexible categories. Essential, protected, exceptional, quarterly, annual and irregular reserve-style entries are unchanged.`,
      priorityText: priority.text,
      relatedTool: priority.relatedTool
    };
  }

  function present(analysis, options) {
    options = options || {};
    const money = typeof options.money === 'function' ? options.money : (value => String(Math.round(num(value))));
    const scenarioKey = SCENARIOS.includes(options.scenario) ? options.scenario : (analysis.scenarios && analysis.scenarios.selected || 'balanced');
    const scenario = presentScenario(analysis, options);
    let allocation = null;
    const remaining = nonNegative(analysis && analysis.summaryFacts && analysis.summaryFacts.remaining);
    if (!scenario && remaining > 0) {
      const priority = priorityPresentation(analysis, remaining, money, options.investmentLabel);
      allocation = {
        amount: remaining,
        annualAmount: remaining * 12,
        text: priority.text,
        relatedTool: priority.relatedTool,
        source: 'existing-surplus'
      };
    }
    return {
      contextText: contextText(analysis),
      primary: (analysis.primary || []).map(item => presentSignal(item, money, scenarioKey)),
      emptyState: analysis.noAction || null,
      scenario,
      allocation,
      protectedText: 'Protected categories are never used as spending-reduction sources. Essential categories and quarterly, annual or irregular reserve-style entries may be highlighted for context, but Smart Suggestions does not propose cutting them.'
    };
  }

  return {
    VERSION,
    analyze,
    present,
    presentScenario,
    monthlyEquivalent,
    _test: {
      average, normalizeName, scenarioAmounts, materiality, materialityAbsolute, normalHistory, categorySeries,
      frequencyClass, persistentComparison, recurringStep, financialImpactPoints, scoreSignal
    }
  };
});
