import { number, percent, won } from "@/lib/format";
import type { DashboardData } from "@/types/domain";
export function Metrics({ data }: { data: DashboardData }) {
  const metrics = [
    { label: "유입 고객", en: "SOURCE UNIQUE USERS", value: number(data.source.uniqueUsers), unit: "명", note: `${number(data.source.sessions)} Sessions` },
    { label: "전체 구매", en: "TOTAL PURCHASE", value: number(data.totals.purchases), unit: "건", note: `직접 ${data.analytics.directPurchases} + 회수 ${data.retargeting.recoveredPurchases}` },
    { label: "통합 매출", en: "TOTAL REVENUE", value: won(data.totals.revenue), note: "직접 매출 + 회수 매출" },
    { label: "집행 광고비", en: "AD SPEND", value: won(data.totals.spend), note: "GPT Ads + Meta" },
    { label: "구매당 비용", en: "CPA", value: won(data.totals.cpa), note: "광고비 ÷ 전체 구매" },
    { label: "광고 수익률", en: "ROAS", value: percent(data.totals.roas), note: "매출 ÷ 광고비 × 100", accent: true },
  ];
  return <section title="데이터 출처: 구매·매출 = GA4 데모 집계 / 광고비 = AI 유입 + Meta 데모 비용" className="metrics-grid" aria-label="핵심 성과 지표">{metrics.map(metric => <article className={`metric ${metric.accent ? "metric-accent" : ""}`} key={metric.en}><span>{metric.label}</span><small>{metric.en}</small><div className="metric-value">{metric.value}<em>{metric.unit}</em></div><p>{metric.note}</p></article>)}</section>;
}
