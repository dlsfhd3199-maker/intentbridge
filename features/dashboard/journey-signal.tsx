"use client";
import Link from "next/link";
import {SignalIndicator} from "@/components/product-ui";
import type {WorkspaceSummary} from "@/lib/workspace-summary";
import {number,percent} from "@/lib/format";

/** Presentation of the existing workspace snapshot; no additional attribution or forecast. */
export function JourneySignal({summary,readOnly=false}:{summary:WorkspaceSummary;readOnly?:boolean}){
 const {dashboard:d,stages}=summary;
 const loss=stages.reduce((a,b)=>b.dropOff>a.dropOff?b:a,stages[0]);
 return <section className="ds-journey-signal" aria-label={`${d.advertiser.name} 고객 흐름`}>
  <header><div><SignalIndicator type={!d.source.uniqueUsers?"DATA":summary.attention?"CAMPAIGN":"OPPORTUNITY"}/><h2>{d.advertiser.name}</h2><p>{d.source.channels.map(c=>c.name).join(" · ")}</p></div><span>최근 {d.period}일</span></header>
  <ol className="ds-flow">{stages.map((stage,i)=><li key={stage.id} className={stage.id===loss.id?"has-loss":""}>{i>0&&<span className="ds-flow-loss">{number(stage.dropOff)}명 이탈 <small>{stage.conversionRate===null?"":percent(stage.conversionRate)+" 전환"}</small></span>}<span>{stage.label}</span><strong>{number(stage.users)}<small>명</small></strong></li>)}</ol>
  <div className="ds-recovery"><div><span>구매로 이어지지 않은 흐름</span><p>{summary.insight}</p></div><div><span>현재 재공략 가능 고객</span><strong>{number(d.retargeting.retargetableAudience)}<small>명</small></strong></div></div>
  <p className="ds-scope">기간 내 직접 구매 {number(d.analytics.directPurchases)}건 + 재방문 구매 {number(d.retargeting.recoveredPurchases)}건 = 총 구매 {number(d.totals.purchases)}건. 현재 재공략 대상과 기간 내 구매는 다른 시점의 지표입니다.</p>
  <div className="ds-actions"><Link href={`/funnel?advertiser=${d.advertiser.id}&period=${d.period}`}>고객 흐름 보기 →</Link><Link href={`/${readOnly?"performance":"campaigns"}?advertiser=${d.advertiser.id}&period=${d.period}`}>{readOnly?"개선안 확인":"재공략 설계"} →</Link></div>
 </section>;
}
