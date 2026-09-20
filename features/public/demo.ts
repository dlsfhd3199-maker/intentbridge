import fixture from '@/mock/mock-data.json';
// Public, shipped demo fixture only. Never read authenticated tenant data for marketing.
const sample=fixture.advertisers[0];
const purchases=sample.funnel.directPurchases+sample.funnel.recoveredPurchases;
const revenue=sample.finance.directRevenue+sample.finance.recoveredRevenue;
const spend=sample.finance.gptSpend+sample.finance.metaSpend;
export const preview={users:sample.source.uniqueUsers,view:sample.funnel.viewContent,cart:sample.funnel.addToCart,checkout:sample.funnel.beginCheckout,direct:sample.funnel.directPurchases,recovered:sample.funnel.recoveredPurchases,eligible:sample.funnel.retargetableAudience,purchases,revenue,spend,roas:revenue/spend*100,cartAudience:sample.segments.find(s=>s.id==='cart-14d')!.volume,drop:sample.funnel.viewContent-sample.funnel.addToCart,forecastPurchases:Math.round(purchases*1.2),forecastRevenue:Math.round(revenue*1.2)};
export const formatNumber=(n:number)=>n.toLocaleString('ko-KR');
export const formatMoney=(n:number)=>'₩'+formatNumber(n);
