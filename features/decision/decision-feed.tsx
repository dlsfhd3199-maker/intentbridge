"use client";
import {productFlow} from "@/lib/product-language";
import {useEffect,useRef,useState} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {useUserRole} from "@/context/user-role-context";
import {can} from "@/lib/permissions";
import type {Period} from "@/types/domain";
import type {Signal,SignalStatus,Evidence} from "@/types/decision";
import {comparisonPeriod} from "@/lib/decision/comparison";
import {rankSignals} from "@/lib/decision/engine";
import {loadDecisionWorkspace,setSignalStatus,signalPreview,signalHandoff,type DecisionWorkspace} from "@/lib/decision/service";
import {signalNames,severityNames,statusNames,ruleDescriptions} from "@/lib/decision/thresholds";
import {saveCampaignHandoff} from "@/lib/campaign-store";
import {number,won} from "@/lib/format";
import {nextAction} from "@/lib/decision/next-action";
import "./decision.css";

const value=(n:number|null,unit:string)=>n===null?"미제공":`${new Intl.NumberFormat("ko-KR",{maximumFractionDigits:1}).format(n)}${unit}`;
function EvidenceRow({e}:{e:Evidence}){return <tr><th>{e.label}</th><td>{value(e.current,e.unit)}</td><td>{value(e.previous,e.unit)}</td><td>{value(e.change,e.changeUnit)}</td><td>{e.threshold}</td></tr>}
export function DecisionFeed({advertiserIds,period,all=false,readOnly=false,title="오늘의 운영 브리핑",perAdvertiser=false}:{advertiserIds:string[];period:Period;all?:boolean;readOnly?:boolean;title?:string;perAdvertiser?:boolean}){
  const {user}=useUserRole(),[workspaces,setWorkspaces]=useState<DecisionWorkspace[]>([]),[ready,setReady]=useState(false),[error,setError]=useState(""),[attempt,setAttempt]=useState(0),[busy,setBusy]=useState(false),[hidden,setHidden]=useState(false),[selected,setSelected]=useState<Signal|null>(null);
  const key=JSON.stringify(advertiserIds),canAct=!readOnly&&can(user.role,"MANAGE_CAMPAIGN"),canReview=!readOnly&&can(user.role,"MANAGE_OPERATIONS");
  useEffect(()=>{let active=true;setReady(false);setError("");setSelected(null);Promise.all((JSON.parse(key) as string[]).map(id=>loadDecisionWorkspace(id,period))).then(w=>{if(active){setWorkspaces(w);setReady(true)}}).catch(()=>{if(active)setError("운영 신호를 불러오지 못했습니다. 데이터와 접근 상태를 확인해 주세요.")});return()=>{active=false}},[key,period,attempt]);
  const status=(s:Signal)=>workspaces.find(w=>w.advertiserId===s.advertiserId)?.states[s.id]??"NEW";
  let signals=rankSignals(workspaces.flatMap(w=>w.signals)).filter(s=>hidden||status(s)!=="DISMISSED");
  if(perAdvertiser)signals=signals.filter((s,i,rows)=>rows.findIndex(r=>r.advertiserId===s.advertiserId)===i);
  if(!all)signals=signals.slice(0,readOnly?3:5);
  const change=async(s:Signal,next:SignalStatus)=>{setBusy(true);try{await setSignalStatus(s.advertiserId,s.id,next);setWorkspaces(w=>w.map(row=>row.advertiserId===s.advertiserId?{...row,states:{...row.states,[s.id]:next}}:row));}catch{setError("검토 상태를 저장하지 못했습니다. 다시 시도해 주세요.")}finally{setBusy(false)}};
  return <section className="decision-feed" aria-label={title} data-testid="decision-feed"><header><div><span className="decision-eyebrow">{productFlow}</span><h2>{title}</h2><p>선택한 {period}일과 동일 길이의 직전 기간 · 명확한 규칙으로 감지한 변화</p></div>{all&&<label><input type="checkbox" checked={hidden} onChange={e=>setHidden(e.target.checked)}/> 숨긴 신호 포함</label>}</header>
    {error?<p role="alert">{error} <button onClick={()=>setAttempt(v=>v+1)}>다시 불러오기</button></p>:!ready?<p role="status">운영 신호를 확인하고 있습니다…</p>:<>
    {!signals.length&&<p className="decision-empty">현재 확인이 필요한 큰 변화가 없습니다. 숨긴 신호는 운영 제안에서 다시 확인할 수 있습니다.</p>}
    <ol className="decision-list">{signals.map(s=><li key={s.id} className="decision-row" data-signal-type={s.type} data-signal-id={s.id}><div className="decision-meta"><span>{s.advertiserName}</span><span data-severity={s.severity}>{severityNames[s.severity]}</span><span>{signalNames[s.type]} · {s.source}</span></div><h3>{s.title}</h3><p>{s.summary}</p><div className="decision-impact"><strong>{s.evidence[0]?.label} · {value(s.evidence[0]?.current??null,s.evidence[0]?.unit??"")}</strong>{s.evidence[0]?.change!==null&&<span>직전 대비 {value(s.evidence[0]?.change??null,s.evidence[0]?.changeUnit??"")}</span>}<span>영향 고객 {number(s.affectedUsers)}명</span>{s.audience&&<span>재공략 가능 <b>{number(s.audience.size)}명</b> · {s.audience.window}일</span>}</div>
      <details className="decision-evidence"><summary>근거 보기</summary><p>{s.sourceDescription}</p><p>{(()=>{const r=comparisonPeriod(s.endDate,s.period);return `현재 ${r.current.start} ~ ${r.current.end} / 직전 ${r.previous.start} ~ ${r.previous.end}`})()}</p><div className="decision-table"><table><caption>판단 근거 · {s.advertiserName}</caption><thead><tr>{["지표","현재","직전","변화","기준"].map(t=><th key={t}>{t}</th>)}</tr></thead><tbody>{s.evidence.map(e=><EvidenceRow key={e.label} e={e}/>)}</tbody></table></div><p>Confidence {s.confidence} · {s.source==="DEMO"?"DEMO 비교 이력, 실측 아님":"정규화된 실측 입력"} · 기준 시각 {s.createdAt}</p>{s.audience&&<p>모집단: {s.audience.sourceNames.join(" OR ")} → {s.audience.event} · Purchase 제외 · 더 깊은 행동 단계 고객 제외 · 재공략 가능 고객만</p>}</details>
      <div className="decision-next"><p><b>다음 행동</b> {nextAction(s).label}</p><p>현재 대응 · {statusNames[status(s)]}{!!workspaces.find(w=>w.advertiserId===s.advertiserId)?.draftCounts?.[s.id]&&` · 연결된 초안 ${workspaces.find(w=>w.advertiserId===s.advertiserId)!.draftCounts![s.id]}건`}</p><div className="decision-actions">{(s.type!=="DATA_ISSUE"||can(user.role,"VIEW_CONNECTIONS"))&&<Link href={nextAction(s).href}>{nextAction(s).label}</Link>}{canAct&&nextAction(s).plan&&<button onClick={()=>setSelected(s)}>대상 조건으로 실행안 작성</button>}{canReview&&all&&<label>검토 상태<select aria-label={`${s.title} 검토 상태`} value={status(s)} disabled={busy} onChange={e=>change(s,e.target.value as SignalStatus)}>{(Object.keys(statusNames) as SignalStatus[]).map(k=><option key={k} value={k}>{statusNames[k]}</option>)}</select></label>}</div></div></li>)}</ol>
    <p className="decision-note">{workspaces.map(w=>w.note).filter((v,i,a)=>a.indexOf(v)===i).join(" · ")}</p>
    </>}
    {all&&<details className="decision-rules"><summary>Signal 기준 보기</summary><ul>{ruleDescriptions.map(r=><li key={r}>{r}</li>)}</ul><p>순서: 심각도 → 영향 고객·매출·변화 폭·신뢰도 합산. 동점은 고정 신호 ID 순서. 기준은 읽기 전용입니다.</p></details>}
    {selected&&<AudienceDialog signal={selected} workspace={workspaces.find(w=>w.advertiserId===selected.advertiserId)!} close={()=>setSelected(null)}/>}
  </section>;
}
function AudienceDialog({signal,workspace,close}:{signal:Signal;workspace:DecisionWorkspace;close:()=>void}){
  const ref=useRef<HTMLDialogElement>(null),router=useRouter(),[error,setError]=useState("");
  useEffect(()=>{ref.current?.showModal()},[]);
  const a=signal.audience!,context=workspace.context;
  let preview:ReturnType<typeof signalPreview>|null=null,problem="";
  try{if(context)preview=signalPreview(signal,context)}catch{problem="고객 그룹 데이터가 변경되었습니다. 신호를 다시 불러와 주세요."}
  const forecast=preview?.evaluation.forecast;
  return <dialog ref={ref} className="decision-dialog" aria-labelledby="decision-audience-title" onCancel={close}><button className="decision-close" onClick={close}>닫기</button><span className="decision-eyebrow">SIGNAL → CUSTOMER CONDITIONS → ACTION PLAN</span><h2 id="decision-audience-title">재공략 대상 확인</h2><p>{signal.title}</p><strong className="decision-size">{number(a.size)}명</strong><h3>{a.name}</h3><dl><dt>Include</dt><dd>{a.sourceNames.join(" OR ")}<br/>{a.event} · 최근 {a.window}일</dd><dt>Exclude</dt><dd>구매 완료 고객 · 더 깊은 행동 그룹</dd><dt>데이터 출처</dt><dd>{signal.sourceDescription}</dd><dt>추천 목표</dt><dd>{preview?.draft.objective??"데이터 확인 필요"}</dd></dl><p>선택 기간 {signal.period}일 내 {a.window}일 행동 기준입니다. 고객 여정과 실행안의 동일 모집단을 사용합니다. 개별 고객 정보가 아닌 조건과 집계 인원입니다.</p>
    {forecast&&<div className="decision-forecast"><b>DEMO FORECAST</b><p>Meta Mock 예시 조건 · 채널 확정 추천이 아닙니다.</p><dl><dt>예상 도달</dt><dd>{number(forecast.reach)}명</dd><dt>예상 구매</dt><dd>{number(forecast.purchases)}건</dd><dt>예상 매출</dt><dd>{won(forecast.revenue)}</dd></dl><p>일 {won(preview!.draft.budget.daily)} · {preview!.draft.budget.duration}일 · 기존 Forecast 엔진 · 성과 보장 아님</p></div>}
    <p>다음 화면에서 채널·메시지·예산을 선택하세요. Meta는 Demo 계산을 지원하며, Naver·Google은 조건 검토와 초안 저장만 지원합니다.</p>{(problem||error)&&<p role="alert">{problem||error}</p>}<button className="decision-primary" disabled={!preview} onClick={()=>{try{router.push(saveCampaignHandoff(signalHandoff(signal,context!)))}catch{setError("실행안 연결에 실패했습니다. 고객 그룹을 다시 확인해 주세요.")}}}>실행안 작성</button>
  </dialog>;
}
