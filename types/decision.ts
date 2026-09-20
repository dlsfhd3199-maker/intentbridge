import type {Period, SourceId} from "./domain";
import type {BehaviorEvent, StageId} from "./funnel";
import type {CampaignForecast} from "./campaign";

export type SignalType = "DROP_OFF" | "PERFORMANCE_DROP" | "RECOVERY_OPPORTUNITY" | "CAMPAIGN_FATIGUE" | "DATA_ISSUE" | "POSITIVE_MOMENTUM";
export type Severity = "INFO" | "WATCH" | "ACTION" | "CRITICAL";
export type SignalStatus = "NEW" | "REVIEWING" | "ACTIONED" | "DISMISSED";
export type Confidence = "HIGH" | "MEDIUM" | "LOW";
export interface DecisionMetrics {stages: Record<StageId, number>; purchases:number; revenue:number; spend:number}
export interface DecisionAudience {segmentId:string; name:string; event:BehaviorEvent; window:Period; sourceIds:SourceId[]; sourceNames:string[]; excludePurchase:true; size:number}
export interface Evidence {label:string; current:number|null; previous:number|null; change:number|null; unit:"명"|"건"|"원"|"%"|"회"|"시간"; changeUnit:"%"|"%p"; threshold:string}
export interface DecisionInput {
  advertiserId:string; advertiserName:string; period:Period; endDate:string; observedAt:string;
  source:"DEMO"|"REAL"; sourceDescription:string; current:DecisionMetrics|null; previous:DecisionMetrics|null;
  audiences:DecisionAudience[];
  campaigns:{id:string; name:string; audience:number; current:{frequency:number;ctr:number;cvr:number}; previous:{frequency:number;ctr:number;cvr:number}|null}[];
  health:{status:"healthy"|"error"|"missing"; lastSync:string|null; reason?:string};
}
export interface Signal {
  id:string; advertiserId:string; advertiserName:string; type:SignalType; severity:Severity; title:string; summary:string;
  evidence:Evidence[]; audience:DecisionAudience|null; affectedUsers:number; revenueImpact:number;
  recommendedAction:string; expectedResult:CampaignForecast|null; source:DecisionInput["source"]; sourceDescription:string;
  createdAt:string; confidence:Confidence; priority:number; stage:StageId|null; period:Period; endDate:string;
}
