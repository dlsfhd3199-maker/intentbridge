import type {Query} from "../../types/domain";
import type {GA4AnalyticsConnector,GA4ConnectionStatus,GA4Snapshot} from "../../types/ga4";
import type {GA4ServerConfig} from "./config";
import {dateRange} from "./definitions";
import {GA4Error,safeGA4Error} from "./errors";
import {normalizeOverview,normalizeEvents,normalizeSources,normalizeDaily,type ReportResponse} from "./normalizer";
import type {ConnectorRequestPolicy} from "../connectors/base";
export interface ReportRequest { property:string; dateRanges:{startDate:string;endDate:string}[]; metrics:{name:string}[]; dimensions?:{name:string}[]; dimensionFilter?:{filter:{fieldName:string;inListFilter:{values:string[]}}}; limit:number;returnPropertyQuota:true; orderBys?:({metric:{metricName:string};desc:boolean}|{dimension:{dimensionName:string};desc:boolean})[] }
export interface GA4ReadClient { runReport(request:ReportRequest,timeoutMs:number):Promise<ReportResponse> }
const metrics=["totalUsers","sessions","ecommercePurchases","purchaseRevenue"];
export const ga4RequestPolicy:ConnectorRequestPolicy={timeoutMs:10000,retry:{maxAttempts:3,baseDelayMs:1000,maxDelayMs:4000},onRateLimit:"fail"};
export class GA4Connector implements GA4AnalyticsConnector {
 private status:GA4ConnectionStatus;private cache=new Map<string,{expires:number;promise:Promise<ReportResponse>}>();
 constructor(private config:GA4ServerConfig,private client:GA4ReadClient,private policy=ga4RequestPolicy,private delay=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms))){this.status={status:config.invalid?"API ERROR":config.propertyId&&config.keyFilename?"CONFIGURED":"NOT CONFIGURED",propertyId:config.propertyId,lastTested:null,readOnly:true,quotaRemaining:null};}
 getConnectionStatus(){return structuredClone(this.status);}
 private async request(query:Query,kind:"overview"|"events"|"sources"|"daily"|"test"):Promise<ReportResponse>{
  if(this.config.invalid)throw new GA4Error("INVALID_PROPERTY");if(!this.config.propertyId||!this.config.keyFilename)throw new GA4Error("MISSING_CONFIGURATION");if(query.advertiserId!==this.config.advertiserId)throw new GA4Error("INVALID_PROPERTY");
  const key=JSON.stringify([query,this.config.propertyId,kind,this.config.events]);const cached=this.cache.get(key);if(cached&&cached.expires>Date.now())return cached.promise;
  const req:ReportRequest={property:`properties/${this.config.propertyId}`,dateRanges:[kind==="test"?{startDate:"yesterday",endDate:"yesterday"}:dateRange(query.period)],metrics:(kind==="test"||kind==="events"?["totalUsers"]:metrics).map(name=>({name})),returnPropertyQuota:true,limit:kind==="sources"?20:kind==="daily"?30:kind==="events"?4:1};
  if(kind==="events"){req.dimensions=[{name:"eventName"}];req.dimensionFilter={filter:{fieldName:"eventName",inListFilter:{values:Object.values(this.config.events)}}};}
  if(kind==="sources"){req.dimensions=["sessionSource","sessionMedium","sessionSourceMedium"].map(name=>({name}));req.orderBys=[{metric:{metricName:"sessions"},desc:true}];}
  if(kind==="daily"){req.dimensions=[{name:"date"}];req.orderBys=[{dimension:{dimensionName:"date"},desc:false}];}
  const run=async()=>{for(let attempt=0;;attempt++){let timer:ReturnType<typeof setTimeout>|undefined;try{const result=await Promise.race([this.client.runReport(req,this.policy.timeoutMs),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new GA4Error("TIMEOUT")),this.policy.timeoutMs);})]);this.status.quotaRemaining=result.propertyQuota?.tokensPerHour?.remaining??this.status.quotaRemaining;return result;}catch(e){const safe=safeGA4Error(e);const raw=Number(e&&typeof e==="object"&&"code"in e?e.code:0);const transient=[429,500,503,13,14].includes(raw)&&safe.code!=="QUOTA_ERROR";if(!transient||attempt>=this.policy.retry.maxAttempts-1){this.status={...this.status,status:safe.code==="PERMISSION_DENIED"?"PERMISSION ERROR":"API ERROR",error:safe};throw new GA4Error(safe.code);}await this.delay(Math.min(this.policy.retry.maxDelayMs,this.policy.retry.baseDelayMs*2**attempt));}finally{if(timer)clearTimeout(timer);}}};
  if(this.cache.size>40)this.cache.clear();const promise=run();this.cache.set(key,{expires:Date.now()+60000,promise});promise.catch(()=>{this.cache.set(key,{expires:Date.now()+3000,promise});});return promise;
 }
 async getOverviewMetrics(q:Query){return normalizeOverview(await this.request(q,"overview"));}
 async getTrafficSources(q:Query){return normalizeSources(await this.request(q,"sources"),this.config.sourceRules);}
 async getFunnelMetrics(q:Query){return normalizeEvents(await this.request(q,"events"),this.config.events);}
 async getDailyMetrics(q:Query){return normalizeDaily(await this.request(q,"daily"));}
 async testConnection(){try{await this.request({advertiserId:this.config.advertiserId,period:7},"test");this.status={...this.status,status:"CONNECTED",lastTested:new Date().toISOString(),error:undefined};}catch(e){const error=safeGA4Error(e);this.status={...this.status,status:error.code==="MISSING_CONFIGURATION"?"NOT CONFIGURED":error.code==="PERMISSION_DENIED"?"PERMISSION ERROR":"API ERROR",lastTested:new Date().toISOString(),error};}return this.getConnectionStatus();}
 async snapshot(q:Query):Promise<GA4Snapshot>{const [a,e,s,d]=await Promise.all([this.request(q,"overview"),this.request(q,"events"),this.request(q,"sources"),this.request(q,"daily")]);const overview=normalizeOverview(a),events=normalizeEvents(e,this.config.events);const warnings=events.filter(e=>!e.found).map(e=>`EVENT NOT DETECTED · GA4에서 ${e.eventName} 이벤트가 확인되지 않습니다. 조회 기간 내 기록 부재이며 설치 오류를 단정하지 않습니다.`);if((events.find(e=>e.key==="purchase")?.found||overview.purchases>0)&&overview.purchaseRevenue===0)warnings.push("REVENUE NOT DETECTED · 구매는 확인되지만 purchaseRevenue가 0입니다. GA4 수집 상태를 확인하세요.");if([a,e,s,d].some(r=>r.metadata?.subjectToThresholding||r.metadata?.dataLossFromOtherRow||r.metadata?.samplingMetadatas?.length))warnings.push("GA4 데이터 임계값·샘플링·집계 제한이 포함될 수 있습니다.");return {provenance:"real",advertiserId:q.advertiserId,period:q.period,propertyId:this.config.propertyId!,...dateRange(q.period),timezone:a.metadata?.timeZone??"GA4 Property timezone",fetchedAt:new Date().toISOString(),overview,events,sources:normalizeSources(s,this.config.sourceRules),daily:normalizeDaily(d),warnings,quotaRemaining:this.status.quotaRemaining};}
}
