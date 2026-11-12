(() => {
  'use strict';

  const HISTORY_KEY = 'carrowmont_budget_session_months_v1';
  const PREF_KEY = 'carrowmont_budget_session_preferences_v1';
  const readJson=(key,fallback)=>{try{return JSON.parse(sessionStorage.getItem(key)||'null')??fallback;}catch(_){return fallback;}};
  const writeJson=(key,value)=>{try{sessionStorage.setItem(key,JSON.stringify(value));return true;}catch(_){return false;}};
  const readMonths=()=>{const value=readJson(HISTORY_KEY,{});return value&&typeof value==='object'&&!Array.isArray(value)?value:{};};

  async function saveMonth(snapshot){
    const copy=structuredClone(snapshot);copy.savedAt=new Date().toISOString();const months=readMonths();months[copy.month]=copy;if(!writeJson(HISTORY_KEY,months))throw new Error('Could not save this session month.');return copy;
  }
  async function deleteMonth(month){const months=readMonths();delete months[month];writeJson(HISTORY_KEY,months);}
  async function listMonths(){return Object.values(readMonths()).sort((a,b)=>String(a.month).localeCompare(String(b.month)));}
  async function getMonth(month){return readMonths()[month]||null;}
  function savePreferences(value){writeJson(PREF_KEY,value);}
  function loadPreferences(){return readJson(PREF_KEY,null);}
  async function exportAll(){return {schemaVersion:2,storageScope:'browser-session',exportedAt:new Date().toISOString(),preferences:loadPreferences(),months:await listMonths()};}
  async function importAll(payload){
    if(!payload||![1,2].includes(payload.schemaVersion)||!Array.isArray(payload.months))throw new Error('This is not a supported Carrowmont budget backup.');
    const months={};payload.months.forEach(m=>{if(m&&/^\d{4}-\d{2}$/.test(m.month||''))months[m.month]=m;});writeJson(HISTORY_KEY,months);if(payload.preferences)savePreferences(payload.preferences);
  }
  async function clearAll(){try{sessionStorage.removeItem(HISTORY_KEY);sessionStorage.removeItem(PREF_KEY);}catch(_){}}

  window.CarrowmontBudgetStorage={saveMonth,deleteMonth,listMonths,getMonth,savePreferences,loadPreferences,exportAll,importAll,clearAll};
})();
