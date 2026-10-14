(() => {
  'use strict';
  const L = window.CarrowmontLocale;
  const S = window.CarrowmontPlanState;
  const C = window.CarrowmontDebtPayoffCore;
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const num = v => Number.isFinite(Number(v)) ? Number(v) : 0;
  let rows = [];
  let result = null;
  let rowSeq = 0;

  const els = {
    rows:$('debtRows'), add:$('addDebtBtn'), load:$('loadExampleBtn'), reset:$('resetBtn'), extra:$('extraMonthly'), start:$('startMonth'),
    count:$('debtCountNote'), budgetLine:$('monthlyBudgetLine'), validation:$('validationMessage'), warning:$('warningMessage'), calculate:$('calculateBtn'),
    region:$('regionSelect'), currency:$('currencySelect'), localeCurrent:$('localeCurrent'), localeMenu:$('localeMenu'),
    resultLead:$('resultLead'), starting:$('startingDebtResult'), monthlyBudget:$('monthlyBudgetResult'), avalancheMonths:$('avalancheMonths'), avalancheInterest:$('avalancheInterest'), avalancheFirst:$('avalancheFirst'), avalancheDate:$('avalancheDate'), snowballMonths:$('snowballMonths'), snowballInterest:$('snowballInterest'), snowballFirst:$('snowballFirst'), snowballDate:$('snowballDate'), comparison:$('comparisonText'), avalancheExtra:$('avalancheExtraImpact'), snowballExtra:$('snowballExtraImpact'), payoffBody:$('payoffTableBody'), timelineBody:$('timelineTableBody'), chart:$('balanceChart'), report:$('reportBtn'), copy:$('copyBtn'), status:$('reportDownloadStatus'), handoff:$('budgetHandoff'), handoffText:$('budgetHandoffText'), applyHandoff:$('applyHandoffBtn'), dismissHandoff:$('dismissHandoffBtn')
  };

  function uid(){ rowSeq += 1; return `debt-${rowSeq}`; }
  function money(value, digits = 0){ return L.formatMoney(value,{maximumFractionDigits:digits,minimumFractionDigits:digits}); }
  function rate(value){ return `${num(value).toFixed(2)}%`; }
  function duration(months){
    if (!Number.isFinite(months)) return '—';
    const years = Math.floor(months / 12), rest = months % 12;
    if (!years) return `${months} month${months===1?'':'s'}`;
    if (!rest) return `${years} year${years===1?'':'s'}`;
    return `${years}y ${rest}m`;
  }
  function dateForMonth(monthNumber){
    const raw = els.start.value;
    if(!raw || !/^\d{4}-\d{2}$/.test(raw) || !Number.isFinite(monthNumber)) return '—';
    const [year, month] = raw.split('-').map(Number);
    const d = new Date(Date.UTC(year, month - 1 + Math.max(0, monthNumber - 1), 1));
    try { return new Intl.DateTimeFormat(L.getLocale(),{month:'short',year:'numeric',timeZone:'UTC'}).format(d); }
    catch(_) { return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`; }
  }
  function rowTerms(){
    const r=L.getRegion();
    return {
      rate: ['US','CA'].includes(r) ? 'Interest rate (APR)' : 'Interest rate',
      minimum: ['AU','NZ'].includes(r) ? 'Minimum monthly repayment' : 'Minimum monthly payment'
    };
  }
  function blankRow(){ return {id:uid(),label:'',balance:'',annualRatePct:'',minimumPayment:''}; }
  function setRows(next){ rows=next; renderRows(); updateBudgetLine(); }
  function rowHtml(row,index){
    const t=rowTerms();
    return `<div class="debt-row" data-id="${esc(row.id)}">
      <label><span>Debt name (optional)</span><input data-field="label" maxlength="50" value="${esc(row.label)}" placeholder="Example: Credit card"></label>
      <label><span>How much do you owe?</span><div class="money-input"><span class="row-currency">${esc(L.currencySymbol())}</span><input data-field="balance" type="number" min="0" step="100" value="${esc(row.balance)}" aria-label="Debt ${index+1} balance"></div></label>
      <label><span>${esc(t.rate)}</span><div class="input-suffix"><input data-field="annualRatePct" type="number" min="0" step="0.01" value="${esc(row.annualRatePct)}" aria-label="Debt ${index+1} interest rate"><span>%</span></div></label>
      <label><span>${esc(t.minimum)}</span><div class="money-input"><span class="row-currency">${esc(L.currencySymbol())}</span><input data-field="minimumPayment" type="number" min="0" step="10" value="${esc(row.minimumPayment)}" aria-label="Debt ${index+1} minimum payment"></div></label>
      <button class="btn btn-secondary remove-debt" type="button" aria-label="Remove debt ${index+1}" ${rows.length<=1?'disabled':''}>Remove</button>
    </div>`;
  }
  function renderRows(){
    els.rows.innerHTML=rows.map(rowHtml).join('');
    els.count.textContent=`${rows.length} of 10 rows`;
    els.add.disabled=rows.length>=10;
    document.querySelectorAll('.currency-prefix').forEach(el=>el.textContent=L.currencySymbol());
  }
  function syncRowInput(input){
    const host=input.closest('.debt-row'); if(!host) return;
    const row=rows.find(r=>r.id===host.dataset.id); if(!row) return;
    row[input.dataset.field]=input.value;
    updateBudgetLine();
  }
  function rowData(){
    return rows.map(row=>({id:row.id,label:row.label.trim(),balance:Number(row.balance),annualRatePct:Number(row.annualRatePct),minimumPayment:Number(row.minimumPayment)}));
  }
  function isBlank(row){ return !row.label.trim() && row.balance==='' && row.annualRatePct==='' && row.minimumPayment===''; }
  function validate(){
    const errors=[];
    const active=rows.filter(r=>!isBlank(r));
    if(!active.length) errors.push('Add at least one debt with a balance, interest rate and minimum monthly payment.');
    active.forEach((row,index)=>{
      const label=row.label.trim()||`Debt ${index+1}`;
      if(!(Number(row.balance)>0)) errors.push(`${label}: enter how much you owe.`);
      if(!Number.isFinite(Number(row.annualRatePct)) || Number(row.annualRatePct)<0) errors.push(`${label}: enter an interest rate of 0% or more.`);
      if(!(Number(row.minimumPayment)>0)) errors.push(`${label}: enter a minimum monthly payment above 0.`);
    });
    if(rows.length>10) errors.push('This version supports up to 10 debts.');
    return {errors,active};
  }
  function validDebts(){ const {active}=validate(); return active.map(r=>({id:r.id,label:r.label.trim(),balance:Number(r.balance),annualRatePct:Number(r.annualRatePct),minimumPayment:Number(r.minimumPayment)})); }
  function updateBudgetLine(){
    const debts=rows.filter(r=>!isBlank(r) && Number(r.minimumPayment)>0);
    const mins=debts.reduce((s,r)=>s+Number(r.minimumPayment),0), extra=Math.max(0,num(els.extra.value));
    els.budgetLine.textContent=`Entered minimums: ${money(mins)} · Extra: ${money(extra)} · Total modeled monthly debt payment: ${money(mins+extra)}`;
  }
  function clearMessages(){ els.validation.hidden=true; els.warning.hidden=true; els.status.textContent=''; }
  function calculate(){
    clearMessages();
    const v=validate();
    if(v.errors.length){els.validation.innerHTML=v.errors.map(x=>`<div>${esc(x)}</div>`).join('');els.validation.hidden=false;result=null;resetResults();return;}
    const debts=validDebts();
    result=C.comparePlans(debts,Math.max(0,num(els.extra.value)));
    if(result.warnings.length){els.warning.innerHTML=`<strong>Check these entries:</strong> ${result.warnings.map(w=>esc(w.message)).join(' ')}`;els.warning.hidden=false;}
    renderResult();
  }
  function resetResults(){
    for(const el of [els.starting,els.monthlyBudget,els.avalancheMonths,els.avalancheInterest,els.avalancheFirst,els.avalancheDate,els.snowballMonths,els.snowballInterest,els.snowballFirst,els.snowballDate,els.avalancheExtra,els.snowballExtra]) el.textContent='—';
    els.resultLead.textContent='Enter at least one debt, then calculate.'; els.comparison.textContent='Your comparison will appear here.'; els.payoffBody.innerHTML='<tr><td colspan="6" class="debt-empty">Calculate a plan to see the payoff order.</td></tr>';els.timelineBody.innerHTML='<tr><td colspan="5" class="debt-empty">Calculate a plan to see the monthly timeline.</td></tr>';els.chart.innerHTML='<title id="chartTitle">Debt balance over time</title><desc id="chartDesc">No result yet.</desc>';els.report.disabled=true;els.copy.disabled=true;
  }
  function methodFirst(strategy){
    if(!strategy.firstPayoff) return '—';
    const label=strategy.firstPayoff.label||`Debt ${strategy.firstPayoff.originalIndex+1}`;
    return `${label} · month ${strategy.firstPayoff.month}`;
  }
  function methodDate(strategy){ return strategy.status==='paid_off'?dateForMonth(strategy.months):'Not within 50 years'; }
  function methodDuration(strategy){ return strategy.status==='paid_off'?duration(strategy.months):'Not repaid within 50 years'; }
  function extraImpact(strategy,baseline){
    if(result.inputs.extraMonthlyPayment<=0) return 'No extra monthly payment entered.';
    if(baseline.status!=='paid_off') return 'Minimum-only plan did not fully repay within 50 years.';
    const months=Math.max(0,baseline.months-strategy.months), interest=Math.max(0,baseline.totalInterest-strategy.totalInterest);
    return `${duration(months)} sooner · ${money(interest)} less modeled interest`;
  }
  function comparisonText(){
    const a=result.avalanche,s=result.snowball;
    if(a.status!=='paid_off' || s.status!=='paid_off') return 'At least one method does not fully repay all entered debts within the 50-year model horizon. Review the minimum payments and extra amount.';
    const sameOrder=a.payoffRecords.map(x=>x.id).join('|')===s.payoffRecords.map(x=>x.id).join('|');
    const interestSaved=s.totalInterest-a.totalInterest;
    const firstDiff=(s.firstPayoff?.month??0)-(a.firstPayoff?.month??0);
    if(sameOrder && Math.abs(interestSaved)<0.01) return 'Both methods follow the same payoff order with these numbers, so the modeled result is effectively the same.';
    const parts=[];
    if(Math.abs(interestSaved)>=0.01){
      if(interestSaved>0) parts.push(`Paying the highest-interest debt first uses about ${money(interestSaved)} less interest in this model.`);
      else parts.push(`Paying the smallest debt first uses about ${money(-interestSaved)} less interest in this model.`);
    }
    if(a.firstPayoff && s.firstPayoff){
      if(firstDiff>0) parts.push(`The highest-interest-first method clears its first debt ${duration(firstDiff)} sooner.`);
      else if(firstDiff<0) parts.push(`The smallest-debt-first method clears its first debt ${duration(-firstDiff)} sooner.`);
      else parts.push('Both methods clear their first debt in the same month.');
    }
    if(a.months===s.months) parts.push('The full debt-free month is the same.');
    else parts.push(`${a.months<s.months?'Highest-interest-first':'Smallest-debt-first'} reaches the modeled debt-free point ${duration(Math.abs(a.months-s.months))} sooner.`);
    return parts.join(' ');
  }
  function renderResult(){
    const a=result.avalanche,s=result.snowball;
    els.resultLead.textContent='These estimates use the same debts and total monthly payment for both methods.';
    els.starting.textContent=money(result.startingTotalDebt); els.monthlyBudget.textContent=money(result.totalMonthlyBudget);
    els.avalancheMonths.textContent=methodDuration(a); els.avalancheInterest.textContent=money(a.totalInterest); els.avalancheFirst.textContent=methodFirst(a); els.avalancheDate.textContent=methodDate(a);
    els.snowballMonths.textContent=methodDuration(s); els.snowballInterest.textContent=money(s.totalInterest); els.snowballFirst.textContent=methodFirst(s); els.snowballDate.textContent=methodDate(s);
    els.comparison.textContent=comparisonText(); els.avalancheExtra.textContent=extraImpact(a,result.zeroExtra.avalanche); els.snowballExtra.textContent=extraImpact(s,result.zeroExtra.snowball);
    renderPayoffTable(); renderTimeline(); renderChart(); els.report.disabled=false; els.copy.disabled=false;
  }
  function renderPayoffTable(){
    const blocks=[['Highest interest first',result.avalanche],['Smallest debt first',result.snowball]];
    const rowsOut=[];
    for(const [label,strategy] of blocks){
      if(!strategy.payoffRecords.length){rowsOut.push(`<tr><td>${esc(label)}</td><td>—</td><td colspan="4">Not fully repaid within 50 years</td></tr>`);continue;}
      strategy.payoffRecords.forEach((rec,index)=>rowsOut.push(`<tr><td>${esc(label)}</td><td>${index+1}</td><td>${esc(rec.label||`Debt ${rec.originalIndex+1}`)}</td><td>${esc(money(rec.startingBalance))}</td><td>${esc(rate(rec.annualRatePct))}</td><td>${esc(dateForMonth(rec.month)!=='—'?`${dateForMonth(rec.month)} · month ${rec.month}`:`Month ${rec.month}`)}</td></tr>`));
    }
    els.payoffBody.innerHTML=rowsOut.join('');
  }
  function renderTimeline(){
    const max=Math.max(result.avalanche.monthly.length,result.snowball.monthly.length); const out=[];
    for(let i=0;i<max;i+=1){const a=result.avalanche.monthly[i],s=result.snowball.monthly[i];out.push(`<tr><td>${i+1}${dateForMonth(i+1)!=='—'?` · ${esc(dateForMonth(i+1))}`:''}</td><td>${esc(money(a?.closingBalance??0))}</td><td>${esc(money(a?.cumulativeInterest??result.avalanche.totalInterest))}</td><td>${esc(money(s?.closingBalance??0))}</td><td>${esc(money(s?.cumulativeInterest??result.snowball.totalInterest))}</td></tr>`);}
    els.timelineBody.innerHTML=out.join('');
  }
  function svgPath(points,maxX,maxY,width=860,height=240,pad=28){
    return points.map((p,i)=>{const x=pad+(p.x/maxX)*(width-2*pad),y=pad+(1-p.y/maxY)*(height-2*pad);return `${i?'L':'M'} ${x.toFixed(1)} ${y.toFixed(1)}`;}).join(' ');
  }
  function renderChart(){
    const start=result.startingTotalDebt||1; const maxMonths=Math.max(1,result.avalanche.monthly.length,result.snowball.monthly.length);
    const a=[{x:0,y:start},...result.avalanche.monthly.map(x=>({x:x.month,y:x.closingBalance}))]; const s=[{x:0,y:start},...result.snowball.monthly.map(x=>({x:x.month,y:x.closingBalance}))];
    const pa=svgPath(a,maxMonths,start),ps=svgPath(s,maxMonths,start); const fmt=v=>L.formatCompactMoney(v,{maximumFractionDigits:1});
    els.chart.innerHTML=`<title id="chartTitle">Debt balance over time</title><desc id="chartDesc">Highest-interest-first and smallest-debt-first total remaining debt over ${maxMonths} modeled months.</desc><line x1="28" y1="268" x2="872" y2="268" stroke="#cfdae0"/><line x1="28" y1="28" x2="28" y2="268" stroke="#cfdae0"/><text x="28" y="20" font-size="12" fill="#53697d">${esc(fmt(start))}</text><text x="28" y="288" font-size="12" fill="#53697d">Month 0</text><text x="820" y="288" font-size="12" fill="#53697d">Month ${maxMonths}</text><path d="${pa}" fill="none" stroke="#0e827a" stroke-width="4"/><path d="${ps}" fill="none" stroke="#4e638f" stroke-width="3" stroke-dasharray="8 6"/>`;
  }
  function summaryText(){
    if(!result) return '';
    const interestDiff=result.snowball.totalInterest-result.avalanche.totalInterest;
    return ['Carrowmont Debt Payoff Calculator Summary',`Country / currency: ${L.getProfile().label} · ${L.getCurrency()}`,`Total starting debt: ${money(result.startingTotalDebt)}`,`Total monthly debt payment: ${money(result.totalMonthlyBudget)}`,`Extra monthly payment: ${money(result.inputs.extraMonthlyPayment)}`,'',`Pay highest-interest debt first: ${methodDuration(result.avalanche)} · total interest ${money(result.avalanche.totalInterest)}`,`Pay smallest debt first: ${methodDuration(result.snowball)} · total interest ${money(result.snowball.totalInterest)}`,`Interest difference: ${money(Math.abs(interestDiff))}`,`First-debt timing: highest interest first ${result.avalanche.firstPayoff?.month??'—'} month(s); smallest debt first ${result.snowball.firstPayoff?.month??'—'} month(s)`,'','Assumes fixed entered rates and fixed entered minimum payments in a monthly planning model. Lender statements can differ.','Educational planning illustration, not individualized financial advice.'].join('\n');
  }
  async function copySummary(){
    if(!result)return;try{await navigator.clipboard.writeText(summaryText());els.status.textContent='Summary copied.';}catch(_){els.status.textContent='Could not copy automatically. Your browser may block clipboard access.';}
  }
  async function generateReport(){
    if(!result)return;try{await window.CarrowmontDebtPayoffPdfRenderer.download({result,startMonth:els.start.value,region:L.getRegion(),country:L.getProfile().label,currency:L.getCurrency()});els.status.textContent='Report has been downloaded.';}catch(err){console.error(err);els.status.textContent='Could not generate the report.';}
  }
  function bindLocale(){
    const entries=Object.entries(L.regions).sort(([a,x],[b,y])=>{if(a==='OTHER')return 1;if(b==='OTHER')return -1;return x.label.localeCompare(y.label,'en');});
    els.region.innerHTML=entries.map(([k,v])=>`<option value="${k}">${esc(v.label)}</option>`).join('');
    els.currency.innerHTML=Object.entries(L.currencies).map(([k,v])=>`<option value="${k}">${k} · ${esc(v.label)}</option>`).join('');
    const sync=()=>{els.region.value=L.getRegion();els.currency.value=L.getCurrency();els.localeCurrent.textContent=`${L.getProfile().label} · ${L.getCurrency()}`;renderRows();updateBudgetLine();if(result)calculate();renderBudgetHandoff();};
    els.region.addEventListener('change',()=>L.setRegion(els.region.value,{syncCurrency:true})); els.currency.addEventListener('change',()=>L.setCurrency(els.currency.value)); $('localeDone').addEventListener('click',()=>els.localeMenu.removeAttribute('open')); window.addEventListener('carrowmont:localechange',sync); sync();
  }
  function handoffEntry(){
    if(!S?.get)return null; const entry=S.get('assumptions.possibleMonthlyDebtExtra'); if(!entry||typeof entry!=='object')return null;
    if(entry.sourceTool!=='budget-cash-flow-planner'||entry.currency!==L.getCurrency()||!(Number(entry.value)>0))return null;
    const age=Date.now()-new Date(entry.updatedAt||0).getTime(); if(!Number.isFinite(age)||age<0||age>30*60*1000)return null;
    return entry;
  }
  function renderBudgetHandoff(){
    const entry=handoffEntry(); if(!entry){els.handoff.hidden=true;return;} els.handoffText.textContent=`${money(entry.value)} per month was staged from Budget & Cash Flow Planner. It will not be used unless you choose to apply it.`; els.handoff.hidden=false;
  }
  function clearHandoff(){try{S?.clear('assumptions.possibleMonthlyDebtExtra');}catch(_){}els.handoff.hidden=true;}
  function loadExample(){setRows([{id:uid(),label:'Credit card',balance:'5000',annualRatePct:'20',minimumPayment:'150'},{id:uid(),label:'Personal loan',balance:'12000',annualRatePct:'9',minimumPayment:'280'},{id:uid(),label:'Car loan',balance:'8000',annualRatePct:'6',minimumPayment:'220'}]);els.extra.value='200';updateBudgetLine();calculate();}
  function reset(){setRows([blankRow(),blankRow()]);els.extra.value='0';els.start.value='';result=null;clearMessages();resetResults();}

  els.rows.addEventListener('input',e=>{if(e.target.dataset.field)syncRowInput(e.target);});
  els.rows.addEventListener('click',e=>{const btn=e.target.closest('.remove-debt');if(!btn||rows.length<=1)return;rows=rows.filter(r=>r.id!==btn.closest('.debt-row').dataset.id);renderRows();updateBudgetLine();});
  els.add.addEventListener('click',()=>{if(rows.length<10){rows.push(blankRow());renderRows();}}); els.extra.addEventListener('input',updateBudgetLine); els.load.addEventListener('click',loadExample); els.reset.addEventListener('click',reset); els.calculate.addEventListener('click',calculate); els.copy.addEventListener('click',copySummary); els.report.addEventListener('click',generateReport);
  els.applyHandoff.addEventListener('click',()=>{const e=handoffEntry();if(!e)return renderBudgetHandoff();els.extra.value=String(e.value);updateBudgetLine();clearHandoff();els.status.textContent='Budget amount applied as the extra monthly payment. Review it before calculating.';}); els.dismissHandoff.addEventListener('click',clearHandoff);
  window.addEventListener('carrowmont:planchange',e=>{if((e.detail?.keys||[]).some(k=>k==='*'||k==='assumptions.possibleMonthlyDebtExtra'))renderBudgetHandoff();});

  rows=[blankRow(),blankRow()]; bindLocale(); renderRows(); updateBudgetLine(); renderBudgetHandoff(); resetResults();
})();
