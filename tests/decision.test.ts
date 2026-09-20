import {test} from "node:test";
import assert from "node:assert/strict";
import type {DecisionInput} from "../types/decision";
import {generateSignals,rankSignals,confidence} from "../lib/decision/engine";
import {comparisonPeriod} from "../lib/decision/comparison";
import {normalizeDemo} from "../lib/decision/demo-normalizer";
import {signalPreview,signalHandoff,signalJourneyUrl,setSignalStatus,readSignalStates} from "../lib/decision/service";
import {evaluateCampaign,newCampaignDraft} from "../lib/campaign-service";
import {isCampaignDraft,saveCampaign,readCampaignStore} from "../lib/campaign-store";
import {installServerStorage} from "../lib/server-storage";
import {installSessionUser,mockUser} from "../lib/permissions";
const base=():DecisionInput=>({advertiserId:"brand-a",advertiserName:"브랜드 A",period:30,endDate:"2026-09-17",observedAt:"2026-09-17T23:59:59Z",source:"DEMO",sourceDescription:"합성 테스트",current:{stages:{Visit:1000,ViewContent:800,AddToCart:300,BeginCheckout:150,Purchase:40},purchases:80,revenue:8000000,spend:2000000},previous:{stages:{Visit:1000,ViewContent:800,AddToCart:300,BeginCheckout:210,Purchase:50},purchases:100,revenue:10000000,spend:2000000},audiences:[{segmentId:"cart-14d",name:"장바구니 미구매",event:"AddToCart",window:14,sourceIds:["gpt-organic"],sourceNames:["GPT Organic"],excludePurchase:true,size:198}],campaigns:[],health:{status:"healthy",lastSync:"2026-09-17T23:59:59Z"}});
test("Decision: DROP_OFF 이전 단계 분모·%p·가장 큰 하락과 KPI 통합",()=>{
 const signals=generateSignals(base()),drop=signals.find(s=>s.type==="DROP_OFF")!,performance=signals.filter(s=>s.type==="PERFORMANCE_DROP");
 assert.equal(drop.stage,"BeginCheckout");assert.equal(drop.evidence[0].current,50);assert.equal(drop.evidence[0].previous,70);assert.equal(drop.evidence[0].change,-20);assert.equal(drop.affectedUsers,150);assert.equal(drop.audience?.size,198);assert.equal(drop.severity,"ACTION");
 assert.equal(performance.length,1);assert.equal(performance[0].evidence.length,4);assert.equal(signals.filter(s=>s.type==="DROP_OFF").length,1);
 assert.equal(new URL(signalJourneyUrl(drop),"https://example.test").searchParams.get("signalStage"),"BeginCheckout");
});
test("Decision: RECOVERY 는 임계 인원·기간·Purchase 제외 모집단 유지",()=>{
 const input=base();let recovery=generateSignals(input).find(s=>s.type==="RECOVERY_OPPORTUNITY")!;assert.equal(recovery.audience?.window,14);assert.equal(recovery.audience?.excludePurchase,true);assert.equal(recovery.evidence[0].previous,null);
 input.audiences[0].size=29;assert.ok(!generateSignals(input).some(s=>s.type==="RECOVERY_OPPORTUNITY"));input.audiences[0].size=30;recovery=generateSignals(input).find(s=>s.type==="RECOVERY_OPPORTUNITY")!;assert.equal(recovery.severity,"WATCH");
});
test("Decision: FATIGUE 는 빈도 증가 AND 반응 하락 (빈도만/이력 없으면 없음)",()=>{
 const input=base();input.campaigns=[{id:"c1",name:"리마인드",audience:198,current:{frequency:4.8,ctr:1.5,cvr:3},previous:{frequency:3,ctr:2,cvr:3}}];
 assert.equal(generateSignals(input).filter(s=>s.type==="CAMPAIGN_FATIGUE").length,1);
 input.campaigns[0].current.ctr=2;assert.ok(!generateSignals(input).some(s=>s.type==="CAMPAIGN_FATIGUE"));input.campaigns[0].previous=null;assert.ok(!generateSignals(input).some(s=>s.type==="CAMPAIGN_FATIGUE"));
});
test("Decision: DATA_ISSUE 우선·오래된 데이터·없음은 성과/회수 신호 억제",()=>{
 for(const variant of ["error","missing","stale"]){const input=base();if(variant==="stale")input.health.lastSync="2026-09-16T23:59:59Z";else input.health.status=variant as "error"|"missing";const signals=generateSignals(input);assert.equal(signals.length,1);assert.equal(signals[0].type,"DATA_ISSUE");assert.equal(signals[0].confidence,"LOW");assert.equal(signals[0].severity,"CRITICAL")}
 const invalid=base();invalid.current!.stages.BeginCheckout=NaN;assert.deepEqual(generateSignals(invalid).map(s=>s.type),["DATA_ISSUE"]);
});
test("Decision: POSITIVE 는 악화와 혼합하지 않고 무조건 증액하지 않음",()=>{
 const input=base();[input.current,input.previous]=[input.previous,input.current];let signals=generateSignals(input);assert.ok(signals.some(s=>s.type==="POSITIVE_MOMENTUM"));assert.ok(!signals.some(s=>s.type==="PERFORMANCE_DROP"));
 input.current!.spend*=2;signals=generateSignals(input);assert.ok(!signals.some(s=>s.type==="POSITIVE_MOMENTUM"));
});
test("Decision: 기간은 인접·동일 길이, 신뢰도 및 zero denominator",()=>{
 for(const period of [7,14,30] as const){const r=comparisonPeriod("2026-03-01",period),days=(a:string,b:string)=>(Date.parse(b)-Date.parse(a))/86400000+1;assert.equal(days(r.current.start,r.current.end),period);assert.equal(days(r.previous.start,r.previous.end),period);assert.equal(days(r.previous.end,r.current.start),2)}
 const input=base();assert.equal(confidence(input),"HIGH");input.period=7;assert.equal(confidence(input),"MEDIUM");input.previous=null;assert.equal(confidence(input),"LOW");assert.ok(!generateSignals(input).some(s=>s.type==="DROP_OFF"||s.type==="PERFORMANCE_DROP"));
 input.current={stages:{Visit:0,ViewContent:0,AddToCart:0,BeginCheckout:0,Purchase:0},purchases:0,revenue:0,spend:0};input.previous=structuredClone(input.current);input.audiences=[];assert.deepEqual(generateSignals(input),[]);
});
test("Decision: 동일 입력·동점·중복 제거는 deterministic",()=>{
 const input=base(),signals=generateSignals(input);assert.deepEqual(signals,generateSignals(structuredClone(input)));assert.deepEqual(rankSignals([...signals,...signals]),signals);
 const tied=signals.map(s=>({...s,priority:1}));assert.deepEqual(rankSignals(tied),rankSignals([...tied].reverse()));assert.ok(signals.every((s,i)=>!i||signals[i-1].priority>=s.priority));
});
test("Decision: 전체 Demo 기간 Journey→Audience→Campaign→Forecast 모집단/합계 보존",async()=>{
 for(const id of ["brand-a","brand-b"])for(const period of [7,14,30] as const){const {input,context}=await normalizeDemo(id,period);assert.equal(input.current?.purchases,context.baseline.totalPurchases);assert.equal(input.current?.revenue,context.baseline.revenue);assert.equal(input.current?.spend,context.baseline.adSpend);
   for(const s of generateSignals(input).filter(s=>s.audience)){const {draft,evaluation}=signalPreview(s,context),handoff=signalHandoff(s,context),restored=newCampaignDraft(context,handoff.origin,handoff.sourceIds);assert.equal(evaluation.audience,s.audience!.size);assert.equal(evaluation.audience,context.funnel.segments.find(a=>a.id===s.audience!.segmentId)!.volume);assert.deepEqual(evaluateCampaign(restored,context).forecast,evaluation.forecast);assert.ok(isCampaignDraft(draft,id));assert.equal(restored.origin.recommendation?.id,s.id);assert.ok(restored.origin.recommendation?.message.includes("구매 제외"));}
 }
 const {input}=await normalizeDemo("brand-a",30);assert.equal(input.current?.stages.Visit,1284);assert.equal(input.current?.purchases,94);assert.equal(input.audiences.find(a=>a.segmentId==="cart-14d")?.size,152);
});
test("Decision: Draft 저장 이후 원본 이유 보존·타 Workspace handoff 거부",async()=>{
 installServerStorage([]);const {input,context}=await normalizeDemo("brand-a",30),s=generateSignals(input).find(s=>s.audience)!;const preview=signalPreview(s,context);saveCampaign(preview.draft,preview.evaluation,context.advertiser.name);assert.equal(readCampaignStore("brand-a").campaigns[0].origin.recommendation?.id,s.id);
 const other=await normalizeDemo("brand-b",30);assert.throws(()=>signalHandoff(s,other.context));
});
test("Decision: Role 범위와 기존 변경 권한 재사용",async()=>{
 installSessionUser({...mockUser("manager"),advertiserIds:["brand-a"]});try{await assert.rejects(()=>normalizeDemo("brand-b",30));const {input,context}=await normalizeDemo("brand-a",30),s=generateSignals(input).find(s=>s.audience)!;installSessionUser(mockUser("advertiser"));assert.throws(()=>signalPreview(s,context));await assert.rejects(()=>setSignalStatus("brand-a",s.id,"REVIEWING"));assert.throws(()=>readSignalStates("brand-b"));}finally{installSessionUser(mockUser("super_admin"))}
});
test("Decision: 캠페인 Demo 관측값 보존·직전 7일은 현재 30일 안의 이력 사용",async()=>{
 installServerStorage([]);const {context}=await normalizeDemo("brand-a",30),draft=newCampaignDraft(context,{from:"Campaign Studio",segmentId:"view-30d",window:30,recommendedBudgetChange:0,createdAt:"2026-09-17T00:00:00Z"}),evaluation=evaluateCampaign(draft,context);
 const campaign={...draft,id:"demo-fatigue",status:"MOCK ACTIVE",audienceName:evaluation.segmentName,audienceSize:evaluation.audience,forecast:evaluation.forecast,tracking:evaluation.tracking,advertiserName:context.advertiser.name};
 installServerStorage([{key:"intentbridge:campaigns:v1:brand-a",revision:1,payload:{version:1,draft:null,drafts:[],campaigns:[campaign],versions:[],lastEdited:null}}]);
 const month=await normalizeDemo("brand-a",30),week=await normalizeDemo("brand-a",7);assert.ok(generateSignals(month.input).some(s=>s.type==="CAMPAIGN_FATIGUE"));assert.equal(week.input.campaigns[0].previous?.frequency,week.input.campaigns[0].current.frequency);assert.ok(!generateSignals(week.input).some(s=>s.type==="CAMPAIGN_FATIGUE"));installServerStorage([]);
});
