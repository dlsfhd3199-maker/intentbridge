"use client";
import {useUserRole} from "@/context/user-role-context";
import {can} from "@/lib/permissions";
import {AdvertiserDashboard} from "@/features/dashboard/advertiser-dashboard";
import {AdminDashboard} from "./admin-dashboard";
import {useGA4} from "@/features/ga4/provider";
import {GA4AnalyticsView} from "@/features/ga4/analytics-view";
import { OperationsSummary } from "@/features/operations/home-summary";
import "@/features/operations/operations.css";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, FlaskConical, Network, ShieldCheck } from "lucide-react";
import { useDashboard } from "@/components/app-shell";
import { Metrics } from "@/components/metrics";
import { number, percent, won } from "@/lib/format";
import { FunnelSummary } from "./funnel-summary";

function MockOverview() {
  const data = useDashboard();
  const directShare = data.analytics.directPurchases / data.totals.purchases * 100;
  return <div className="space-y-6">
    <Link className="campaign-quick-action" href={`/campaigns?advertiser=${data.advertiser.id}&period=${data.period}`}>캠페인 만들기 <ArrowRight size={16}/></Link>
    <Metrics data={data}/>
    <OperationsSummary advertiserId={data.advertiser.id} period={data.period}/>
    <div className="overview-grid"><FunnelSummary data={data}/><section className="audience-panel"><div className="panel-heading"><h2>다시 만날 고객</h2><span className="soft-badge">MOCK</span></div><p className="muted text-sm">Meta Retargetable 고객 그룹</p><div className="audience-value">{number(data.retargeting.retargetableAudience)}<span>명</span></div><div className="audience-track"><span style={{ width: `${data.retargeting.retargetableAudience / data.analytics.nonPurchaseUsers * 100}%` }}/></div><div className="audience-caption"><span>미구매 고객 중</span><b>{percent(data.retargeting.retargetableAudience / data.analytics.nonPurchaseUsers * 100)}</b></div><div className="audience-stat"><span>현재 미구매 고객</span><strong>{number(data.analytics.nonPurchaseUsers)}명</strong></div><div className="exclusion-note"><ShieldCheck size={16}/> 직접·회수 구매 고객 제외</div><p className="small-note">기간 내 구매 이벤트가 없는 예시 고객 기준입니다. 실제 광고 대상과는 다를 수 있습니다.</p></section></div>
    <div className="details-grid"><section className="light-panel"><div className="panel-heading"><h2>구매 성과의 두 가지 경로</h2><span className="muted text-xs">PURCHASE MIX</span></div><div className="purchase-total"><strong>{number(data.totals.purchases)}<span>건</span></strong><span className="muted text-sm">직접 구매와 회수 구매의 합계</span></div><div className="purchase-track" role="img" aria-label={`직접 구매 ${data.analytics.directPurchases}건, 회수 구매 ${data.retargeting.recoveredPurchases}건`}><div style={{ width: `${directShare}%` }}/><div style={{ width: `${100 - directShare}%` }}/></div><div className="purchase-legends"><div><span><i className="legend-dot violet-bg"/> Direct Purchase</span><b>{number(data.analytics.directPurchases)}건</b><small>{won(data.finance.directRevenue)}</small></div><div><span><i className="legend-dot mint-bg"/> 재방문 구매</span><b>{number(data.retargeting.recoveredPurchases)}건</b><small>{won(data.finance.recoveredRevenue)}</small></div></div></section>
    <section className="light-panel"><div className="panel-heading"><h2>어디에서 관심이 시작됐을까요?</h2><span className="soft-badge">2 SOURCES</span></div><div className="source-list">{data.source.channels.map((source, index) => <div className="source-row" key={source.id}><span className={`source-icon ${index ? "violet-tint" : "mint-tint"}`}>{index ? <ArrowUpRight size={19}/> : "◎"}</span><div><b>{source.name}</b><span>{index ? "광고를 통한 유입" : "추천·검색을 통한 자연 유입"}</span></div><strong>{number(source.users)}<small>명</small></strong><span className="source-share">{percent(source.users / data.source.uniqueUsers * 100)}</span></div>)}</div><p className="small-note source-note">다음에는 Naver · Google · 콘텐츠 유입까지 같은 구조로 확장합니다.</p></section></div>
    <div className="section-label"><h2>다음 액션을 위한 워크스페이스</h2><span>EXPLORE YOUR WORKSPACE</span></div><div className="workspace-cards"><Link className="workspace-card" href="/funnel"><span className="workspace-icon mint-tint"><Network size={23}/></span><div><span className="eyebrow">01 / UNDERSTAND</span><h3>고객 여정</h3><p>유입과 고객 행동, 미구매 고객을 한 흐름에서 확인하세요.</p></div><ArrowRight size={21}/></Link><Link className="workspace-card" href="/performance"><span className="workspace-icon violet-tint"><FlaskConical size={23}/></span><div><span className="eyebrow">02 / IMPROVE</span><h3>성과 개선</h3><p>현재 성과를 확인하고, 성과개선 시뮬레이션을 준비하세요.</p></div><ArrowRight size={21}/></Link></div>
    <p className="data-note">MOCK DATA · 30일은 제공된 원본 수치, 7·14일은 비례 생성한 예시 데이터입니다. 실제 기간별 실적이 아닙니다.</p>
  </div>;
}

export function Overview(){const {user}=useUserRole(),{mode}=useGA4();if(user.role==="manager")return <><AdminDashboard assigned/><details className="ux-admin-detail"><summary>선택한 광고주 상세 성과 보기</summary>{mode==="real"?<GA4AnalyticsView page="overview"/>:<MockOverview/>}</details></>;if(!can(user.role,"VIEW_ALL_ADVERTISERS"))return <AdvertiserDashboard/>;return <><AdminDashboard/><details className="ux-admin-detail"><summary>선택한 광고주 상세 성과 보기</summary>{mode==="real"?<GA4AnalyticsView page="overview"/>:<MockOverview/>}</details></>;}
