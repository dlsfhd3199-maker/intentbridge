import {assertAccess} from "./permissions";
import type { Period, Query, SourceId } from "../types/domain";
import type { AudienceCohort, AudienceConditions, AudienceEstimate, AudienceSegment, BehaviorEvent, FunnelDataset, FunnelStage, FunnelWorkspaceData, MockJourney, RetargetingCampaign, SourceAnalysis } from "../types/funnel";
import { mockFunnelConnector, type FunnelConnector } from "./connectors/funnel";

const ratio = (part: number, total: number) => total ? part / total * 100 : 0;
const hasEvent = (journey: Pick<MockJourney, "events">, event: BehaviorEvent, window = 30) => journey.events.some(item => item.type === event && item.daysAgo <= window);
const eventOrder: BehaviorEvent[] = ["BeginCheckout", "AddToCart", "ViewContent"];
export const audienceEventOptions: { id: BehaviorEvent; label: string }[] = [
  { id: "ViewContent", label: "상품조회" }, { id: "AddToCart", label: "장바구니" }, { id: "BeginCheckout", label: "결제진입" },
];

export async function loadFunnelWorkspace(query: Query, connector: FunnelConnector = mockFunnelConnector): Promise<FunnelWorkspaceData> {
  assertAccess(query.advertiserId);
  return aggregateFunnel(await connector.getDataset(query));
}

function aggregateFunnel(dataset: FunnelDataset): FunnelWorkspaceData {
  const { journeys, query } = dataset;
  let allocatedSpend = 0;
  const sourceRows: SourceAnalysis[] = dataset.sources.map((source, index) => {
    const rows = journeys.filter(journey => journey.sourceId === source.id);
    const purchases = rows.filter(row => row.conversion?.path === "direct").length;
    const spend = journeys.length === 0 ? 0 : index === dataset.sources.length - 1 ? dataset.spend - allocatedSpend : Math.round(dataset.spend * rows.length / journeys.length);
    allocatedSpend += spend;
    return { ...source, spend, uniqueUsers: rows.length, sessions: rows.reduce((sum, row) => sum + row.sessions, 0),
      viewContent: rows.filter(row => hasEvent(row, "ViewContent")).length,
      addToCart: rows.filter(row => hasEvent(row, "AddToCart")).length,
      beginCheckout: rows.filter(row => hasEvent(row, "BeginCheckout")).length,
      purchases, recoveredPurchases: rows.filter(row => row.conversion?.path === "recovered").length,
      revenue: { amount: rows.reduce((sum, row) => sum + (row.conversion?.path === "direct" ? row.conversion.revenue.amount : 0), 0), currency: "KRW" },
      recoveredRevenue: { amount: rows.reduce((sum, row) => sum + (row.conversion?.path === "recovered" ? row.conversion.revenue.amount : 0), 0), currency: "KRW" },
      cvr: ratio(purchases, rows.length),
    };
  });
  // Collapse synthetic journeys to anonymous event cohorts; the UI gets no individual records.
  const cohortMap = new Map<string, AudienceCohort>();
  for (const row of journeys) {
    const value = { sourceId: row.sourceId, events: row.events, purchased: !!row.conversion, eligible: row.eligible };
    const key = JSON.stringify(value);
    const found = cohortMap.get(key);
    if (found) found.count += 1;
    else cohortMap.set(key, { ...value, count: 1 });
  }
  const cohorts = [...cohortMap.values()];
  const segments = dataset.segmentRules.map(rule => ({ ...rule, volume: 0, share: 0, status: "대상 없음" as AudienceSegment["status"] }));
  const initial: FunnelWorkspaceData = {
    query, advertiser: dataset.advertiser, campaign: dataset.campaign, channels: dataset.channels, sources: dataset.sources, sourceRows,
    stages: [], segments, cohorts, bottleneck: null,
    totals: { users: 0, sessions: 0, direct: 0, recovered: 0, purchases: 0, initialNonPurchase: 0, currentNonPurchase: 0, audience: 0,
      revenue: journeys.reduce((sum, row) => sum + (row.conversion?.revenue.amount ?? 0), 0), spend: dataset.spend, cpa: 0, roas: 0 },
  };
  return filterFunnel(initial, dataset.sources.map(source => source.id));
}

export function filterFunnel(data: FunnelWorkspaceData, sourceIds: SourceId[]): FunnelWorkspaceData {
  const rows = data.sourceRows.filter(row => sourceIds.includes(row.id));
  const cohorts = data.cohorts.filter(row => sourceIds.includes(row.sourceId));
  const sum = (key: "uniqueUsers" | "sessions" | "purchases" | "recoveredPurchases" | "viewContent" | "addToCart" | "beginCheckout") => rows.reduce((total, row) => total + row[key], 0);
  const users = sum("uniqueUsers"), direct = sum("purchases"), recovered = sum("recoveredPurchases");
  const currentNonPurchase = cohorts.filter(row => !row.purchased).reduce((total, row) => total + row.count, 0);
  const audience = cohorts.filter(row => !row.purchased && row.eligible && row.events.length > 0).reduce((total, row) => total + row.count, 0);
  const values: [FunnelStage["id"], string, number][] = [["Visit", "유입 고객", users], ["ViewContent", "상품조회", sum("viewContent")], ["AddToCart", "장바구니", sum("addToCart")], ["BeginCheckout", "결제진입", sum("beginCheckout")], ["Purchase", "직접 구매", direct]];
  const stages: FunnelStage[] = values.map(([id, label, count], index) => {
    const previous = index ? values[index - 1][2] : null;
    return { id, label, users: count, conversionRate: previous === null || !previous ? null : ratio(count, previous), dropOff: previous === null ? 0 : previous - count,
      status: count === 0 ? "데이터 없음" : index === 0 ? "유입" : "관찰",
      insight: index === 0 ? "선택한 유입 소스의 고유 고객입니다." : `${values[index - 1][1]} 고객 중 ${previous ? ratio(count, previous).toFixed(1) : "0"}%가 이 단계에 도달했습니다.` };
  });
  const candidates = stages.slice(1).filter(stage => stage.conversionRate !== null);
  const bottleneck = candidates.length ? candidates.reduce((lowest, stage) => stage.conversionRate! < lowest.conversionRate! ? stage : lowest) : null;
  if (bottleneck) {
    bottleneck.status = "병목";
    const previous = stages[stages.indexOf(bottleneck) - 1];
    bottleneck.insight = `${previous.label} → ${bottleneck.label} 전환율이 가장 낮습니다. (${bottleneck.conversionRate!.toFixed(1)}%)`;
  }
  const segments: AudienceSegment[] = data.segments.map(rule => {
    const volume = cohorts.filter(row => row.eligible && !row.purchased && eventOrder.find(event => hasEvent(row, event)) === rule.event && hasEvent(row, rule.event, Math.min(data.query.period, rule.window))).reduce((total, row) => total + row.count, 0);
    return { ...rule, volume, share: ratio(volume, currentNonPurchase), status: volume ? "미리보기 가능" : "대상 없음" };
  });
  const purchases = direct + recovered;
  const revenue = rows.reduce((total, row) => total + row.revenue.amount + row.recoveredRevenue.amount, 0);
  const spend = rows.reduce((total, row) => total + row.spend, 0);
  return { ...data, sourceRows: rows, cohorts, stages, segments, bottleneck,
    totals: { ...data.totals, users, sessions: sum("sessions"), direct, recovered, purchases,
      initialNonPurchase: cohorts.filter(row => !row.purchased).reduce((total, row) => total + row.count, 0) + recovered,
      currentNonPurchase, audience, revenue, spend, cpa: purchases ? spend / purchases : 0,
      roas: spend ? revenue / spend * 100 : 0 },
  };
}

export function estimateAudience(data: FunnelWorkspaceData, conditions: AudienceConditions): AudienceEstimate {
  const effectiveWindow = Math.min(data.query.period, conditions.window) as Period;
  const matched = data.cohorts.filter(row => row.eligible && conditions.sources.includes(row.sourceId) && (!conditions.excludePurchase || !row.purchased) && conditions.events.some(event => hasEvent(row, event, effectiveWindow)));
  return { size: matched.reduce((sum, row) => sum + row.count, 0), purchaseUsersIncluded: matched.filter(row => row.purchased).reduce((sum, row) => sum + row.count, 0), effectiveWindow };
}

export function previewRetargeting(segment: AudienceSegment, channelName: string, period: Period): RetargetingCampaign {
  const forecastPurchases = Math.round(segment.volume * segment.forecastRate);
  const forecastSpend = segment.volume * segment.costPerPerson;
  return { segmentId: segment.id, audience: segment.volume, channelName, message: segment.message, cta: segment.cta, window: Math.min(segment.window, period) as Period,
    forecastPurchases, forecastSpend, forecastCpa: forecastPurchases ? forecastSpend / forecastPurchases : null, label: "DEMO FORECAST" };
}
