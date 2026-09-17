export type Period = 7 | 14 | 30;
export type SourceId = "gpt-organic" | "gpt-ads" | "naver" | "google" | "meta" | "kakao" | "youtube" | "affiliate" | "crm" | "content" | "other";
export interface Advertiser { id: string; name: string; industry: string; productName: string }
export interface Query { advertiserId: string; period: Period }
export interface SourceMetrics { uniqueUsers: number; sessions: number; channels: { id: SourceId; name: string; users: number }[] }
export interface AnalyticsMetrics { viewContent: number; addToCart: number; beginCheckout: number; directPurchases: number; nonPurchaseUsers: number }
export interface RetargetingMetrics { retargetableAudience: number; recoveredPurchases: number; purchaseExcluded: true; segments: { id: string; name: string; volume: number; priority: string }[] }
export interface AdsMetrics { gptSpend: number; metaSpend: number; directRevenue: number; recoveredRevenue: number }
export interface DashboardData {
  advertiser: Advertiser; period: Period; source: SourceMetrics; analytics: AnalyticsMetrics;
  retargeting: RetargetingMetrics; finance: AdsMetrics;
  totals: { purchases: number; revenue: number; spend: number; cpa: number; roas: number };
}
