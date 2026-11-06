(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  else root.CarrowmontBudgetCore=api;
})(typeof self!=='undefined'?self:this,function(){
  'use strict';

  const VERSION='BUDGET-CORE-1.0';
  const FREQ=Object.freeze({
    weekly:Object.freeze({label:'Weekly',perMonth:52/12,days:7}),
    biweekly:Object.freeze({label:'Every 2 Weeks',perMonth:26/12,days:14}),
    semimonthly:Object.freeze({label:'Twice Monthly',perMonth:2,days:365.2425/24}),
    fourweekly:Object.freeze({label:'Every 4 Weeks',perMonth:13/12,days:28}),
    monthly:Object.freeze({label:'Monthly',perMonth:1,days:365.2425/12}),
    quarterly:Object.freeze({label:'Quarterly',perMonth:1/3,days:365.2425/4}),
    annual:Object.freeze({label:'Annual',perMonth:1/12,days:365.2425}),
    irregular:Object.freeze({label:'Irregular / Monthly Average',perMonth:1,days:null})
  });
  const num=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
  function monthlyEquivalent(amount,frequency){return Math.max(0,num(amount))* (FREQ[frequency]?.perMonth || 1);}
  function perCycleFromMonthly(monthly,frequency){const p=FREQ[frequency]?.perMonth||1;return p>0?monthly/p:monthly;}
  function irregularReserve(rows=[]){return rows.filter(r=>!['weekly','biweekly','semimonthly','fourweekly','monthly','irregular'].includes(r.frequency)).reduce((sum,r)=>sum+monthlyEquivalent(r.amount,r.frequency),0);}
  function sumRows(rows=[]){return rows.reduce((sum,r)=>sum+monthlyEquivalent(r.amount,r.frequency),0);}
  function calculate(s={}){
    const incomes=Array.isArray(s.incomes)?s.incomes:[],essentialRows=Array.isArray(s.essential)?s.essential:[],flexibleRows=Array.isArray(s.flexible)?s.flexible:[],savingRows=Array.isArray(s.savings)?s.savings:[];
    const income=sumRows(incomes), essential=sumRows(essentialRows), flexible=sumRows(flexibleRows), saving=sumRows(savingRows);
    const reserves=irregularReserve([...essentialRows,...flexibleRows]);
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
  return Object.freeze({VERSION,FREQ,monthlyEquivalent,perCycleFromMonthly,irregularReserve,sumRows,calculate});
});
