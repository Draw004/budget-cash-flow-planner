(() => {
  'use strict';

  const L = window.CarrowmontLocale;
  const S = window.CarrowmontBudgetStorage;
  const byId = id => document.getElementById(id);
  const clamp = (n,a,b)=>Math.min(b,Math.max(a,n));
  const num = (v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
  const isoMonth = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  const today = new Date(); today.setHours(0,0,0,0);
  const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2,7)}`;

  const FREQ = {
    weekly:{label:'Weekly',perMonth:52/12,days:7},
    biweekly:{label:'Every 2 Weeks',perMonth:26/12,days:14},
    semimonthly:{label:'Twice Monthly',perMonth:2,days:365.2425/24},
    fourweekly:{label:'Every 4 Weeks',perMonth:13/12,days:28},
    monthly:{label:'Monthly',perMonth:1,days:365.2425/12},
    quarterly:{label:'Quarterly',perMonth:1/3,days:365.2425/4},
    annual:{label:'Annual',perMonth:1/12,days:365.2425},
    irregular:{label:'Irregular / Monthly Average',perMonth:1,days:null}
  };

  const DEFAULTS = {
    view:'monthly', month:isoMonth(today), primaryPayFrequency:'monthly', nextPayday:'', availableCash:0,
    emergencyCurrent:180000, emergencyTargetMonths:6, priority:'emergency', monthNote:'', monthExceptional:false,
    incomes:[
      {id:uid(),name:'Salary / wages',amount:120000,frequency:'monthly'}
    ],
    essential:[
      {id:uid(),name:'Rent / mortgage',amount:30000,frequency:'monthly',protected:true,exceptional:false,dueDate:''},
      {id:uid(),name:'Utilities',amount:6000,frequency:'monthly',protected:true,exceptional:false,dueDate:''},
      {id:uid(),name:'Insurance',amount:36000,frequency:'annual',protected:true,exceptional:false,dueDate:''},
      {id:uid(),name:'Transport commitment',amount:6500,frequency:'monthly',protected:false,exceptional:false,dueDate:''}
    ],
    flexible:[
      {id:uid(),name:'Groceries',amount:15000,frequency:'monthly',protected:true,exceptional:false,dueDate:''},
      {id:uid(),name:'Dining & entertainment',amount:8500,frequency:'monthly',protected:false,exceptional:false,dueDate:''},
      {id:uid(),name:'Shopping / personal care',amount:5000,frequency:'monthly',protected:false,exceptional:false,dueDate:''}
    ],
    savings:[
      {id:uid(),name:'Recurring investment',amount:10000,frequency:'monthly'},
      {id:uid(),name:'Emergency savings',amount:5000,frequency:'monthly'}
    ]
  };

  let state = structuredClone(DEFAULTS);
  let history = [];
  let toastTimer;

  const els = {
    budgetMonth:byId('budgetMonth'), primaryPayFrequency:byId('primaryPayFrequency'), nextPayday:byId('nextPayday'), availableCash:byId('availableCash'),
    emergencyCurrent:byId('emergencyCurrent'), emergencyTargetMonths:byId('emergencyTargetMonths'), priority:byId('priority'), monthNote:byId('monthNote'), monthExceptional:byId('monthExceptional'),
    incomeRows:byId('incomeRows'), essentialRows:byId('essentialRows'), flexibleRows:byId('flexibleRows'), savingRows:byId('savingRows'),
    regionSelect:byId('regionSelect'), currencySelect:byId('currencySelect'), localeCurrent:byId('localeCurrent'), localeMenu:byId('localeMenu'),
    moneyRemaining:byId('moneyRemaining'), remainingNote:byId('remainingNote'), cashflowHero:byId('cashflowHero'), monthlyIncome:byId('monthlyIncome'), essentialTotal:byId('essentialTotal'), flexibleTotal:byId('flexibleTotal'), savingTotal:byId('savingTotal'), reserveTotal:byId('reserveTotal'), savingsRate:byId('savingsRate'), safeWeekly:byId('safeWeekly'), safeDaily:byId('safeDaily'),
    nextPaydayDisplay:byId('nextPaydayDisplay'), cycleIncome:byId('cycleIncome'), cycleEssential:byId('cycleEssential'), cycleSavings:byId('cycleSavings'), cycleRoom:byId('cycleRoom'), upcomingBills:byId('upcomingBills'), cashAfterBills:byId('cashAfterBills'),
    coverageRing:byId('coverageRing'), coverageMonths:byId('coverageMonths'), coverageHeading:byId('coverageHeading'), coverageText:byId('coverageText'),
    insightGrid:byId('insightGrid'), historyRange:byId('historyRange'), historyTableBody:byId('historyTableBody'), trendChart:byId('trendChart'), saveStatus:byId('saveStatus')
  };

  function escapeHtml(s){return String(s??'').replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));}
  function money(v){return L.formatMoney(v,{maximumFractionDigits:0});}
  function compact(v){return L.formatCompactMoney(v,{maximumFractionDigits:1});}
  function currencySymbol(){return L.currencySymbol();}
  function frequencyLabel(key){
    if(key==='biweekly'){
      const t=L.getProfile().twoWeekLabel;
      if(t==='fortnightly') return 'Fortnightly (Every 2 Weeks)';
      if(t==='biweekly') return 'Biweekly (Every 2 Weeks)';
    }
    return FREQ[key]?.label || key;
  }
  function monthlyEquivalent(amount,frequency){return Math.max(0,num(amount))* (FREQ[frequency]?.perMonth || 1);}
  function perCycleFromMonthly(monthly,frequency){const p=FREQ[frequency]?.perMonth||1;return p>0?monthly/p:monthly;}
  function irregularReserve(rows){return rows.filter(r=>!['weekly','biweekly','semimonthly','fourweekly','monthly','irregular'].includes(r.frequency)).reduce((sum,r)=>sum+monthlyEquivalent(r.amount,r.frequency),0);}
  function sumRows(rows){return rows.reduce((sum,r)=>sum+monthlyEquivalent(r.amount,r.frequency),0);}
  function normalizeState(raw){
    const s={...structuredClone(DEFAULTS),...(raw||{})};
    ['incomes','essential','flexible','savings'].forEach(k=>{if(!Array.isArray(s[k]))s[k]=[];s[k]=s[k].map(r=>({...r,id:r.id||uid()}));});
    if(!/^\d{4}-\d{2}$/.test(s.month||''))s.month=isoMonth(today);
    return s;
  }
  function defaultNextPayday(freq){
    const d=new Date(today); const days=FREQ[freq]?.days||30;
    d.setDate(d.getDate()+Math.max(1,Math.round(days)));
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function calculate(s=state){
    const income=sumRows(s.incomes), essential=sumRows(s.essential), flexible=sumRows(s.flexible), saving=sumRows(s.savings);
    const reserves=irregularReserve([...s.essential,...s.flexible]);
    const remaining=income-essential-flexible-saving;
    const savingsRate=income>0?saving/income*100:0;
    const weekly=Math.max(0,remaining)/(52/12), daily=Math.max(0,remaining)/(365.2425/12);
    const coverage=essential>0?Math.max(0,num(s.emergencyCurrent))/essential:0;
    const targetAmount=essential*Math.max(0,num(s.emergencyTargetMonths));
    const emergencyGap=Math.max(0,targetAmount-Math.max(0,num(s.emergencyCurrent)));
    const cycleFreq=s.primaryPayFrequency||'monthly';
    const cycleIncome=perCycleFromMonthly(income,cycleFreq), cycleEssential=perCycleFromMonthly(essential,cycleFreq), cycleSaving=perCycleFromMonthly(saving,cycleFreq), cycleFlexible=perCycleFromMonthly(flexible,cycleFreq);
    const cycleRoom=cycleIncome-cycleEssential-cycleSaving-cycleFlexible;
    return {income,essential,flexible,saving,reserves,remaining,savingsRate,weekly,daily,coverage,targetAmount,emergencyGap,cycleIncome,cycleEssential,cycleSaving,cycleFlexible,cycleRoom};
  }

  function frequencyOptions(selected,includeIrregular=true){
    return Object.entries(FREQ).filter(([k])=>includeIrregular||k!=='irregular').map(([k,v])=>`<option value="${k}" ${k===selected?'selected':''}>${escapeHtml(frequencyLabel(k))}</option>`).join('');
  }
  function rowHtml(row,kind){
    const isIncome=kind==='income', isSaving=kind==='saving';
    const monthly=monthlyEquivalent(row.amount,row.frequency);
    const reserveNote=!isIncome&&!isSaving&&!['weekly','biweekly','semimonthly','fourweekly','monthly','irregular'].includes(row.frequency)?`Monthly reserve: ${money(monthly)}`:'';
    if(isIncome){
      return `<div class="entry-row income-row" data-kind="${kind}" data-id="${row.id}">
        <label class="mini-field"><span>Income source</span><input data-field="name" type="text" maxlength="60" value="${escapeHtml(row.name)}"></label>
        <label class="mini-field money-cell"><span>Amount</span><span class="row-currency">${escapeHtml(currencySymbol())}</span><input data-field="amount" type="number" min="0" step="100" value="${num(row.amount)}"></label>
        <label class="mini-field"><span>Frequency</span><select data-field="frequency">${frequencyOptions(row.frequency,true)}</select></label>
        <div class="row-actions"><button class="icon-btn delete-row" type="button" aria-label="Delete row">×</button></div>
      </div>`;
    }
    if(isSaving){
      return `<div class="entry-row" data-kind="${kind}" data-id="${row.id}">
        <label class="mini-field"><span>Saving / investment</span><input data-field="name" type="text" maxlength="60" value="${escapeHtml(row.name)}"></label>
        <label class="mini-field money-cell"><span>Amount</span><span class="row-currency">${escapeHtml(currencySymbol())}</span><input data-field="amount" type="number" min="0" step="100" value="${num(row.amount)}"></label>
        <label class="mini-field"><span>Frequency</span><select data-field="frequency">${frequencyOptions(row.frequency,true)}</select></label>
        <div class="mini-field"><span>Monthly equivalent</span><input data-monthly-equivalent value="${escapeHtml(money(monthly))}" disabled></div>
        <div class="row-actions"><button class="icon-btn delete-row" type="button" aria-label="Delete row">×</button></div>
      </div>`;
    }
    return `<div class="entry-row" data-kind="${kind}" data-id="${row.id}">
      <label class="mini-field"><span>Category</span><input data-field="name" type="text" maxlength="60" value="${escapeHtml(row.name)}"></label>
      <label class="mini-field money-cell"><span>Amount</span><span class="row-currency">${escapeHtml(currencySymbol())}</span><input data-field="amount" type="number" min="0" step="100" value="${num(row.amount)}"></label>
      <label class="mini-field"><span>Frequency</span><select data-field="frequency">${frequencyOptions(row.frequency,true)}</select></label>
      <div class="mini-field"><span>Monthly equivalent</span><input data-monthly-equivalent value="${escapeHtml(money(monthly))}" disabled></div>
      <div class="row-actions"><button class="icon-btn delete-row" type="button" aria-label="Delete row">×</button></div>
      <div class="row-options">
        <label><input data-field="protected" type="checkbox" ${row.protected?'checked':''}> Protect from spending-reduction suggestions</label>
        <label><input data-field="exceptional" type="checkbox" ${row.exceptional?'checked':''}> Exceptional / one-time for comparisons</label>
        <label class="due-wrap">Next due date <input data-field="dueDate" type="date" value="${escapeHtml(row.dueDate||'')}"></label>
        ${reserveNote?`<span class="row-reserve-note">${escapeHtml(reserveNote)}</span>`:''}
      </div>
    </div>`;
  }
  function renderRows(){
    els.incomeRows.innerHTML=state.incomes.length?state.incomes.map(r=>rowHtml(r,'income')).join(''):'<div class="empty-row">Add at least one income source.</div>';
    els.essentialRows.innerHTML=state.essential.length?state.essential.map(r=>rowHtml(r,'essential')).join(''):'<div class="empty-row">No essential expenses added yet.</div>';
    els.flexibleRows.innerHTML=state.flexible.length?state.flexible.map(r=>rowHtml(r,'flexible')).join(''):'<div class="empty-row">No flexible expenses added yet.</div>';
    els.savingRows.innerHTML=state.savings.length?state.savings.map(r=>rowHtml(r,'saving')).join(''):'<div class="empty-row">No planned savings or investments added yet.</div>';
  }

  function upcomingBills(){
    const payday=state.nextPayday?new Date(`${state.nextPayday}T00:00:00`):null;
    if(!payday||Number.isNaN(payday.getTime())||payday<today)return[];
    return [...state.essential,...state.flexible].filter(r=>r.dueDate).map(r=>({...r,_due:new Date(`${r.dueDate}T00:00:00`)})).filter(r=>!Number.isNaN(r._due.getTime())&&r._due>=today&&r._due<=payday).sort((a,b)=>a._due-b._due);
  }

  function renderSummary(){
    const c=calculate();
    els.moneyRemaining.textContent=money(c.remaining); els.cashflowHero.classList.toggle('negative',c.remaining<0);
    els.remainingNote.textContent=c.remaining<0?'planned outflows exceed monthly income under the current entries':'after planned spending, reserves, savings and investments';
    els.monthlyIncome.textContent=money(c.income); els.essentialTotal.textContent=money(c.essential); els.flexibleTotal.textContent=money(c.flexible); els.savingTotal.textContent=money(c.saving); els.reserveTotal.textContent=money(c.reserves); els.savingsRate.textContent=`${c.savingsRate.toFixed(1)}%`; els.safeWeekly.textContent=money(c.weekly); els.safeDaily.textContent=money(c.daily);
    els.cycleIncome.textContent=money(c.cycleIncome); els.cycleEssential.textContent=money(c.cycleEssential); els.cycleSavings.textContent=money(c.cycleSaving); els.cycleRoom.textContent=money(c.cycleRoom);
    if(state.nextPayday){try{els.nextPaydayDisplay.textContent=new Intl.DateTimeFormat(L.getLocale(),{day:'numeric',month:'short',year:'numeric'}).format(new Date(`${state.nextPayday}T00:00:00`));}catch(_){els.nextPaydayDisplay.textContent=state.nextPayday;}}else els.nextPaydayDisplay.textContent='Not set';
    const bills=upcomingBills(); els.upcomingBills.innerHTML=bills.length?bills.map(b=>`<div class="bill-line"><span>${escapeHtml(b.name)} · ${b._due.toLocaleDateString(L.getLocale(),{day:'numeric',month:'short'})}</span><strong>${escapeHtml(money(b.amount))}</strong></div>`).join(''):'<div class="empty-row">No dated bills fall before the next payday.</div>';
    els.cashAfterBills.textContent=num(state.availableCash)>0?money(num(state.availableCash)-bills.reduce((s,b)=>s+num(b.amount),0)):'—';
    const pct=state.emergencyTargetMonths>0?clamp(c.coverage/num(state.emergencyTargetMonths)*100,0,100):0; els.coverageRing.style.setProperty('--ring',`${pct}%`); els.coverageMonths.textContent=c.coverage.toFixed(1);
    if(c.essential<=0){els.coverageHeading.textContent='Add essential expenses';els.coverageText.textContent='Emergency coverage uses your monthly essential-expense total.';}
    else if(num(state.emergencyTargetMonths)<=0){els.coverageHeading.textContent='No target selected';els.coverageText.textContent=`Your current reserve equals about ${c.coverage.toFixed(1)} months of entered essential expenses.`;}
    else if(c.emergencyGap<=0){els.coverageHeading.textContent='Your selected target is covered';els.coverageText.textContent=`The current reserve covers about ${c.coverage.toFixed(1)} months against your ${num(state.emergencyTargetMonths).toFixed(0)}-month target.`;}
    else{els.coverageHeading.textContent='Gap to your selected target';els.coverageText.textContent=`About ${money(c.emergencyGap)} more would reach the ${num(state.emergencyTargetMonths).toFixed(0)}-month target under the current essential-expense estimate.`;}
  }

  function baselineHistory(){return history.filter(h=>!h.monthExceptional);}
  function averageRecent(field,months=3){const arr=baselineHistory().slice(-months);if(!arr.length)return null;return arr.reduce((s,h)=>s+num(h.summary?.[field]),0)/arr.length;}
  function categoryBaseline(kind,name,months=3){
    const arr=baselineHistory().slice(-months);const vals=[];
    arr.forEach(h=>{const rows=h[kind]||[];const r=rows.find(x=>String(x.name).trim().toLowerCase()===String(name).trim().toLowerCase()&&!x.exceptional);if(r)vals.push(monthlyEquivalent(r.amount,r.frequency));});
    return vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:null;
  }
  function insights(){
    const c=calculate(); const out=[];
    if(c.remaining<0)out.push({type:'critical',kicker:'CASH-FLOW PRESSURE',title:`Planned outflows exceed income by ${money(Math.abs(c.remaining))}.`,body:'This is a planning signal rather than a judgement. Review timing, one-time items and adjustable categories to decide whether the shortfall is temporary or recurring.'});
    else out.push({type:'positive',kicker:'FREE CASH FLOW',title:`${money(c.remaining)} remains unassigned this month.`,body:`You can leave this as a buffer or direct some toward your selected priority: ${priorityLabel(state.priority)}.`});
    if(c.essential>0&&num(state.emergencyTargetMonths)>0){
      if(c.emergencyGap>0)out.push({type:'',kicker:'EMERGENCY RESERVE',title:`Your reserve covers about ${c.coverage.toFixed(1)} months of essentials.`,body:`Against your own ${num(state.emergencyTargetMonths).toFixed(0)}-month target, the modelled gap is ${money(c.emergencyGap)}.`});
      else out.push({type:'positive',kicker:'EMERGENCY RESERVE',title:`Your selected ${num(state.emergencyTargetMonths).toFixed(0)}-month target is covered.`,body:`The current reserve equals about ${c.coverage.toFixed(1)} months of the essential expenses entered here.`});
    }
    const avgFlex=averageRecent('flexible',3); if(avgFlex!==null&&avgFlex>0){const change=(c.flexible-avgFlex)/avgFlex*100;if(change>10)out.push({type:'warning',kicker:'SPENDING TREND',title:`Flexible spending is ${change.toFixed(0)}% above the recent non-exceptional average.`,body:`Current flexible spending is ${money(c.flexible)} versus a recent average of about ${money(avgFlex)}. Check whether the change reflects a deliberate choice or a new recurring pattern.`});}
    let candidate=null;
    state.flexible.filter(r=>!r.protected&&!r.exceptional).forEach(r=>{const b=categoryBaseline('flexible',r.name,3);const cur=monthlyEquivalent(r.amount,r.frequency);if(b!==null&&b>0&&cur>b*1.15){const increase=cur-b;if(!candidate||increase>candidate.increase)candidate={r,b,cur,increase};}});
    if(candidate)out.push({type:'warning',kicker:'CATEGORY CHANGE',title:`${candidate.r.name} is about ${money(candidate.increase)} above its recent baseline.`,body:`The current monthly equivalent is ${money(candidate.cur)} versus a recent non-exceptional average near ${money(candidate.b)}. This category is not protected, so it is a reasonable place to review before changing essential spending.`});
    const avgSave=averageRecent('saving',3);if(avgSave!==null){const delta=c.saving-avgSave;if(Math.abs(delta)>=Math.max(500,avgSave*.08))out.push({type:delta>0?'positive':'warning',kicker:'SAVINGS TREND',title:`Planned saving is ${delta>0?'up':'down'} ${money(Math.abs(delta))} versus the recent average.`,body:`Current planned savings and investments total ${money(c.saving)} per month. The recent non-exceptional average was about ${money(avgSave)}.`});}
    if(c.reserves>0)out.push({type:'',kicker:'IRREGULAR BILLS',title:`${money(c.reserves)} per month is reserved for quarterly or annual bills.`,body:'This amount is already included in the expense totals. Treating irregular bills as monthly reserves helps avoid a seemingly “surprise” expense when the actual bill arrives.'});
    return out.slice(0,6);
  }
  function priorityLabel(v){return ({buffer:'cash buffer',emergency:'emergency reserve',debt:'debt reduction',goal:'a life goal',investment:'recurring investment',retirement:'retirement',fi:'financial independence'})[v]||'your selected priority';}
  function renderInsights(){const arr=insights();els.insightGrid.innerHTML=arr.map(x=>`<article class="insight-card ${x.type||''}"><div class="insight-kicker">${escapeHtml(x.kicker)}</div><h3>${escapeHtml(x.title)}</h3><p>${escapeHtml(x.body)}</p></article>`).join('');}

  function summarySnapshot(){const c=calculate();return {income:c.income,essential:c.essential,flexible:c.flexible,saving:c.saving,reserves:c.reserves,remaining:c.remaining,savingsRate:c.savingsRate,coverage:c.coverage};}
  function snapshot(){return {...structuredClone(state),summary:summarySnapshot(),savedAt:new Date().toISOString(),region:L.getRegion(),currency:L.getCurrency()};}
  async function refreshHistory(){
    try{history=await S.listMonths();renderHistory();renderInsights();}catch(err){console.error(err);toast('Local history is not available in this browser.');}
  }
  function renderHistory(){
    const n=num(els.historyRange.value,3);const rows=history.slice(-n);els.historyTableBody.innerHTML=rows.length?rows.slice().reverse().map(h=>{const spend=num(h.summary?.essential)+num(h.summary?.flexible);return `<tr class="${h.monthExceptional?'exceptional-month':''}"><td><strong>${escapeHtml(h.month)}</strong>${h.monthExceptional?'<span class="month-note">Exceptional month</span>':h.monthNote?`<span class="month-note">${escapeHtml(h.monthNote)}</span>`:''}</td><td>${escapeHtml(money(h.summary?.income||0))}</td><td>${escapeHtml(money(spend))}</td><td>${escapeHtml(money(h.summary?.saving||0))}</td><td>${escapeHtml(money(h.summary?.remaining||0))}</td><td><button class="history-delete" type="button" data-delete-month="${escapeHtml(h.month)}">Delete</button></td></tr>`;}).join(''):'<tr><td colspan="6">No months saved yet. Save the current month to start a private history on this device.</td></tr>';
    renderTrend(rows);
  }
  function renderTrend(rows){
    if(!rows.length){els.trendChart.innerHTML='<div class="empty-row" style="width:100%;align-self:center">Save at least one month to build a trend.</div>';return;}
    const max=Math.max(1,...rows.flatMap(h=>[num(h.summary?.income),num(h.summary?.essential)+num(h.summary?.flexible),Math.max(0,num(h.summary?.remaining))]));
    const bars=rows.map(h=>{const income=num(h.summary?.income),spend=num(h.summary?.essential)+num(h.summary?.flexible),rem=Math.max(0,num(h.summary?.remaining));const hp=v=>Math.max(2,v/max*100);return `<div class="trend-column ${h.monthExceptional?'exceptional-month':''}"><div class="trend-bars"><i class="trend-bar income" style="height:${hp(income)}%" title="Income ${escapeHtml(money(income))}"></i><i class="trend-bar spending" style="height:${hp(spend)}%" title="Spending ${escapeHtml(money(spend))}"></i><i class="trend-bar remaining" style="height:${hp(rem)}%" title="Remaining ${escapeHtml(money(rem))}"></i></div><div class="trend-label">${escapeHtml(h.month.slice(5))}/${escapeHtml(h.month.slice(2,4))}</div></div>`;}).join('');
    els.trendChart.innerHTML=bars+`<div class="trend-legend" style="position:absolute;left:-9999px"></div>`;
    const legend=document.createElement('div');legend.className='trend-legend';legend.innerHTML='<span><i style="background:#6db5aa"></i>Income</span><span><i style="background:#d7a35a"></i>Spending</span><span><i style="background:#587fa0"></i>Remaining</span>';
    els.trendChart.parentElement.querySelector('.trend-legend')?.remove();els.trendChart.parentElement.appendChild(legend);
  }

  function bindLocale(){
    const regionEntries=Object.entries(L.regions).sort((a,b)=>{if(a[0]==='OTHER')return 1;if(b[0]==='OTHER')return -1;return a[1].label.localeCompare(b[1].label,'en',{sensitivity:'base'});});els.regionSelect.innerHTML=regionEntries.map(([k,v])=>`<option value="${k}">${escapeHtml(v.label)}</option>`).join('');
    els.currencySelect.innerHTML=Object.entries(L.currencies).map(([k,v])=>`<option value="${k}">${k} · ${escapeHtml(v.label)}</option>`).join('');
    function sync(){els.regionSelect.value=L.getRegion();els.currencySelect.value=L.getCurrency();els.localeCurrent.textContent=`${L.getProfile().label} · ${L.getCurrency()}`;document.querySelectorAll('.currency-prefix,.row-currency').forEach(el=>el.textContent=currencySymbol());const bi=els.primaryPayFrequency?.querySelector('option[value="biweekly"]');if(bi)bi.textContent=frequencyLabel('biweekly');const investmentName=L.getRegion()==='IN'?'SIP Calculator':'Recurring Investment Calculator';document.querySelectorAll('.investment-tool-link').forEach(a=>a.textContent=`${investmentName} →`);document.querySelectorAll('.footer-investment-link').forEach(a=>a.textContent=investmentName);renderRows();renderAll();}
    els.regionSelect.addEventListener('change',()=>{L.setRegion(els.regionSelect.value,{syncCurrency:true});});els.currencySelect.addEventListener('change',()=>L.setCurrency(els.currencySelect.value));byId('localeDone').addEventListener('click',()=>els.localeMenu.removeAttribute('open'));window.addEventListener('carrowmont:localechange',sync);sync();
  }

  function syncInputsFromState(){
    els.budgetMonth.value=state.month;els.primaryPayFrequency.value=state.primaryPayFrequency;els.nextPayday.value=state.nextPayday||'';els.availableCash.value=num(state.availableCash);els.emergencyCurrent.value=num(state.emergencyCurrent);els.emergencyTargetMonths.value=num(state.emergencyTargetMonths);els.priority.value=state.priority;els.monthNote.value=state.monthNote||'';els.monthExceptional.checked=!!state.monthExceptional;
    document.querySelectorAll('.view-btn').forEach(b=>b.classList.toggle('active',b.dataset.view===state.view));document.querySelectorAll('.paycycle-only').forEach(el=>el.classList.toggle('hidden',state.view!=='paycycle'));
  }
  function savePrefs(){S.savePreferences({view:state.view,month:state.month,primaryPayFrequency:state.primaryPayFrequency,nextPayday:state.nextPayday,availableCash:state.availableCash,emergencyCurrent:state.emergencyCurrent,emergencyTargetMonths:state.emergencyTargetMonths,priority:state.priority,monthNote:state.monthNote,monthExceptional:state.monthExceptional,incomes:state.incomes,essential:state.essential,flexible:state.flexible,savings:state.savings});}
  function updateRow(target,rerender=false){
    const row=target.closest('.entry-row');if(!row)return;const kind=row.dataset.kind,id=row.dataset.id;const collection=kind==='income'?state.incomes:kind==='essential'?state.essential:kind==='flexible'?state.flexible:state.savings;const item=collection.find(x=>x.id===id);if(!item)return;const f=target.dataset.field;if(!f)return;if(target.type==='checkbox')item[f]=target.checked;else if(f==='amount')item[f]=Math.max(0,num(target.value));else item[f]=target.value;
    const eq=row.querySelector('[data-monthly-equivalent]');if(eq)eq.value=money(monthlyEquivalent(item.amount,item.frequency));
    if(rerender)renderRows();renderAll();savePrefs();
  }
  function addRow(kind){
    if(kind==='income')state.incomes.push({id:uid(),name:'Other income',amount:0,frequency:'monthly'});
    else if(kind==='saving')state.savings.push({id:uid(),name:'Other saving',amount:0,frequency:'monthly'});
    else state[kind].push({id:uid(),name:kind==='essential'?'Other essential expense':'Other flexible expense',amount:0,frequency:'monthly',protected:false,exceptional:false,dueDate:''});
    renderRows();renderAll();savePrefs();
  }
  function deleteRow(btn){const row=btn.closest('.entry-row');if(!row)return;const kind=row.dataset.kind,id=row.dataset.id,key=kind==='income'?'incomes':kind==='saving'?'savings':kind;state[key]=state[key].filter(x=>x.id!==id);renderRows();renderAll();savePrefs();}
  function renderAll(){renderSummary();renderInsights();}
  function toast(msg){const t=byId('toast');t.textContent=msg;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),2600);}
  function downloadJson(obj,filename){const blob=new Blob([JSON.stringify(obj,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);}

  function copySummary(){const c=calculate();const lines=[
    'Carrowmont Budget & Cash Flow Summary',`Month: ${state.month}`,`Country / currency: ${L.getProfile().label} · ${L.getCurrency()}`,
    `Monthly income: ${money(c.income)}`,`Essential expenses: ${money(c.essential)}`,`Flexible expenses: ${money(c.flexible)}`,`Savings & investments: ${money(c.saving)}`,`Irregular-bill reserves: ${money(c.reserves)}`,`Money remaining: ${money(c.remaining)}`,`Savings rate: ${c.savingsRate.toFixed(1)}%`,`Emergency reserve coverage: ${c.coverage.toFixed(1)} months`,`Selected emergency target: ${num(state.emergencyTargetMonths).toFixed(0)} months`,'','Educational planning illustration. Not individualized financial advice.'
  ];navigator.clipboard?.writeText(lines.join('\n')).then(()=>toast('Summary copied.')).catch(()=>toast('Could not copy automatically.'));}

  function reportModel(){const c=calculate();return {generatedAt:new Date(),region:L.getRegion(),country:L.getProfile().label,currency:L.getCurrency(),month:state.month,state:structuredClone(state),summary:c,insights:insights(),history:history.slice(-12)};}
  async function generateReport(){try{const R=window.CarrowmontBudgetPdfRenderer;if(!R)throw new Error('Budget report renderer is unavailable.');await R.download(reportModel());const st=byId('reportDownloadStatus');if(st)st.textContent='Report has been downloaded.';toast('Budget report generated.');}catch(err){console.error(err);toast('Could not generate the report.');}}

  async function saveCurrentMonth(){try{state.month=els.budgetMonth.value||state.month;await S.saveMonth(snapshot());els.saveStatus.textContent=`Saved ${state.month} on this device.`;await refreshHistory();toast('Month saved locally.');}catch(err){console.error(err);els.saveStatus.textContent='Could not save this month.';}}
  async function loadMonthIfSaved(month){try{const found=await S.getMonth(month);if(found){state=normalizeState(found);syncInputsFromState();renderRows();renderAll();toast(`Loaded saved month ${month}.`);}else{state.month=month;savePrefs();renderAll();}}catch(err){console.error(err);}}

  function bindEvents(){
    document.addEventListener('input',e=>{if(e.target.closest('.entry-row'))return updateRow(e.target,false);const id=e.target.id;if(id==='availableCash')state.availableCash=num(e.target.value);else if(id==='emergencyCurrent')state.emergencyCurrent=Math.max(0,num(e.target.value));else if(id==='emergencyTargetMonths')state.emergencyTargetMonths=clamp(num(e.target.value),0,36);else if(id==='monthNote')state.monthNote=e.target.value;else return;renderAll();savePrefs();});
    document.addEventListener('change',e=>{if(e.target.closest('.entry-row'))return updateRow(e.target,e.target.dataset.field==='frequency');const id=e.target.id;if(id==='budgetMonth'){loadMonthIfSaved(e.target.value);return;}if(id==='primaryPayFrequency'){state.primaryPayFrequency=e.target.value;if(!state.nextPayday){state.nextPayday=defaultNextPayday(state.primaryPayFrequency);els.nextPayday.value=state.nextPayday;}}else if(id==='nextPayday')state.nextPayday=e.target.value;else if(id==='priority')state.priority=e.target.value;else if(id==='monthExceptional')state.monthExceptional=e.target.checked;else if(id==='historyRange'){renderHistory();return;}else return;renderAll();savePrefs();});
    document.addEventListener('click',e=>{const add=e.target.closest('.add-row');if(add){addRow(add.dataset.kind);return;}const del=e.target.closest('.delete-row');if(del){deleteRow(del);return;}const hist=e.target.closest('[data-delete-month]');if(hist){if(confirm(`Delete saved month ${hist.dataset.deleteMonth}?`))S.deleteMonth(hist.dataset.deleteMonth).then(refreshHistory);return;}});
    document.querySelectorAll('.view-btn').forEach(btn=>btn.addEventListener('click',()=>{state.view=btn.dataset.view;syncInputsFromState();renderAll();savePrefs();}));
    byId('saveMonthBtn').addEventListener('click',saveCurrentMonth);byId('refreshHistoryBtn').addEventListener('click',refreshHistory);byId('copyBtn').addEventListener('click',copySummary);byId('reportBtn').addEventListener('click',generateReport);
    byId('exportBtn').addEventListener('click',async()=>{try{downloadJson(await S.exportAll(),`carrowmont-budget-backup-${isoMonth(new Date())}.json`);toast('Budget backup exported.');}catch(err){console.error(err);toast('Could not export budget data.');}});
    byId('importFile').addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;try{const data=JSON.parse(await f.text());await S.importAll(data);const pref=S.loadPreferences();if(pref)state=normalizeState(pref);syncInputsFromState();renderRows();renderAll();await refreshHistory();toast('Budget data restored.');}catch(err){console.error(err);toast(err.message||'Could not restore this backup.');}finally{e.target.value='';}});
    byId('loadDefaultsBtn').addEventListener('click',()=>{state=structuredClone(DEFAULTS);state.month=els.budgetMonth.value||isoMonth(today);state.nextPayday=defaultNextPayday(state.primaryPayFrequency);syncInputsFromState();renderRows();renderAll();savePrefs();toast('Example budget loaded.');});
    byId('resetBtn').addEventListener('click',()=>{if(!confirm('Reset the current unsaved planner entries? Saved month history will not be deleted.'))return;state=normalizeState({month:els.budgetMonth.value||isoMonth(today),primaryPayFrequency:L.getProfile().contributionFrequency||'monthly',nextPayday:'',availableCash:0,emergencyCurrent:0,emergencyTargetMonths:6,priority:'buffer',incomes:[],essential:[],flexible:[],savings:[]});syncInputsFromState();renderRows();renderAll();savePrefs();toast('Current planner reset.');});
    els.localeMenu.addEventListener('toggle',()=>{});
  }

  async function init(){
    const pref=S.loadPreferences();state=normalizeState(pref||DEFAULTS);if(!state.primaryPayFrequency||!FREQ[state.primaryPayFrequency])state.primaryPayFrequency=L.getProfile().contributionFrequency||'monthly';if(!state.nextPayday)state.nextPayday=defaultNextPayday(state.primaryPayFrequency);
    bindLocale();syncInputsFromState();renderRows();bindEvents();renderAll();await refreshHistory();
  }
  init();
})();
