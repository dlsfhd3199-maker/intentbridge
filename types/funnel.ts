import type { Advertiser, Period, Query, SourceId } from "./domain";

export type ChannelId = string;
export type BehaviorEvent = "ViewContent" | "AddToCart" | "BeginCheckout";
export type StageId = "Visit" | BehaviorEvent | "Purchase";
export interface Channel { id: ChannelId; name: string }
export interface TrafficSource { id: SourceId; channelId: ChannelId; name: string; medium: "organic" | "paid" | "referral" }
export interface Campaign { id: string; advertiserId: string; name: string; status: "MOCK ACTIVE"; sourceChannelId: ChannelId; retargetingChannelId: ChannelId }
export interface Revenue { amount: number; currency: "KRW" }
export interface Conversion { path: "direct" | "recovered"; revenue: Revenue }
// Entirely synthetic, never a customer identifier. Kept in the service/repository layer.
export interface MockJourney { sourceId: SourceId; sessions: number; events: { type: BehaviorEvent; daysAgo: number }[]; conversion?: Conversion; eligible: boolean }
export interface SegmentRule { id: string; name: string; event: BehaviorEvent; window: Period; priority: "HIGH" | "MEDIUM" | "BROAD"; message: string; cta: string; forecastRate: number; costPerPerson: number }
export interface FunnelDataset {
  query: Query; advertiser: Advertiser; campaign: Campaign; channels: Channel[]; sources: TrafficSource[];
  segmentRules: SegmentRule[]; journeys: MockJourney[]; spend: number;
}
export interface FunnelStage { id: StageId; label: string; users: number; conversionRate: number | null; dropOff: number; status: "유입" | "관찰" | "병목" | "데이터 없음"; insight: string }
export interface SourceAnalysis extends TrafficSource { uniqueUsers: number; sessions: number; viewContent: number; addToCart: number; beginCheckout: number; purchases: number; recoveredPurchases: number; revenue: Revenue; recoveredRevenue: Revenue; spend: number; cvr: number }
export interface AudienceSegment extends SegmentRule { volume: number; share: number; status: "미리보기 가능" | "대상 없음" }
export interface AudienceCohort { sourceId: SourceId; events: { type: BehaviorEvent; daysAgo: number }[]; purchased: boolean; eligible: boolean; count: number }
export interface AudienceConditions { sources: SourceId[]; events: BehaviorEvent[]; window: Period; excludePurchase: boolean }
export interface AudienceEstimate { size: number; purchaseUsersIncluded: number; effectiveWindow: Period }
export interface RetargetingCampaign { segmentId: string; audience: number; channelName: string; message: string; cta: string; window: Period; forecastPurchases: number; forecastSpend: number; forecastCpa: number | null; label: "DEMO FORECAST" }
export interface FunnelWorkspaceData {
  query: Query; advertiser: Advertiser; campaign: Campaign; channels: Channel[]; sources: TrafficSource[];
  sourceRows: SourceAnalysis[]; stages: FunnelStage[]; segments: AudienceSegment[]; cohorts: AudienceCohort[];
  totals: { users: number; sessions: number; direct: number; recovered: number; purchases: number; initialNonPurchase: number; currentNonPurchase: number; audience: number; revenue: number; spend: number; cpa: number; roas: number };
  bottleneck: FunnelStage | null;
}
