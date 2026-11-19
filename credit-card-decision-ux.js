/* Batch 12B-1 UX: one decision workspace, two tested engines, no account writes. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const tabs = { payoff: $('tab-payoff'), transfer: $('tab-transfer') };
  const panels = { payoff: $('payoff'), transfer: $('balance-transfer') };
  const methods = {
    payoff: $('payoff-methodology'), transfer: $('transfer-methodology')
  };
  const shared = [
    ['balance', 'btBalance'],
    ['apr', 'btCurrentApr'],
    ['planned', 'btPayment']
  ];
  let currentMode = 'payoff';
  const modeForHash = () => location.hash === '#balance-transfer' ? 'transfer' : 'payoff';

  // A single visible set of inputs at a time. Copy values between the two
  // independent existing engines, but never copy/save what-if values to an account.
  function carryInputs(from, to) {
    for (const [payoffId, transferId] of shared) {
      const source = $(from === 'payoff' ? payoffId : transferId);
      const destination = $(to === 'payoff' ? payoffId : transferId);
      if (source && destination) destination.value = source.value;
    }
  }
  function refresh(mode) {
    if (mode === 'transfer') window.dispatchEvent(new Event('carrowmont:transfer-mode'));
    else $('calculateBtn')?.click();
  }
  function scrollToWorkspace(mode) {
    // The target is visible before scrolling; avoids the first-click collapsed-anchor bug.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      panels[mode].scrollIntoView({behavior:'instant',block:'start'});
    }));
  }
  function choose(mode, { updateHash = false, scroll = false } = {}) {
    if (!tabs[mode] || !panels[mode]) return;
    if (currentMode !== mode) carryInputs(currentMode, mode);
    currentMode = mode;
    document.documentElement.dataset.ccMode = mode;
    Object.entries(panels).forEach(([key, panel]) => {
      panel.hidden = key !== mode;
      tabs[key].setAttribute('aria-selected', String(key === mode));
      tabs[key].tabIndex = key === mode ? 0 : -1;
    });
    Object.entries(methods).forEach(([key, method]) => { method.hidden = key !== mode; });
    refresh(mode);
    if (updateHash) {
      const hash = mode === 'transfer' ? '#balance-transfer' : '#payoff';
      if (location.hash !== hash) history.pushState(null, '', hash);
    }
    if (scroll) scrollToWorkspace(mode);
  }
  Object.entries(tabs).forEach(([mode, tab]) => {
    tab.addEventListener('click', () => choose(mode,{updateHash:true,scroll:true}));
    tab.addEventListener('keydown', event => {
      if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 'payoff' : event.key === 'End' ? 'transfer' : mode === 'payoff' ? 'transfer' : 'payoff';
      choose(next,{updateHash:true,scroll:false});
      tabs[next].focus();
    });
  });
  document.querySelectorAll('a[href="#balance-transfer"]').forEach(link => {
    link.addEventListener('click', event => { event.preventDefault(); choose('transfer',{updateHash:true,scroll:true}); });
  });
  document.querySelectorAll('a[href="#payoff"]').forEach(link => {
    link.addEventListener('click', event => { event.preventDefault(); choose('payoff',{updateHash:true,scroll:true}); });
  });
  const methodology = $('methodology');
  document.querySelectorAll('a[href="#methodology"]').forEach(link => {
    link.addEventListener('click', () => { methodology?.querySelector('details')?.setAttribute('open',''); });
  });
  // Direct links and the browser Back button must always select the intended pane.
  function restoreLocation() {
    const mode = modeForHash();
    choose(mode,{scroll:location.hash === '#balance-transfer' || location.hash === '#payoff'});
    if (location.hash === '#methodology') methodology?.querySelector('details')?.setAttribute('open','');
  }
  window.addEventListener('hashchange',restoreLocation);
  window.addEventListener('popstate',restoreLocation);
  restoreLocation();
})();
