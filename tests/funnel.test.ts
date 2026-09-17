import { test } from "node:test";
import assert from "node:assert/strict";
import { getDashboard } from "../lib/dashboard";
import { getFunnelDataset } from "../data/mock/funnel-repository";
import { estimateAudience, filterFunnel, loadFunnelWorkspace, previewRetargeting } from "../lib/funnel";
import type { AudienceConditions } from "../types/funnel";
import type { Period } from "../types/domain";

const allConditions: AudienceConditions = { sources: ["gpt-organic", "gpt-ads"], events: ["ViewContent", "AddToCart", "BeginCheckout"], window: 30, excludePurchase: true };

test("모든 광고주/기간의 이벤트 집계가 기존 홈 수치와 일치한다", async () => {
  for (const advertiserId of ["brand-a", "brand-b"]) for (const period of [7, 14, 30] as Period[]) {
    const query = { advertiserId, period };
    const home = await getDashboard(query);
    const workspace = await loadFunnelWorkspace(query);
    assert.equal(workspace.totals.users, home.source.uniqueUsers);
    assert.equal(workspace.totals.sessions, home.source.sessions);
    assert.equal(workspace.totals.purchases, home.totals.purchases);
    assert.equal(workspace.totals.currentNonPurchase, home.analytics.nonPurchaseUsers);
    assert.equal(workspace.totals.audience, home.retargeting.retargetableAudience);
    assert.equal(workspace.totals.revenue, home.totals.revenue);
    assert.equal(workspace.totals.spend, home.totals.spend);
    assert.deepEqual(workspace.stages.map(stage => stage.users), [home.source.uniqueUsers, home.analytics.viewContent, home.analytics.addToCart, home.analytics.beginCheckout, home.analytics.directPurchases]);
    for (const row of workspace.sourceRows) {
      assert.equal(row.uniqueUsers, home.source.channels.find(source => source.id === row.id)!.users);
      assert.ok(row.uniqueUsers >= row.viewContent && row.viewContent >= row.addToCart && row.addToCart >= row.beginCheckout && row.beginCheckout >= row.purchases);
    }
    assert.equal(workspace.segments.reduce((sum, segment) => sum + segment.volume, 0), workspace.totals.audience);
    assert.equal(estimateAudience(workspace, allConditions).size, workspace.totals.audience);
    assert.ok(workspace.segments.every(segment => segment.share <= 100 && segment.share >= 0));
  }
});

test("소스별 세분화 지표와 재공략 집계는 합산 가능하며 현재/초기 미구매를 구분한다", async () => {
  const data = await loadFunnelWorkspace({ advertiserId: "brand-a", period: 30 });
  assert.equal(data.totals.initialNonPurchase, 1243);
  assert.equal(data.totals.currentNonPurchase, 1190);
  assert.equal(data.totals.recovered, 53);
  assert.equal(data.bottleneck?.id, "Purchase");
  assert.equal(data.bottleneck?.dropOff, 133);
  assert.equal(data.bottleneck?.conversionRate, 41 / 174 * 100);
  const a = filterFunnel(data, ["gpt-organic"]), b = filterFunnel(data, ["gpt-ads"]);
  for (const key of ["users", "sessions", "direct", "recovered", "purchases", "initialNonPurchase", "currentNonPurchase", "audience", "revenue", "spend"] as const) assert.equal(a.totals[key] + b.totals[key], data.totals[key], key);
  assert.ok(a.cohorts.every(row => row.sourceId === "gpt-organic"));
});

test("Audience의 Source·Event OR/AND와 Window·Purchase 제외가 실제 코호트를 필터링한다", async () => {
  const data = await loadFunnelWorkspace({ advertiserId: "brand-a", period: 30 });
  const size = (changes: Partial<AudienceConditions>) => estimateAudience(data, { ...allConditions, ...changes }).size;
  assert.equal(size({}), 742);
  assert.equal(size({ excludePurchase: false }), 836);
  assert.equal(size({ sources: [] }), 0);
  assert.equal(size({ events: [] }), 0);
  assert.ok(size({ window: 7 }) < size({ window: 14 }));
  assert.ok(size({ window: 14 }) < size({ window: 30 }));
  assert.equal(size({ events: ["ViewContent"] }), size({})); // OR deduplicates overlapping events.
  assert.ok(size({ events: ["BeginCheckout"] }) < size({ events: ["AddToCart"] }));
  assert.equal(size({ sources: ["gpt-organic"] }) + size({ sources: ["gpt-ads"] }), 742);
  const shortPeriod = await loadFunnelWorkspace({ advertiserId: "brand-a", period: 7 });
  assert.equal(estimateAudience(shortPeriod, allConditions).effectiveWindow, 7);
  assert.equal(estimateAudience(shortPeriod, allConditions).size, estimateAudience(shortPeriod, { ...allConditions, window: 7 }).size);
});

test("실제 이벤트 경과일 경계를 적용하고 세그먼트는 가장 깊은 행동만 집계한다", async () => {
  const dataset = getFunnelDataset({ advertiserId: "brand-a", period: 30 });
  dataset.spend = 0;
  dataset.journeys = [
    { sourceId: "gpt-organic", sessions: 1, eligible: true, events: [{ type: "ViewContent", daysAgo: 7 }, { type: "AddToCart", daysAgo: 7 }, { type: "BeginCheckout", daysAgo: 7 }] },
    { sourceId: "gpt-organic", sessions: 1, eligible: true, events: [{ type: "ViewContent", daysAgo: 8 }] },
    { sourceId: "gpt-ads", sessions: 1, eligible: false, events: [{ type: "ViewContent", daysAgo: 1 }] },
    { sourceId: "gpt-ads", sessions: 1, eligible: true, events: [{ type: "ViewContent", daysAgo: 1 }], conversion: { path: "direct", revenue: { amount: 100, currency: "KRW" } } },
  ];
  const data = await loadFunnelWorkspace(dataset.query, { getDataset: async () => dataset });
  assert.equal(estimateAudience(data, { ...allConditions, window: 7 }).size, 1);
  assert.equal(estimateAudience(data, { ...allConditions, window: 14 }).size, 2);
  assert.deepEqual(data.segments.map(segment => segment.volume), [1, 0, 1]);
});

test("새 Source를 Connector로 주입할 수 있고 0건에서도 NaN이나 잘못된 CPA가 없다", async () => {
  const dataset = getFunnelDataset({ advertiserId: "brand-b", period: 30 });
  dataset.sources = [{ id: "naver", name: "Naver Search", channelId: "naver", medium: "organic" }];
  dataset.journeys = [];
  const empty = await loadFunnelWorkspace(dataset.query, { getDataset: async () => dataset });
  assert.equal(empty.sourceRows[0].id, "naver");
  assert.equal(empty.bottleneck, null);
  assert.equal(empty.totals.roas, 0);
  assert.ok(Object.values(empty.totals).every(Number.isFinite));
  const preview = previewRetargeting(empty.segments[0], "Meta", 7);
  assert.equal(preview.forecastPurchases, 0);
  assert.equal(preview.forecastCpa, null);
});

test("리타겟팅 예상값은 세그먼트 규모와 Mock 가정으로 계산된다", async () => {
  const data = await loadFunnelWorkspace({ advertiserId: "brand-a", period: 30 });
  for (const segment of data.segments) {
    const preview = previewRetargeting(segment, "Meta", 30);
    assert.equal(preview.label, "DEMO FORECAST");
    assert.equal(preview.audience, segment.volume);
    assert.equal(preview.forecastPurchases, Math.round(segment.volume * segment.forecastRate));
    assert.equal(preview.forecastSpend, segment.volume * segment.costPerPerson);
    assert.equal(preview.forecastCpa, preview.forecastSpend / preview.forecastPurchases);
  }
});
