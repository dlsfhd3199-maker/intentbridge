import type { Campaign, CampaignForecast, CampaignWindow } from "./campaign";
import type { Period } from "./domain";
import type { BaselineMetrics, ProjectedMetrics, ScenarioSelection, SimulationLevers } from "./simulation";
export type OperationMetric = "roas" | "cpa" | "ctr" | "cvr" | "frequency" | "spend" | "purchases" | "audienceRemaining" | "dailyBudgetUsage";
export interface AutomationCondition { metric: OperationMetric; operator: ">" | "<" | ">=" | "<="; value: number }
export type ActionKind = "Increase Budget" | "Decrease Budget" | "Pause" | "Resume" | "Creative Refresh" | "Audience Expand" | "Window Change" | "Notify Only";
export interface AutomationAction { type: ActionKind; value: number }
export interface AutomationRule { id: string; advertiserId: string; campaignId: string; name: string; conditions: AutomationCondition[]; action: AutomationAction; enabled: boolean; createdAt: string; priority?:1|2|3|4|5 }
export type CampaignHealth = "HEALTHY" | "WATCH" | "ACTION REQUIRED" | "LIMITED" | "LEARNING";
export interface OperationMetrics { spend: number; purchases: number; revenue: number; cpa: number | null; roas: number | null; ctr: number; cvr: number; frequency: number; audienceRemaining: number; dailyBudgetUsage: number; impressions: number; clicks: number; reach: number }
export interface CampaignTarget { cpa: number; roas: number }
export interface Guardrail { minDaily: number; maxDaily: number; maxIncrease: number; minAudience: number; maxFrequency: number }
export interface OperationPreview { matched: boolean; valid: boolean; allowed: boolean; reasons: string[]; supporting: string[]; before: Campaign; after: Campaign; forecast: CampaignForecast; purchaseDelta: number; revenueDelta: number; category: ChangeCategory }
export type ChangeCategory = "Budget" | "Status" | "Audience" | "Creative" | "Window" | "Notification";
export interface OperationRecommendation { id: string; campaignId: string; campaignName: string; priority: number; rule: AutomationRule; preview: OperationPreview; reason: string; status: "PENDING" | "IGNORED" | "APPLIED IN MOCK"; conflict?:import("./mvp").RuleConflict }
export interface OperationChange { id: string; advertiserId: string; campaignId: string; campaignName: string; createdAt: string; type: ChangeCategory | "ROLLBACK"; before: Campaign; after: Campaign; reason: string; source: string; actor: "User" | "Automation"; status: "APPLIED IN MOCK" | "ROLLBACK"; rollbackOf?: string; version: number }
export interface CampaignVersion { id: string; campaignId: string; advertiserId: string; version: number; createdAt: string; reason: string; snapshot: Campaign }
export interface Alert { id: string; advertiserId: string; campaignId: string; type: "INFO" | "SUCCESS" | "WARNING" | "CRITICAL"; message: string; createdAt: string; read: boolean }
export interface OperationsStore { schema: 1; rules: AutomationRule[]; targets: Record<string,CampaignTarget>; guardrails: Record<string,Guardrail>; history: OperationChange[]; versions: CampaignVersion[]; alerts: Alert[]; decisions: Record<string,"IGNORED" | "APPLIED IN MOCK">; conflictResolutions?:Record<string,import("./mvp").ConflictResolution>; signalStates?:Record<string,import("./decision").SignalStatus> }
export interface MonitoredCampaign { campaign: Campaign; metrics: OperationMetrics; health: CampaignHealth; reason: string; target: CampaignTarget; guardrail: Guardrail }
export interface OperationsWorkspace { advertiserId: string; period: Period; campaigns: MonitoredCampaign[]; recommendations: OperationRecommendation[]; store: OperationsStore }
export interface SavedSimulation { id: string; advertiserId: string; name: string; createdAt: string; scenario: ScenarioSelection; period: Period; levers: SimulationLevers; baseline: BaselineMetrics; forecast: ProjectedMetrics }
export type ExportFormat = "json" | "csv" | "html";
export interface CampaignPlan { label: "DEMO FORECAST"; exportedAt: string; campaign: Campaign; rules: AutomationRule[]; target: CampaignTarget; guardrail: Guardrail; notes: string }
export const operationWindows: CampaignWindow[] = [3,7,14,30];
