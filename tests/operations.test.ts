import {test} from "node:test";
import assert from "node:assert/strict";
import {loadCampaignWorkspace,newCampaignDraft,evaluateCampaign} from "../lib/campaign-service";
import {saveCampaign,changeCampaignStatus,readCampaignStore,duplicateDraft,deleteDraft,persistCampaignDraft} from "../lib/campaign-store";
import {loadOperations,rulePreview,matchesConditions,monitorCampaign} from "../lib/operations-engine";
import {campaignHealth} from "../lib/operations-health";
import {guardBudget} from "../lib/operations-guardrail";
import {defaultGuardrail,defaultTarget} from "../data/mock/operations-config";
import {readOperations,saveControls,validRule,markAlertRead} from "../lib/operations-store";
import {applyOperation,rollbackOperation,saveAutomationRule} from "../lib/operations-history";
import {saveNamedSimulation,readSimulationLibrary,duplicateSimulation,deleteSimulation} from "../lib/simulation-library";
import {campaignPlan,exportCampaignPlan} from "../lib/export-service";
import {loadCampaignPlans} from "../lib/campaign-library";
import {scenarios} from "../data/mock/simulation-config";
import type {AutomationRule,OperationMetrics} from "../types/operations";
const metrics:OperationMetrics={spend:100000,purchases:10,revenue:500000,cpa:10000,roas:500,ctr:3,cvr:10,frequency:2,audienceRemaining:60,dailyBudgetUsage:50,impressions:10000,clicks:300,reach:5000};
async function setup(){const ctx=await loadCampaignWorkspace({advertiserId:"brand-a",period:30}),d=newCampaignDraft(ctx,{from:"Campaign Studio",segmentId:"cart-14d",window:14,recommendedBudgetChange:0,createdAt:new Date().toISOString()});const c=saveCampaign(d,evaluateCampaign(d,ctx),ctx.advertiser.name,true);return {ctx,c:changeCampaignStatus("brand-a",c.id,"MOCK ACTIVE")};}
const rule=(id:string):AutomationRule=>({id:crypto.randomUUID(),advertiserId:"brand-a",campaignId:id,name:"AND Scale Rule",conditions:[{metric:"spend",operator:">=",value:0},{metric:"frequency",operator:"<",value:5}],action:{type:"Increase Budget",value:15},enabled:true,createdAt:new Date().toISOString()});

test("운영 Health 5종은 목표와 관측값으로 판정하며 0 구매를 과장하지 않는다",()=>{
  assert.equal(campaignHealth(metrics,defaultTarget,500,defaultGuardrail).health,"HEALTHY");
  assert.equal(campaignHealth({...metrics,roas:350},defaultTarget,500,defaultGuardrail).health,"WATCH");
  assert.equal(campaignHealth({...metrics,roas:300},defaultTarget,500,defaultGuardrail).health,"ACTION REQUIRED");
  assert.equal(campaignHealth(metrics,defaultTarget,0,defaultGuardrail).health,"LIMITED");
  assert.equal(campaignHealth({...metrics,frequency:6},defaultTarget,500,defaultGuardrail).health,"LIMITED");
  assert.equal(campaignHealth({...metrics,purchases:0,cpa:null},defaultTarget,500,defaultGuardrail).health,"LEARNING");
});
test("AND / 비교 연산 및 잘못된 Rule을 안전하게 처리한다",()=>{
  const r=rule("c");assert.ok(validRule(r));assert.ok(matchesConditions(r.conditions,metrics));
  assert.equal(matchesConditions([...r.conditions,{metric:"roas",operator:">",value:600}],metrics),false);
  for(const value of [-1,NaN,Infinity])assert.equal(validRule({...r,conditions:[{metric:"roas",operator:">",value}]}),false);
  assert.equal(matchesConditions([{metric:"cpa",operator:"<=",value:50000}],{...metrics,cpa:null}),false);
  assert.equal(validRule({...r,conditions:[]}),false);
  assert.equal(validRule({...r,action:{type:"Window Change",value:8}}),false);
});
test("예산 상하한·1회 증액·Audience·Frequency Guardrail을 강제한다",()=>{
  const g={...defaultGuardrail,minDaily:10000,maxDaily:100000,maxIncrease:20};
  assert.equal(guardBudget({type:"Increase Budget",value:50},50000,500,metrics,g).daily,60000);
  assert.equal(guardBudget({type:"Increase Budget",value:15},99000,500,metrics,g).daily,100000);
  assert.equal(guardBudget({type:"Decrease Budget",value:99},50000,500,metrics,g).daily,10000);
  assert.equal(guardBudget({type:"Increase Budget",value:15},50000,99,metrics,g).allowed,false);
  assert.equal(guardBudget({type:"Increase Budget",value:15},50000,500,{...metrics,frequency:6},g).allowed,false);
  assert.equal(guardBudget({type:"Increase Budget",value:15},-50,500,metrics,g).allowed,false);
});
test("Mock Apply는 재검증·버전·이력·중복 방지를 보장하고 Rollback은 상태를 복원한다",async()=>{
  const {c,ctx}=await setup(),r=rule(c.id);saveAutomationRule(r);
  const w=await loadOperations("brand-a",30),rec=w.recommendations.find(item=>item.rule.id===r.id)!;
  assert.ok(rec.preview.allowed);
  const result=await Promise.allSettled([applyOperation("brand-a",rec,30),applyOperation("brand-a",rec,30)]);
  assert.equal(result.filter(r=>r.status==="fulfilled").length,1);
  const change=readOperations("brand-a").history.find(h=>h.campaignId===c.id)!;
  assert.equal(change.after.budget.daily,Math.round(c.budget.daily*1.15));assert.equal(change.status,"APPLIED IN MOCK");
  assert.ok(readCampaignStore("brand-a").versions.filter(v=>v.campaignId===c.id).length>=3);
  const restored=rollbackOperation("brand-a",change.id);assert.equal(restored.after.budget.daily,c.budget.daily);assert.equal(restored.type,"ROLLBACK");
  assert.throws(()=>rollbackOperation("brand-a",change.id));
  const invalid=rulePreview({...r,action:{type:"Increase Budget",value:15}},{...c,audienceSize:0},metrics,defaultGuardrail,ctx);assert.equal(invalid.allowed,false);
  await assert.rejects(()=>applyOperation("brand-b",rec,30));
});
test("감액·중지·재개·소재·Audience·Window·Notify Preview 및 삭제 참조를 처리한다",async()=>{
  const {c,ctx}=await setup(),r=rule(c.id),m=monitorCampaign(c,30);
  for(const action of [{type:"Decrease Budget" as const,value:10},{type:"Pause" as const,value:0},{type:"Creative Refresh" as const,value:0},{type:"Window Change" as const,value:7},{type:"Audience Expand" as const,value:0},{type:"Notify Only" as const,value:0}]){
    const p=rulePreview({...r,action},c,m,defaultGuardrail,ctx);assert.ok(p.valid);assert.ok(p.matched);assert.ok(Number.isFinite(p.forecast.revenue));
    if(action.type==="Decrease Budget")assert.ok(p.after.budget.daily<c.budget.daily);
    if(action.type==="Pause"){assert.equal(p.after.status,"PAUSED");assert.equal(p.forecast.purchases,0);}
    if(action.type==="Creative Refresh")assert.notEqual(p.after.message.headline,c.message.headline);
  }
  assert.ok(rulePreview({...r,action:{type:"Resume",value:0}},{...c,status:"PAUSED"},m,defaultGuardrail,ctx).allowed);
  assert.throws(()=>saveAutomationRule({...r,campaignId:"deleted"}));
  assert.throws(()=>saveControls("brand-a","deleted",defaultTarget,defaultGuardrail));
  assert.throws(()=>saveControls("brand-a",c.id,{cpa:NaN,roas:400},defaultGuardrail));
  const alerts=(await loadOperations("brand-a",30)).store.alerts;assert.ok(alerts.length);markAlertRead("brand-a",alerts[0].id);assert.equal(readOperations("brand-a").alerts[0].read,true);assert.equal(readOperations("brand-b").alerts.length,0);
});
test("여러 초안과 named Simulation은 복제·삭제·비교용 스냅샷을 분리 보관한다",async()=>{
  const {ctx}=await setup(),d=newCampaignDraft(ctx);persistCampaignDraft(d);const copy=duplicateDraft(d);
  assert.notEqual(copy.draftId,d.draftId);assert.ok(readCampaignStore("brand-a").drafts.some(x=>x.draftId===d.draftId));
  deleteDraft("brand-a",copy.draftId);assert.equal(readCampaignStore("brand-a").drafts.some(x=>x.draftId===copy.draftId),false);
  assert.ok((await loadCampaignPlans("brand-a")).some(c=>c.draftId===d.draftId));
  const sim=saveNamedSimulation(ctx.baseline,scenarios[1].levers,"추천 원본");const simCopy=duplicateSimulation("brand-a",sim.id);assert.equal(sim.forecast.totalPurchases,124);assert.notEqual(sim.id,simCopy.id);deleteSimulation("brand-a",simCopy.id);assert.equal(readSimulationLibrary("brand-a").length,1);assert.equal(readSimulationLibrary("brand-b").length,0);
});
test("JSON/CSV/HTML Export는 전체 설계안을 포함하고 HTML/CSV 삽입을 차단한다",async()=>{
  const {c}=await setup(),plan=campaignPlan({...c,name:'=HYPERLINK("bad")',message:{...c.message,body:'<script>alert("x")</script> & "quote"'}});
  const json=exportCampaignPlan(plan,"json"),csv=exportCampaignPlan(plan,"csv"),html=exportCampaignPlan(plan,"html");
  assert.equal(JSON.parse(json.content).campaign.id,c.id);assert.ok(csv.content.startsWith("\uFEFF"));assert.ok(csv.content.includes("'=HYPERLINK"));
  assert.ok(html.content.includes("&lt;script&gt;"));assert.ok(!html.content.includes("<script>"));assert.ok(html.content.includes("DEMO FORECAST"));assert.ok(html.content.includes("운영 제안 규칙"));assert.ok(html.content.includes("Content-Security-Policy"));
});

test("4차의 최신 초안과 저장된 DRAFT 목록을 함께 이전하고 손상 Simulation은 제외한다",async()=>{
  const {c,ctx}=await setup(),id="legacy-migration-test",one={...newCampaignDraft(ctx),advertiserId:id},two={...c,advertiserId:id,draftId:crypto.randomUUID(),id:"DRAFT-legacy",status:"DRAFT" as const};
  const previous=Object.getOwnPropertyDescriptor(globalThis,"localStorage");
  const data=new Map<string,string>([
    [`intentbridge:campaigns:v1:${id}`,JSON.stringify({version:1,draft:one,campaigns:[two],lastEdited:one.updatedAt})],
    [`intentbridge:simulation-library:v1:${id}`,JSON.stringify([{id:"bad",advertiserId:id,name:"bad",period:30,createdAt:"today",levers:{},baseline:{advertiserId:id,period:30},forecast:{totalPurchases:1,revenue:1,adSpend:1,confidence:{level:"HIGH"}}}])],
  ]);
  Object.defineProperty(globalThis,"localStorage",{configurable:true,value:{getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>data.set(k,v)}});
  try {assert.equal(readCampaignStore(id).drafts.length,2);assert.equal(readSimulationLibrary(id).length,0);}finally{if(previous)Object.defineProperty(globalThis,"localStorage",previous);else Reflect.deleteProperty(globalThis,"localStorage");}
});
