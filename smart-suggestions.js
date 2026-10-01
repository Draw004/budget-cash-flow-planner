(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CarrowmontSmartSuggestions = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null), function () {
  'use strict';

  const VERSION = '1.0.0';
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
    if (!values.length) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  function normalizeName(value) {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function monthlyEquivalent(row) {
    if (!row) return 0;
    return nonNegative(row.amount) * (FREQ[row.frequency] || 1);
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
      result.push({ month: month.month, value: monthlyEquivalent(row) });
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
    if (count < 6) return 'short-term';
    if (count < 12) return 'medium-term';
    return 'long-term';
  }

  function materiality(delta, percent, income, minimumPercent) {
    if (!(income > 0) || !(delta > 0) || !(percent >= minimumPercent)) return false;
    return delta >= income * 0.005;
  }

  function scenarioAmounts(current, excess) {
    return {
      low: Math.max(0, Math.min(excess * 0.25, current * 0.10)),
      balanced: Math.max(0, Math.min(excess * 0.50, current * 0.20)),
      aggressive: Math.max(0, Math.min(excess * 0.75, current * 0.30))
    };
  }

  function signal(kind, rank, family, data) {
    return Object.assign({
      id: `${kind}-${String(data && data.key || data && data.name || rank).replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`,
      kind,
      rank,
      family,
      severity: 'info',
      confidence: 'current',
      historyMonthsUsed: 0,
      eligibleForReduction: false,
      protected: false,
      evidence: []
    }, data || {});
  }

  function selectPrimary(signals) {
    const sorted = signals.slice().sort((a, b) => {
      if (b.rank !== a.rank) return b.rank - a.rank;
      return nonNegative(b.deltaValue) - nonNegative(a.deltaValue);
    });
    const selected = [];
    const families = new Set();
    for (const item of sorted) {
      if (families.has(item.family)) continue;
      selected.push(item);
      families.add(item.family);
      if (selected.length === 3) break;
    }
    return selected;
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
    const signals = [];

    if (remaining < 0) {
      signals.push(signal('cashflow_pressure', 1000, 'cashflow', {
        severity: 'critical',
        shortfall: Math.abs(remaining),
        currentValue: remaining,
        evidence: [{ key: 'monthlyShortfall', value: Math.abs(remaining) }]
      }));
    } else {
      signals.push(signal('free_cashflow', 500, 'cashflow', {
        severity: 'positive',
        currentValue: remaining,
        evidence: [{ key: 'moneyRemaining', value: remaining }]
      }));
    }

    const essentialTotal = nonNegative(summary.essential);
    const targetMonths = nonNegative(state.emergencyTargetMonths);
    const coverage = nonNegative(summary.coverage);
    const emergencyGap = nonNegative(summary.emergencyGap);
    if (essentialTotal > 0 && targetMonths > 0) {
      if (emergencyGap > 0) {
        signals.push(signal('emergency_gap', 700, 'emergency', {
          severity: 'info',
          currentValue: coverage,
          targetValue: targetMonths,
          deltaValue: emergencyGap,
          evidence: [
            { key: 'coverageMonths', value: coverage },
            { key: 'targetMonths', value: targetMonths },
            { key: 'gapAmount', value: emergencyGap }
          ]
        }));
      } else {
        signals.push(signal('emergency_target_covered', 450, 'emergency', {
          severity: 'positive',
          currentValue: coverage,
          targetValue: targetMonths,
          evidence: [
            { key: 'coverageMonths', value: coverage },
            { key: 'targetMonths', value: targetMonths }
          ]
        }));
      }
    }

    const flexibleTotals = normal.map(month => ({ month: month.month, value: historyTotal(month, 'flexible') }));
    if (income > 0 && flexibleTotals.length >= 6) {
      let persistent = null;
      if (flexibleTotals.length >= 12) {
        const last12 = flexibleTotals.slice(-12);
        const previous = average(last12.slice(0, 6).map(item => item.value));
        const latest = average(last12.slice(6).map(item => item.value));
        if (previous !== null && latest !== null && previous > 0) {
          const delta = latest - previous;
          const percent = delta / previous * 100;
          if (materiality(delta, percent, income, 8)) {
            persistent = signal('persistent_flexible_trend', 860, 'trend', {
              severity: 'warning', confidence: 'high', historyMonthsUsed: 12,
              baselineValue: previous, currentValue: latest, deltaValue: delta, deltaPercent: percent,
              period: 'latest 6 months versus previous 6 months',
              evidence: [{ key: 'previous6Average', value: previous }, { key: 'latest6Average', value: latest }]
            });
          }
        }
      }
      if (!persistent) {
        const last6 = flexibleTotals.slice(-6);
        const previous = average(last6.slice(0, 3).map(item => item.value));
        const latest = average(last6.slice(3).map(item => item.value));
        if (previous !== null && latest !== null && previous > 0) {
          const delta = latest - previous;
          const percent = delta / previous * 100;
          if (materiality(delta, percent, income, 10)) {
            persistent = signal('persistent_flexible_trend', 840, 'trend', {
              severity: 'warning', confidence: 'medium', historyMonthsUsed: 6,
              baselineValue: previous, currentValue: latest, deltaValue: delta, deltaPercent: percent,
              period: 'latest 3 months versus previous 3 months',
              evidence: [{ key: 'previous3Average', value: previous }, { key: 'latest3Average', value: latest }]
            });
          }
        }
      }
      if (persistent) signals.push(persistent);
    }

    if (income > 0 && flexibleTotals.length >= 3) {
      const recent = flexibleTotals.slice(-3).map(item => item.value);
      const baseline = average(recent);
      if (baseline !== null && baseline > 0 && currentFlexible > baseline) {
        const delta = currentFlexible - baseline;
        const percent = delta / baseline * 100;
        if (materiality(delta, percent, income, 12)) {
          signals.push(signal('flexible_total_change', 790, 'trend', {
            severity: 'warning', confidence: 'short', historyMonthsUsed: 3,
            currentValue: currentFlexible, baselineValue: baseline, deltaValue: delta, deltaPercent: percent,
            evidence: [{ key: 'currentFlexible', value: currentFlexible }, { key: 'recent3Average', value: baseline }]
          }));
        }
      }
    }

    const candidates = [];
    (Array.isArray(state.flexible) ? state.flexible : []).forEach(row => {
      if (!row || row.protected || row.exceptional) return;
      const series = categorySeries(normal, 'flexible', row);
      if (series.length < 3 || !(income > 0)) return;
      const baseline = average(series.slice(-3).map(item => item.value));
      const current = monthlyEquivalent(row);
      if (!(baseline > 0) || !(current > baseline)) return;
      const delta = current - baseline;
      const percent = delta / baseline * 100;
      if (!materiality(delta, percent, income, 12)) return;
      const scenario = scenarioAmounts(current, delta);
      const candidate = {
        key: String(row.id || normalizeName(row.name)),
        name: String(row.name || 'Flexible category'),
        currentValue: current,
        baselineValue: baseline,
        excess: delta,
        deltaPercent: percent,
        historyMonthsUsed: 3,
        totalMatchingHistory: series.length,
        scenarioAmounts: scenario
      };
      candidates.push(candidate);
      signals.push(signal('flexible_category_change', 820, 'category', {
        key: candidate.key,
        name: candidate.name,
        severity: 'warning', confidence: 'short', historyMonthsUsed: 3,
        currentValue: current, baselineValue: baseline, deltaValue: delta, deltaPercent: percent,
        eligibleForReduction: true, protected: false, scenarioAmounts: scenario,
        evidence: [{ key: 'currentCategory', value: current }, { key: 'recent3Average', value: baseline }]
      }));
    });

    const essentialSignals = [];
    (Array.isArray(state.essential) ? state.essential : []).forEach(row => {
      if (!row || row.exceptional || !(income > 0)) return;
      const series = categorySeries(normal, 'essential', row);
      if (series.length < 3) return;
      const baseline = average(series.slice(-3).map(item => item.value));
      const current = monthlyEquivalent(row);
      if (!(baseline > 0) || !(current > baseline)) return;
      const delta = current - baseline;
      const percent = delta / baseline * 100;
      if (!materiality(delta, percent, income, 12)) return;
      essentialSignals.push(signal('essential_cost_change', 760, 'essential', {
        key: String(row.id || normalizeName(row.name)),
        name: String(row.name || 'Essential category'),
        severity: 'info', confidence: 'short', historyMonthsUsed: 3,
        currentValue: current, baselineValue: baseline, deltaValue: delta, deltaPercent: percent,
        eligibleForReduction: false, protected: !!row.protected,
        evidence: [{ key: 'currentCategory', value: current }, { key: 'recent3Average', value: baseline }]
      }));
    });
    essentialSignals.sort((a, b) => b.deltaValue - a.deltaValue);
    if (essentialSignals[0]) signals.push(essentialSignals[0]);

    const savingHistory = normal.map(month => historyTotal(month, 'savings'));
    if (savingHistory.length >= 3 && income > 0) {
      const baseline = average(savingHistory.slice(-3));
      const current = nonNegative(summary.saving);
      if (baseline !== null) {
        const delta = current - baseline;
        const absDelta = Math.abs(delta);
        const percent = baseline > 0 ? absDelta / baseline * 100 : (current > 0 ? 100 : 0);
        if (absDelta >= income * 0.005 && percent >= 8) {
          signals.push(signal(delta >= 0 ? 'savings_progress' : 'savings_decline', delta >= 0 ? 520 : 650, 'savings', {
            severity: delta >= 0 ? 'positive' : 'warning', confidence: 'short', historyMonthsUsed: 3,
            currentValue: current, baselineValue: baseline, deltaValue: delta, deltaPercent: baseline > 0 ? delta / baseline * 100 : null,
            evidence: [{ key: 'currentSaving', value: current }, { key: 'recent3Average', value: baseline }]
          }));
        }
      }
    }

    const reserves = nonNegative(summary.reserves);
    if (reserves > 0) {
      signals.push(signal('irregular_bill_reserve', 200, 'reserve', {
        severity: 'info', currentValue: reserves,
        evidence: [{ key: 'monthlyReserve', value: reserves }]
      }));
    }

    candidates.sort((a, b) => b.excess - a.excess);
    const totals = candidates.reduce((acc, item) => {
      SCENARIOS.forEach(key => { acc[key] += item.scenarioAmounts[key]; });
      return acc;
    }, { low: 0, balanced: 0, aggressive: 0 });

    const excludedExceptionalMonths = history.filter(item => item && item.monthExceptional && item.month !== state.month).length;
    const result = {
      version: VERSION,
      generatedFrom: 'deterministic-local-engine',
      context: {
        normalHistoryMonths: normal.length,
        quality: qualityForCount(normal.length),
        months: normal.map(item => item.month),
        excludedExceptionalMonths
      },
      summaryFacts: {
        income,
        remaining,
        emergencyGap,
        coverage,
        targetMonths,
        reserves,
        currentFlexible,
        currentEssential
      },
      signals,
      primary: selectPrimary(signals),
      reductionCandidates: candidates,
      scenarios: {
        available: candidates.length > 0 && totals.balanced > 0,
        selected: selectedScenario,
        totals,
        candidateCount: candidates.length
      },
      priority: {
        key: String(state.priority || 'buffer'),
        relatedTool: PRIORITY_TOOLS[state.priority] || null
      }
    };
    return result;
  }

  function historyMeta(count, matchingCategory = false) {
    if (!count) return 'Current-month calculation.';
    return matchingCategory
      ? `Based on ${count} matching non-exceptional saved month${count === 1 ? '' : 's'}.`
      : `Based on ${count} non-exceptional saved month${count === 1 ? '' : 's'}.`;
  }

  function presentSignal(item, money) {
    const amount = money || (value => String(Math.round(num(value))));
    const pct = value => `${Math.abs(num(value)).toFixed(0)}%`;
    const base = {
      id: item.id,
      kind: item.kind,
      type: item.severity === 'critical' ? 'critical' : item.severity === 'warning' ? 'warning' : item.severity === 'positive' ? 'positive' : '',
      historyMonthsUsed: item.historyMonthsUsed || 0,
      eligibleForReduction: !!item.eligibleForReduction,
      title: '', body: '', kicker: 'SMART SUGGESTION', meta: historyMeta(item.historyMonthsUsed || 0, ['flexible_category_change','essential_cost_change'].includes(item.kind))
    };

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
        base.kicker = 'PERSISTENT SPENDING TREND';
        base.title = `Flexible spending is ${pct(item.deltaPercent)} higher across the ${item.period}.`;
        base.body = `The newer period averages ${amount(item.currentValue)} per month versus about ${amount(item.baselineValue)} in the earlier period.`;
        break;
      case 'flexible_total_change':
        base.kicker = 'FLEXIBLE SPENDING';
        base.title = `Flexible spending is ${pct(item.deltaPercent)} above its recent baseline.`;
        base.body = `Current non-exceptional flexible spending is ${amount(item.currentValue)} versus a recent average near ${amount(item.baselineValue)}.`;
        break;
      case 'flexible_category_change':
        base.kicker = 'FLEXIBLE CATEGORY';
        base.title = `${item.name} is about ${amount(item.deltaValue)} above its recent baseline.`;
        base.body = `The current monthly equivalent is ${amount(item.currentValue)} versus about ${amount(item.baselineValue)}. This category is unprotected and can be used in scenario modelling.`;
        break;
      case 'essential_cost_change':
        base.kicker = 'ESSENTIAL COST CHANGE';
        base.title = `${item.name} is about ${amount(item.deltaValue)} above its recent baseline.`;
        base.body = 'This is an informational change only. Smart Suggestions does not propose reducing essential categories.';
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
    if (count === 0) return 'Based on the current month only. Save at least 3 normal months to unlock history-based trend suggestions.';
    if (count < 3) return `Based on the current month + ${count} normal saved month${count === 1 ? '' : 's'}. Trend claims wait until at least 3 normal months are available.`;
    return `Based on the current month + ${count} normal saved months.${excluded ? ` ${excluded} exceptional month${excluded === 1 ? '' : 's'} excluded from the normal baseline.` : ' Exceptional months and entries are excluded from normal baselines.'}`;
  }

  function priorityPresentation(analysis, scenarioAmount, money, investmentLabel) {
    const priority = analysis.priority && analysis.priority.key || 'buffer';
    const facts = analysis.summaryFacts || {};
    const amount = nonNegative(scenarioAmount);
    const result = { text: '', relatedTool: null };

    if (facts.remaining < 0) {
      const shortfall = Math.abs(facts.remaining);
      if (amount >= shortfall) {
        const remainder = amount - shortfall;
        result.text = remainder > 0
          ? `Applied to the current plan, this scenario could cover the ${money(shortfall)} monthly shortfall and leave about ${money(remainder)} before other changes.`
          : `Applied to the current plan, this scenario could cover the ${money(shortfall)} monthly shortfall.`;
      } else {
        result.text = `Applied to the current plan, this scenario could reduce the ${money(shortfall)} monthly shortfall by about ${money(amount)}.`;
      }
      return result;
    }

    if (priority === 'emergency') {
      if (facts.emergencyGap > 0 && amount > 0) {
        const months = Math.max(1, Math.ceil(facts.emergencyGap / amount));
        result.text = `This amount could be directed toward your selected emergency-reserve target. At ${money(amount)} per month, the current modelled gap of ${money(facts.emergencyGap)} is about ${months} month${months === 1 ? '' : 's'}, assuming the inputs stay unchanged.`;
      } else {
        result.text = 'Your selected emergency-reserve target is already covered under the current entries, so this amount could remain as extra buffer or support another goal.';
      }
      return result;
    }
    if (priority === 'debt') {
      result.text = `This could become an additional ${money(amount)} monthly debt payment. Carrowmont does not estimate interest saved or a payoff date without debt-specific inputs.`;
      return result;
    }
    if (priority === 'goal') {
      result.text = `This could be used as a ${money(amount)} monthly contribution input in Goal Planner.`;
      result.relatedTool = PRIORITY_TOOLS.goal;
      return result;
    }
    if (priority === 'investment') {
      result.text = `This could be used as a ${money(amount)} monthly contribution input in ${investmentLabel || 'Recurring Investment Calculator'}.`;
      result.relatedTool = Object.assign({}, PRIORITY_TOOLS.investment, { label: investmentLabel || PRIORITY_TOOLS.investment.label });
      return result;
    }
    if (priority === 'retirement') {
      result.text = `This could be used as a ${money(amount)} monthly contribution input in Retirement Planner.`;
      result.relatedTool = PRIORITY_TOOLS.retirement;
      return result;
    }
    if (priority === 'fi') {
      result.text = `This could be used as a ${money(amount)} monthly investment input in Financial Independence.`;
      result.relatedTool = PRIORITY_TOOLS.fi;
      return result;
    }
    result.text = `This could remain as an additional ${money(amount)} monthly cash buffer.`;
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
    return {
      key,
      label: labels[key],
      amount,
      annualAmount: amount * 12,
      candidateCount: analysis.scenarios.candidateCount || 0,
      text: `This scenario adjusts only evidenced excess in unprotected flexible categories. Essential, protected and exceptional entries are unchanged.`,
      priorityText: priority.text,
      relatedTool: priority.relatedTool
    };
  }

  function present(analysis, options) {
    options = options || {};
    const money = typeof options.money === 'function' ? options.money : (value => String(Math.round(num(value))));
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
      primary: (analysis.primary || []).map(item => presentSignal(item, money)),
      scenario,
      allocation,
      protectedText: 'Protected categories are never used as spending-reduction sources. Essential categories may be highlighted for context, but Smart Suggestions does not propose cutting them.'
    };
  }

  return {
    VERSION,
    analyze,
    present,
    presentScenario,
    monthlyEquivalent,
    _test: { average, normalizeName, scenarioAmounts, materiality, normalHistory, categorySeries }
  };
});
