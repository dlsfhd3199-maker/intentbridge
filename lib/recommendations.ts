import { diagnose, normalizeLevers } from "./simulation";
import type { BaselineMetrics, ProjectedMetrics, Recommendation } from "../types/simulation";

export function getRecommendations(b: BaselineMetrics, p: ProjectedMetrics): Recommendation[] {
  const recommendations: Omit<Recommendation, "priority">[] = [];
  const l = p.levers;
  // A worsening scenario takes precedence over growth suggestions.
  if ((p.cpa !== null && b.cpa !== null && p.cpa > b.cpa * 1.03) || (p.roas !== null && b.roas !== null && p.roas < b.roas * .97)) {
    recommendations.push({ id: "efficiency-guardrail", title: "예산 확대의 효율부터 재검토", message: "현재 Simulation에서 CPA 또는 ROAS가 기준 대비 악화됩니다. 예산 증감을 0%로 되돌려 전환율 개선 효과부터 비교해 보세요.", actionLabel: "두 예산 변화 0% 적용", changes: { acquisitionBudget: 0, retargetingBudget: 0 } });
  }
  const opportunities = diagnose(b).filter(item => item.currentRate !== null && item.severity !== "Healthy").sort((a, c) => (a.currentRate! / a.benchmark) - (c.currentRate! / c.benchmark));
  for (const opportunity of opportunities) {
    if (recommendations.length >= 2) break;
    const key = opportunity.lever;
    const next = normalizeLevers({ ...l, [key]: Math.max(15, l[key] + 5) })[key];
    if (next === l[key]) continue;
    recommendations.push({ id: `improve-${opportunity.id}`, title: opportunity.label + " 점검", message: `${opportunity.message} 현재 ${opportunity.currentRate!.toFixed(1)}%, Mock 목표 ${opportunity.benchmark}%입니다.${opportunity.id === "checkout-entry" ? " 결제 진입 개선의 직접 레버는 없으므로 결제 완료 개선을 대안으로 비교합니다." : ""}`, actionLabel: `개선 가정 +${next}% 적용`, changes: { [key]: next } });
  }
  const directCpa = b.directPurchases ? b.acquisitionSpend / b.directPurchases : null;
  const recoveredCpa = b.metaPurchases ? b.retargetingSpend / b.metaPurchases : null;
  if (recommendations.length < 3 && directCpa !== null && recoveredCpa !== null && recoveredCpa < directCpa && l.retargetingBudget < 15 && b.retargetingSpend > 0) {
    // Move 15% of baseline retargeting budget from acquisition; total is preserved within integer lever rounding.
    const acquisitionBudget = b.acquisitionSpend ? Math.max(-30, Math.round(-b.retargetingSpend * .15 / b.acquisitionSpend * 100)) : 0;
    recommendations.push({ id: "budget-balance", title: "회수 비용이 낮은 경로 비교", message: `${b.retargetingChannel.name} 회수 CPA가 유입 직접 CPA보다 낮습니다. 신규 유입 예산 일부를 재공략으로 이동하는 가정을 비교하세요. 정수 레버 반올림으로 총예산은 소폭 달라질 수 있습니다.`, actionLabel: "재공략 +15% · 유입 일부 감액", changes: { acquisitionBudget, retargetingBudget: 15 } });
  }
  if (!recommendations.length) recommendations.push({ id: "controlled-test", title: "작은 변화로 효과 분리", message: "추가 확대보다 변경 가정을 줄인 대조 시나리오를 비교해 보세요. 통계적 검증이 없는 Mock 결과입니다.", actionLabel: "Landing +3%만 적용", changes: { landing: 3, cart: 0, checkout: 0, retargetingEfficiency: 0, acquisitionBudget: 0, retargetingBudget: 0 } });
  return recommendations.slice(0, 3).map((item, index) => ({ ...item, priority: index + 1 }));
}
