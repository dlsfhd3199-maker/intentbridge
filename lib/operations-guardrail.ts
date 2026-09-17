import type { AutomationAction, Guardrail, OperationMetrics } from "../types/operations";
import { nonnegative } from "./local-store";
export function validGuardrail(g:Guardrail):boolean { return !!g && Object.values(g).every(nonnegative) && g.minDaily <= g.maxDaily && g.maxDaily > 0 && g.maxDaily <= 1e7 && g.maxIncrease > 0 && g.maxIncrease <= 100 && g.minAudience >= 1 && g.maxFrequency > 0; }
export function guardBudget(action:AutomationAction,current:number,audience:number,metrics:OperationMetrics,g:Guardrail): {allowed:boolean;daily:number;reasons:string[]} {
  const reasons:string[] = [];
  if (!validGuardrail(g) || !nonnegative(current) || !nonnegative(action.value)) return {allowed:false,daily:current,reasons:["유효하지 않은 Guardrail 또는 예산입니다."]};
  if (action.type !== "Increase Budget" && action.type !== "Decrease Budget") return {allowed:true,daily:current,reasons};
  const increase = action.type === "Increase Budget";
  if (increase && audience < g.minAudience) reasons.push(`Audience ${audience}명 < 최소 ${g.minAudience}명: 증액 금지`);
  if (increase && metrics.frequency > g.maxFrequency) reasons.push(`Frequency ${metrics.frequency.toFixed(1)} > ${g.maxFrequency}: 증액 금지`);
  const percent = increase ? Math.min(action.value,g.maxIncrease) : Math.min(action.value,100);
  if (increase && action.value > g.maxIncrease) reasons.push(`1회 증액 상한 ${g.maxIncrease}%를 적용합니다.`);
  const raw = Math.round(current*(1+(increase?1:-1)*percent/100));
  const daily = increase ? Math.min(raw,g.maxDaily) : Math.max(raw,g.minDaily);
  if (daily !== raw) reasons.push(`일 예산 한도 ${g.minDaily.toLocaleString()}~${g.maxDaily.toLocaleString()}원을 적용합니다.`);
  const blocked = increase && (audience < g.minAudience || metrics.frequency > g.maxFrequency) || daily === current || (increase ? daily < current : daily > current);
  if (daily === current) reasons.push("이미 예산 한도에 도달해 변경할 수 없습니다.");
  return {allowed:!blocked,daily:blocked?current:daily,reasons};
}
