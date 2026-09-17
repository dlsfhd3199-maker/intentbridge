import type { LeverId, SimulationLevers, SimulationScenario } from "../../types/simulation";

export const zeroLevers: SimulationLevers = { landing: 0, cart: 0, checkout: 0, retargetingEfficiency: 0, acquisitionBudget: 0, retargetingBudget: 0 };
export const leverDefinitions: { id: LeverId; label: string; min: number; max: number; help: string }[] = [
  { id: "landing", label: "Landing CVR Improvement", min: 0, max: 30, help: "유입 → 상품조회 전환율의 상대 개선" },
  { id: "cart", label: "AddToCart Improvement", min: 0, max: 30, help: "상품조회 → 장바구니 전환율의 상대 개선" },
  { id: "checkout", label: "Checkout Completion Improvement", min: 0, max: 30, help: "결제진입 → 직접 구매 전환율의 상대 개선" },
  { id: "retargetingEfficiency", label: "Retargeting Efficiency", min: 0, max: 40, help: "재공략 풀 → 추가 구매 전환율의 상대 개선" },
  { id: "acquisitionBudget", label: "Acquisition Budget", min: -30, max: 50, help: "유입 광고비와 Paid 유입에만 비례 적용 · Organic 고정" },
  { id: "retargetingBudget", label: "Retargeting Budget", min: -30, max: 100, help: "재공략 광고비와 회수율에 비례 적용 · 풀 규모로 제한" },
];
export const scenarios: SimulationScenario[] = [
  { id: "conservative", name: "보수적", englishName: "Conservative", levers: { landing: 3, cart: 3, checkout: 3, retargetingEfficiency: 5, acquisitionBudget: 0, retargetingBudget: 0 } },
  { id: "recommended", name: "추천", englishName: "Recommended", levers: { landing: 8, cart: 10, checkout: 12, retargetingEfficiency: 15, acquisitionBudget: 0, retargetingBudget: 15 } },
  { id: "aggressive", name: "공격적", englishName: "Aggressive", levers: { landing: 15, cart: 20, checkout: 20, retargetingEfficiency: 30, acquisitionBudget: 15, retargetingBudget: 40 } },
];
export const whatIfPresets: { id: string; label: string; changes: Partial<SimulationLevers> }[] = [
  { id: "retarget-10", label: "재공략 예산 +10%", changes: { retargetingBudget: 10 } },
  { id: "retarget-30", label: "재공략 예산 +30%", changes: { retargetingBudget: 30 } },
  { id: "landing-10", label: "Landing +10%", changes: { landing: 10 } },
  { id: "checkout-15", label: "Checkout +15%", changes: { checkout: 15 } },
  { id: "total-20", label: "Total Budget +20%", changes: { acquisitionBudget: 20, retargetingBudget: 20 } },
];
// Product demonstration targets, NOT industry benchmarks or statistically learned thresholds.
export const diagnosticRules = [
  { id: "landing", label: "유입 → 상품조회", from: "visitors", to: "viewContent", benchmark: 85, lever: "landing", message: "유입 메시지와 상품 상세 첫 화면의 일치도를 확인하세요." },
  { id: "cart", label: "상품조회 → 장바구니", from: "viewContent", to: "addToCart", benchmark: 45, lever: "cart", message: "가격·배송·후기·혜택을 CTA 이전에 배치하는 테스트를 검토하세요." },
  { id: "checkout-entry", label: "장바구니 → 결제진입", from: "addToCart", to: "checkout", benchmark: 60, lever: "checkout", message: "배송비 공개 시점과 결제 진입 동선의 마찰을 확인하세요." },
  { id: "checkout", label: "결제진입 → 직접 구매", from: "checkout", to: "directPurchases", benchmark: 40, lever: "checkout", message: "결제 수단·신뢰 정보·입력 단계의 마찰을 줄이는 테스트를 검토하세요." },
  { id: "retargeting", label: "재공략 풀 → 추가 구매", from: "recoveryPool", to: "metaPurchases", benchmark: 10, lever: "retargetingEfficiency", message: "미구매 세그먼트에 맞는 소재와 CTA를 테스트하세요." },
] as const;
