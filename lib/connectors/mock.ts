import { getSnapshot } from "../../data/mock/repository";
import type { Query, SourceMetrics } from "../../types/domain";
import type { SourceConnector, AnalyticsConnector, RetargetingConnector, AdsConnector, Connectors } from "./interfaces";
export class MockSourceConnector implements SourceConnector {
  async getSource(query: Query): Promise<SourceMetrics> {
    const { source } = getSnapshot(query);
    return { uniqueUsers: source.uniqueUsers, sessions: source.sessions, channels: [
      { id: "gpt-organic", name: "GPT Organic", users: source.organicUsers },
      { id: "gpt-ads", name: "GPT Ads", users: source.paidUsers },
    ] };
  }
}
export class MockAnalyticsConnector implements AnalyticsConnector { async getAnalytics(query: Query) { return getSnapshot(query).analytics; } }
export class MockRetargetingConnector implements RetargetingConnector { async getRetargeting(query: Query) { return getSnapshot(query).retargeting; } }
export class MockAdsConnector implements AdsConnector { async getAds(query: Query) { return getSnapshot(query).finance; } }
export const mockConnectors: Connectors = { source: new MockSourceConnector(), analytics: new MockAnalyticsConnector(), retargeting: new MockRetargetingConnector(), ads: new MockAdsConnector() };
