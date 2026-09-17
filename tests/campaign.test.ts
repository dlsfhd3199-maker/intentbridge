import { test } from "node:test";
import assert from "node:assert/strict";
import { loadCampaignWorkspace, newCampaignDraft, evaluateCampaign, performanceHandoff } from "../lib/campaign-service";
import { forecastCampaign, changeCampaignBudget } from "../lib/campaign-forecast";
import { saveCampaign, readCampaignStore, persistCampaignDraft, changeCampaignStatus, isCampaignDraft } from "../lib/campaign-store";
import { campaignName, campaignTracking } from "../lib/campaign-naming";
import { getRecommendations } from "../lib/recommendations";
import { simulate } from "../lib/simulation";
import { scenarios } from "../data/mock/simulation-config";
import { saveSetting } from "../lib/simulation/store";
import { savedCampaignSimulations } from "../lib/campaign-simulations";

test("기존 Segment와 Campaign Audience는 모든 광고주·기간에서 일치한다", async () => {
  for (const advertiserId of ["brand-a","brand-b"]) for (const period of [7,14,30] as const) {
    const ctx = await loadCampaignWorkspace({advertiserId,period});
    for (const segment of ctx.funnel.segments) {
      const d = newCampaignDraft(ctx, { from:"Funnel Workspace",segmentId:segment.id,window:segment.window,recommendedBudgetChange:0,createdAt:new Date().toISOString() });
      const e = evaluateCampaign(d,ctx);
      assert.equal(e.audience,segment.volume); assert.ok(e.ready);
      assert.ok(e.forecast.purchases <= e.forecast.clicks && e.forecast.clicks <= e.forecast.reach && e.forecast.reach <= e.audience);
      assert.ok(evaluateCampaign({...d,window:3},ctx).audience <= e.audience);
      assert.equal(evaluateCampaign({...d,sourceIds:[]},ctx).audience,0);
      assert.equal(evaluateCampaign({...d,purchaseExcluded:false},ctx).ready,false);
      assert.equal(evaluateCampaign({...d,retargetingChannelId:"google"},ctx).ready,false);
    }
  }
});
test("Forecast는 알려진 산식과 인원·예산 상한 및 0/NaN 경계를 지킨다", () => {
  const input = {audience:1000,budget:14000,duration:7,ctr:.05,cvr:.2,averageOrderValue:100000,cpm:14000,frequency:"daily-1" as const};
  const f = forecastCampaign(input);
  assert.equal(f.impressions,1000); assert.equal(f.clicks,50); assert.equal(f.purchases,10); assert.equal(f.revenue,1000000); assert.equal(f.cpa,1400);
  for (const invalid of [0,-1,NaN,Infinity]) {
    const empty = forecastCampaign({...input,budget:invalid}); assert.equal(empty.purchases,0); assert.equal(empty.cpa,null); assert.equal(empty.roas,null);
    assert.equal(forecastCampaign({...input,duration:invalid}).purchases,0);
    assert.equal(forecastCampaign({...input,audience:invalid}).purchases,0);
  }
  let budget = changeCampaignBudget({daily:0,total:0,duration:7,mode:"daily"},"daily",50000);
  assert.equal(budget.total,350000);
  budget = changeCampaignBudget(budget,"total",700000); assert.equal(budget.daily,100000);
  budget = changeCampaignBudget(budget,"duration",14); assert.equal(budget.daily,50000); assert.equal(budget.total,700000);
  assert.equal(changeCampaignBudget(budget,"daily",NaN).total,0);
  assert.equal(changeCampaignBudget(budget,"daily",-20).total,0);
});
test("추천·시나리오를 보존하며 이름과 Tracking을 안전하게 생성한다", async () => {
  const ctx = await loadCampaignWorkspace({advertiserId:"brand-a",period:30});
  const levers = scenarios[1].levers, rec = getRecommendations(ctx.baseline,simulate(ctx.baseline,levers))[0];
  const handoff = performanceHandoff(ctx.baseline,levers,rec);
  const d = newCampaignDraft(ctx,handoff.origin,handoff.sourceIds);
  assert.equal(d.origin.recommendation?.id,rec.id); assert.equal(d.origin.scenario,scenarios[1].id);
  assert.equal(d.origin.forecast?.totalPurchases,124); assert.deepEqual(d.origin.levers,levers);
  assert.ok(campaignName(d).startsWith("IB_META_"));
  const tracking = campaignTracking({...d,name:"한글 이름 & / 테스트"},ctx.funnel.campaign.id);
  assert.equal(new URLSearchParams(tracking.parameters).get("utm_source"),"meta");
  assert.ok(!new URLSearchParams(tracking.parameters).get("utm_campaign")?.includes("&"));
  saveSetting(ctx.baseline,levers);
  const saved = await savedCampaignSimulations("brand-a"); assert.ok(saved.some(s => s.forecast.totalPurchases === 124));
});
test("초안·READY·상태 변경은 광고주별로 저장되며 중복 생성과 부정 설정을 막는다", async () => {
  const ctx = await loadCampaignWorkspace({advertiserId:"brand-a",period:30});
  const d = newCampaignDraft(ctx), e = evaluateCampaign(d,ctx);
  persistCampaignDraft(d); assert.equal(readCampaignStore("brand-a").draft?.draftId,d.draftId);
  assert.equal(readCampaignStore("brand-b").campaigns.length,0);
  saveCampaign(d,e,ctx.advertiser.name); const c = saveCampaign(d,e,ctx.advertiser.name,true);
  assert.equal(c.status,"READY"); assert.equal(saveCampaign(d,e,ctx.advertiser.name,true).id,c.id);
  assert.equal(readCampaignStore("brand-a").campaigns.length,1);
  assert.equal(changeCampaignStatus("brand-a",c.id,"MOCK ACTIVE").status,"MOCK ACTIVE");
  assert.equal(changeCampaignStatus("brand-a",c.id,"PAUSED").status,"PAUSED");
  assert.throws(() => saveCampaign({...d,draftId:crypto.randomUUID()}, {...e,ready:false},ctx.advertiser.name,true));
  assert.equal(isCampaignDraft({...d,budget:{...d.budget,total:NaN}},"brand-a"),false);
  assert.equal(isCampaignDraft({...d,period:"30"},"brand-a"),false);
  assert.equal(isCampaignDraft({...d,origin:{...d.origin,scenario:{bad:true}}},"brand-a"),false);
});
