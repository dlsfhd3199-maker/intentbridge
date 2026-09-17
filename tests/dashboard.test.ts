import { test } from "node:test";
import assert from "node:assert/strict";
import { getDashboard } from "../lib/dashboard";
import type { Period } from "../types/domain";

test("원본 30일 데이터와 직접/회수 구매·매출이 일치한다", async () => {
  const a = await getDashboard({ advertiserId: "brand-a", period: 30 });
  assert.equal(a.source.uniqueUsers, 1284);
  assert.equal(a.source.sessions, 1516);
  assert.equal(a.analytics.directPurchases, 41);
  assert.equal(a.retargeting.recoveredPurchases, 53);
  assert.equal(a.totals.purchases, 94);
  assert.equal(a.totals.revenue, 13690000);
  assert.equal(a.totals.spend, 3200000);
  assert.equal(a.totals.cpa, 3200000 / 94);
  assert.equal(a.analytics.nonPurchaseUsers, 1190);
  const b = await getDashboard({ advertiserId: "brand-b", period: 30 });
  assert.equal(b.source.uniqueUsers, 842);
  assert.equal(b.totals.purchases, 63);
  assert.equal(b.totals.revenue, 9450000);
  assert.equal(b.retargeting.retargetableAudience, 511);
});
test("모든 광고주·기간에서 집계 정합성과 기간 전환을 보장한다", async () => {
  for (const advertiserId of ["brand-a", "brand-b"]) {
    let lastUsers = 0;
    for (const period of [7, 14, 30] as Period[]) {
      const data = await getDashboard({ advertiserId, period });
      assert.ok(data.source.uniqueUsers > lastUsers);
      lastUsers = data.source.uniqueUsers;
      assert.equal(data.source.uniqueUsers, data.source.channels.reduce((sum, source) => sum + source.users, 0));
      assert.equal(data.retargeting.retargetableAudience, data.retargeting.segments.reduce((sum, segment) => sum + segment.volume, 0));
      assert.ok(data.retargeting.retargetableAudience <= data.analytics.nonPurchaseUsers);
      assert.ok(data.analytics.beginCheckout >= data.analytics.directPurchases);
      assert.ok(data.source.sessions >= data.source.uniqueUsers);
      assert.equal(data.retargeting.purchaseExcluded, true);
    }
  }
});
test("알 수 없는 광고주와 기간은 데이터로 위장하지 않는다", async () => {
  await assert.rejects(getDashboard({ advertiserId: "missing", period: 30 }));
  await assert.rejects(getDashboard({ advertiserId: "brand-a", period: 90 as Period }));
});
