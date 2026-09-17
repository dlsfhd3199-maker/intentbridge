import {serverStorageInstalled,flushServerStorage} from "./server-storage";
import {assertAccess} from "./permissions";
import {advertisers,getDashboard} from "./dashboard";
import {loadFunnelWorkspace} from "./funnel";
import {loadPerformanceBaseline} from "./simulation/baseline";
import {loadOperationsSummary} from "./operations-engine";
import {readCampaignStore} from "./campaign-store";
import {loadPerformanceTrend} from "./performance-trend";
import type {Query,Period} from "../types/domain";
async function calculateWorkspaceSummary(query:Query){assertAccess(query.advertiserId);const [dashboard,funnel,baseline,operations,trend]=await Promise.all([getDashboard(query),loadFunnelWorkspace(query),loadPerformanceBaseline(query),loadOperationsSummary(query.advertiserId,query.period),loadPerformanceTrend(query.advertiserId,query.period)]);const store=readCampaignStore(query.advertiserId);return {dashboard,baseline,stages:funnel.stages,insight:funnel.bottleneck?funnel.bottleneck.id==="Purchase"?`결제까지 이동한 고객 중 ${funnel.bottleneck.dropOff}명이 구매하지 않았습니다.`:`${funnel.bottleneck.label} 단계로 이동하는 비율이 ${funnel.bottleneck.conversionRate?.toFixed(1)}%로 가장 낮습니다.`:"현재 고객 흐름을 확인하고 개선안을 비교해 보세요.",active:store.campaigns.filter(c=>c.status==="MOCK ACTIVE").length,attention:operations.attention,pending:operations.pending,recent:operations.recent,lastUpdated:store.lastEdited,campaigns:operations.campaigns,trend:trend.rows,reason:operations.reason??(funnel.bottleneck?`${funnel.bottleneck.label} 개선 검토`:"운영 상태 확인"),priority:operations.attention?2:funnel.bottleneck?1:0};}
export type WorkspaceSummary=Awaited<ReturnType<typeof calculateWorkspaceSummary>>;
export async function loadAdminSummary(period:Period){assertAccess(undefined,"VIEW_ALL_ADVERTISERS");if(typeof window!=="undefined"&&serverStorageInstalled()){await flushServerStorage();const response=await fetch(`/api/admin/workspace-summaries?period=${period}`,{cache:"no-store"});if(!response.ok)throw new Error("광고주 요약을 불러오지 못했습니다.");return response.json() as Promise<WorkspaceSummary[]>;}return Promise.all(advertisers.map(a=>loadWorkspaceSummary({advertiserId:a.id,period})));}

export async function loadWorkspaceSummary(query:Query):Promise<WorkspaceSummary>{if(typeof window!=="undefined"&&serverStorageInstalled()){await flushServerStorage();const response=await fetch(`/api/workspace-summary?advertiser=${encodeURIComponent(query.advertiserId)}&period=${query.period}`,{cache:"no-store"});if(!response.ok)throw new Error("워크스페이스 요약을 불러오지 못했습니다.");return response.json()}return calculateWorkspaceSummary(query)}
