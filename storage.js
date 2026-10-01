(() => {
  'use strict';

  const DB_NAME = 'carrowmont_budget_v1';
  const DB_VERSION = 1;
  const STORE = 'months';
  const PREF_KEY = 'carrowmont_budget_preferences_v1';

  function openDb(){
    return new Promise((resolve,reject)=>{
      if(!('indexedDB' in window)){ reject(new Error('IndexedDB is not available in this browser.')); return; }
      const req=indexedDB.open(DB_NAME,DB_VERSION);
      req.onupgradeneeded=()=>{
        const db=req.result;
        if(!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE,{keyPath:'month'});
      };
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error||new Error('Could not open local budget storage.'));
    });
  }
  async function tx(mode,fn){
    const db=await openDb();
    try{
      return await new Promise((resolve,reject)=>{
        const t=db.transaction(STORE,mode); const store=t.objectStore(STORE);
        let result;
        try{ result=fn(store); }catch(err){ reject(err); return; }
        t.oncomplete=()=>resolve(result);
        t.onerror=()=>reject(t.error||new Error('Budget storage operation failed.'));
        t.onabort=()=>reject(t.error||new Error('Budget storage operation was cancelled.'));
      });
    }finally{ db.close(); }
  }
  async function saveMonth(snapshot){
    const copy=structuredClone(snapshot); copy.savedAt=new Date().toISOString();
    await tx('readwrite',store=>store.put(copy)); return copy;
  }
  async function deleteMonth(month){ await tx('readwrite',store=>store.delete(month)); }
  async function listMonths(){
    const db=await openDb();
    try{
      return await new Promise((resolve,reject)=>{
        const t=db.transaction(STORE,'readonly'); const req=t.objectStore(STORE).getAll();
        req.onsuccess=()=>resolve((req.result||[]).sort((a,b)=>String(a.month).localeCompare(String(b.month))));
        req.onerror=()=>reject(req.error||new Error('Could not read budget history.'));
      });
    }finally{db.close();}
  }
  async function getMonth(month){
    const db=await openDb();
    try{
      return await new Promise((resolve,reject)=>{const req=db.transaction(STORE,'readonly').objectStore(STORE).get(month);req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error);});
    }finally{db.close();}
  }
  function savePreferences(value){ try{localStorage.setItem(PREF_KEY,JSON.stringify(value));}catch(_){} }
  function loadPreferences(){ try{return JSON.parse(localStorage.getItem(PREF_KEY)||'null');}catch(_){return null;} }
  async function exportAll(){ return {schemaVersion:1,exportedAt:new Date().toISOString(),preferences:loadPreferences(),months:await listMonths()}; }
  async function importAll(payload){
    if(!payload||payload.schemaVersion!==1||!Array.isArray(payload.months)) throw new Error('This is not a supported Carrowmont budget backup.');
    const db=await openDb();
    try{
      await new Promise((resolve,reject)=>{
        const t=db.transaction(STORE,'readwrite'); const store=t.objectStore(STORE);
        payload.months.forEach(m=>{ if(m&&/^\d{4}-\d{2}$/.test(m.month||'')) store.put(m); });
        t.oncomplete=resolve; t.onerror=()=>reject(t.error||new Error('Could not restore budget data.'));
      });
    }finally{db.close();}
    if(payload.preferences) savePreferences(payload.preferences);
  }
  async function clearAll(){
    const db=await openDb();
    try{await new Promise((resolve,reject)=>{const t=db.transaction(STORE,'readwrite');t.objectStore(STORE).clear();t.oncomplete=resolve;t.onerror=()=>reject(t.error);});}
    finally{db.close();}
  }

  window.CarrowmontBudgetStorage={saveMonth,deleteMonth,listMonths,getMonth,savePreferences,loadPreferences,exportAll,importAll,clearAll};
})();
