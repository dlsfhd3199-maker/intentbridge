import { getDashboard } from "./dashboard";
import { loadFunnelWorkspace } from "./funnel";
import { loadPerformanceBaseline } from "./simulation/baseline";
import { simulate } from "./simulation";
import { scenarios } from "../data/mock/simulation-config";
import { loadOperations } from "./operations-engine";
import { readCampaignStore } from "./campaign-store";
import { readAppSettings } from "./app-settings";
import type { Query } from "../types/domain";
export async function loadExecutiveReport(query:Query){const [dashboard,funnel,baseline,operations]=await Promise.all([getDashboard(query),loadFunnelWorkspace(query),loadPerformanceBaseline(query),loadOperations(query.advertiserId,query.period)]),scenario=scenarios.find(s=>s.id===readAppSettings().forecastScenario)??scenarios[1],forecast=simulate(baseline,scenario.levers),store=readCampaignStore(query.advertiserId);
 const insights:string[]=[];
 if(dashboard.totals.purchases)insights.push(`총 구매 ${dashboard.totals.purchases}건 중 ${(dashboard.retargeting.recoveredPurchases/dashboard.totals.purchases*100).toFixed(1)}%인 ${dashboard.retargeting.recoveredPurchases}건이 리타겟팅 회수 구매입니다.`);
 if(funnel.bottleneck)insights.push(`${funnel.bottleneck.label} 구간이 현재 Mock 퍼널의 병목입니다. ${scenario.name} 가정의 총 구매 변화는 ${forecast.totalPurchases-baseline.totalPurchases>=0?"+":""}${forecast.totalPurchases-baseline.totalPurchases}건입니다 (DEMO FORECAST).`);
 const action=operations.campaigns.find(c=>c.health==="ACTION REQUIRED"||c.health==="LIMITED");if(action)insights.push(`${action.campaign.name}: ${action.reason}`);else if(operations.campaigns.length)insights.push(`운영 캠페인 ${operations.campaigns.length}개 중 ${operations.campaigns.filter(c=>c.health==="HEALTHY").length}개가 목표 내 상태이며, 검토 대기 추천은 ${operations.recommendations.filter(r=>r.status==="PENDING").length}개입니다.`);else insights.push(`현재 ${store.drafts.length}개 초안이 있으며 생성된 운영 캠페인은 없습니다. Funnel의 세그먼트로 캠페인을 설계할 수 있습니다.`);
 return {dashboard,baseline,forecast,scenario,funnel,operations,insights:insights.slice(0,3),counts:{draft:store.drafts.length,ready:store.campaigns.filter(c=>c.status==="READY").length,active:store.campaigns.filter(c=>c.status==="MOCK ACTIVE").length,action:operations.campaigns.filter(c=>c.health==="ACTION REQUIRED").length},top:operations.campaigns.slice().sort((a,b)=>(b.metrics.roas??-1)-(a.metrics.roas??-1)).slice(0,3)};
}
export type ExecutiveReportData=Awaited<ReturnType<typeof loadExecutiveReport>>;
