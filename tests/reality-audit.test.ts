import {test} from "node:test";
import assert from "node:assert/strict";
import {nextAction} from "../lib/decision/next-action";
import {normalizeDemo} from "../lib/decision/demo-normalizer";
import {generateSignals} from "../lib/decision/engine";
import {planStatus,operationAction,alertLabel,planCopy} from "../lib/product-language";
import {campaignChannels} from "../data/mock/campaign-config";
import {campaignPlan,exportCampaignPlan} from "../lib/export-service";
import {newCampaignDraft,evaluateCampaign} from "../lib/campaign-service";
import {saveCampaign} from "../lib/campaign-store";
import type {SignalType} from "../types/decision";

test("Reality: six next actions preserve scope and only eligible recovery/drop can create plans",async()=>{
 const {input}=await normalizeDemo("brand-a",30),signal=generateSignals(input).find(s=>s.audience)!;
 const cases:[SignalType,string,boolean][]=[["DROP_OFF","/funnel",true],["RECOVERY_OPPORTUNITY","/funnel",true],["PERFORMANCE_DROP","/performance",false],["CAMPAIGN_FATIGUE","/campaigns",false],["DATA_ISSUE","/connections",false],["POSITIVE_MOMENTUM","/performance",false]];
 for(const [type,path,plan] of cases){const action=nextAction({...signal,type}),url=new URL(action.href,"https://example.test");assert.equal(url.pathname,path);assert.equal(url.searchParams.get("advertiser"),signal.advertiserId);assert.equal(url.searchParams.get("period"),"30");assert.equal(action.plan,plan);}
 assert.equal(nextAction({...signal,type:"DROP_OFF",audience:null}).plan,false);
 assert.equal(nextAction({...signal,type:"RECOVERY_OPPORTUNITY",audience:{...signal.audience!,size:0}}).plan,false);
 assert.equal(campaignChannels.find(c=>c.id==="chatgpt")?.retargeting,false);
});

test("Reality: presentation preserves user names, numeric forecasts, original JSON and safe exports",async()=>{
 const {context}=await normalizeDemo("brand-a",30),draft=newCampaignDraft(context);
 draft.name="Launch / Rollback 캠페인 — 사용자 이름";
 const campaign=saveCampaign(draft,evaluateCampaign(draft,context),context.advertiser.name,true),plan=campaignPlan(campaign),before=structuredClone(plan);
 const json=JSON.parse(exportCampaignPlan(plan,"json").content);
 assert.deepEqual(json.campaign,campaign);assert.deepEqual(json.rules,plan.rules);assert.equal(json.presentation.externalExecution,"NOT_PERFORMED");assert.equal(json.presentation.status,"실행 준비");
 for(const format of ["html","csv"] as const){const result=exportCampaignPlan(plan,format).content;assert.ok(result.includes(draft.name));assert.ok(result.includes("DEMO FORECAST"));assert.ok(result.includes("실행 준비"));assert.ok(!result.includes("Mock Automation"));}
 assert.ok(exportCampaignPlan(plan,"html").content.includes(planCopy.handoff));assert.deepEqual(plan,before);
 assert.equal(planStatus("MOCK ACTIVE"),"검토 완료");assert.equal(planStatus("PAUSED"),"보류");assert.equal(operationAction("Increase Budget"),"예산 확대 검토");
 assert.equal(alertLabel(`${draft.name}: Increase Budget APPLIED IN MOCK`),`${draft.name}: 예산 확대 검토 · 실행안 반영 완료`);assert.equal(alertLabel(draft.name),draft.name);
});
