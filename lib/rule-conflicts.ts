import type { AutomationRule } from "../types/operations";
import type { ConflictResolution, RuleConflict } from "../types/mvp";
export const conflictModes:ConflictResolution[]=["Manual Review Required","Higher Priority Wins","Skip Both"];
export const rulePriority=(r:AutomationRule)=>r.priority??3;
function overlap(a:AutomationRule,b:AutomationRule){const x=a.action.type,y=b.action.type;if(x==="Notify Only"||y==="Notify Only")return false;if(x==="Pause"||y==="Pause")return true;if(x.includes("Budget")&&y.includes("Budget"))return true;if(["Window Change","Audience Expand"].includes(x)&&["Window Change","Audience Expand"].includes(y))return true;return x===y;}
export function detectRuleConflicts(matched:AutomationRule[],resolution:ConflictResolution="Manual Review Required"):RuleConflict[]{
  const groups:AutomationRule[][]=[];
  for(const rule of matched){const connected=groups.filter(g=>g.some(r=>r.campaignId===rule.campaignId&&overlap(r,rule)));if(!connected.length)groups.push([rule]);else{const merged=[rule,...connected.flat()];for(const group of connected)groups.splice(groups.indexOf(group),1);groups.push(merged);}}
  return groups.filter(g=>g.length>1).map(g=>{const ordered=[...g].sort((a,b)=>rulePriority(a)-rulePriority(b)),winner=resolution==="Higher Priority Wins"&&rulePriority(ordered[0])<rulePriority(ordered[1])?ordered[0].id:null;return {campaignId:g[0].campaignId,ruleIds:g.map(r=>r.id),resolution,winnerId:winner,message:`CONFLICT DETECTED · ${g.map(r=>`P${rulePriority(r)} ${r.name}`).join(" / ")}. ${resolution==="Higher Priority Wins"&&!winner?"동순위이므로 수동 검토가 필요합니다.":resolution==="Skip Both"?"충돌 그룹 전체를 건너뜁니다.":winner?"가장 높은 우선순위 1개만 Mock 적용할 수 있습니다.":"수동 검토 후 우선순위 또는 처리 방식을 선택하세요."}`};});
}
export function similarRules(candidate:AutomationRule,existing:AutomationRule[]):AutomationRule[]{
  const sorted=(r:AutomationRule)=>[...r.conditions].sort((a,b)=>`${a.metric}:${a.operator}:${a.value}`.localeCompare(`${b.metric}:${b.operator}:${b.value}`));
  return existing.filter(r=>{if(r.id===candidate.id||r.campaignId!==candidate.campaignId||r.action.type!==candidate.action.type||r.conditions.length!==candidate.conditions.length)return false;const a=sorted(r),b=sorted(candidate);return a.every((c,i)=>c.metric===b[i].metric&&c.operator===b[i].operator&&Math.abs(c.value-b[i].value)<=Math.max(1,Math.abs(c.value)*.05))&&Math.abs(r.action.value-candidate.action.value)<=Math.max(1,Math.abs(r.action.value)*.05);});
}
