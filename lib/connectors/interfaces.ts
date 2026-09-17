import type { Query, SourceMetrics, AnalyticsMetrics, RetargetingMetrics, AdsMetrics } from "../../types/domain";
export interface SourceConnector { getSource(query: Query): Promise<SourceMetrics> }
export interface AnalyticsConnector { getAnalytics(query: Query): Promise<AnalyticsMetrics> }
export interface RetargetingConnector { getRetargeting(query: Query): Promise<RetargetingMetrics> }
export interface AdsConnector { getAds(query: Query): Promise<AdsMetrics> }
export interface Connectors { source: SourceConnector; analytics: AnalyticsConnector; retargeting: RetargetingConnector; ads: AdsConnector }

// GA4 uses distinct event-user/order contracts; it must not impersonate Mock cohorts.
export type {GA4AnalyticsConnector} from "../../types/ga4";
