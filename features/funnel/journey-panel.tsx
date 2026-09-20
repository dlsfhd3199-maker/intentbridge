"use client";
import {useSearchParams} from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowDown, ArrowRight, Info } from "lucide-react";
import type { FunnelWorkspaceData, StageId } from "@/types/funnel";
import { number, percent } from "@/lib/format";

export function JourneyPanel({ data }: { data: FunnelWorkspaceData }) {
  const [selected, setSelected] = useState<StageId>(data.bottleneck?.id ?? "Visit");
  const params=useSearchParams(),signalStage=params.get("signalStage");
  useEffect(()=>{if(params.get("advertiser")===data.advertiser.id&&Number(params.get("period"))===data.query.period&&data.stages.some(s=>s.id===signalStage))setSelected(signalStage as StageId)},[signalStage,params,data]);
  const largestLoss=data.stages.reduce((largest,item)=>item.dropOff>largest.dropOff?item:largest,data.stages[0]);
  const stage = data.stages.find(item => item.id === selected)!;
  return <section className="fw-journey" aria-label="고객 여정 퍼널"><div className="fw-section-heading"><div><span className="fw-overline">CUSTOMER JOURNEY</span><h2>고객의 다음 행동을 연결하세요</h2></div><span className="fw-badge dark">MOCK RULE</span></div>
    {largestLoss.dropOff>0&&<p className="ui-loss-note">가장 많은 이탈 · {largestLoss.label} 단계 진입 전 <b>{number(largestLoss.dropOff)}명</b> — 전환율 기준 병목과 구분해 확인하세요.</p>}
    <div className="fw-journey-grid"><div className="fw-stage-list" role="group" aria-label="퍼널 단계 선택">{data.stages.map((item, index) => <div key={item.id}>{index > 0 && <div className={`fw-transition ${item.status === "병목" ? "is-bottleneck" : ""}`}><ArrowDown size={13}/><span>이전 단계 대비 {item.conversionRate === null ? "—" : percent(item.conversionRate)}</span><span>이탈 {number(item.dropOff)}명</span></div>}<button className={`fw-stage ${selected === item.id ? "is-selected" : ""} ${item.status === "병목" ? "is-bottleneck" : ""} ${item.id===largestLoss.id&&item.dropOff>0?"is-volume-loss":""}`} aria-pressed={selected === item.id} onClick={() => setSelected(item.id)}><div className="fw-stage-bar" style={{ width: `${data.totals.users ? item.users / data.totals.users * 100 : 0}%` }}/><span className="fw-stage-label"><b>{item.label}</b><small>{item.id}</small></span><span className="fw-stage-status">{item.status}</span><strong>{number(item.users)}<small>명</small></strong></button></div>)}</div>
      <div className="fw-recovery-branch"><span className="fw-overline">RECOVERY BRANCH</span><div className="fw-branch-origin">직접 구매 이후 미구매 <b>{number(data.totals.initialNonPurchase)}명</b></div><p className="fw-note">이 중 {number(data.totals.recovered)}명이 재공략 후 구매했습니다.</p><div className="fw-branch-node"><span>현재 미구매 고객</span><strong>{number(data.totals.currentNonPurchase)}<small>명</small></strong><small>직접·회수 Purchase 모두 제외</small></div><ArrowDown className="fw-branch-arrow" size={16}/><div className="fw-branch-node mint"><span>Meta 재공략 가능</span><strong>{number(data.totals.audience)}<small>명</small></strong><small>현재 미구매 중 {data.totals.currentNonPurchase ? percent(data.totals.audience / data.totals.currentNonPurchase * 100) : "—"}</small></div><div className="fw-recovery-result"><span>기간 내 Meta 추가 구매 <b>+{number(data.totals.recovered)}건</b></span><ArrowRight size={16}/><span>총 구매 <b>{number(data.totals.purchases)}건</b></span></div><p className="fw-note">현재 고객 그룹와 기간 내 회수 구매는 시점이 다릅니다. 두 수치로 회수 전환율을 계산하지 않습니다.</p></div>
    </div><div className="fw-stage-insight" aria-live="polite"><Info size={18}/><div><b>{stage.label} · {stage.status}</b><p>{stage.insight}</p>{stage.status !== "병목" && data.bottleneck && <small>우선 점검: {data.bottleneck.insight}</small>}</div></div>
  </section>;
}
