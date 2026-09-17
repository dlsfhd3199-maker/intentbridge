import { chartPairs } from "@/lib/simulation";
import type { BaselineMetrics, ProjectedMetrics } from "@/types/simulation";
import { formatMetric } from "./format";

export function SimulationCharts({ baseline, forecast }: { baseline: BaselineMetrics; forecast: ProjectedMetrics }) {
  return <div className="pl-charts">{(["funnel", "finance"] as const).map(kind => <section className="pl-panel" key={kind}><div className="pl-heading"><h2>{kind === "funnel" ? "현재 vs 예상 퍼널" : "매출·효율 변화"}</h2><span className="pl-tag">DEMO FORECAST</span></div><div className="pl-chart-legend"><span>● Current</span><span>● 예상 성과</span></div><div className="pl-chart-rows">{chartPairs(baseline, forecast, kind).map(row => <div key={row.id} className="pl-chart-row"><div><b>{row.label}</b><span>{formatMetric(row.current, row.format, row.unit)} → <strong>{formatMetric(row.forecast, row.format, row.unit)}</strong></span></div><div className="pl-chart-tracks" aria-hidden="true"><div><i style={{ width: `${row.currentWidth}%` }}/></div><div><i style={{ width: `${row.forecastWidth}%` }}/></div></div></div>)}</div><p className="pl-note">{kind === "funnel" ? "전체 유입을 공통 척도로 비교합니다. 회수 구매는 직접 구매와 별도 경로입니다." : "지표별 두 값 중 큰 값을 100%로 표시합니다. 서로 다른 단위의 막대 길이는 비교하지 않습니다. CPA는 낮을수록 좋습니다."}</p></section>)}</div>;
}
