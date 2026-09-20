import type {DashboardData} from './domain';
export type ConnectorId='ga4'|'naver'|'meta'|'google'|'kakao'|'daangn'|'ai';
export type ConnectorState='disconnected'|'setup'|'connecting'|'healthy'|'attention'|'error';
export interface ConnectorDefinition {id:ConnectorId;name:string;icon:string;description:string;fields:string[];accounts:string[];properties:string[];kind:'analytics'|'ads';planned?:boolean}
export interface DemoConnection {state:ConnectorState;account:string;property:string;fields:string[];lastSync:string|null}
export interface PlatformDocument {version:1;profile:{siteUrl:string;monthlyBudget:number;goal:string};connections:Partial<Record<ConnectorId,DemoConnection>>;validated:boolean;started:boolean;activity:{id:string;at:string;label:string}[]}
export interface PlatformView {document:PlatformDocument;revision:number;managers:{id:string;name:string}[];status:string;hasData:boolean;activity?:PlatformDocument['activity']}
export interface ConnectorMetrics {label:string;value:number;unit?:string}
export interface PlatformConnector {definition:ConnectorDefinition;test(input:{account:string;property:string;fields:string[]}):Promise<{ok:boolean;message:string}>;collect(data:DashboardData):ConnectorMetrics[]}
export interface AnalyticsConnector extends PlatformConnector {readonly category:'analytics'}
export interface AdsConnector extends PlatformConnector {readonly category:'ads'}
