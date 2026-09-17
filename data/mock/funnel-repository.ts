import {runtimeScope} from "../../lib/runtime-scope";
import { advertisers, getSnapshot } from "./repository";
import type { Query } from "../../types/domain";
import type { BehaviorEvent, Channel, FunnelDataset, MockJourney, SegmentRule, TrafficSource } from "../../types/funnel";

const channels: Channel[] = [
  { id: "chatgpt", name: "ChatGPT" }, { id: "meta", name: "Meta" },
  { id: "naver", name: "Naver" }, { id: "google", name: "Google" },
  { id: "kakao", name: "Kakao" }, { id: "youtube", name: "YouTube" },
  { id: "affiliate", name: "Affiliate" }, { id: "crm", name: "CRM" }, { id: "other", name: "기타" },
];
const sources: TrafficSource[] = [
  { id: "gpt-organic", channelId: "chatgpt", name: "GPT Organic", medium: "organic" },
  { id: "gpt-ads", channelId: "chatgpt", name: "GPT Ads", medium: "paid" },
];
const segmentRules: SegmentRule[] = [
  { id: "checkout-7d", name: "결제진입 / 미구매 / 7일", event: "BeginCheckout", window: 7, priority: "HIGH", message: "구매를 완료하지 않으셨나요? 고민하던 상품을 다시 확인해 보세요.", cta: "구매 계속하기", forecastRate: 0.12, costPerPerson: 2400 },
  { id: "cart-14d", name: "장바구니 / 미구매 / 14일", event: "AddToCart", window: 14, priority: "MEDIUM", message: "장바구니에 담아둔 상품이 기다리고 있어요. 배송과 혜택을 확인해 보세요.", cta: "장바구니 확인", forecastRate: 0.07, costPerPerson: 1700 },
  { id: "view-30d", name: "상품조회 / 미구매 / 30일", event: "ViewContent", window: 30, priority: "BROAD", message: "아직 구매를 고민 중이신가요? 실제 사용 후기와 상품 정보를 만나보세요.", cta: "상품 다시 보기", forecastRate: 0.035, costPerPerson: 1100 },
];
const allocateRevenue = (total: number, count: number, index: number) => Math.floor(total / count) + (index < total % count ? 1 : 0);

export function getFunnelDataset(query: Query): FunnelDataset {
  const snapshot = getSnapshot(query);
  const advertiser = (runtimeScope()?.advertisers??advertisers).find(item => item.id === query.advertiserId)!;
  const { source, analytics, retargeting, finance } = snapshot;
  const purchased = analytics.directPurchases + retargeting.recoveredPurchases;
  const journeys: MockJourney[] = Array.from({ length: source.uniqueUsers }, (_, index) => {
    // Evenly interleave source membership while keeping the original exact source totals.
    const isOrganic = Math.floor((index + 1) * source.organicUsers / source.uniqueUsers) > Math.floor(index * source.organicUsers / source.uniqueUsers);
    const depth = index < analytics.beginCheckout ? "BeginCheckout" : index < analytics.addToCart ? "AddToCart" : "ViewContent";
    const window = segmentRules.find(rule => rule.event === depth)!.window;
    const daysAgo = index % Math.min(query.period, window) + 1;
    const events: MockJourney["events"] = [];
    const thresholds: [BehaviorEvent, number][] = [["ViewContent", analytics.viewContent], ["AddToCart", analytics.addToCart], ["BeginCheckout", analytics.beginCheckout]];
    for (const [type, count] of thresholds) if (index < count) events.push({ type, daysAgo });
    const conversion: MockJourney["conversion"] = index < analytics.directPurchases
      ? { path: "direct", revenue: { amount: allocateRevenue(finance.directRevenue, analytics.directPurchases, index), currency: "KRW" } }
      : index < purchased ? { path: "recovered", revenue: { amount: allocateRevenue(finance.recoveredRevenue, retargeting.recoveredPurchases, index - analytics.directPurchases), currency: "KRW" } } : undefined;
    return {
      sourceId: sources[isOrganic ? 0 : 1].id,
      sessions: 1 + Math.floor((source.sessions - source.uniqueUsers) / source.uniqueUsers) + (index < (source.sessions - source.uniqueUsers) % source.uniqueUsers ? 1 : 0),
      events, conversion,
      // Eligibility is a fixture flag, not a claim about real consent or platform reach.
      eligible: index < purchased + retargeting.retargetableAudience && events.length > 0,
    };
  });
  return {
    query, advertiser, channels, sources, segmentRules, journeys,
    campaign: { id: `${advertiser.id}-gpt-meta`, advertiserId: advertiser.id, name: `${advertiser.productName} 관심 고객 회수`, status: "MOCK ACTIVE", sourceChannelId: "chatgpt", retargetingChannelId: "meta" },
    spend: finance.gptSpend + finance.metaSpend,
  };
}
