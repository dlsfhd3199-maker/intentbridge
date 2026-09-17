import Link from "next/link";
import { ArrowRight, Network } from "lucide-react";
import { number } from "@/lib/format";
import type { DashboardData } from "@/types/domain";
export function FunnelSummary({ data, detailed = false }: { data: DashboardData; detailed?: boolean }) {
  const stages = [
    { label: "유입 고객", en: "Source users", value: data.source.uniqueUsers },
    { label: "상품 조회", en: "ViewContent", value: data.analytics.viewContent },
    { label: "장바구니", en: "AddToCart", value: data.analytics.addToCart },
    { label: "결제 진입", en: "BeginCheckout", value: data.analytics.beginCheckout },
    { label: "직접 구매", en: "Direct Purchase", value: data.analytics.directPurchases },
  ];
  return <section className="funnel-panel"><div className="panel-heading"><div><div className="eyebrow mint"><Network size={14}/> THE GROWTH BRIDGE</div><h2>관심이 구매가 되는 여정</h2></div>{!detailed && <Link href="/funnel" className="dark-link">퍼널 살펴보기 <ArrowRight size={15}/></Link>}</div>
    <div className="funnel-chart">{stages.map((stage, index) => <div className="funnel-stage" key={stage.en}><span className="stage-number">0{index + 1}</span><div className="funnel-bar-space"><div className={`funnel-bar bar-${index}`} style={{ height: `${stage.value / data.source.uniqueUsers * 100}%` }}/></div><strong>{number(stage.value)}<small>{index === 4 ? "건" : "명"}</small></strong><b>{stage.label}</b><span>{stage.en}</span></div>)}</div>
    <div className="recovery-strip"><div><span className="recovery-icon">↳</span><span>Meta에서 다시 만난 관심 고객</span></div><span>회수 구매 <strong>+{number(data.retargeting.recoveredPurchases)}건</strong></span><ArrowRight size={16}/><span>전체 구매 <strong className="mint">{number(data.totals.purchases)}건</strong></span></div>
    <p className="panel-footnote">자사몰에서 GA4 분석과 Meta Pixel/CAPI 수집이 병렬로 작동하는 구조입니다.</p>
  </section>;
}
