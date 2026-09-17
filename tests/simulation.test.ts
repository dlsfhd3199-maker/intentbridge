import { test } from "node:test";
import assert from "node:assert/strict";
import { loadPerformanceBaseline } from "../lib/simulation/baseline";
import { chartPairs, compareMetrics, diagnose, normalizeLevers, simulate } from "../lib/simulation";
import { getRecommendations } from "../lib/recommendations";
import { leverDefinitions, scenarios, zeroLevers } from "../data/mock/simulation-config";
import { identifyScenario, restoreSetting, saveSetting, settingKey } from "../lib/simulation/store";
import type { BaselineMetrics } from "../types/simulation";
import type { Period } from "../types/domain";

test("Reset은 모든 광고주·기간의 기존 Baseline과 정확히 일치한다", async () => {
  for (const advertiserId of ["brand-a", "brand-b"]) for (const period of [7, 14, 30] as Period[]) {
    const b = await loadPerformanceBaseline({ advertiserId, period });
    const p = simulate(b, zeroLevers);
    for (const key of ["visitors", "viewContent", "addToCart", "checkout", "directPurchases", "metaPurchases", "totalPurchases", "revenue", "adSpend", "cpa", "roas", "recoveryPool"] as const) assert.equal(p[key], b[key], `${advertiserId} ${period} ${key}`);
    assert.ok(p.breakdown.every(step => step.delta === 0));
  }
});

test("추천 시나리오의 수치와 Confidence, Breakdown 합계가 검증된 예시와 일치한다", async () => {
  const b = await loadPerformanceBaseline({ advertiserId: "brand-a", period: 30 });
  assert.equal(b.totalPurchases, 94);
  assert.equal(b.recoveryPool, 795);
  const p = simulate(b, scenarios[1].levers);
  assert.equal(p.visitors, 1284);
  assert.equal(p.directPurchases, 55);
  assert.equal(p.metaPurchases, 69);
  assert.equal(p.totalPurchases, 124);
  assert.equal(p.revenue, 18059103);
  assert.equal(p.adSpend, 3372500);
  assert.equal(b.totalPurchases + p.breakdown.reduce((sum, row) => sum + row.delta, 0), p.totalPurchases);
  assert.deepEqual(scenarios.map(scenario => simulate(b, scenario.levers).confidence.level), ["HIGH", "MEDIUM", "LOW"]);
});

test("6개 레버의 모든 최소/최대 조합에서 인원 상한·합계·유한성을 보장한다", async () => {
  for (const advertiserId of ["brand-a", "brand-b"]) for (const period of [7, 14, 30] as Period[]) {
    const b = await loadPerformanceBaseline({ advertiserId, period });
    for (let mask = 0; mask < 64; mask++) {
      const levers = { ...zeroLevers };
      leverDefinitions.forEach((definition, index) => { levers[definition.id] = mask & (1 << index) ? definition.max : definition.min; });
      const p = simulate(b, levers);
      const counts = [p.visitors, p.viewContent, p.addToCart, p.checkout, p.directPurchases];
      counts.forEach((value, index) => { assert.ok(Number.isInteger(value) && value >= 0); if (index) assert.ok(value <= counts[index - 1]); });
      assert.ok(p.metaPurchases <= p.recoveryPool && p.recoveryPool <= p.visitors - p.directPurchases);
      assert.equal(p.totalPurchases, p.directPurchases + p.metaPurchases);
      for (const value of [p.revenue, p.adSpend, p.cpa, p.roas]) assert.ok(value === null || Number.isFinite(value) && value >= 0);
      assert.equal(b.totalPurchases + p.breakdown.reduce((sum, item) => sum + item.delta, 0), p.totalPurchases);
    }
  }
});

test("예산 변화는 유료 유입에만 반영되고 악화 지표는 악화로 반환한다", async () => {
  const b = await loadPerformanceBaseline({ advertiserId: "brand-a", period: 30 });
  const p = simulate(b, { acquisitionBudget: 50 });
  assert.equal(p.visitors, b.organicVisitors + Math.round(b.paidVisitors * 1.5));
  const changes = compareMetrics(b, p);
  assert.equal(changes.find(row => row.id === "cpa")!.direction, "worse");
  assert.equal(changes.find(row => row.id === "roas")!.direction, "worse");
  const totalBudget = simulate(b, { acquisitionBudget: 20, retargetingBudget: 20 });
  assert.equal(totalBudget.adSpend, Math.round(b.adSpend * 1.2));
});

test("추천은 데이터·현재 설정에 따라 달라지고 적용하면 Forecast가 재계산된다", async () => {
  const b = await loadPerformanceBaseline({ advertiserId: "brand-a", period: 30 });
  const initial = simulate(b, zeroLevers);
  const recs = getRecommendations(b, initial);
  assert.ok(recs.length > 0 && recs.length <= 3);
  assert.ok(recs.some(rec => rec.id === "improve-checkout"));
  const applied = simulate(b, { ...initial.levers, ...recs[0].changes });
  assert.notEqual(applied.totalPurchases, initial.totalPurchases);
  const bad = simulate(b, { acquisitionBudget: 50 });
  assert.equal(getRecommendations(b, bad)[0].id, "efficiency-guardrail");
  const maximum = normalizeLevers(Object.fromEntries(leverDefinitions.map(definition => [definition.id, definition.max])));
  assert.notDeepEqual(getRecommendations(b, simulate(b, maximum)).map(rec => rec.id), recs.map(rec => rec.id));
});

test("잘못된 레버·0건·0원 입력을 안전하게 처리하고 채널명에 계산을 결합하지 않는다", async () => {
  const b = await loadPerformanceBaseline({ advertiserId: "brand-a", period: 30 });
  assert.deepEqual(normalizeLevers({ landing: NaN, cart: Infinity, checkout: -10, acquisitionBudget: -200, retargetingBudget: 500 }), { ...zeroLevers, acquisitionBudget: -30, retargetingBudget: 100 });
  const empty: BaselineMetrics = { ...b, visitors: 0, organicVisitors: 0, paidVisitors: 0, viewContent: 0, addToCart: 0, checkout: 0, directPurchases: 0, metaPurchases: 0, totalPurchases: 0, recoveryPool: 0, currentAudience: 0, revenue: 0, directRevenue: 0, recoveredRevenue: 0, acquisitionSpend: 0, retargetingSpend: 0, adSpend: 0, cpa: null, roas: null };
  const p = simulate(empty, scenarios[2].levers);
  assert.equal(p.cpa, null); assert.equal(p.roas, null); assert.equal(p.totalPurchases, 0);
  assert.ok(diagnose(empty).every(row => row.currentRate === null));
  assert.ok(chartPairs(empty, p, "finance").every(row => row.currentWidth === 0 && row.forecastWidth === 0));
  const other = { ...b, sourceChannel: { id: "naver", name: "Naver" }, retargetingChannel: { id: "google", name: "Google", kind: "retargeting" as const } };
  assert.deepEqual(simulate(other, zeroLevers), simulate(b, zeroLevers));
});

test("설정 저장은 광고주·기간별로 분리하고 손상 데이터·Storage 거부에 대응한다", async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) } });
  try {
    const b = await loadPerformanceBaseline({ advertiserId: "brand-a", period: 30 });
    const a = { ...b, advertiserId: "storage-test-a" }, other = { ...b, advertiserId: "storage-test-b" };
    assert.equal(saveSetting(a, scenarios[2].levers), "local");
    assert.deepEqual(restoreSetting(a), scenarios[2].levers);
    assert.deepEqual(restoreSetting(other), zeroLevers);
    assert.deepEqual(restoreSetting({ ...a, period: 7 }), zeroLevers);
    assert.equal(JSON.parse(storage.get(settingKey(a))!).scenario, "aggressive");
    assert.equal(identifyScenario(restoreSetting(a)), "aggressive");
    storage.set(settingKey(other), "broken-json"); assert.deepEqual(restoreSetting(other), zeroLevers);
    storage.set(settingKey(other), JSON.stringify({ levers: { landing: 900, cart: "secret" }, forecast: { totalPurchases: 999999 } }));
    assert.equal(restoreSetting(other).landing, 30); assert.equal(restoreSetting(other).cart, 0);
    Object.defineProperty(globalThis, "localStorage", { configurable: true, get() { throw new Error("denied"); } });
    assert.equal(saveSetting(other, { ...zeroLevers, cart: 10 }), "memory");
    assert.equal(restoreSetting(other).cart, 10);
  } finally { if (descriptor) Object.defineProperty(globalThis, "localStorage", descriptor); else Reflect.deleteProperty(globalThis, "localStorage"); }
});
