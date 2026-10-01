(() => {
  'use strict';
  const P=()=>window.CarrowmontPdfExport;
  const RS=()=>window.CarrowmontReportStandard;
  const L=()=>window.CarrowmontLocale;
  const W=794,H=1123,M=40,CW=W-M*2;
  const C={ink:'#102945',navy:'#123f5f',teal:'#0e827a',tealDark:'#08736c',muted:'#4c6379',line:'#d6e1e6',pale:'#e9f7f4',amber:'#fff3de',red:'#fff0f0',white:'#fff',light:'#f8fbfc'};
  function page(){return P().createPage({width:W,height:H,scale:2.25,background:'#fff'});}
  function money(v){return L().formatMoney(v,{maximumFractionDigits:0});}
  function pct(v){return `${Number(v||0).toFixed(1)}%`;}
  function card(ctx,x,y,w,h,fill=C.white,stroke=C.line,r=10){P().roundRect(ctx,x,y,w,h,r,fill,stroke,1);}
  function line(ctx,x1,x2,y,color=C.line,w=1){P().line(ctx,x1,y,x2,y,color,w);}
  function footer(ctx,right='Budget & Cash Flow Planner · carrowmont.com'){P().text(ctx,'CARROWMONT',M,H-34,{size:9.5,weight:900,color:C.teal});P().text(ctx,right,W-M,H-34,{size:8.7,weight:500,color:C.muted,align:'right'});}
  function title(ctx,model,sub){P().text(ctx,'CARROWMONT',M,48,{size:13,weight:900,color:C.teal});P().text(ctx,'Budget & Cash Flow Report',M,80,{size:28,weight:900,color:C.ink});P().text(ctx,sub||`Budget month ${model.month}`,M,101,{size:10.5,weight:600,color:C.muted});P().text(ctx,`${model.country} · ${model.currency}`,W-M,48,{size:9.5,weight:750,color:C.ink,align:'right'});P().text(ctx,new Intl.DateTimeFormat(L().getLocale(),{dateStyle:'medium'}).format(model.generatedAt),W-M,68,{size:9,weight:500,color:C.muted,align:'right'});line(ctx,M,W-M,126,C.navy,2);}
  function metric(ctx,x,y,w,label,value,fill=C.white,valueColor=C.ink){card(ctx,x,y,w,68,fill,C.line,9);P().wrappedText(ctx,label,x+11,y+18,w-22,{size:8.7,lineHeight:11,weight:600,color:C.muted,maxLines:2});P().text(ctx,value,x+11,y+52,{size:15.5,weight:900,color:valueColor});}
  function rowTable(ctx,rows,x,y,w,opts={}){const labelW=w*.58;let yy=y;rows.forEach((r,i)=>{const h=opts.rowH||29;if(i%2===1){ctx.fillStyle='#fbfdfe';ctx.fillRect(x,yy,w,h);}P().wrappedText(ctx,String(r.label),x+7,yy+18,labelW-14,{size:8.8,lineHeight:10.7,weight:600,color:C.muted,maxLines:2});P().text(ctx,String(r.value),x+w-7,yy+18,{size:9,weight:850,color:opts.lastTeal&&i===rows.length-1?C.tealDark:C.ink,align:'right'});line(ctx,x,x+w,yy+h,C.line,1);yy+=h;});return yy;}
  function summarizeRows(rows){return (rows||[]).map(r=>({label:r.name,value:`${money(Number(r.amount||0))} · ${r.frequency||'monthly'}`}));}
  function topInsights(model){return (model.insights||[]).slice(0,4).map(i=>({title:i.title,body:i.body}));}

  function summaryPage(model){
    const pg=page(),ctx=pg.ctx,s=model.summary,st=model.state;title(ctx,model,'Monthly cash-flow summary');
    const heroY=154;card(ctx,M,heroY,CW,128,s.remaining<0?'#7e3737':C.navy,null,14);P().text(ctx,'MONEY REMAINING',M+18,heroY+28,{size:9.5,weight:900,color:'#dbe8ef'});P().text(ctx,money(s.remaining),M+18,heroY+75,{size:34,weight:900,color:C.white});P().wrappedText(ctx,s.remaining<0?'Planned spending, reserves, savings and investments exceed entered income.':'After planned spending, reserves, savings and investments.',M+18,heroY+99,410,{size:9.5,lineHeight:13,weight:500,color:'#dbe8ef',maxLines:2});
    const rx=M+470;card(ctx,rx,heroY+18,CW-488,92,C.pale,'#b8ddd8',11);P().text(ctx,'Savings rate',rx+14,heroY+43,{size:9.5,weight:700,color:C.muted});P().text(ctx,pct(s.savingsRate),rx+14,heroY+79,{size:27,weight:900,color:C.tealDark});
    const gap=9,col=(CW-gap*2)/3,y=305;metric(ctx,M,y,col,'Monthly income',money(s.income));metric(ctx,M+col+gap,y,col,'Essential expenses',money(s.essential));metric(ctx,M+(col+gap)*2,y,col,'Flexible expenses',money(s.flexible));
    metric(ctx,M,y+78,col,'Savings & investments',money(s.saving),C.pale,C.tealDark);metric(ctx,M+col+gap,y+78,col,'Irregular-bill reserves',money(s.reserves),C.amber);metric(ctx,M+(col+gap)*2,y+78,col,'Emergency coverage',`${s.coverage.toFixed(1)} months`);
    P().text(ctx,'PAY-CYCLE VIEW',M,y+176,{size:9,weight:900,color:C.tealDark});const cy=y+190;card(ctx,M,cy,CW,112,C.light,C.line,10);const cw=CW/4;[['Typical income / cycle',money(s.cycleIncome)],['Essential / cycle',money(s.cycleEssential)],['Savings / cycle',money(s.cycleSaving)],['Cash-flow room / cycle',money(s.cycleRoom)]].forEach((d,i)=>{if(i)P().line(ctx,M+i*cw,cy+14,M+i*cw,cy+98,C.line,1);P().wrappedText(ctx,d[0],M+i*cw+10,cy+35,cw-20,{size:8.4,lineHeight:10.4,weight:600,color:C.muted,maxLines:2});P().text(ctx,d[1],M+i*cw+10,cy+76,{size:12.5,weight:900,color:C.ink});});
    P().text(ctx,'EMERGENCY RESERVE',M,cy+144,{size:9,weight:900,color:C.tealDark});const ey=cy+159;card(ctx,M,ey,CW,88,C.pale,'#c4e2dd',10);P().text(ctx,`${money(st.emergencyCurrent)} current reserve`,M+14,ey+31,{size:14.5,weight:900,color:C.ink});P().wrappedText(ctx,`Your selected target is ${Number(st.emergencyTargetMonths||0).toFixed(0)} months of essential expenses. Under the current entries, the modelled gap is ${money(s.emergencyGap)}.`,M+14,ey+55,CW-28,{size:9.2,lineHeight:12.5,weight:500,color:C.muted,maxLines:2});
    P().text(ctx,'DETERMINISTIC INSIGHTS',M,ey+130,{size:9,weight:900,color:C.tealDark});let iy=ey+145;topInsights(model).forEach((ins,i)=>{const h=64;card(ctx,M,iy,CW,h,i===0&&s.remaining<0?C.red:'#fff',C.line,9);P().wrappedText(ctx,ins.title,M+12,iy+20,CW-24,{size:10.2,lineHeight:12.8,weight:850,color:C.ink,maxLines:2});P().wrappedText(ctx,ins.body,M+12,iy+46,CW-24,{size:8.5,lineHeight:11,weight:500,color:C.muted,maxLines:2});iy+=h+8;});footer(ctx);return pg.canvas;
  }

  function detailPage(model){
    const pg=page(),ctx=pg.ctx,st=model.state;title(ctx,model,'Income, spending and saving detail');
    let y=150;const section=(name,rows)=>{P().text(ctx,name,M,y,{size:14.5,weight:900,color:C.ink});line(ctx,M,W-M,y+12,'#c5d2d8',1);y+=24;if(!rows.length){P().text(ctx,'No entries',M+6,y+18,{size:9,color:C.muted});y+=34;return;}const mapped=rows.map(r=>({label:`${r.name}${r.exceptional?' · exceptional':''}${r.protected?' · protected':''}`,value:`${money(Number(r.amount||0))} · ${String(r.frequency||'monthly').replace('biweekly','every 2 weeks').replace('semimonthly','twice monthly').replace('fourweekly','every 4 weeks')}`}));y=rowTable(ctx,mapped,M,y,CW,{rowH:30})+22;};
    section('Income',st.incomes||[]);section('Essential & committed expenses',st.essential||[]);section('Flexible & lifestyle expenses',st.flexible||[]);section('Savings & investments',st.savings||[]);
    if(y>H-150){footer(ctx);return pg.canvas;}card(ctx,M,y,CW,72,C.light,C.line,10);P().text(ctx,'Month note',M+12,y+22,{size:9,weight:900,color:C.tealDark});P().wrappedText(ctx,st.monthNote||'No note entered.',M+12,y+43,CW-24,{size:9,lineHeight:12,weight:500,color:C.muted,maxLines:2});P().text(ctx,st.monthExceptional?'This whole month is marked exceptional for baseline comparisons.':'This month is included in normal baseline comparisons.',M+12,y+63,{size:8.5,weight:650,color:C.muted});footer(ctx);return pg.canvas;
  }

  function historyPage(model){
    const pg=page(),ctx=pg.ctx;title(ctx,model,'Saved history and comparison context');
    let y=150;P().wrappedText(ctx,'Saved history remains on this browser/device unless it is exported and restored elsewhere. Exceptional months remain visible but are not treated as the normal comparison baseline by the planner.',M,y,CW,{size:10,lineHeight:14,weight:500,color:C.muted,maxLines:3});y+=58;
    const hist=(model.history||[]).slice(-12);P().text(ctx,'RECENT MONTHS',M,y,{size:9,weight:900,color:C.tealDark});y+=18;if(!hist.length){card(ctx,M,y,CW,70,C.light,C.line,10);P().text(ctx,'No saved history yet.',M+14,y+29,{size:11,weight:850,color:C.ink});P().text(ctx,'Save monthly records in the planner to build 3-, 6- and 12-month comparisons.',M+14,y+50,{size:9,color:C.muted});y+=90;}else{const rows=hist.map(h=>({label:`${h.month}${h.monthExceptional?' · exceptional':''}`,value:`Income ${money(h.summary?.income||0)} · Remaining ${money(h.summary?.remaining||0)}`}));y=rowTable(ctx,rows,M,y,CW,{rowH:31})+22;}
    P().text(ctx,'HOW CARROWMONT TREATS THE DATA',M,y,{size:9,weight:900,color:C.tealDark});y+=18;const notes=[['Monthly equivalents','Weekly, every-two-weeks, twice-monthly, four-weekly, quarterly and annual amounts are converted to monthly equivalents for comparison.'],['Irregular items','When “Irregular / Monthly Average” is selected, the amount entered is treated as the monthly average supplied by the user.'],['Irregular-bill reserves','Quarterly and annual expenses are represented as monthly reserves and are already included in expense totals.'],['Protected categories','Protected categories stay visible but are not candidates for spending-reduction observations.'],['Exceptional records','Exceptional categories and months remain in history but are excluded from the normal comparison baseline.']];
    y=rowTable(ctx,notes.map(n=>({label:n[0],value:n[1]})),M,y,CW,{rowH:48});footer(ctx);return pg.canvas;
  }

  async function download(model){
    const canvases=[summaryPage(model),detailPage(model),historyPage(model)];
    if(RS()){
      canvases.push(RS().guidePage({reportTitle:'Budget & Cash Flow Report',preparedFrom:'Prepared from the Carrowmont Budget & Cash Flow Planner',howToRead:'Start with money remaining and the monthly breakdown, then review pay-cycle context, emergency-reserve coverage and the detailed categories. History-based observations depend on the records saved on this device.',methodology:[{label:'Cash-flow basis',body:'Income, expenses and savings are converted to monthly equivalents using the frequency selected for each item.'},{label:'Irregular bills',body:'Quarterly and annual expenses are translated into monthly reserves so they are visible before the actual bill arrives.'},{label:'History baseline',body:'Months or categories marked exceptional stay visible but are excluded from the normal comparison baseline.'}],terminology:[{label:'Essential expenses',body:'Committed or necessary spending entered by the user.'},{label:'Flexible expenses',body:'Lifestyle or adjustable spending entered by the user.'},{label:'Money remaining',body:'Income minus essential expenses, flexible expenses and planned savings/investments.'},{label:'Savings rate',body:'Planned savings and investments divided by monthly-equivalent income.'}],assumptions:'The planner uses user-entered values and does not prescribe a universal budgeting ratio or emergency-fund target.',methodologyMeta:'Budget & Cash Flow Planner methodology v1.0',methodologyUrl:'carrowmont.com/budget-cash-flow-planner/#methodology'}));
      canvases.push(RS().continuePlanningPage({currentTool:'budget',intro:'Use your current cash-flow picture as a starting point for goal funding, recurring investment, retirement and financial-independence planning.'}));
    }
    return P().downloadCanvases(canvases,{filename:`carrowmont-budget-cash-flow-report-${model.month}.pdf`,quality:.93});
  }
  window.CarrowmontBudgetPdfRenderer={download};
})();
