import { getDashboard } from "../dashboard";
import { loadFunnelWorkspace } from "../funnel";
import type { Query } from "../../types/domain";
import type { BaselineMetrics } from "../../types/simulation";

export async function loadPerformanceBaseline(query: Query): Promise<BaselineMetrics> {
  const [home, funnel] = await Promise.all([getDashboard(query), loadFunnelWorkspace(query)]);
  const stage = (id: string) => funnel.stages.find(item => item.id === id)?.users ?? 0;
  const sourceChannel = funnel.channels.find(channel => channel.id === funnel.campaign.sourceChannelId)!;
  const retarget = funnel.channels.find(channel => channel.id === funnel.campaign.retargetingChannelId)!;
  return {
    advertiserId: home.advertiser.id, advertiserName: home.advertiser.name, period: query.period,
    trafficSources: funnel.sources, sourceChannel, retargetingChannel: { ...retarget, kind: "retargeting" },
    visitors: home.source.uniqueUsers, organicVisitors: funnel.sourceRows.filter(row => row.medium !== "paid").reduce((sum, row) => sum + row.uniqueUsers, 0),
    paidVisitors: funnel.sourceRows.filter(row => row.medium === "paid").reduce((sum, row) => sum + row.uniqueUsers, 0),
    viewContent: stage("ViewContent"), addToCart: stage("AddToCart"), checkout: stage("BeginCheckout"),
    directPurchases: home.analytics.directPurchases, metaPurchases: home.retargeting.recoveredPurchases, totalPurchases: home.totals.purchases,
    currentAudience: home.retargeting.retargetableAudience,
    // Synthetic period cohort: survivors + recovered purchasers. Never use current Audience alone as historical denominator.
    recoveryPool: home.retargeting.retargetableAudience + home.retargeting.recoveredPurchases,
    acquisitionSpend: home.finance.gptSpend, retargetingSpend: home.finance.metaSpend,
    directRevenue: home.finance.directRevenue, recoveredRevenue: home.finance.recoveredRevenue,
    revenue: home.totals.revenue, adSpend: home.totals.spend, cpa: home.totals.cpa, roas: home.totals.roas,
  };
}
