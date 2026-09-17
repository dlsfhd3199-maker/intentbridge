import type {GA4Snapshot,GA4Overview} from "../../types/ga4";
export function getGA4Baseline(s:GA4Snapshot){return {provenance:"real" as const,overview:s.overview,eventUsers:s.events.map(e=>({...e})),period:s.period};}
// Order-based projection: no fabricated sequential cohort, retargeting share or ad cost.
export function simulateGA4Baseline(b:ReturnType<typeof getGA4Baseline>,lift:number):GA4Overview&{provenance:"forecast"}{const normalized=Number.isFinite(lift)?Math.max(-30,Math.min(30,lift)):0;const purchases=Math.round(b.overview.purchases*(1+normalized/100));return {...b.overview,provenance:"forecast",purchases,purchaseRevenue:normalized===0?b.overview.purchaseRevenue:b.overview.purchases?Math.round(purchases*b.overview.purchaseRevenue/b.overview.purchases*100)/100:0};}
