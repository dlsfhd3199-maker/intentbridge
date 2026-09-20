import type {Campaign,CampaignWorkspace} from "../../types/campaign";
import type {DecisionInput,DecisionMetrics} from "../../types/decision";
import type {Period} from "../../types/domain";
import {allocateTotal,loadPerformanceTrend,mockTrendEndDate} from "../performance-trend";
import {loadCampaignWorkspace} from "../campaign-service";
import {decisionHistory} from "../../data/mock/decision-history";
import {readCampaignStore} from "../campaign-store";
import {monitorCampaign} from "../operations-engine";

const periods=[7,14,30] as const;
const uniform=(total:number,length:number)=>allocateTotal(total,Array.from({length},()=>1));
// Explicit synthetic prior-30-day fixture. Never used for REAL data. Current totals stay untouched.
// Prior checkout conversion is 70% (A), 45% (other demo brands); A is a decline, B an improvement example.
function priorFixture(current:DecisionMetrics,brand:string):DecisionMetrics{
  const stages={...current.stages},profile=brand==="brand-a"?decisionHistory.declining:decisionHistory.improving;
  stages.BeginCheckout=Math.min(stages.AddToCart,Math.round(stages.AddToCart*profile.checkoutRate));
  stages.Purchase=Math.min(stages.BeginCheckout,Math.round(stages.Purchase*profile.purchaseFactor));
  return {stages,purchases:Math.round(current.purchases*profile.purchaseFactor),revenue:Math.round(current.revenue*profile.purchaseFactor),spend:current.spend};
}
function campaignComparison(c:Campaign,period:Period):DecisionInput["campaigns"][number]{
  const snapshots=periods.map(p=>monitorCampaign(c,p)),current=snapshots[periods.indexOf(period)];
  let previous:DecisionInput["campaigns"][number]["previous"]=null;
  if(period===30)previous=decisionHistory.campaign[c.segmentId as keyof typeof decisionHistory.campaign]??null;
  else {
    // For 7/14 days the previous window is INSIDE the current 30-day observation series.
    // Do not replace that overlapping history with the older synthetic prior-30-day fixture.
    const total=(key:"impressions"|"clicks"|"purchases")=>[...uniform(snapshots[2][key]-snapshots[1][key],16),...uniform(snapshots[1][key]-snapshots[0][key],7),...uniform(snapshots[0][key],7)].slice(30-2*period,30-period).reduce((a,b)=>a+b,0);
    const impressions=total("impressions"),clicks=total("clicks"),purchases=total("purchases");
    if(impressions&&clicks)previous={frequency:snapshots[2].frequency,ctr:clicks/impressions*100,cvr:purchases/clicks*100};
  }
  return {id:c.id,name:c.name,audience:c.audienceSize,current,previous};
}
export async function normalizeDemo(advertiserId:string,period:Period):Promise<{input:DecisionInput;context:CampaignWorkspace}>{
  const contexts=await Promise.all(periods.map(period=>loadCampaignWorkspace({advertiserId,period})));
  const snapshots=contexts.map(({funnel:f})=>({stages:Object.fromEntries(f.stages.map(s=>[s.id,s.users])) as DecisionMetrics["stages"],purchases:f.totals.purchases,revenue:f.totals.revenue,spend:f.totals.spend}));
  const context=contexts[periods.indexOf(period)],current=snapshots[periods.indexOf(period)],prior=priorFixture(snapshots[2],advertiserId);
  const series=(values:number[],older:number)=>[...uniform(older,30),...uniform(values[2]-values[1],16),...uniform(values[1]-values[0],7),...uniform(values[0],7)];
  const sumPrevious=(rows:number[])=>rows.slice(60-2*period,60-period).reduce((a,b)=>a+b,0);
  const previous:DecisionMetrics={stages:{...current.stages},purchases:0,revenue:0,spend:0};
  for(const stage of Object.keys(current.stages) as (keyof DecisionMetrics["stages"])[])previous.stages[stage]=sumPrevious(series(snapshots.map(s=>s.stages[stage]),prior.stages[stage]));
  // Same financial daily series as the existing Performance chart; prior history is explicitly synthetic.
  const trend=await loadPerformanceTrend(advertiserId,30);
  for(const key of ["purchases","revenue","spend"] as const)previous[key]=sumPrevious([...uniform(prior[key],30),...trend.rows.map(r=>r[key])]);
  return {context,input:{advertiserId,advertiserName:context.advertiser.name,period,endDate:mockTrendEndDate,observedAt:mockTrendEndDate+"T23:59:59Z",source:"DEMO",sourceDescription:"GA4 · Demo / 광고 Mock · 현재 합계 유지, 직전 이력·캠페인 반응률은 명시적 합성 비교 데이터",current,previous,audiences:context.funnel.segments.map(s=>({segmentId:s.id,name:s.name,event:s.event,window:Math.min(period,s.window) as Period,sourceIds:context.funnel.sources.map(s=>s.id),sourceNames:context.funnel.sources.map(s=>s.name),excludePurchase:true,size:s.volume})),campaigns:readCampaignStore(advertiserId).campaigns.filter(c=>c.status==="MOCK ACTIVE"||c.status==="PAUSED").map(c=>campaignComparison(c,period)),health:{status:"healthy",lastSync:mockTrendEndDate+"T23:59:59Z"}}};
}
