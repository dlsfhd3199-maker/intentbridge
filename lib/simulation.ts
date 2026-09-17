import { diagnosticRules, leverDefinitions, zeroLevers } from "../data/mock/simulation-config";
import type { BaselineMetrics, Bottleneck, ChartPair, ForecastConfidence, MetricComparison, PerformanceMetrics, ProjectedMetrics, SimulationBreakdown, SimulationLevers } from "../types/simulation";

const finite = (value: number) => Number.isFinite(value) ? Math.max(0, value) : 0;
const divide = (a: number, b: number) => b > 0 ? a / b : 0;
const rate = (a: number, b: number) => Math.min(1, divide(a, b));
// Shared by Performance Lab and campaign delivery forecasts; undefined ratios stay null.
export function calculateFinancialMetrics(purchases: number, revenueInput: number, spendInput: number) {
  const revenue = Math.round(finite(revenueInput)), adSpend = Math.round(finite(spendInput));
  return { revenue, adSpend, cpa: finite(purchases) ? adSpend / purchases : null, roas: adSpend ? revenue / adSpend * 100 : null };
}
export function normalizeLevers(input: Partial<SimulationLevers>): SimulationLevers {
  const output = { ...zeroLevers };
  for (const definition of leverDefinitions) {
    const value = input[definition.id];
    output[definition.id] = typeof value === "number" && Number.isFinite(value) ? Math.round(Math.min(definition.max, Math.max(definition.min, value))) : 0;
  }
  return output;
}
export function getConfidence(levers: SimulationLevers): ForecastConfidence {
  const magnitude = Math.max(...Object.values(levers).map(Math.abs));
  const level = magnitude <= 5 ? "HIGH" : magnitude <= 20 ? "MEDIUM" : "LOW";
  return { level, magnitude, explanation: `최대 변경 폭 ${magnitude}%. 5% 이하 HIGH, 20% 이하 MEDIUM, 그 이상 LOW. 통계적 신뢰도나 성공 확률이 아닌 가정 변경 폭 등급입니다.` };
}

// Relative lifts, not percentage-point additions. Round at each user-count stage and cap by its parent.
function calculate(b: BaselineMetrics, l: SimulationLevers): PerformanceMetrics {
  const acquisitionFactor = 1 + l.acquisitionBudget / 100;
  const retargetFactor = 1 + l.retargetingBudget / 100;
  const visitors = Math.round(finite(b.organicVisitors) + finite(b.paidVisitors) * acquisitionFactor);
  const next = (parent: number, baseChild: number, baseParent: number, lift = 0) => Math.min(parent, Math.round(parent * Math.min(1, rate(finite(baseChild), finite(baseParent)) * (1 + lift / 100))));
  const viewContent = next(visitors, b.viewContent, b.visitors, l.landing);
  const addToCart = next(viewContent, b.addToCart, b.viewContent, l.cart);
  const checkout = next(addToCart, b.checkout, b.addToCart);
  const directPurchases = next(checkout, b.directPurchases, b.checkout, l.checkout);
  // Preserve baseline retargeting eligibility share as the non-direct population changes.
  const nonDirect = visitors - directPurchases;
  const recoveryPool = next(nonDirect, b.recoveryPool, b.visitors - b.directPurchases);
  const metaPurchases = Math.min(recoveryPool, Math.round(recoveryPool * Math.min(1, rate(finite(b.metaPurchases), finite(b.recoveryPool)) * (1 + l.retargetingEfficiency / 100) * retargetFactor)));
  const totalPurchases = directPurchases + metaPurchases;
  // Hold the two paths' order values fixed; no price or mix uplift assumption.
  const revenue = Math.round(directPurchases * divide(finite(b.directRevenue), finite(b.directPurchases)) + metaPurchases * divide(finite(b.recoveredRevenue), finite(b.metaPurchases)));
  const adSpend = Math.round(finite(b.acquisitionSpend) * acquisitionFactor + finite(b.retargetingSpend) * retargetFactor);
  return { visitors, viewContent, addToCart, checkout, directPurchases, metaPurchases, totalPurchases, recoveryPool, ...calculateFinancialMetrics(totalPurchases, revenue, adSpend) };
}
export function simulate(baseline: BaselineMetrics, input: Partial<SimulationLevers>): ProjectedMetrics {
  const levers = normalizeLevers(input);
  const projected = calculate(baseline, levers);
  const running = { ...zeroLevers };
  let previous = calculate(baseline, running).totalPurchases;
  const breakdown: SimulationBreakdown[] = [];
  // Sequential attribution: each step is the difference from the immediately preceding full simulation.
  // This includes interactions and rounding exactly once; order matters and is exposed in the UI.
  const steps: { id: string; label: string; keys: (keyof SimulationLevers)[] }[] = [
    { id: "landing", label: "Landing 개선", keys: ["landing"] },
    { id: "cart", label: "장바구니 개선", keys: ["cart"] },
    { id: "checkout", label: "결제 완료 개선", keys: ["checkout"] },
    { id: "efficiency", label: "재공략 효율 개선", keys: ["retargetingEfficiency"] },
    { id: "budget", label: "예산 변화", keys: ["acquisitionBudget", "retargetingBudget"] },
  ];
  for (const step of steps) {
    for (const key of step.keys) running[key] = levers[key];
    const cumulative = calculate(baseline, running).totalPurchases;
    breakdown.push({ id: step.id, label: step.label, delta: cumulative - previous, cumulative });
    previous = cumulative;
  }
  return { ...projected, label: "DEMO FORECAST", levers, confidence: getConfidence(levers), breakdown };
}
export function diagnose(b: BaselineMetrics): Bottleneck[] {
  return diagnosticRules.map(rule => {
    const parent = finite(b[rule.from]), child = finite(b[rule.to]);
    const currentRate = parent ? rate(child, parent) * 100 : null;
    const attainment = currentRate === null ? 0 : currentRate / rule.benchmark;
    const severity = attainment >= 1 ? "Healthy" : attainment >= .85 ? "Watch" : attainment >= .6 ? "Opportunity" : "Critical";
    return { id: rule.id, label: rule.label, benchmark: rule.benchmark, currentRate, severity,
      dropOff: Math.max(0, parent - child), opportunity: Math.max(0, Math.round(parent * rule.benchmark / 100) - child), lever: rule.lever,
      message: currentRate === null ? "모수가 없어 전환율을 계산할 수 없습니다. Mock 기준 데이터를 먼저 확인하세요." : rule.message };
  });
}
export function compareMetrics(b: PerformanceMetrics, p: PerformanceMetrics): MetricComparison[] {
  const definitions: { id: keyof PerformanceMetrics; label: string; format: MetricComparison["format"]; lowerBetter?: boolean; neutral?: boolean }[] = [
    { id: "totalPurchases", label: "총 구매", format: "count" }, { id: "revenue", label: "매출", format: "money" },
    { id: "adSpend", label: "광고비", format: "money", neutral: true }, { id: "cpa", label: "CPA", format: "money", lowerBetter: true }, { id: "roas", label: "ROAS", format: "percent" },
  ];
  return definitions.map(definition => {
    const current = b[definition.id], forecast = p[definition.id];
    const change = current === null || forecast === null ? null : forecast - current;
    return { ...definition, current, forecast, change, changePercent: current && change !== null ? change / current * 100 : null,
      direction: change === null || change === 0 || definition.neutral ? "neutral" : (definition.lowerBetter ? change < 0 : change > 0) ? "better" : "worse" };
  });
}
export function chartPairs(b: PerformanceMetrics, p: PerformanceMetrics, kind: "funnel" | "finance"): ChartPair[] {
  const definitions: { id: keyof PerformanceMetrics; label: string; format: ChartPair["format"] }[] = kind === "funnel" ? [
    { id: "visitors", label: "유입", format: "count" }, { id: "viewContent", label: "상품조회", format: "count" }, { id: "addToCart", label: "장바구니", format: "count" },
    { id: "checkout", label: "결제진입", format: "count" }, { id: "directPurchases", label: "직접 구매", format: "count" }, { id: "metaPurchases", label: "회수 구매", format: "count" },
  ] : [{ id: "revenue", label: "매출", format: "money" }, { id: "cpa", label: "CPA", format: "money" }, { id: "roas", label: "ROAS", format: "percent" }];
  return definitions.map(item => {
    const current = b[item.id], forecast = p[item.id];
    const max = kind === "funnel" ? Math.max(b.visitors, p.visitors, 1) : Math.max(current ?? 0, forecast ?? 0, 1);
    return { ...item, current, forecast, unit: ["directPurchases", "metaPurchases"].includes(item.id) ? "건" : "명", currentWidth: (current ?? 0) / max * 100, forecastWidth: (forecast ?? 0) / max * 100 };
  });
}

export function waterfallBars(b: BaselineMetrics, p: ProjectedMetrics) {
  const maximum = Math.max(1, b.totalPurchases, p.totalPurchases, ...p.breakdown.map(step => step.cumulative));
  let previous = b.totalPurchases;
  const steps = p.breakdown.map(step => {
    const bottom = Math.min(previous, step.cumulative) / maximum * 100;
    const height = Math.abs(step.delta) / maximum * 100;
    previous = step.cumulative;
    return { ...step, bottom, height, total: false };
  });
  return [
    { id: "baseline", label: "Baseline", delta: b.totalPurchases, cumulative: b.totalPurchases, bottom: 0, height: b.totalPurchases / maximum * 100, total: true },
    ...steps,
    { id: "projected", label: "Projected", delta: p.totalPurchases, cumulative: p.totalPurchases, bottom: 0, height: p.totalPurchases / maximum * 100, total: true },
  ];
}
