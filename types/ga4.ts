import type {TrafficSource} from "./funnel";
import type { Period, Query, SourceId } from "./domain";
export type DataSourceType = "real" | "mock" | "forecast" | "mixed";
export type DataMode = "mock" | "real";
export interface AdvertiserConnection { advertiserId:string; analyticsProvider:"ga4"; propertyId:string|null; dataMode:DataMode }
export interface FunnelEventMapping { viewContent:string; addToCart:string; beginCheckout:string; purchase:string }
export interface GA4Overview { users:number; sessions:number; purchases:number; purchaseRevenue:number; currency:string }
export interface GA4TrafficSource extends Omit<TrafficSource,"id"|"medium"> { id:string; channelId:SourceId; name:string; source:string; medium:string; sourceMedium:string; classification:"GPT Organic"|"GPT Paid"|"GPT Unclassified"|"Other"; users:number; sessions:number; purchases:number; purchaseRevenue:number }
export interface GA4Event { key:keyof FunnelEventMapping; eventName:string; users:number; found:boolean }
export interface GA4Daily extends GA4Overview { date:string }
export type GA4ErrorCode="MISSING_CONFIGURATION"|"INVALID_PROPERTY"|"PERMISSION_DENIED"|"AUTHENTICATION_ERROR"|"QUOTA_ERROR"|"RATE_LIMIT"|"API_ERROR"|"TIMEOUT";
export interface GA4Failure { code:GA4ErrorCode; message:string }
export interface GA4ConnectionStatus { status:"NOT CONFIGURED"|"CONFIGURED"|"CONNECTED"|"PERMISSION ERROR"|"API ERROR"; propertyId:string|null; lastTested:string|null; readOnly:true; error?:GA4Failure; quotaRemaining:number|null }
export interface GA4Snapshot { provenance:"real"; advertiserId:string; period:Period; propertyId:string; startDate:string; endDate:"yesterday"; timezone:string; fetchedAt:string; overview:GA4Overview; events:GA4Event[]; sources:GA4TrafficSource[]; daily:GA4Daily[]; warnings:string[]; quotaRemaining:number|null }
export interface GA4Envelope { mode:DataMode; connection:GA4ConnectionStatus; snapshot?:GA4Snapshot; error?:GA4Failure }
export interface GA4AnalyticsConnector {
 getOverviewMetrics(query:Query):Promise<GA4Overview>;
 getTrafficSources(query:Query):Promise<GA4TrafficSource[]>;
 getFunnelMetrics(query:Query):Promise<GA4Event[]>;
 getDailyMetrics(query:Query):Promise<GA4Daily[]>;
 testConnection():Promise<GA4ConnectionStatus>;
 getConnectionStatus():GA4ConnectionStatus;
}
