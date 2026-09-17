import {runtimeScope} from "./runtime-scope";
import {assertAccess} from "./permissions";
import { advertisers } from "../data/mock/repository";
import { mockConnectors } from "./connectors/mock";
import type { Connectors } from "./connectors/interfaces";
import type { DashboardData, Query } from "../types/domain";
export { advertisers };
export async function getDashboard(query: Query, connectors: Connectors = mockConnectors): Promise<DashboardData> {
  assertAccess(query.advertiserId);
  const advertiser = (runtimeScope()?.advertisers??advertisers).find(item => item.id === query.advertiserId);
  if (!advertiser) throw new Error("광고주를 찾을 수 없습니다.");
  const [source, analytics, retargeting, finance] = await Promise.all([
    connectors.source.getSource(query), connectors.analytics.getAnalytics(query),
    connectors.retargeting.getRetargeting(query), connectors.ads.getAds(query),
  ]);
  const purchases = analytics.directPurchases + retargeting.recoveredPurchases;
  const revenue = finance.directRevenue + finance.recoveredRevenue;
  const spend = finance.gptSpend + finance.metaSpend;
  return { advertiser, period: query.period, source, analytics, retargeting, finance,
    totals: { purchases, revenue, spend, cpa: purchases ? spend / purchases : 0, roas: spend ? revenue / spend * 100 : 0 } };
}
