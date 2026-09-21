import {assertAccess,can,currentUser} from "./permissions";
import { configuredTarget } from "./app-settings";
import { detectRuleConflicts, rulePriority } from "./rule-conflicts";
import type { Campaign, CampaignWorkspace } from "../types/campaign";
import type { Period } from "../types/domain";
import type { AutomationCondition, AutomationRule, CampaignTarget, Guardrail, OperationMetrics, OperationPreview, OperationsWorkspace, OperationRecommendation, ChangeCategory } from "../types/operations";
import { defaultGuardrail, monitoringProfiles, operationMetrics } from "../data/mock/operations-config";
import { campaignChannels } from "../data/mock/campaign-config";
import { readCampaignStore } from "./campaign-store";
import { campaignHealth } from "./operations-health";
import { guardBudget } from "./operations-guardrail";
import { readOperations, validRule, writeOperations } from "./operations-store";
import { calculateFinancialMetrics } from "./simulation";
import { loadCampaignWorkspace, evaluateCampaign } from "./campaign-service";
import { changeCampaignBudget } from "./campaign-forecast";

export function monitorCampaign(c:Campaign,period:Period):OperationMetrics {
  const p=monitoringProfiles[c.segmentId as keyof typeof monitoringProfiles] ?? monitoringProfiles["view-30d"];
  const costPerImpression=(campaignChannels.find(channel=>channel.id===c.retargetingChannelId)?.cpm??0)/1000;
  const active=c.status==="MOCK ACTIVE" || c.status==="PAUSED";
  const fraction=Math.min(period,c.budget.duration)/Math.max(1,c.budget.duration);
  const frequency=Math.round(p.frequency*Math.min(1,period/7)*10)/10;
  const reach=active?Math.floor(c.audienceSize*p.reachShare*fraction):0;
  const impressions=Math.min(Math.round(reach*frequency),costPerImpression?Math.floor(c.budget.total*fraction/costPerImpression):0);
  const clicks=Math.min(reach,Math.round(impressions*p.ctr)),purchases=Math.min(clicks,Math.round(clicks*p.cvr));
  const spend=Math.round(impressions*costPerImpression),revenue=Math.round(purchases*c.forecast.averageOrderValue);
  const finance=calculateFinancialMetrics(purchases,revenue,spend);
  return {spend,purchases,revenue,cpa:finance.cpa,roas:finance.roas,impressions,clicks,reach,frequency:active&&reach?frequency:0,ctr:impressions?clicks/impressions*100:0,cvr:clicks?purchases/clicks*100:0,audienceRemaining:c.audienceSize?Math.max(0,(1-reach/c.audienceSize)*100):0,dailyBudgetUsage:c.budget.daily&&active?Math.min(100,spend/Math.max(1,Math.min(period,c.budget.duration))/c.budget.daily*100):0};
}
export function matchesConditions(conditions:AutomationCondition[],metrics:OperationMetrics):boolean {
  return conditions.length>0 && conditions.every(c=>{const value=metrics[c.metric];if(value===null||!Number.isFinite(value)||!Number.isFinite(c.value)||c.value<0)return false;switch(c.operator){case ">":return value>c.value;case "<":return value<c.value;case ">=":return value>=c.value;case "<=":return value<=c.value;default:return false;}});
}
export function rulePreview(rule:AutomationRule,c:Campaign,metrics:OperationMetrics,guard:Guardrail,ctx:CampaignWorkspace):OperationPreview {
  const valid=validRule(rule)&&rule.campaignId===c.id&&rule.advertiserId===c.advertiserId&&c.status!=="DRAFT";
  const matched=valid&&rule.enabled&&matchesConditions(rule.conditions,metrics), after=structuredClone(c),reasons:string[]=[];
  const supporting=rule.conditions.map(cond=>{const m=operationMetrics.find(m=>m.id===cond.metric);const v=metrics[cond.metric];return `${m?.label ?? cond.metric} ${v===null?"산출 불가":Number(v).toFixed(1)}${m?.unit ?? ""} ${cond.operator} ${cond.value}`;});
  let category:ChangeCategory="Notification", allowed=matched;
  if(!valid)reasons.push("잘못된 규칙 또는 실행안 참조입니다.");
  if(!matched)reasons.push("현재 데이터가 모든 AND 조건을 충족하지 않습니다.");
  const action=rule.action;
  if(action.type==="Increase Budget"||action.type==="Decrease Budget") {category="Budget";const result=guardBudget(action,c.budget.daily,c.audienceSize,metrics,guard);allowed=allowed&&result.allowed;reasons.push(...result.reasons);after.budget=changeCampaignBudget(c.budget,"daily",result.daily);if(c.status!=="MOCK ACTIVE"){allowed=false;reasons.push("예산안 변경은 검토 완료 상태인 실행안에만 반영합니다.");}}
  if(action.type==="Pause"||action.type==="Resume") {category="Status";after.status=action.type==="Pause"?"PAUSED":"MOCK ACTIVE";if(action.type==="Pause"&&c.status!=="MOCK ACTIVE"||action.type==="Resume"&&!["READY","PAUSED"].includes(c.status)){allowed=false;reasons.push("현재 검토 상태에서는 이 상태로 변경할 수 없습니다.");}}
  if(action.type==="Creative Refresh") {category="Creative";after.message={...c.message,headline:(c.message.headline.startsWith("새 제안 · ")?"다시 만나는 · ":"새 제안 · ")+c.message.headline.replace(/^(새 제안 · |다시 만나는 · )/,"")};after.message.headline=after.message.headline.slice(0,200);reasons.push("메시지 버전을 변경합니다. 근거 없는 성과 상승은 Forecast에 가산하지 않습니다.");}
  if(action.type==="Audience Expand") {category="Audience";after.sourceIds=ctx.funnel.sources.map(s=>s.id);after.window=30;reasons.push("동일 유입 매체의 모든 Source와 30D Window로 확장합니다. 변경 값(%)은 이 액션에서 사용하지 않습니다.");}
  if(action.type==="Window Change") {category="Window";after.window=action.value as Campaign["window"];}
  const evaluation=evaluateCampaign(after,ctx);
  after.audienceSize=evaluation.audience;after.audienceName=evaluation.segmentName;after.forecast=evaluation.forecast;after.tracking=evaluation.tracking;
  if(action.type==="Notify Only") Object.assign(after,structuredClone(c));
  if(action.type==="Pause") after.forecast={...after.forecast,reach:0,impressions:0,clicks:0,purchases:0,revenue:0,cpa:null,roas:null,modeledSpend:0,unspentBudget:after.budget.total};
  if(action.type!=="Notify Only"&&!evaluation.ready){allowed=false;reasons.push("실행안 저장 조건을 충족하지 않아 반영할 수 없습니다.");}
  if(action.type==="Audience Expand"&&after.audienceSize<=c.audienceSize){allowed=false;reasons.push("현재 Mock 코호트에서 더 확장할 Audience가 없습니다.");}
  if(action.type==="Window Change"&&after.window===c.window){allowed=false;reasons.push("현재 Window와 같습니다.");}
  if(c.audienceSize===0&&action.type==="Increase Budget"){allowed=false;reasons.push("Audience가 0명이므로 증액할 수 없습니다.");}
  return {matched,valid,allowed,reasons,supporting,before:c,after,forecast:after.forecast,purchaseDelta:after.forecast.purchases-c.forecast.purchases,revenueDelta:after.forecast.revenue-c.forecast.revenue,category};
}
export function builtInRules(c:Campaign,target:CampaignTarget):AutomationRule[] {
  const base={advertiserId:c.advertiserId,campaignId:c.id,enabled:true,createdAt:c.createdAt};
  return [
    {...base,id:`builtin-scale-${c.id}`,name:"성과 우수 · 예산 확대",conditions:[{metric:"roas" as const,operator:">=" as const,value:target.roas*1.2},{metric:"audienceRemaining" as const,operator:">" as const,value:40}],action:{type:"Increase Budget" as const,value:15}},
    {...base,id:`builtin-cost-${c.id}`,name:"목표 ROAS 미달 · 예산 축소",conditions:[{metric:"roas" as const,operator:"<" as const,value:target.roas*.75},{metric:"spend" as const,operator:">" as const,value:0}],action:{type:"Decrease Budget" as const,value:10}},
    {...base,id:`builtin-frequency-${c.id}`,name:"노출 빈도 상승 · 소재 교체",conditions:[{metric:"frequency" as const,operator:">" as const,value:4}],action:{type:"Creative Refresh" as const,value:0}},
  ];
}
async function calculateOperations(advertiserId:string,period:Period,readOnly=false):Promise<OperationsWorkspace> {
  assertAccess(advertiserId);
  const campaigns=readCampaignStore(advertiserId).campaigns.filter(c=>c.status!=="DRAFT");
  const contexts=new Map(await Promise.all([...new Set(campaigns.map(c=>c.period))].map(async p=>[p,await loadCampaignWorkspace({advertiserId,period:p})] as const)));
  let store=readOperations(advertiserId);
  const versions=readCampaignStore(advertiserId).versions;
  for(const v of versions) {
    const before=versions.find(p=>p.campaignId===v.campaignId&&p.version===v.version-1)?.snapshot;
    const id="user-"+v.id;
    if(!before||v.snapshot.status==="DRAFT"||v.reason!=="Campaign Studio 변경"||store.history.some(h=>h.id===id))continue;
    const type=before.status!==v.snapshot.status?"Status" as const:before.budget.total!==v.snapshot.budget.total?"Budget" as const:before.window!==v.snapshot.window?"Window" as const:"Creative" as const;
    store.history.push({id,advertiserId,campaignId:v.campaignId,campaignName:v.snapshot.name,createdAt:v.createdAt,type,before,after:v.snapshot,reason:v.reason,source:"Campaign Studio",actor:"User",status:"APPLIED IN MOCK",version:v.version});
  }
  store.history.sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  const monitored=campaigns.map(c=>{const metrics=monitorCampaign(c,period),target=store.targets[c.id]??configuredTarget(),guardrail=store.guardrails[c.id]??defaultGuardrail;return {campaign:c,metrics,target,guardrail,...campaignHealth(metrics,target,c.audienceSize,guardrail)};});
  const recommendations:OperationRecommendation[]=[];
  for(const row of monitored) {
    for(const rule of [...store.rules.filter(r=>r.campaignId===row.campaign.id),...builtInRules(row.campaign,row.target)]) {
      const preview=rulePreview(rule,row.campaign,row.metrics,row.guardrail,contexts.get(row.campaign.period)!);
      if(!preview.matched)continue;
      const id=`${rule.id}:${row.campaign.updatedAt}:${period}:${JSON.stringify(rule.conditions)}:${JSON.stringify(rule.action)}`;
      recommendations.push({id,campaignId:row.campaign.id,campaignName:row.campaign.name,priority:rulePriority(rule),rule,preview,reason:`최근 ${period}일 Mock 관측: ${preview.supporting.join(" AND ")}. ${preview.reasons.join(" ")}`,status:store.decisions[id]??"PENDING"});
    }
    const alertId=`health:${row.campaign.id}:${row.campaign.updatedAt}:${period}:${row.health}:${row.target.cpa}:${row.target.roas}`;
    if(!store.alerts.some(a=>a.id===alertId)) store={...store,alerts:[{id:alertId,advertiserId,campaignId:row.campaign.id,type:row.health==="ACTION REQUIRED"?"CRITICAL":row.health==="HEALTHY"?"SUCCESS":row.health==="LEARNING"?"INFO":"WARNING",message:`${row.campaign.name}: ${row.reason}`,createdAt:new Date().toISOString(),read:false},...store.alerts]};
  }
  for(const row of monitored){
    const candidates=recommendations.filter(r=>r.campaignId===row.campaign.id&&r.status==="PENDING");
    const conflicts=detectRuleConflicts(candidates.map(r=>r.rule),store.conflictResolutions?.[row.campaign.id]??"Manual Review Required");
    for(const rec of candidates){const conflict=conflicts.find(c=>c.ruleIds.includes(rec.rule.id));if(conflict){rec.conflict=conflict;rec.reason+=" "+conflict.message;if(conflict.winnerId!==rec.rule.id){rec.preview.allowed=false;rec.preview.reasons.push(conflict.message);}}}
  }
  if(!readOnly&&can(currentUser().role,"MANAGE_OPERATIONS"))writeOperations(advertiserId,store);
  return {advertiserId,period,campaigns:monitored,recommendations:recommendations.sort((a,b)=>a.priority-b.priority),store};
}

export async function loadOperations(advertiserId:string,period:Period){assertAccess(advertiserId,"VIEW_OPERATIONS");return calculateOperations(advertiserId,period);}
export async function loadOperationsSummary(advertiserId:string,period:Period){const ops=await calculateOperations(advertiserId,period,true),attention=ops.campaigns.filter(c=>["ACTION REQUIRED","LIMITED","WATCH"].includes(c.health));return {attention:attention.length,pending:ops.recommendations.filter(r=>r.status==="PENDING").length,recent:ops.store.history.filter(h=>Date.parse(h.createdAt)>=Date.now()-period*86400000).length,reason:attention[0]?.reason,campaigns:ops.campaigns.map(c=>({id:c.campaign.id,name:c.campaign.name,objective:c.campaign.objective,budget:c.campaign.budget.daily,status:c.campaign.status,purchases:c.metrics.purchases,roas:c.metrics.roas}))};}
