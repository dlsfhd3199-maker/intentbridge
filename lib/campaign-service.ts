import {assertAccess} from "./permissions";
import type { Query, SourceId } from "../types/domain";
import type { AudienceSegment } from "../types/funnel";
import type { BaselineMetrics, Recommendation, SimulationLevers } from "../types/simulation";
import type { CampaignDraft, CampaignEvaluation, CampaignHandoff, CampaignOrigin, CampaignWorkspace } from "../types/campaign";
import { loadFunnelWorkspace } from "./funnel";
import { loadPerformanceBaseline } from "./simulation/baseline";
import { campaignChannels, campaignTemplates } from "../data/mock/campaign-config";
import { campaignName, campaignTracking } from "./campaign-naming";
import { recommendCampaignMessage } from "./campaign-message";
import { changeCampaignBudget, forecastCampaign } from "./campaign-forecast";
import { normalizeLevers, simulate } from "./simulation";
import { identifyScenario } from "./simulation/store";

export async function loadCampaignWorkspace(query: Query): Promise<CampaignWorkspace> {
  const [funnel, baseline] = await Promise.all([loadFunnelWorkspace(query), loadPerformanceBaseline(query)]);
  return { advertiser: funnel.advertiser, funnel, baseline };
}
export function recommendationSegment(recommendation: Pick<Recommendation, "id">) {
  return recommendation.id.includes("cart") ? "cart-14d" : recommendation.id.includes("landing") ? "view-30d" : "checkout-7d";
}
export function performanceHandoff(b: BaselineMetrics, levers: SimulationLevers, recommendation: Recommendation): CampaignHandoff {
  const proposed = normalizeLevers({ ...levers, ...recommendation.changes });
  const segmentId = recommendationSegment(recommendation);
  return { id: crypto.randomUUID(), advertiserId: b.advertiserId, period: b.period, sourceChannelId: b.sourceChannel.id, retargetingChannelId: b.retargetingChannel.id, sourceIds: b.trafficSources.map(source => source.id),
    origin: { from: "Performance Lab", recommendation, scenario: identifyScenario(levers), levers: { ...levers }, forecast: simulate(b, levers), recommendedBudgetChange: proposed.retargetingBudget, segmentId, window: segmentId === "checkout-7d" ? 7 : segmentId === "cart-14d" ? 14 : 30, createdAt: new Date().toISOString() } };
}
export function newCampaignDraft(context: CampaignWorkspace, origin?: CampaignOrigin, sourceIds?: SourceId[]): CampaignDraft {assertAccess(context.advertiser.id,"MANAGE_CAMPAIGN");
  const segment = context.funnel.segments.find(item => item.id === origin?.segmentId) ?? context.funnel.segments[0];
  const window = origin?.window ?? segment.window;
  const template = campaignTemplates[segment.event];
  const now = new Date().toISOString();
  const suggestedDaily = Math.round(context.baseline.retargetingSpend / context.baseline.period * (1 + (origin?.recommendedBudgetChange ?? 0) / 100) * (context.baseline.currentAudience ? segment.volume / context.baseline.currentAudience : 0));
  const draft: CampaignDraft = { draftId: crypto.randomUUID(), advertiserId: context.advertiser.id, period: context.baseline.period, name: "", sourceChannelId: context.baseline.sourceChannel.id, retargetingChannelId: context.baseline.retargetingChannel.id, sourceIds: sourceIds ?? context.funnel.sources.map(source => source.id), segmentId: segment.id, objective: template.objective, window, frequency: template.frequency, purchaseExcluded: true, message: recommendCampaignMessage(segment, context.funnel), budget: changeCampaignBudget({ daily: 0, total: 0, duration: window, mode: "daily" }, "daily", suggestedDaily), origin: origin ?? { from: "Campaign Studio", recommendedBudgetChange: 0, segmentId: segment.id, window, createdAt: now }, createdAt: now, updatedAt: now };
  draft.name = campaignName(draft);
  return draft;
}
export function selectCampaignSegment(draft: CampaignDraft, segment: AudienceSegment, context: CampaignWorkspace): CampaignDraft {
  return { ...draft, segmentId: segment.id, window: segment.window, objective: campaignTemplates[segment.event].objective, frequency: campaignTemplates[segment.event].frequency, message: recommendCampaignMessage(segment, context.funnel), updatedAt: new Date().toISOString() };
}
export function evaluateCampaign(draft: CampaignDraft, context: CampaignWorkspace): CampaignEvaluation {
  const segment = context.funnel.segments.find(item => item.id === draft.segmentId);
  const channel = campaignChannels.find(item => item.id === draft.retargetingChannelId);
  const supported = draft.sourceChannelId === context.funnel.campaign.sourceChannelId && draft.retargetingChannelId === context.funnel.campaign.retargetingChannelId && !!channel?.capability.create;
  const effectiveWindow = Math.min(draft.period, draft.window);
  const eventOrder = ["BeginCheckout", "AddToCart", "ViewContent"];
  const audience = supported && segment ? context.funnel.cohorts.filter(cohort => cohort.eligible && draft.sourceIds.includes(cohort.sourceId) && (!draft.purchaseExcluded || !cohort.purchased) && eventOrder.find(event => cohort.events.some(item => item.type === event)) === segment.event && cohort.events.some(item => item.type === segment.event && item.daysAgo <= effectiveWindow)).reduce((sum, cohort) => sum + cohort.count, 0) : 0;
  const template = campaignTemplates[segment?.event ?? "ViewContent"];
  const measurable = !["Lead", "Custom"].includes(draft.objective);
  const forecast = forecastCampaign({ audience: measurable ? audience : 0, budget: draft.budget.total, duration: draft.budget.duration, ctr: template.ctr, cvr: template.cvr, averageOrderValue: context.baseline.metaPurchases ? context.baseline.recoveredRevenue / context.baseline.metaPurchases : 0, cpm: channel?.cpm ?? 0, frequency: draft.frequency });
  const tracking = campaignTracking(draft, context.funnel.campaign.id);
  const checks = [
    { label: "Traffic Source Rule", ready: supported && draft.sourceIds.length > 0 && draft.sourceIds.every(id => context.funnel.sources.some(source => source.id === id)), reason: "ChatGPT → Meta Mock 조합과 유입 소스 선택이 필요합니다." },
    { label: "Audience Rule", ready: audience > 0, reason: "선택 조건에 맞는 Audience가 1명 이상 필요합니다." },
    { label: "Purchase Exclusion", ready: draft.purchaseExcluded, reason: "Mock 생성 전 구매 고객 제외를 ON으로 설정하세요." },
    { label: "Retargeting Window", ready: [3, 7, 14, 30].includes(draft.window), reason: "지원 Window를 선택하세요." },
    { label: "Budget", ready: Number.isFinite(draft.budget.total) && draft.budget.total > 0 && draft.budget.duration >= 1 && draft.budget.duration <= 90, reason: "양수 예산과 1~90일 집행 기간이 필요합니다." },
    { label: "Creative", ready: [draft.message.headline, draft.message.body, draft.message.cta, draft.name].every(value => value.trim().length > 0), reason: "이름·Headline·Body·CTA를 입력하세요." },
    { label: "Tracking Parameters", ready: new URLSearchParams(tracking.parameters).get("utm_campaign") !== "", reason: "추적 가능한 캠페인 이름을 입력하세요." },
    { label: "Performance Measurement", ready: measurable && supported, reason: "Lead/Custom 및 미지원 채널의 측정은 Coming Soon입니다." },
  ];
  return { audience, segmentName: segment?.name ?? "선택되지 않음", behavior: segment?.event ?? "ViewContent", priority: segment?.priority ?? "—", supported, forecast, tracking, checks, ready: checks.every(check => check.ready) };
}
