import type { Advertiser, Period, SourceId } from "./domain";
import type { BehaviorEvent, FunnelWorkspaceData } from "./funnel";
import type { BaselineMetrics, ProjectedMetrics, Recommendation, ScenarioSelection, SimulationLevers } from "./simulation";

export type CampaignStatus = "DRAFT" | "READY" | "MOCK ACTIVE" | "PAUSED";
export type CampaignObjective = "Purchase" | "Recover Cart" | "Recover Checkout" | "Revisit Product" | "Lead" | "Custom";
export type CampaignWindow = 3 | 7 | 14 | 30;
export type FrequencyCap = "daily-1" | "daily-2" | "weekly-3" | "unlimited";
export interface ChannelCapability { status: "Available" | "Mock" | "Coming Soon"; forecast: boolean; create: boolean }
export interface CampaignChannel { id: string; name: string; source: boolean; retargeting: boolean; capability: ChannelCapability; previewLabel: string; cpm: number }
export interface CampaignMessage { headline: string; body: string; cta: string }
export interface CampaignBudget { daily: number; total: number; duration: number; mode: "daily" | "total" }
export interface CampaignForecast { label: "DEMO FORECAST"; reach: number; clicks: number; purchases: number; revenue: number; cpa: number | null; roas: number | null; modeledSpend: number; unspentBudget: number; impressions: number; ctr: number; cvr: number; averageOrderValue: number }
export interface CampaignTracking { parameters: string; sourceCampaignId: string; sourceChannel: string; sourceIds: SourceId[] }
export interface CampaignOrigin {
  from: "Performance Lab" | "Funnel Workspace" | "Campaign Studio";
  recommendation?: Pick<Recommendation, "id" | "priority" | "title" | "message">;
  scenario?: ScenarioSelection; levers?: SimulationLevers; forecast?: ProjectedMetrics;
  recommendedBudgetChange: number; segmentId: string; window: CampaignWindow; createdAt: string;
}
export interface CampaignDraft {
  draftId: string; advertiserId: string; period: Period; name: string; sourceChannelId: string; retargetingChannelId: string;
  sourceIds: SourceId[]; segmentId: string; objective: CampaignObjective; window: CampaignWindow; purchaseExcluded: boolean;
  frequency: FrequencyCap; message: CampaignMessage; budget: CampaignBudget; origin: CampaignOrigin;
  createdAt: string; updatedAt: string;
}
export interface Campaign extends CampaignDraft { id: string; status: CampaignStatus; audienceName: string; audienceSize: number; forecast: CampaignForecast; tracking: CampaignTracking; advertiserName: string }
export interface CampaignWorkspace { advertiser: Advertiser; funnel: FunnelWorkspaceData; baseline: BaselineMetrics }
export interface CampaignStore { drafts: CampaignDraft[]; versions: import("./operations").CampaignVersion[]; version: 1; draft: CampaignDraft | null; campaigns: Campaign[]; lastEdited: string | null }
export interface CampaignHandoff { id: string; advertiserId: string; period: Period; sourceChannelId: string; retargetingChannelId: string; sourceIds: SourceId[]; origin: CampaignOrigin }
export interface CampaignEvaluation { audience: number; segmentName: string; behavior: BehaviorEvent; priority: string; supported: boolean; forecast: CampaignForecast; tracking: CampaignTracking; checks: { label: string; ready: boolean; reason: string }[]; ready: boolean }
export interface SavedCampaignSimulation { id: string; label: string; baseline: BaselineMetrics; levers: SimulationLevers; forecast: ProjectedMetrics; recommendation: Recommendation | null }
export interface MessageTemplate { headline: string; body: string; cta: string; objective: CampaignObjective; frequency: FrequencyCap; ctr: number; cvr: number }
export interface CampaignForecastInput { audience: number; budget: number; duration: number; ctr: number; cvr: number; averageOrderValue: number; cpm: number; frequency: FrequencyCap }
