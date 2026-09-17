import {runtimeScope} from "../../lib/runtime-scope";
import type seedType from "../../mock/mock-data.json";
let seed:typeof seedType={advertisers:[]};
import type { Advertiser, Query } from "../../types/domain";

export const advertisers: Advertiser[] = [];
export function installFixtures(value:typeof seedType){seed=value;advertisers.splice(0,advertisers.length,...value.advertisers.map(({id,name,industry,productName})=>({id,name,industry,productName})));}

// Explicit illustrative period snapshots, not a historical time-series or forecast.
const periodWeights = { 7: 0.24, 14: 0.49, 30: 1 } as const;
export function getSnapshot(query: Query) {
  const brand = (runtimeScope()?.fixtures??seed).advertisers.find(item => item.id === query.advertiserId);
  if (!brand) throw new Error("알 수 없는 광고주입니다.");
  const weight = periodWeights[query.period];
  if (weight === undefined) throw new Error("지원하지 않는 기간입니다.");
  const scale = (value: number) => Math.round(value * weight);
  const organicUsers = scale(brand.source.organicUsers);
  const paidUsers = scale(brand.source.paidUsers);
  const directPurchases = scale(brand.funnel.directPurchases);
  const recoveredPurchases = scale(brand.funnel.recoveredPurchases);
  const segments = brand.segments.map(segment => ({ ...segment, volume: scale(segment.volume) }));
  // Synthetic anonymous event journeys. Both purchase paths are excluded.
  // These records stay in the data layer; only aggregate counts reach the UI.
  const journeys = Array.from({ length: organicUsers + paidUsers }, (_, index) => ({
    events: index < directPurchases ? ["visit", "purchase-direct"] :
      index < directPurchases + recoveredPurchases ? ["visit", "purchase-recovered"] : ["visit"],
  }));
  return {
    source: { uniqueUsers: organicUsers + paidUsers, sessions: scale(brand.source.sessions), organicUsers, paidUsers },
    analytics: {
      viewContent: scale(brand.funnel.viewContent), addToCart: scale(brand.funnel.addToCart),
      beginCheckout: scale(brand.funnel.beginCheckout), directPurchases,
      nonPurchaseUsers: journeys.filter(journey => !journey.events.some(event => event.startsWith("purchase-"))).length,
    },
    retargeting: { retargetableAudience: segments.reduce((sum, segment) => sum + segment.volume, 0), recoveredPurchases, purchaseExcluded: true as const, segments },
    finance: { gptSpend: scale(brand.finance.gptSpend), metaSpend: scale(brand.finance.metaSpend), directRevenue: scale(brand.finance.directRevenue), recoveredRevenue: scale(brand.finance.recoveredRevenue) },
  };
}
