import type { Period } from "./domain";
import type { Channel, TrafficSource } from "./funnel";

export interface RetargetingChannel extends Channel { kind: "retargeting" }
export interface PerformanceMetrics {
  visitors: number; viewContent: number; addToCart: number; checkout: number;
  directPurchases: number; metaPurchases: number; totalPurchases: number;
  recoveryPool: number; revenue: number; adSpend: number; cpa: number | null; roas: number | null;
}
export interface BaselineMetrics extends PerformanceMetrics {
  advertiserId: string; advertiserName: string; period: Period;
  trafficSources: TrafficSource[]; sourceChannel: Channel; retargetingChannel: RetargetingChannel;
  organicVisitors: number; paidVisitors: number; currentAudience: number;
  acquisitionSpend: number; retargetingSpend: number; directRevenue: number; recoveredRevenue: number;
}
export interface SimulationLevers {
  landing: number; cart: number; checkout: number; retargetingEfficiency: number;
  acquisitionBudget: number; retargetingBudget: number;
}
export type LeverId = keyof SimulationLevers;
export interface SimulationScenario { id: "conservative" | "recommended" | "aggressive"; name: string; englishName: string; levers: SimulationLevers }
export type ScenarioSelection = SimulationScenario["id"] | "custom" | "baseline";
export interface ForecastConfidence { level: "HIGH" | "MEDIUM" | "LOW"; magnitude: number; explanation: string }
export interface SimulationBreakdown { id: string; label: string; delta: number; cumulative: number }
export interface ProjectedMetrics extends PerformanceMetrics {
  label: "DEMO FORECAST"; levers: SimulationLevers; confidence: ForecastConfidence; breakdown: SimulationBreakdown[];
}
export interface Bottleneck {
  id: string; label: string; currentRate: number | null; benchmark: number; severity: "Healthy" | "Watch" | "Opportunity" | "Critical";
  dropOff: number; opportunity: number; message: string; lever: LeverId;
}
export interface Recommendation { id: string; priority: number; title: string; message: string; actionLabel: string; changes: Partial<SimulationLevers> }
export interface SimulationSetting { scenario: ScenarioSelection; levers: SimulationLevers; forecast: ProjectedMetrics }
export interface MetricComparison { id: keyof PerformanceMetrics; label: string; current: number | null; forecast: number | null; change: number | null; changePercent: number | null; direction: "better" | "worse" | "neutral"; format: "count" | "money" | "percent" }
export interface ChartPair { id: string; label: string; current: number | null; forecast: number | null; currentWidth: number; forecastWidth: number; format: "count" | "money" | "percent"; unit: string }
