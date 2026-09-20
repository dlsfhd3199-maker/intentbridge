import test from 'node:test';
import assert from 'node:assert/strict';
import {connectorCatalog,connections,emptyPlatform,onboardingSteps,workspaceHealth} from '../features/platform/catalog';
import {getDashboard,advertisers} from '../lib/dashboard';
import {loadPerformanceTrend} from '../lib/performance-trend';
import {loadPerformanceBaseline} from '../lib/simulation/baseline';
import {loadFunnelWorkspace} from '../lib/funnel';
import {loadCampaignWorkspace,newCampaignDraft,evaluateCampaign} from '../lib/campaign-service';
import {saveCampaign,changeCampaignStatus} from '../lib/campaign-store';
test('Demo connectors validate selections without network and use existing aggregate metrics',async()=>{
 for(const c of connectorCatalog){assert.equal((await connections.get(c.id).test({account:c.accounts[0],property:c.properties[0],fields:c.fields})).ok,true);assert.equal((await connections.get(c.id).test({account:'unknown',property:c.properties[0],fields:c.fields})).ok,false);assert.equal((await connections.get(c.id).test({account:c.accounts[0],property:c.properties[0],fields:[]})).ok,false);}
 for(const advertiser of advertisers){const d=await getDashboard({advertiserId:advertiser.id,period:30});assert.equal(connections.get('ga4').collect(d).find(m=>m.label==='구매')?.value,d.analytics.directPurchases+d.retargeting.recoveredPurchases);assert.equal((await loadPerformanceBaseline({advertiserId:advertiser.id,period:30})).totalPurchases,d.totals.purchases);assert.ok(await loadFunnelWorkspace({advertiserId:advertiser.id,period:30}));}
});
test('Onboarding requires profile, actual manager membership, connection, verification and launch',()=>{const doc=emptyPlatform();assert.deepEqual(onboardingSteps(doc,0,false),[false,false,false,false,false]);assert.equal(workspaceHealth(doc),'설정 중');doc.profile={siteUrl:'https://example.invalid',monthlyBudget:100,goal:'구매'};doc.connections.ga4={state:'healthy',account:'Demo',property:'Demo',fields:['구매'],lastSync:null};doc.validated=true;assert.deepEqual(onboardingSteps(doc,1,true),[true,true,true,true,false]);doc.started=true;assert.equal(workspaceHealth(doc),'운영 정상');doc.connections.ga4.state='error';assert.equal(workspaceHealth(doc),'데이터 오류');});
test('Shared deterministic daily dataset preserves dashboard totals and nested 7/14/30 periods',async()=>{for(const a of advertisers){const full=await loadPerformanceTrend(a.id,30);for(const period of [7,14,30] as const){const daily=await loadPerformanceTrend(a.id,period),d=await getDashboard({advertiserId:a.id,period});assert.deepEqual(daily.rows,full.rows.slice(-period));assert.equal(daily.rows.reduce((s,r)=>s+r.purchases,0),d.totals.purchases);assert.equal(daily.rows.reduce((s,r)=>s+r.revenue,0),d.totals.revenue);assert.equal(daily.rows.reduce((s,r)=>s+r.spend,0),d.totals.spend);assert.deepEqual(daily,await loadPerformanceTrend(a.id,period));}}});
test('Campaign daily revenue belongs to purchase days and retains observation totals',async()=>{
 const context=await loadCampaignWorkspace({advertiserId:'brand-a',period:30}),draft=newCampaignDraft(context);
 const c=saveCampaign(draft,evaluateCampaign(draft,context),context.advertiser.name,true);
 changeCampaignStatus('brand-a',c.id,'MOCK ACTIVE');
 const full=await loadPerformanceTrend('brand-a',30,c.id);
 for(const period of [7,14,30] as const){const trend=await loadPerformanceTrend('brand-a',period,c.id);assert.deepEqual(trend.rows,full.rows.slice(-period));assert.equal(trend.rows.reduce((sum,r)=>sum+r.revenue,0),trend.totals.revenue);assert.ok(trend.rows.every(r=>r.purchases>0||r.revenue===0));}
});
