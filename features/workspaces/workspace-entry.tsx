"use client";
import Link from "next/link";
import { ArrowLeft, ArrowRight, FlaskConical } from "lucide-react";
import { useDashboard } from "@/components/app-shell";
import { Metrics } from "@/components/metrics";
import { FunnelSummary } from "@/features/dashboard/funnel-summary";
import { number } from "@/lib/format";
export function WorkspaceEntry({ kind }: { kind: "funnel" | "performance" }) {
  const data = useDashboard();
  const isFunnel = kind === "funnel";
  return <div className="space-y-6"><div className="phase-note"><span className="soft-badge">1차 · 진입 화면</span><span>{isFunnel ? "퍼널 상세 기능은 2차 단계에서 확장합니다." : "시뮬레이션 기능은 3차 단계에서 구현합니다."}</span></div>
    {isFunnel ? <><FunnelSummary data={data} detailed/><section className="light-panel"><div className="panel-heading"><h2>현재 연결된 유입</h2><span className="soft-badge">MOCK CONNECTED</span></div><div className="entry-sources">{data.source.channels.map(source => <div key={source.id}><span>{source.name}</span><b>{number(source.users)}명</b></div>)}</div><p className="small-note mt-5">다음 단계: 행동 이벤트 집계 · 미구매 세그먼트 30D / 14D / 7D · Purchase 제외 · 광고비와 매출 분석</p></section></> : <><Metrics data={data}/><section className="lab-placeholder"><span className="lab-orb"><FlaskConical size={42}/></span><span className="eyebrow mint">PERFORMANCE LAB / PREVIEW</span><h2>더 나은 성과를 위한 실험이 시작될 곳</h2><p>선택한 광고주의 현재 성과를 기준으로, 랜딩 전환율과 재공략 효율,<br className="desktop-break"/> 예산 배분을 바꾸는 시나리오를 비교할 예정입니다.</p><div className="lab-roadmap"><span>01 · 병목 진단</span><ArrowRight size={15}/><span>02 · 시나리오 조정</span><ArrowRight size={15}/><span>03 · 개선 전후 비교</span></div><div className="forecast-note">DEMO FORECAST · 구현 예정<p>아직 예상값을 계산하지 않습니다. 이후 규칙 기반 성과 예측으로 제공하며 실제 성과를 보장하지 않습니다.</p></div></section></>}
    <Link href="/dashboard" className="back-link"><ArrowLeft size={16}/> 홈 대시보드로 돌아가기</Link></div>;
}
