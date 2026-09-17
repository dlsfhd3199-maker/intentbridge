import type { Period, Advertiser } from "./domain";
import type { CampaignStore } from "./campaign";
import type { OperationsStore, SavedSimulation } from "./operations";
import type { ScenarioSelection, SimulationLevers } from "./simulation";
export interface AppSettings { defaultPeriod:Period; currency:"KRW"; locale:"ko-KR"; targetRoas:number; targetCpa:number; forecastScenario:"conservative"|"recommended"|"aggressive"; density:"compact"|"comfortable" }
export type ConnectionStatus="MOCK CONNECTED"|"NOT CONNECTED"|"READY FOR API"|"COMING SOON"|"REQUIRES SETUP";
export interface ReadinessItem { id:string; label:string; weight:number; ready:boolean; evidence:string }
export interface ConnectionDefinition { id:string; name:string; category:string; purpose:string; status:ConnectionStatus; permission:string; lastSync:string; credentials:string[]; permissions:string[]; data:string[]; usedBy:string[]; checklist:ReadinessItem[]; notes:string }
export interface ConnectionReadiness extends ConnectionDefinition { score:number; readiness:"READY"|"ACTION REQUIRED"; remaining:string[] }
export interface DailyMetric { date:string; spend:number; traffic:number; purchases:number; revenue:number; cpa:number|null; roas:number|null; frequency:number }
export interface TrendDetection { status:"Improving"|"Stable"|"Watch"|"Declining"; roasDayChange:number|null; cpaThreeDayChange:number|null; frequency:number; reasons:string[] }
export interface PerformanceTrend { rows:DailyMetric[]; detection:TrendDetection; scope:string; period:Period; totals:{spend:number;traffic:number;purchases:number;revenue:number} }
export type ConflictResolution="Manual Review Required"|"Higher Priority Wins"|"Skip Both";
export interface RuleConflict { campaignId:string; ruleIds:string[]; message:string; resolution:ConflictResolution; winnerId:string|null }
export interface BackupAdvertiser { advertiser:Advertiser; campaigns:CampaignStore; operations:OperationsStore; simulations:SavedSimulation[]; settings:AppSettings; currentSimulations:{period:Period;levers:SimulationLevers;scenario:ScenarioSelection}[] }
export interface AppBackup { schemaVersion:"1.0"; application:"IntentBridge"; createdAt:string; advertisers:BackupAdvertiser[]; userSettings:AppSettings }
export interface BackupValidation { valid:boolean; errors:string[]; data:AppBackup|null }
export interface ImportPreview { mode:"merge"|"replace"; conflicts:string[]; additions:number; result:AppBackup }
