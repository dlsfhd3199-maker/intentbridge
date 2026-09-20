import type { Period } from "../types/domain";
import type { DailyMetric, PerformanceTrend, TrendDetection } from "../types/mvp";
import { getDashboard } from "./dashboard";
import { readCampaignStore } from "./campaign-store";
import { monitorCampaign } from "./operations-engine";
import { calculateFinancialMetrics } from "./simulation";
export const mockTrendEndDate="2026-09-17";
function weights(seed:string,n:number){let h=[...seed].reduce((s,c)=>(s*31+c.charCodeAt(0))>>>0,7);return Array.from({length:n},()=>{h=(Math.imul(h,1664525)+1013904223)>>>0;return .5+(h%1000)/1000;});}
export function allocateTotal(total:number,weights:number[]):number[]{const sum=weights.reduce((a,b)=>a+b,0);if(!sum)return weights.map(()=>0);const exact=weights.map(w=>Math.max(0,Math.round(total))*w/sum),values=exact.map(Math.floor);let remaining=Math.round(total)-values.reduce((a,b)=>a+b,0);const order=exact.map((v,i)=>({i,rest:v-values[i]})).sort((a,b)=>b.rest-a.rest);for(const item of order){if(remaining--<=0)break;values[item.i]++;}return values;}
const change=(current:number|null,base:number|null)=>current===null||base===null||base===0?null:(current/base-1)*100;
export function detectTrend(rows:DailyMetric[]):TrendDetection {
  const last=rows.at(-1),prev=rows.at(-2);if(!last||!prev)return {status:"Stable",roasDayChange:null,cpaThreeDayChange:null,frequency:0,reasons:["비교할 일자별 데이터가 부족합니다."]};
  const history=rows.slice(-4,-1).map(r=>r.cpa).filter((n):n is number=>n!==null),avg=history.length?history.reduce((a,b)=>a+b,0)/history.length:null;
  const roasDayChange=change(last.roas,prev.roas),cpaThreeDayChange=change(last.cpa,avg);
  const status=(roasDayChange!==null&&roasDayChange<=-20)||(cpaThreeDayChange!==null&&cpaThreeDayChange>=25)?"Declining":last.frequency>4.5||(roasDayChange!==null&&roasDayChange<-10)||(cpaThreeDayChange!==null&&cpaThreeDayChange>10)?"Watch":(roasDayChange!==null&&roasDayChange>=10)&&(cpaThreeDayChange===null||cpaThreeDayChange<=0)?"Improving":"Stable";
  return {status,roasDayChange,cpaThreeDayChange,frequency:last.frequency,reasons:[roasDayChange===null?"ROAS 전일 비교 산출 불가":`ROAS 전일 대비 ${roasDayChange.toFixed(1)}%`,cpaThreeDayChange===null?"CPA 최근 3일 비교 산출 불가":`CPA 직전 3일 유효값 평균 대비 ${cpaThreeDayChange.toFixed(1)}%`,`Frequency ${last.frequency.toFixed(1)} · 일별 값은 합성 Mock입니다.`]};
}
export async function loadPerformanceTrend(advertiserId:string,period:Period,campaignId?:string):Promise<PerformanceTrend>{
  const periods=[7,14,30] as const;
  const campaign=campaignId?readCampaignStore(advertiserId).campaigns.find(c=>c.id===campaignId):undefined;
  if(campaignId&&!campaign)throw new Error("캠페인을 찾을 수 없습니다.");
  const snapshots=await Promise.all(periods.map(async days=>{
    if(campaign){const m=monitorCampaign(campaign,days);return {totals:{spend:m.spend,traffic:m.clicks,purchases:m.purchases,revenue:m.revenue},scope:campaign.name+" · Mock 클릭 유입",frequency:m.frequency};}
    const d=await getDashboard({advertiserId,period:days});return {totals:{spend:d.totals.spend,traffic:d.source.uniqueUsers,purchases:d.totals.purchases,revenue:d.totals.revenue},scope:d.advertiser.name+" · 전체 Mock 유입",frequency:2.2};
  }));
  const chosen=snapshots[periods.indexOf(period)],seed=advertiserId+":"+(campaignId??"all");
  // One nested 30-day dataset: shorter periods are exact suffixes while existing engine totals stay unchanged.
  const distribute=(key:keyof PerformanceTrend["totals"])=>[
    ...allocateTotal(snapshots[2].totals[key]-snapshots[1].totals[key],weights(seed+key+"early",16)),
    ...allocateTotal(snapshots[1].totals[key]-snapshots[0].totals[key],weights(seed+key+"middle",7)),
    ...allocateTotal(snapshots[0].totals[key],weights(seed+key+"recent",7))
  ];
  const spend=distribute("spend"),traffic=distribute("traffic"),purchases=distribute("purchases"),revenue=[...allocateTotal(snapshots[2].totals.revenue-snapshots[1].totals.revenue,purchases.slice(0,16)),...allocateTotal(snapshots[1].totals.revenue-snapshots[0].totals.revenue,purchases.slice(16,23)),...allocateTotal(snapshots[0].totals.revenue,purchases.slice(23))],freq=weights(seed+"frequency",30);
  const rows=Array.from({length:30},(_,i)=>{const date=new Date(mockTrendEndDate+"T00:00:00Z");date.setUTCDate(date.getUTCDate()-29+i);const f=calculateFinancialMetrics(purchases[i],revenue[i],spend[i]);return {date:date.toISOString().slice(0,10),spend:spend[i],traffic:traffic[i],purchases:purchases[i],revenue:revenue[i],cpa:f.cpa,roas:f.roas,frequency:snapshots[2].frequency?Math.round(snapshots[2].frequency*freq[i]*10)/10:0};}).slice(-period);
  return {rows,detection:detectTrend(rows),scope:chosen.scope,period,totals:chosen.totals};
}
