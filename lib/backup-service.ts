import {atomicStoreChange} from "./server-storage";
import {assertAccess} from "./permissions";
import type { AppBackup, BackupValidation, ImportPreview } from "../types/mvp";
import type { CampaignTarget, Guardrail } from "../types/operations";
import { advertisers } from "./dashboard";
import { readCampaignStore, isCampaign, isCampaignDraft, restoreCampaignStore } from "./campaign-store";
import { readOperations, validRule, validTarget, writeOperations } from "./operations-store";
import { validGuardrail } from "./operations-guardrail";
import { readSimulationLibrary, validSaved } from "./simulation-library";
import { listSimulationSettings, clearSimulationSettings, saveSetting, identifyScenario } from "./simulation/store";
import { loadPerformanceBaseline } from "./simulation/baseline";
import { normalizeLevers } from "./simulation";
import { readAppSettings, saveAppSettings, validAppSettings } from "./app-settings";
import { isRecord, nonnegative, writeLocal } from "./local-store";
import { migrateBackup } from "./data-migration";
import { conflictModes } from "./rule-conflicts";
const date=(v:unknown)=>typeof v==="string"&&Number.isFinite(Date.parse(v));
const str=(v:unknown)=>typeof v==="string"&&v.length>0&&v.length<=500;
const unique=(list:unknown[],field:string)=>list.every(v=>isRecord(v)&&str(v[field]))&&new Set(list.map(v=>(v as Record<string,unknown>)[field])).size===list.length;
export function createBackup():AppBackup {assertAccess(undefined,"MANAGE_SETTINGS");return {schemaVersion:"1.0",application:"IntentBridge",createdAt:new Date().toISOString(),userSettings:readAppSettings(),advertisers:advertisers.map(advertiser=>({advertiser,campaigns:readCampaignStore(advertiser.id),operations:readOperations(advertiser.id),simulations:readSimulationLibrary(advertiser.id),settings:readAppSettings(),currentSimulations:listSimulationSettings(advertiser.id).map(({period,levers,scenario})=>({period,levers,scenario}))}))};}
function inspect(value:unknown,depth=0):boolean{if(depth>40)return false;if(typeof value==="number")return Number.isFinite(value);if(Array.isArray(value))return value.length<=10000&&value.every(v=>inspect(v,depth+1));if(isRecord(value))return Object.entries(value).every(([k,v])=>!/^(__proto__|constructor|prototype)$/i.test(k)&&!/(access.?token|api.?key|password|client.?secret|service.?account|private.?key|^secret$)/i.test(k)&&inspect(v,depth+1));return true;}
export function validateBackup(input:unknown):BackupValidation {
 const errors:string[]=[];let raw:unknown;try{raw=migrateBackup(typeof input==="string"?JSON.parse(input):input);}catch(e){return {valid:false,errors:[(e as Error).message],data:null};}
 if(!inspect(raw)||!isRecord(raw)||raw.application!=="IntentBridge"||!date(raw.createdAt)||!validAppSettings(raw.userSettings)||!Array.isArray(raw.advertisers)||raw.advertisers.length!==advertisers.length)return {valid:false,errors:["필수 항목·숫자·광고주 범위 또는 안전한 백업 형식이 아닙니다."],data:null};
 const seen=new Set<string>();
 for(const entry of raw.advertisers){
  if(!isRecord(entry)||!isRecord(entry.advertiser)||typeof entry.advertiser.id!=="string"||!advertisers.some(a=>a.id===(entry.advertiser as Record<string,unknown>).id)||seen.has(entry.advertiser.id)){errors.push("잘못되거나 중복된 Advertiser ID입니다.");continue;}
  const id=entry.advertiser.id;seen.add(id);const fail=(s:string)=>errors.push(`${id}: ${s}`);
  if(!["name","industry","productName"].every(k=>str((entry.advertiser as Record<string,unknown>)[k])))fail("Advertiser 필드 오류");
  if(!validAppSettings(entry.settings)||JSON.stringify(entry.settings)!==JSON.stringify(raw.userSettings))fail("설정 오류");
  const b=entry.campaigns;
  if(!isRecord(b)||b.version!==1||!Array.isArray(b.campaigns)||!Array.isArray(b.drafts)||!Array.isArray(b.versions)){fail("Campaign Store 필수 항목 오류");continue;}
  if(!b.campaigns.every(c=>isCampaign(c,id)&&date(c.createdAt)&&date(c.updatedAt))||!unique(b.campaigns,"id")||!unique(b.campaigns,"draftId"))fail("Campaign ID/값 오류");
  if(!b.drafts.every(d=>isCampaignDraft(d,id)&&date(d.createdAt)&&date(d.updatedAt))||!unique(b.drafts,"draftId")||(b.draft!==null&&!isCampaignDraft(b.draft,id))||(b.lastEdited!==null&&!date(b.lastEdited)))fail("Draft 값/중복 오류");
  const liveIds=new Set(b.campaigns.filter(isRecord).map(c=>c.id));const allIds=new Set(liveIds);
  if(!b.versions.every(v=>{if(!isRecord(v)||v.advertiserId!==id||!str(v.id)||!str(v.campaignId)||!nonnegative(v.version)||!Number.isInteger(v.version)||v.version<1||!date(v.createdAt)||typeof v.reason!=="string"||!isCampaign(v.snapshot,id)||v.snapshot.id!==v.campaignId)return false;allIds.add(v.campaignId);return true;})||!unique(b.versions,"id")||new Set(b.versions.map(v=>isRecord(v)?`${v.campaignId}:${v.version}`:"")).size!==b.versions.length)fail("Version 참조/값 오류");
  if(b.draft!==null&&isRecord(b.draft)&&![...b.drafts,...b.campaigns].some(d=>isRecord(d)&&d.draftId===(b.draft as Record<string,unknown>).draftId))fail("최신 Draft 참조 오류");
  const o=entry.operations;
  if(!isRecord(o)||o.schema!==1||!Array.isArray(o.rules)||!Array.isArray(o.history)||!Array.isArray(o.alerts)||!Array.isArray(o.versions)||o.versions.length!==0||!isRecord(o.targets)||!isRecord(o.guardrails)||!isRecord(o.decisions)){fail("Operations 필수 항목 오류");continue;}
  if(!o.rules.every(r=>validRule(r)&&r.advertiserId===id&&liveIds.has(r.campaignId))||!unique(o.rules,"id"))fail("Rule 또는 삭제된 Campaign 참조 오류");
  if(!Object.entries(o.targets).every(([k,v])=>liveIds.has(k)&&validTarget(v as CampaignTarget))||!Object.entries(o.guardrails).every(([k,v])=>liveIds.has(k)&&validGuardrail(v as Guardrail)))fail("Target/Guardrail 오류");
  if(!Object.values(o.decisions).every(v=>["IGNORED","APPLIED IN MOCK"].includes(String(v))))fail("액션 처리 상태 오류");
  if(o.conflictResolutions!==undefined&&(!isRecord(o.conflictResolutions)||!Object.entries(o.conflictResolutions).every(([k,v])=>liveIds.has(k)&&conflictModes.includes(v as never))))fail("Rule Conflict 설정 오류");
  if(!o.history.every(h=>isRecord(h)&&h.advertiserId===id&&allIds.has(h.campaignId)&&str(h.id)&&date(h.createdAt)&&typeof h.reason==="string"&&typeof h.source==="string"&&typeof h.campaignName==="string"&&["User","Automation"].includes(String(h.actor))&&["APPLIED IN MOCK","ROLLBACK"].includes(String(h.status))&&["Budget","Status","Audience","Creative","Window","Notification","ROLLBACK"].includes(String(h.type))&&nonnegative(h.version)&&Number.isInteger(h.version)&&h.version>0&&isCampaign(h.before,id)&&isCampaign(h.after,id)&&h.before.id===h.campaignId&&h.after.id===h.campaignId&&(h.rollbackOf===undefined||(o.history as unknown[]).some(v=>isRecord(v)&&v.id===h.rollbackOf)))||!unique(o.history,"id"))fail("History 값/참조 오류");
  if(!o.alerts.every(a=>isRecord(a)&&a.advertiserId===id&&allIds.has(a.campaignId)&&str(a.id)&&date(a.createdAt)&&typeof a.message==="string"&&typeof a.read==="boolean"&&["INFO","SUCCESS","WARNING","CRITICAL"].includes(String(a.type)))||!unique(o.alerts,"id"))fail("Alert 값/참조 오류");
  if(!Array.isArray(entry.simulations)||!entry.simulations.every(s=>validSaved(s,id)&&date(s.createdAt))||!unique(entry.simulations,"id"))fail("Saved Simulation 오류");
  if(!Array.isArray(entry.currentSimulations)||entry.currentSimulations.length>3||new Set(entry.currentSimulations.map(s=>isRecord(s)?s.period:null)).size!==entry.currentSimulations.length||!entry.currentSimulations.every(s=>isRecord(s)&&[7,14,30].includes(s.period as number)&&["baseline","custom","conservative","recommended","aggressive"].includes(String(s.scenario))&&isRecord(s.levers)&&Object.keys(normalizeLevers({})).every(k=>typeof (s.levers as Record<string,unknown>)[k]==="number"&&Number.isFinite((s.levers as Record<string,unknown>)[k]))&&identifyScenario(normalizeLevers(s.levers))===s.scenario&&Object.entries(normalizeLevers(s.levers)).every(([k,v])=>(s.levers as Record<string,unknown>)[k]===v)))fail("현재 Simulation 설정 오류");
 }
 return {valid:errors.length===0,errors,data:errors.length?null:raw as unknown as AppBackup};
}
export function previewImport(incoming:AppBackup,mode:"merge"|"replace",current=createBackup()):ImportPreview{
 const valid=validateBackup(incoming);if(!valid.valid)throw new Error(valid.errors.join("\n"));
 const conflicts:string[]=[];let additions=0;
 if(mode==="replace")return {mode,result:structuredClone(incoming),conflicts:["현재 등록된 모든 광고주의 저장 데이터를 이 백업으로 교체합니다. 적용 전 현재 데이터 백업을 권장합니다."],additions:incoming.advertisers.reduce((n,a)=>n+a.campaigns.campaigns.length+a.campaigns.drafts.length+a.simulations.length,0)};
 const result=structuredClone(current);
 function mergeList<T>(existing:T[],next:T[],id:(v:T)=>string,label:string):T[]{const merged=[...existing];for(const item of next){const before=existing.find(v=>id(v)===id(item));if(before){if(JSON.stringify(before)!==JSON.stringify(item))conflicts.push(`${label}: ${id(item)} · 기존 값 유지`);}else{merged.push(structuredClone(item));additions++;}}return merged;}
 for(const src of incoming.advertisers){const dst=result.advertisers.find(a=>a.advertiser.id===src.advertiser.id)!;const id=src.advertiser.id;
  // Campaign is an aggregate: conflicting ID keeps its drafts, versions, rules and audit records together.
  const blocked=new Set(src.campaigns.campaigns.filter(c=>dst.campaigns.campaigns.some(d=>(d.id===c.id||d.draftId===c.draftId)&&JSON.stringify(d)!==JSON.stringify(c))).map(c=>c.id));
  blocked.forEach(c=>conflicts.push(`${id} Campaign ${c}: 연관 버전·규칙·이력 포함 기존 값 유지`));
  const blockedDraft=new Set(src.campaigns.campaigns.filter(c=>blocked.has(c.id)).map(c=>c.draftId));
  dst.campaigns.campaigns=mergeList(dst.campaigns.campaigns,src.campaigns.campaigns.filter(c=>!blocked.has(c.id)),c=>c.id,`${id} Campaign`);
  dst.campaigns.drafts=mergeList(dst.campaigns.drafts,src.campaigns.drafts.filter(d=>!blockedDraft.has(d.draftId)),d=>d.draftId,`${id} Draft`);
  dst.campaigns.versions=mergeList(dst.campaigns.versions,src.campaigns.versions.filter(v=>!blocked.has(v.campaignId)),v=>`${v.campaignId}:${v.version}`,`${id} Version`);
  dst.campaigns.versions.sort((a,b)=>a.campaignId.localeCompare(b.campaignId)||a.version-b.version);
  if(!dst.campaigns.draft&&src.campaigns.draft&&!blockedDraft.has(src.campaigns.draft.draftId))dst.campaigns.draft=structuredClone(src.campaigns.draft);
  dst.operations.rules=mergeList(dst.operations.rules,src.operations.rules.filter(r=>!blocked.has(r.campaignId)),r=>r.id,`${id} Rule`);
  dst.operations.history=mergeList(dst.operations.history,src.operations.history.filter(h=>!blocked.has(h.campaignId)),h=>h.id,`${id} History`);
  dst.operations.alerts=mergeList(dst.operations.alerts,src.operations.alerts.filter(a=>!blocked.has(a.campaignId)),a=>a.id,`${id} Alert`);
  for(const field of ["targets","guardrails","decisions","conflictResolutions"] as const){const old=dst.operations[field]??{},next=src.operations[field]??{};const accepted=Object.fromEntries(Object.entries(next).filter(([k])=>!blocked.has(k)&&!Object.hasOwn(old,k)));for(const k of Object.keys(next))if(Object.hasOwn(old,k)&&JSON.stringify(old[k as keyof typeof old])!==JSON.stringify(next[k as keyof typeof next]))conflicts.push(`${id} ${field}: ${k} · 기존 값 유지`);Object.assign(dst.operations,{[field]:{...accepted,...old}});}
  dst.simulations=mergeList(dst.simulations,src.simulations,s=>s.id,`${id} Simulation`);
  dst.currentSimulations=mergeList(dst.currentSimulations,src.currentSimulations,s=>String(s.period),`${id} 최근 설정`);
 }
 if(JSON.stringify(current.userSettings)!==JSON.stringify(incoming.userSettings))conflicts.push("App Settings · 기존 값 유지");
 const mergedValid=validateBackup(result);if(!mergedValid.valid)throw new Error("Merge 후 참조 검증 실패: "+mergedValid.errors.join(" / "));
 return {mode,result,conflicts,additions};
}
export const backupFingerprint=(data:AppBackup)=>JSON.stringify({...data,createdAt:""});
export async function applyImport(incoming:AppBackup,mode:"merge"|"replace",expectedCurrent?:string){assertAccess(undefined,"MANAGE_SETTINGS");
 if(expectedCurrent && backupFingerprint(createBackup())!==expectedCurrent)throw new Error("검토 이후 데이터가 변경되었습니다. Preview를 새로 확인하세요.");
 const initialFingerprint=backupFingerprint(createBackup());
 const preview=previewImport(incoming,mode);const prepared=await Promise.all(preview.result.advertisers.map(async a=>({a,baselines:await Promise.all(a.currentSimulations.map(s=>loadPerformanceBaseline({advertiserId:a.advertiser.id,period:s.period})))})));
 // No mutation happens until validation and all dependent Mock reads finish.
 if(backupFingerprint(createBackup())!==initialFingerprint)throw new Error("검토 이후 데이터가 변경되었습니다. Preview를 새로 확인하세요.");
 const latest=previewImport(incoming,mode);if(backupFingerprint(latest.result)!==backupFingerprint(preview.result))throw new Error("검토 이후 데이터가 변경되었습니다. Import Preview를 다시 확인하세요.");
 return atomicStoreChange(async()=>{let memoryOnly=false;
 for(const {a,baselines} of prepared){if(restoreCampaignStore(a.advertiser.id,a.campaigns)==="memory")memoryOnly=true;if(writeOperations(a.advertiser.id,a.operations)==="memory")memoryOnly=true;if(writeLocal(`intentbridge:simulation-library:v1:${a.advertiser.id}`,a.simulations)==="memory")memoryOnly=true;clearSimulationSettings(a.advertiser.id);a.currentSimulations.forEach((s,i)=>{if(saveSetting(baselines[i],s.levers)==="memory")memoryOnly=true;});}
 if(saveAppSettings(preview.result.userSettings)==="memory")memoryOnly=true;
 return {memoryOnly,preview};},"import").then(result=>{if(typeof window!=="undefined")window.dispatchEvent(new Event("intentbridge-data-imported"));return result;});
}
