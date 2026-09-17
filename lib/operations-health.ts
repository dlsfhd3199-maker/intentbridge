import type { CampaignHealth, CampaignTarget, Guardrail, OperationMetrics } from "../types/operations";
export function campaignHealth(m:OperationMetrics,target:CampaignTarget,audience:number,guard:Guardrail): {health:CampaignHealth;reason:string} {
  if (audience < guard.minAudience || m.frequency > guard.maxFrequency) return {health:"LIMITED",reason:`Audience ${audience}명 / 최소 ${guard.minAudience}명, Frequency ${m.frequency.toFixed(1)} / 상한 ${guard.maxFrequency}. 확장 여력을 확인하세요.`};
  if (m.purchases < 3 || m.spend === 0 || m.cpa === null || m.roas === null) return {health:"LEARNING",reason:"Mock 구매 3건 미만 또는 지출 부족으로 판단할 데이터가 적습니다."};
  if (m.roas >= target.roas && m.cpa <= target.cpa) return {health:"HEALTHY",reason:`ROAS ${m.roas.toFixed(1)}%가 목표 ${target.roas}% 이상이고 CPA가 목표 이내입니다.`};
  if (m.roas <= target.roas*.75 || m.cpa > target.cpa*1.25) return {health:"ACTION REQUIRED",reason:`ROAS 목표 대비 ${((m.roas/target.roas-1)*100).toFixed(1)}%, CPA 목표 대비 ${((m.cpa/target.cpa-1)*100).toFixed(1)}%로 운영 검토가 필요합니다.`};
  return {health:"WATCH",reason:`ROAS ${m.roas.toFixed(1)}% / 목표 ${target.roas}%, CPA ${Math.round(m.cpa)}원 / 목표 ${target.cpa}원. 추이를 확인하세요.`};
}
