"use client";
import {useUserRole} from "@/context/user-role-context";
import {can} from "@/lib/permissions";
import {AdvertiserDashboard} from "@/features/dashboard/advertiser-dashboard";
import {useGA4} from "@/features/ga4/provider";
import {GA4AnalyticsView} from "@/features/ga4/analytics-view";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ChevronDown, Network, RefreshCw } from "lucide-react";
import { useDashboard } from "@/components/app-shell";
import { filterFunnel, loadFunnelWorkspace } from "@/lib/funnel";
import { number, percent, won } from "@/lib/format";
import type { SourceId } from "@/types/domain";
import type { FunnelWorkspaceData } from "@/types/funnel";
import { JourneyPanel } from "./journey-panel";
import { AudienceWorkbench } from "./audience-workbench";
import "./funnel.css";

function MockFunnelWorkspace() {
  const dashboard = useDashboard();
  const [data, setData] = useState<FunnelWorkspaceData | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const { id: advertiserId } = dashboard.advertiser;
  const { period } = dashboard;
  useEffect(() => {
    let active = true;
    setFailed(false);
    loadFunnelWorkspace({ advertiserId, period }).then(result => { if (active) setData(result); }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [advertiserId, period, attempt]);
  if (failed) return <section className="fw-state" role="alert"><h2>Mock 데이터를 불러오지 못했습니다.</h2><button onClick={() => setAttempt(value => value + 1)}>다시 불러오기</button></section>;
  if (!data || data.query.advertiserId !== advertiserId || data.query.period !== period) return <section className="fw-state" role="status">퍼널 데이터를 불러오는 중입니다.</section>;
  return <WorkspaceContent key={`${advertiserId}-${period}`} data={data}/>;
}

function WorkspaceContent({ data }: { data: FunnelWorkspaceData }) {
  const [sourceChannel, setSourceChannel] = useState(data.campaign.sourceChannelId);
  const [retargetChannel, setRetargetChannel] = useState(data.campaign.retargetingChannelId);
  const [sourceFilter, setSourceFilter] = useState<SourceId | "all">("all");
  const selectedIds = useMemo(() => sourceFilter === "all" ? data.sources.map(source => source.id) : [sourceFilter], [data.sources, sourceFilter]);
  const view = useMemo(() => filterFunnel(data, selectedIds), [data, selectedIds]);
  const supported = sourceChannel === data.campaign.sourceChannelId && retargetChannel === data.campaign.retargetingChannelId;
  const sourceName = data.channels.find(channel => channel.id === sourceChannel)!.name;
  const retargetName = data.channels.find(channel => channel.id === retargetChannel)!.name;
  const kpis = [
    { label: `${sourceName} 유입 유니크`, value: view.totals.users, unit: "명" },
    { label: "직접 구매 고객", value: view.totals.direct, unit: "명" },
    { label: "현재 미구매 고객", value: view.totals.currentNonPurchase, unit: "명" },
    { label: `${retargetName} 재공략 가능`, value: view.totals.audience, unit: "명" },
    { label: `${retargetName} 추가 구매`, value: view.totals.recovered, unit: "건" },
    { label: "총 구매", value: view.totals.purchases, unit: "건" },
  ];
  return <div className="fw">
    <section className="fw-route" aria-label="유입 분석 개요"><div className="fw-route-title"><span className="fw-route-icon"><Network size={23}/></span><div><h2>{data.campaign.name}</h2><p>{data.advertiser.name} · 최근 {data.query.period}일 · {supported ? "GPT Organic + ChatGPT Ads (Experimental / Planned) → Meta 검토" : `${sourceName} → ${retargetName}`}</p></div><span className="fw-badge">{supported ? "MOCK DATA · 유입 분석 예시" : "MOCK 준비 예정"}</span></div>
      <div className="fw-channel-controls"><span>Source Channel</span><label><span className="sr-only">Source Channel</span><select aria-label="Source Channel" value={sourceChannel} onChange={event => setSourceChannel(event.target.value)}>{data.channels.map(channel => <option key={channel.id} value={channel.id}>{channel.name}</option>)}</select></label><ArrowRight size={17}/><span className="fw-site-step">Site Behavior</span><ArrowRight size={17}/><label><span className="sr-only">재방문 광고 Channel</span><select aria-label="Retargeting Channel" value={retargetChannel} onChange={event => setRetargetChannel(event.target.value)}>{data.channels.map(channel => <option key={channel.id} value={channel.id}>{channel.id==="chatgpt"?"ChatGPT Ads · Experimental / Planned":channel.name}</option>)}</select></label><span>검토 채널</span></div>
      <p className="fw-route-note"><b>유입 채널이 달라도, 고객 여정은 하나로 연결됩니다.</b> 유입 매체와 재공략 매체를 확장할 수 있습니다. 현재 데이터는 ChatGPT → Meta 조합만 제공합니다.</p>
    </section>
    {!supported ? <section className="fw-empty" role="status"><Network size={35}/><h2>{sourceName} → {retargetName}</h2><p>이 조합의 Mock 데이터는 아직 준비되지 않았습니다.<br/>채널을 변경해도 실제 계정 연결이나 광고 집행은 발생하지 않습니다.</p><button className="fw-primary" onClick={() => { setSourceChannel(data.campaign.sourceChannelId); setRetargetChannel(data.campaign.retargetingChannelId); }}><RefreshCw size={16}/> GPT → Meta로 돌아가기</button></section> : <>
      <div className="fw-section-heading"><div><span className="fw-overline">01 / GROWTH OVERVIEW</span><h2>유입부터 추가 구매까지</h2></div><div className="fw-filter" role="group" aria-label="유입 소스 필터"><button aria-pressed={sourceFilter === "all"} onClick={() => setSourceFilter("all")}>전체</button>{data.sources.map(source => <button key={source.id} aria-pressed={sourceFilter === source.id} onClick={() => setSourceFilter(source.id)}>{source.name}</button>)}</div></div>
      <section className="fw-kpis" aria-label="퍼널 핵심 지표">{kpis.map(item => <div key={item.label}><span>{item.label}</span><strong>{number(item.value)}<small>{item.unit}</small></strong></div>)}</section>
      <details className="fw-detail-metrics"><summary>유입 세션·행동 지표 보기 <ChevronDown size={15}/></summary><dl><div><dt>유입 세션</dt><dd>{number(view.totals.sessions)}</dd></div>{view.stages.filter(stage => !["Visit", "Purchase"].includes(stage.id)).map(stage => <div key={stage.id}><dt>{stage.label} 고객</dt><dd>{number(stage.users)}명</dd></div>)}</dl></details>
      <p className="fw-analysis-scope">병목은 선택 소스의 최저 전환율 기준입니다. <Link href="/performance">성과 개선에서 전체 소스의 목표 대비 개선 여지 비교 →</Link></p><JourneyPanel key={sourceFilter} data={view}/>
      <AudienceWorkbench key={sourceFilter} data={view} retargetName={retargetName}/>
      <section className="fw-section" aria-labelledby="source-table-title"><div className="fw-section-heading"><div><span className="fw-overline">04 / SOURCE COMPARISON</span><h2 id="source-table-title">유입 소스 분석</h2></div><span className="fw-badge">{sourceFilter === "all" ? "전체 소스 비교" : view.sourceRows[0]?.name}</span></div><p className="fw-description">Purchase·Revenue·CVR은 직접 구매 기준입니다. 상단 소스 필터는 퍼널·세그먼트·고객 그룹에도 적용됩니다.</p><div className="fw-table-wrap" tabIndex={0} role="region" aria-label="유입 소스 비교 표, 가로 스크롤 가능"><table className="fw-source-table"><thead><tr>{["Source", "Unique", "Sessions", "ViewContent", "AddToCart", "BeginCheckout", "Purchase", "Revenue", "CVR"].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{view.sourceRows.map(source => <tr key={source.id}><th scope="row">{source.name}</th><td>{number(source.uniqueUsers)}</td><td>{number(source.sessions)}</td><td>{number(source.viewContent)}</td><td>{number(source.addToCart)}</td><td>{number(source.beginCheckout)}</td><td>{number(source.purchases)}</td><td>{won(source.revenue.amount)}</td><td>{percent(source.cvr)}</td></tr>)}</tbody></table></div><div className="fw-finance"><span>통합 매출 <b>{won(view.totals.revenue)}</b></span><span>광고비 <b>{won(view.totals.spend)}</b></span><span>CPA <b>{won(view.totals.cpa)}</b></span><span>ROAS <b>{percent(view.totals.roas)}</b></span></div><p className="fw-note">소스별 광고비는 전체 Mock 광고비를 유입 인원 비중으로 배분한 예시입니다. 통합 매출에는 회수 매출이 포함됩니다.</p></section>
      <details className="fw-method"><summary>Mock 데이터와 집계 기준</summary><p>30일 합계는 기존 Mock JSON을 유지합니다. 7·14일은 각각 24%·49%로 생성한 예시 스냅샷이며 실제 날짜별 실적이 아닙니다. 소스별 행동·매출·이벤트 경과일은 합계에 맞춰 생성한 합성 데이터입니다.</p><p>세그먼트는 구매자를 제외하고 가장 깊은 행동 기준으로 중복 없이 분류합니다. 1차의 설명용 고정 세그먼트 규모 대신 이벤트를 집계하므로 세그먼트별 인원이 달라집니다. 재공략 가능 여부는 Mock 자격 플래그입니다.</p><p>광고주·분석 기간을 변경하면 소스 필터와 고객 그룹 조건이 초기화됩니다. GA4·Meta 경로는 Mock 예시이며 실제 Pixel/CAPI 수집이나 고객 전송을 수행하지 않습니다.</p></details>
    </>}
  </div>;
}

export function FunnelWorkspace(){const {user}=useUserRole(),{mode}=useGA4();if(!can(user.role,"MANAGE_CAMPAIGN"))return <AdvertiserDashboard view="funnel"/>;return mode==="real"?<GA4AnalyticsView page="funnel"/>:<MockFunnelWorkspace/>;}
