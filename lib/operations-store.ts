import {statusNames} from "./decision/thresholds";
import {assertAccess} from "./permissions";
import { conflictModes } from "./rule-conflicts";
import type { ConflictResolution } from "../types/mvp";
import type { AutomationRule, OperationsStore, CampaignTarget, Guardrail } from "../types/operations";
import { readLocal, writeLocal, isRecord, nonnegative } from "./local-store";
import { operationActions, operationMetrics } from "../data/mock/operations-config";
import { validGuardrail } from "./operations-guardrail";
import { isCampaign, readCampaignStore } from "./campaign-store";
export const operationsKey = (id:string) => `intentbridge:operations:v1:${id}`;
export function validRule(r:unknown): r is AutomationRule {
  if (!isRecord(r) || !isRecord(r.action) || !Array.isArray(r.conditions)) return false;
  return (r.priority === undefined || [1,2,3,4,5].includes(r.priority as number)) && typeof r.id === "string" && typeof r.advertiserId === "string" && typeof r.campaignId === "string" && typeof r.name === "string" && r.name.trim().length > 0 && r.name.length <= 200 && typeof r.enabled === "boolean" && typeof r.createdAt === "string" && r.conditions.length >= 1 && r.conditions.length <= 8 && r.conditions.every(c => isRecord(c) && operationMetrics.some(m=>m.id===c.metric) && [">","<",">=","<="].includes(String(c.operator)) && nonnegative(c.value) && c.value <= 1e12) && operationActions.includes(r.action.type as never) && nonnegative(r.action.value) && r.action.value <= 100 && (!(r.action.type === "Increase Budget" || r.action.type === "Decrease Budget") || r.action.value > 0) && (r.action.type !== "Window Change" || [3,7,14,30].includes(r.action.value));
}
export const validTarget = (t:CampaignTarget):boolean => !!t && nonnegative(t.cpa) && t.cpa > 0 && t.cpa <= 1e9 && nonnegative(t.roas) && t.roas > 0 && t.roas <= 1e6;
export function readOperations(id:string):OperationsStore { assertAccess(id);
  const empty:OperationsStore = {schema:1,rules:[],targets:{},guardrails:{},history:[],versions:[],alerts:[],decisions:{}};
  const raw = readLocal<OperationsStore>(operationsKey(id),empty,(v):v is OperationsStore => isRecord(v) && v.schema === 1 && Array.isArray(v.rules) && Array.isArray(v.history) && Array.isArray(v.alerts) && isRecord(v.targets) && isRecord(v.guardrails) && isRecord(v.decisions));
  return {...raw,signalStates:Object.fromEntries(Object.entries(isRecord(raw.signalStates)?raw.signalStates:{}).filter(([k,v])=>k.startsWith(`decision:${id}:`)&&k.length<=240&&typeof v==="string"&&Object.hasOwn(statusNames,v))) as OperationsStore["signalStates"],conflictResolutions:Object.fromEntries(Object.entries(isRecord(raw.conflictResolutions)?raw.conflictResolutions:{}).filter(([,v])=>conflictModes.includes(v as ConflictResolution))),rules:raw.rules.filter(r=>validRule(r)&&r.advertiserId===id),targets:Object.fromEntries(Object.entries(raw.targets).filter(([,t])=>validTarget(t))),guardrails:Object.fromEntries(Object.entries(raw.guardrails).filter(([,g])=>validGuardrail(g))),history:raw.history.filter(h=>h && h.advertiserId===id && typeof h.id==="string" && typeof h.reason==="string" && typeof h.source==="string" && typeof h.createdAt==="string" && isCampaign(h.before,id) && isCampaign(h.after,id)),alerts:raw.alerts.filter(a=>a && a.advertiserId===id && typeof a.id==="string" && typeof a.message==="string" && ["INFO","SUCCESS","WARNING","CRITICAL"].includes(a.type)),decisions:Object.fromEntries(Object.entries(raw.decisions).filter(([,v])=>v==="IGNORED"||v==="APPLIED IN MOCK"))};
}
export const writeOperations = (id:string,store:OperationsStore) => {assertAccess(id,"MANAGE_OPERATIONS");return writeLocal(operationsKey(id),store);};
export function storeRule(rule:AutomationRule) {
  if (!validRule(rule)) throw new Error("규칙 이름·조건·액션 값을 확인하세요. 음수/NaN은 허용되지 않습니다.");
  const store=readOperations(rule.advertiserId); writeOperations(rule.advertiserId,{...store,rules:[rule,...store.rules.filter(r=>r.id!==rule.id)]});
}
export function deleteRule(advertiserId:string,id:string) {const store=readOperations(advertiserId);writeOperations(advertiserId,{...store,rules:store.rules.filter(r=>r.id!==id)});}
export function saveControls(id:string,campaignId:string,target:CampaignTarget,guardrail:Guardrail) {
  if (!readCampaignStore(id).campaigns.some(c=>c.id===campaignId&&c.status!=="DRAFT")) throw new Error("캠페인을 찾을 수 없습니다.");
  if (!validTarget(target)||!validGuardrail(guardrail)) throw new Error("양수 목표값, 최소≤최대 예산, 1~100% 증액 한도를 확인하세요.");
  const s=readOperations(id);return writeOperations(id,{...s,targets:{...s.targets,[campaignId]:target},guardrails:{...s.guardrails,[campaignId]:guardrail}});
}
export function markAlertRead(id:string,alertId:string) {const s=readOperations(id);writeOperations(id,{...s,alerts:s.alerts.map(a=>a.id===alertId?{...a,read:true}:a)});}

export function saveConflictResolution(id:string,campaignId:string,resolution:ConflictResolution){if(!conflictModes.includes(resolution)||!readCampaignStore(id).campaigns.some(c=>c.id===campaignId))throw new Error("잘못된 Campaign 또는 충돌 처리 방식입니다.");const s=readOperations(id);return writeOperations(id,{...s,conflictResolutions:{...s.conflictResolutions,[campaignId]:resolution}});}
