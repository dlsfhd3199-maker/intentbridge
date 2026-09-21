"use client";

import { useRouter } from "next/navigation";
import { saveCampaignHandoff } from "@/lib/campaign-store";
import { useMemo, useState } from "react";
import { ArrowRight, Eye, ShieldCheck } from "lucide-react";
import { audienceEventOptions, estimateAudience } from "@/lib/funnel";
import { number, percent } from "@/lib/format";
import type { AudienceConditions, FunnelWorkspaceData } from "@/types/funnel";
import type { Period } from "@/types/domain";
import { RetargetingPreview } from "./retargeting-preview";

export function AudienceWorkbench({ data, retargetName }: { data: FunnelWorkspaceData; retargetName: string }) {
  const router = useRouter();
  const [segmentId, setSegmentId] = useState(data.segments[0].id);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [conditions, setConditions] = useState<AudienceConditions>({ sources: data.sourceRows.map(source => source.id), events: audienceEventOptions.map(event => event.id), window: 30, excludePurchase: true });
  const estimate = useMemo(() => estimateAudience(data, conditions), [data, conditions]);
  const segment = data.segments.find(item => item.id === segmentId)!;
  const toggle = <T,>(items: T[], item: T) => items.includes(item) ? items.filter(value => value !== item) : [...items, item];
  return <>
    <section className="fw-section" aria-labelledby="segment-title"><div className="fw-section-heading"><div><span className="fw-overline">02 / SEGMENT BUILDER</span><h2 id="segment-title">구매에 가까운 고객부터 다시 만나세요</h2></div><span className="fw-exclusion"><ShieldCheck size={16}/> Purchase 자동 제외</span></div><p className="fw-description">최근 행동 중 가장 깊은 단계로 분류합니다. 직접·회수 구매 고객을 제외한, 재공략 가능한 세그먼트입니다.</p>
      <div className="fw-segments" role="group" aria-label="미구매 세그먼트 선택">{data.segments.map(item => <button key={item.id} className="fw-segment" aria-pressed={segmentId === item.id} onClick={() => setSegmentId(item.id)}><div><span className={`fw-priority ${item.priority.toLowerCase()}`}>{item.priority} PRIORITY</span><h3>{item.name}</h3><p>{item.event==="AddToCart"?"장바구니에 담았지만 구매하지 않은 고객":item.event==="BeginCheckout"?"결제를 시작했지만 구매하지 않은 고객":"상품을 봤지만 장바구니에 담지 않은 고객"}</p><p>추천 메시지: “{item.message}”</p></div><div className="fw-segment-numbers"><strong>{number(item.volume)}<small>명</small></strong><span>전체 미구매 중 {percent(item.share)}</span><small>{item.status}</small></div></button>)}</div>
      <div className="fw-segment-action"><div><b>{segment.name}</b><p>추천 CTA: {segment.cta} · 추천 기간: {Math.min(segment.window, data.query.period)}일</p></div><button className="fw-primary" onClick={() => router.push(saveCampaignHandoff({ id: crypto.randomUUID(), advertiserId: data.advertiser.id, period: data.query.period, sourceChannelId: data.campaign.sourceChannelId, retargetingChannelId: data.campaign.retargetingChannelId, sourceIds: data.sourceRows.map(s => s.id), origin: { from: "Funnel Workspace", segmentId: segment.id, window: segment.window, recommendedBudgetChange: 0, createdAt: new Date().toISOString() } }))}>대상 조건으로 실행안 작성</button><button className="fw-primary" onClick={() => setPreviewOpen(true)} disabled={!segment.volume}><Eye size={17}/> 재공략 실행안 미리보기</button></div>
      <p className="fw-note">세그먼트끼리는 중복되지 않습니다. 아래 사용자 정의 고객 그룹는 여러 이벤트를 OR로 묶어 별도로 집계합니다.</p>
    </section>

    <section className="fw-section" aria-labelledby="audience-title"><div className="fw-section-heading"><div><span className="fw-overline">03 / AUDIENCE BUILDER</span><h2 id="audience-title">사용자 정의 고객 그룹</h2></div><span className="fw-badge">조건 시뮬레이션</span></div>
      <div className="fw-builder"><div className="fw-rules"><fieldset><legend><b>Include</b> Source · OR</legend><div className="fw-checks">{data.sourceRows.map(source => <label key={source.id}><input type="checkbox" checked={conditions.sources.includes(source.id)} onChange={() => setConditions(current => ({ ...current, sources: toggle(current.sources, source.id) }))}/>{source.name}</label>)}</div></fieldset><div className="fw-and">AND</div><fieldset><legend>Event · OR</legend><div className="fw-checks">{audienceEventOptions.map(event => <label key={event.id}><input type="checkbox" checked={conditions.events.includes(event.id)} onChange={() => setConditions(current => ({ ...current, events: toggle(current.events, event.id) }))}/><span>{event.id}<small>{event.label}</small></span></label>)}</div></fieldset><div className="fw-rule-bottom"><label className="fw-exclude-switch"><span><b>Exclude</b> Purchase</span><input type="checkbox" role="switch" aria-label="Purchase 제외" checked={conditions.excludePurchase} onChange={event => setConditions(current => ({ ...current, excludePurchase: event.target.checked }))}/><span>{conditions.excludePurchase ? "ON" : "OFF"}</span></label><label className="fw-window">Window<select aria-label="Audience Window" value={conditions.window} onChange={event => setConditions(current => ({ ...current, window: Number(event.target.value) as Period }))}>{([7, 14, 30] as const).map(days => <option key={days} value={days}>{days}D</option>)}</select></label></div></div>
        <div className="fw-estimate" aria-live="polite"><span>MOCK 예상 AUDIENCE SIZE</span><strong data-testid="audience-size">{number(estimate.size)}<small>명</small></strong><p>{retargetName} · 최근 {estimate.effectiveWindow}일 이내 이벤트</p><div><ShieldCheck size={16}/>{conditions.excludePurchase ? "직접·회수 구매 고객 제외됨" : `구매 고객 ${number(estimate.purchaseUsersIncluded)}명 포함됨`}</div><p className="fw-note">분석 기간과 Window 중 짧은 기간을 적용합니다. 실제 고객 그룹 생성·전송은 하지 않습니다.</p>{!conditions.excludePurchase && <p className="fw-warning" role="status">제외 OFF는 비교용입니다. 자동 분류 조건과 실행안 미리보기에서는 Purchase 제외가 유지됩니다.</p>}{estimate.size === 0 && <p className="fw-zero">조건에 맞는 대상이 없습니다. Source·Event·Window를 조정해 보세요.</p>}</div>
      </div><details><summary>Advanced · 대상 고객 조건 확인</summary><div className="fw-rule-summary"><span>Source ({conditions.sources.length ? conditions.sources.map(id => data.sources.find(source => source.id === id)?.name).join(" OR ") : "선택 없음"})</span><ArrowRight size={14}/><span>행동 ({conditions.events.length ? conditions.events.join(" OR ") : "선택 없음"})</span><ArrowRight size={14}/><span>{conditions.excludePurchase ? "Purchase 제외" : "Purchase 포함"}</span></div></details>
    </section>
    {previewOpen && <RetargetingPreview segment={segment} retargetName={retargetName} period={data.query.period} onClose={() => setPreviewOpen(false)}/>}
  </>;
}

