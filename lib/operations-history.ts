import {assertAccess} from "./permissions";
import { similarRules, detectRuleConflicts } from "./rule-conflicts";
import { configuredTarget } from "./app-settings";
import type { AutomationRule, OperationRecommendation, OperationChange } from "../types/operations";
import type { Period } from "../types/domain";
import { readCampaignStore, replaceMockCampaign } from "./campaign-store";
import { readOperations, writeOperations, storeRule } from "./operations-store";
import { defaultGuardrail } from "../data/mock/operations-config";
import { loadCampaignWorkspace } from "./campaign-service";
import { builtInRules, monitorCampaign, rulePreview, loadOperations } from "./operations-engine";
export function saveAutomationRule(rule:AutomationRule, force = false) { assertAccess(rule.advertiserId,"MANAGE_OPERATIONS");
  if(!readCampaignStore(rule.advertiserId).campaigns.some(c=>c.id===rule.campaignId&&c.status!=="DRAFT"))throw new Error("삭제되었거나 존재하지 않는 실행안입니다.");
  if(!force && similarRules(rule,readOperations(rule.advertiserId).rules).length)throw new Error("유사한 운영 규칙이 이미 존재합니다. 확인 후 강제 저장할 수 있습니다.");
  storeRule(rule);
}
export async function applyOperation(advertiserId:string,rec:OperationRecommendation,period:Period):Promise<OperationChange> { assertAccess(advertiserId,"MANAGE_OPERATIONS");
  const store=readOperations(advertiserId),c=readCampaignStore(advertiserId).campaigns.find(c=>c.id===rec.campaignId);
  if(!c)throw new Error("삭제되었거나 존재하지 않는 실행안입니다.");
  if(store.decisions[rec.id])throw new Error("이미 처리된 운영 액션입니다.");
  if(JSON.stringify(c)!==JSON.stringify(rec.preview.before))throw new Error("실행안이 변경되었습니다. 최신 추천을 다시 검토하세요.");
  const rule=rec.rule.id.startsWith("builtin-")?rec.rule:store.rules.find(r=>r.id===rec.rule.id);
  if(!rule)throw new Error("규칙이 삭제되었습니다.");
  const evaluated=await loadOperations(advertiserId,period);
  const currentRecommendation=evaluated.recommendations.find(r=>r.rule.id===rule.id&&r.status==="PENDING");
  if(currentRecommendation?.conflict && currentRecommendation.conflict.winnerId!==rule.id)throw new Error(currentRecommendation.conflict.message);
  const ctx=await loadCampaignWorkspace({advertiserId,period:c.period});
  // Re-read after async work: concurrent clicks must not apply twice.
  const latest=readCampaignStore(advertiserId).campaigns.find(item=>item.id===c.id),fresh=readOperations(advertiserId);
  if(!latest||JSON.stringify(latest)!==JSON.stringify(c)||fresh.decisions[rec.id])throw new Error("이미 처리되었거나 변경된 실행안입니다.");
  const latestRule=rule.id.startsWith("builtin-")?builtInRules(c,fresh.targets[c.id]??configuredTarget()).find(r=>r.id===rule.id):fresh.rules.find(r=>r.id===rule.id);
  if(!latestRule)throw new Error("규칙이 삭제되었습니다.");
  if(JSON.stringify(latestRule)!==JSON.stringify(rec.rule))throw new Error("규칙 또는 목표가 변경되었습니다. 새 Preview를 검토하세요.");
  const matched=[...builtInRules(c,fresh.targets[c.id]??configuredTarget()),...fresh.rules.filter(r=>r.campaignId===c.id)].filter(r=>{
    const id=`${r.id}:${c.updatedAt}:${period}:${JSON.stringify(r.conditions)}:${JSON.stringify(r.action)}`;
    return !fresh.decisions[id]&&rulePreview(r,c,monitorCampaign(c,period),fresh.guardrails[c.id]??defaultGuardrail,ctx).matched;
  });
  const conflict=detectRuleConflicts(matched,fresh.conflictResolutions?.[c.id]??"Manual Review Required").find(g=>g.ruleIds.includes(latestRule.id));
  if(conflict&&conflict.winnerId!==latestRule.id)throw new Error(conflict.message);
  const p=rulePreview(latestRule,c,monitorCampaign(c,period),fresh.guardrails[c.id]??defaultGuardrail,ctx);
  if(!p.allowed)throw new Error(p.reasons.join(" ")||"조건이 충족되지 않습니다.");
  const now=new Date().toISOString(),after={...p.after,updatedAt:now};
  const reason=p.supporting.join(" AND ")+". "+p.reasons.join(" ");
  replaceMockCampaign(after,`${latestRule.name} · MOCK`);
  const version=readCampaignStore(advertiserId).versions.filter(v=>v.campaignId===c.id).at(-1)!.version;
  const change:OperationChange={id:crypto.randomUUID(),advertiserId,campaignId:c.id,campaignName:c.name,createdAt:now,type:p.category,before:c,after,reason,source:latestRule.name,actor:"Automation",status:"APPLIED IN MOCK",version};
  writeOperations(advertiserId,{...fresh,history:[change,...fresh.history],decisions:{...fresh.decisions,[rec.id]:"APPLIED IN MOCK"},alerts:[{id:change.id,advertiserId,campaignId:c.id,type:"SUCCESS",message:`${c.name}: ${latestRule.action.type} APPLIED IN MOCK`,createdAt:now,read:false},...fresh.alerts]});
  return change;
}
export function ignoreOperation(advertiserId:string,id:string){const s=readOperations(advertiserId);if(!s.decisions[id])writeOperations(advertiserId,{...s,decisions:{...s.decisions,[id]:"IGNORED"}});}
export function rollbackOperation(advertiserId:string,id:string):OperationChange { assertAccess(advertiserId,"MANAGE_OPERATIONS");
  const s=readOperations(advertiserId),entry=s.history.find(h=>h.id===id);
  if(!entry||entry.type==="ROLLBACK"||s.history.some(h=>h.rollbackOf===id))throw new Error("되돌릴 수 없는 변경입니다.");
  const c=readCampaignStore(advertiserId).campaigns.find(c=>c.id===entry.campaignId);
  if(!c||JSON.stringify({...c,updatedAt:""})!==JSON.stringify({...entry.after,updatedAt:""}))throw new Error("후속 변경이 있어 복원할 수 없습니다. 가장 최근 변경부터 되돌리세요.");
  const now=new Date().toISOString(),after={...structuredClone(entry.before),updatedAt:now};
  replaceMockCampaign(after,`ROLLBACK · ${entry.source}`);
  const version=readCampaignStore(advertiserId).versions.filter(v=>v.campaignId===c.id).at(-1)!.version;
  const change:OperationChange={...entry,id:crypto.randomUUID(),createdAt:now,type:"ROLLBACK",before:c,after,reason:`${entry.id} 변경 복원`,source:"User · Undo",actor:"User",status:"ROLLBACK",rollbackOf:id,version};
  writeOperations(advertiserId,{...s,history:[change,...s.history]});return change;
}
