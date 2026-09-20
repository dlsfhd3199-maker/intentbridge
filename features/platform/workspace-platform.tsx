"use client";
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {useDashboard} from '@/components/app-shell';
import {useUserRole} from '@/context/user-role-context';
import {can} from '@/lib/permissions';
import {usePlatform} from './use-platform';
import {goals,onboardingSteps,workspaceHealth} from './catalog';
import './platform.css';
export function WorkspacePlatform({advertiserId,compact=false}:{advertiserId?:string;compact?:boolean}){
 const data=useDashboard();return <WorkspaceProfile key={advertiserId??data.advertiser.id} id={advertiserId??data.advertiser.id} compact={compact}/>;
}
function WorkspaceProfile({id,compact}:{id:string;compact:boolean}){
 const {user}=useUserRole(),model=usePlatform(id),{view}=model;
 const [siteUrl,setSite]=useState(''),[budget,setBudget]=useState(0),[goal,setGoal]=useState('구매');
 useEffect(()=>{if(view){setSite(view.document.profile.siteUrl);setBudget(view.document.profile.monthlyBudget);setGoal(view.document.profile.goal);}},[view]);
 if(!view)return <p role={model.error?"alert":"status"}>{model.error||"워크스페이스 설정 확인 중…"}</p>;
 const steps=onboardingSteps(view.document,view.managers.length,view.hasData),completed=steps.filter(Boolean).length,admin=can(user.role,'MANAGE_CONNECTIONS'),canView=can(user.role,'VIEW_CONNECTIONS'),url=`/connections?advertiser=${id}`;
 if(compact&&view.hasData&&!view.document.started&&view.revision===0)return <div className="platform-source"><span>DEMO DATA · 기존 운영 데이터</span>{canView?<Link href={url}>데이터 출처 · 설정 확인 →</Link>:<span>데이터 연결은 관리자가 관리합니다.</span>}</div>;
 if(compact&&view.document.started)return <div className="platform-source"><span>{workspaceHealth(view.document)} · 데모 데이터</span><Link href={`/funnel?advertiser=${id}`}>고객 여정 →</Link>{canView&&<Link href={url}>데이터 상태</Link>}</div>;
 return <section className="platform-panel" aria-label="워크스페이스 온보딩"><header><div><span className="platform-tag">WORKSPACE SETUP</span><h2>{view.document.started?'워크스페이스 프로필':'IntentBridge 설정을 완료해주세요.'}</h2><p>{completed} / 5 완료 · {completed*20}% · {workspaceHealth(view.document)}</p></div>{canView&&<Link href={url}>계속 설정하기 →</Link>}</header><p role="alert">{model.error}</p><progress max={5} value={completed} aria-label="설정 진행률"/><ol className="platform-steps">{['광고주 정보','담당 MANAGER','데이터 연결','데이터 확인','운영 시작'].map((label,i)=><li key={label} data-done={steps[i]}><span>{steps[i]?'✓':i+1}</span>{label}</li>)}</ol>
 {!admin&&<p>데이터 연결과 초기 설정은 최고 관리자가 관리합니다. 담당자: {view.managers.map(m=>m.name).join(', ')||'배정 대기'}</p>}
 {!compact&&<><form className="platform-form" onSubmit={async e=>{e.preventDefault();await model.save({action:'profile',siteUrl,monthlyBudget:budget,goal});}}><label>사이트 URL<input aria-label="사이트 URL" type="url" required placeholder="https://example.com" disabled={!admin} value={siteUrl} onChange={e=>setSite(e.target.value)}/></label><label>월 광고예산 (원)<input type="number" min={1} max={1e12} required disabled={!admin} value={budget} onChange={e=>setBudget(Number(e.target.value))}/></label><label>목표<select disabled={!admin} value={goal} onChange={e=>setGoal(e.target.value)}>{goals.map(g=><option key={g}>{g}</option>)}</select></label><label>담당 MANAGER<input readOnly value={view.managers.map(m=>m.name).join(', ')||'배정 대기'}/></label><label>상태<input readOnly value={view.status}/></label>{admin&&<button disabled={model.busy} className="mvp-primary">프로필 저장</button>}</form>
 {admin&&<div className="platform-actions"><Link href={`/settings?advertiser=${id}`}>담당자 배정 · 사용자 관리</Link><Link href={`/advertisers?advertiser=${id}`}>기본 정보 관리</Link><Link href={url}>데모 연결 설정</Link><button disabled={model.busy||!steps.slice(0,4).every(Boolean)} onClick={async()=>{if(await model.save({action:'start'}))window.location.assign(`/dashboard?advertiser=${id}`);}}>운영 시작</button></div>}
 {view.document.started&&<div className="platform-tour"><b>다음 세 가지를 확인하세요.</b><Link href={`/dashboard?advertiser=${id}`}>1. 데이터를 확인하세요</Link><Link href={`/funnel?advertiser=${id}`}>2. 고객 이탈을 찾으세요</Link><Link href={`/campaigns?advertiser=${id}`}>3. 개선 캠페인을 만드세요</Link></div>}
 <details><summary>최근 활동</summary><ol>{(view.activity??view.document.activity).map(a=><li key={a.id}><time>{new Date(a.at).toLocaleString('ko-KR')}</time> · {a.label}</li>)}</ol>{!(view.activity??view.document.activity).length&&<p>아직 기록된 설정 활동이 없습니다.</p>}</details></>}
 </section>;
}
