"use client";
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {useDashboard} from '@/components/app-shell';
import {flushServerStorage} from '@/lib/server-storage';
import {loadAdminSummary} from '@/lib/workspace-summary';
import {connectorCatalog,workspaceHealth} from '@/features/platform/catalog';
import type {Period} from '@/types/domain';
import './advertiser-management.css';
import type {PlatformView} from '@/types/platform';
import {api} from './management';

type Workspace={id:string;name:string;industry:string;productName:string;status:string};
type Row=Workspace&{platform:PlatformView|null;roas:number|null};
const connectionState=(r:Row)=>!r.platform?'unknown':Object.values(r.platform.document.connections).some(c=>c?.state==='error'||c?.state==='attention')?'attention':Object.values(r.platform.document.connections).some(c=>c?.state==='healthy')?'connected':'disconnected';
const health=(r:Row)=>r.status!=='ACTIVE'?'비활성':!r.platform?'확인 불가':workspaceHealth(r.platform.document);
async function allWorkspaces(){
 const items:Workspace[]=[];let after='';
 for(;;){const batch:Workspace[]=await api('/api/admin/advertisers?limit=100'+(after?'&after='+encodeURIComponent(after):''));items.push(...batch);if(batch.length<100)return items;after=batch.at(-1)!.id;}
}
export function WorkspaceAdvertiserManagement(){const {period}=useDashboard();return <AdvertiserManagement period={period}/>;}
export function AdvertiserManagement({period=30}:{period?:Period}){
 const [rows,setRows]=useState<Row[]>([]),[loaded,setLoaded]=useState(false),[error,setError]=useState(''),[partial,setPartial]=useState(false),[attempt,setAttempt]=useState(0);
 const [search,setSearch]=useState(''),[manager,setManager]=useState(''),[filter,setFilter]=useState(''),[connection,setConnection]=useState('');
 const [editing,setEditing]=useState<Workspace|null|undefined>(undefined),[name,setName]=useState(''),[industry,setIndustry]=useState(''),[productName,setProductName]=useState(''),[status,setStatus]=useState('ACTIVE'),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{
  let live=true;setLoaded(false);setError('');setPartial(false);
  async function load(){
   const items=await allWorkspaces();
   const [platforms,summary]=await Promise.all([Promise.allSettled(items.map(w=>w.status==='ACTIVE'?api(`/api/workspaces/${encodeURIComponent(w.id)}/platform`):Promise.resolve(null))),loadAdminSummary(period).then(data=>({data,ok:true})).catch(()=>({data:[],ok:false}))]);
   if(!live)return;
   setPartial(platforms.some(p=>p.status==='rejected')||!summary.ok);
   setRows(items.map((w,i)=>{const p=platforms[i],totals=summary.data.find(s=>s.dashboard.advertiser.id===w.id)?.dashboard.totals;return {...w,platform:p.status==='fulfilled'?p.value:null,roas:totals&&totals.spend>0?totals.revenue/totals.spend*100:null}}));setLoaded(true);
  }
  load().catch(()=>{if(live)setError('광고주 목록을 불러오지 못했습니다.')});return()=>{live=false};
 },[period,attempt]);
 useEffect(()=>{if(editing!==undefined)dialog.current?.showModal();else dialog.current?.close()},[editing]);
 function edit(w:Workspace|null){setName(w?.name??'');setIndustry(w?.industry??'');setProductName(w?.productName??'');setStatus(w?.status??'ACTIVE');setNotice('');setEditing(w)}
 const managers=Array.from(new Map(rows.flatMap(r=>r.platform?.managers??[]).map(m=>[m.id,m])).values());
 const visible=rows.filter(r=>(!search||r.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))&&(!manager||(manager==='unassigned'?!!r.platform&&!r.platform.managers.length:r.platform?.managers.some(m=>m.id===manager)))&&(!filter||(filter==='ACTIVE'||filter==='DISABLED'?r.status===filter:filter==='setup'?health(r)==='설정 중':['확인 필요','데이터 오류','확인 불가'].includes(health(r))))&&(!connection||connectionState(r)===connection));
 const sync=(r:Row)=>{const dates=Object.values(r.platform?.document.connections??{}).flatMap(c=>c?.lastSync?[c.lastSync]:[]).filter(t=>Number.isFinite(Date.parse(t))).sort();return dates.at(-1)};
 return <section className="am-directory" aria-label="광고주 관리" data-testid="advertiser-management">
  <header className="am-heading"><div><p className="am-eyebrow">WORKSPACES</p><h2>어떤 Workspace를 찾으시나요?</h2></div><div className="am-actions"><Link href="/settings">사용자 보기</Link><button className="am-primary" onClick={()=>edit(null)}>+ 새 광고주</button></div></header>
  {error?<div role="alert">{error} <button onClick={()=>setAttempt(a=>a+1)}>다시 시도</button></div>:!loaded?<p role="status">광고주 목록을 불러오는 중입니다.</p>:<>
   <dl className="am-summary" aria-label="광고주 현황">{[['전체 광고주',rows.length],['활성',rows.filter(r=>r.status==='ACTIVE').length],['설정 중',rows.filter(r=>health(r)==='설정 중').length],['확인 필요',rows.filter(r=>['확인 필요','데이터 오류','확인 불가'].includes(health(r))).length]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
   <div className="am-filters"><label className="am-search">광고주 검색<input type="search" value={search} placeholder="광고주 이름으로 검색" onChange={e=>setSearch(e.target.value)}/></label><label>담당자<select aria-label="담당자" value={manager} onChange={e=>setManager(e.target.value)}><option value="">전체 담당자</option><option value="unassigned">미배정</option>{managers.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label><label>상태<select aria-label="상태" value={filter} onChange={e=>setFilter(e.target.value)}><option value="">전체 상태</option><option value="ACTIVE">활성</option><option value="DISABLED">비활성</option><option value="setup">설정 중</option><option value="attention">확인 필요</option></select></label><label>데이터 연결 상태<select aria-label="데이터 연결 상태" value={connection} onChange={e=>setConnection(e.target.value)}><option value="">전체 연결</option><option value="connected">연결 있음</option><option value="disconnected">연결 안 됨</option><option value="attention">확인 필요</option><option value="unknown">확인 불가</option></select></label></div>
   <div className="am-list-note"><span role="status">{visible.length}개 Workspace</span><span>연결·동기화는 Demo 설정 · ROAS는 최근 {period}일 Mock 집계</span></div>
   {partial&&<p role="alert">일부 연결 상태 또는 성과를 확인하지 못했습니다. <button onClick={()=>setAttempt(a=>a+1)}>다시 시도</button></p>}
   <div className="am-table-wrap"><table className="am-table" aria-label="광고주 목록"><thead><tr>{['광고주','담당','Workspace','데이터 연결','최근 동기화','최근 ROAS','상태','관리'].map(t=><th key={t}>{t}</th>)}</tr></thead><tbody>{visible.map(r=>{const last=sync(r);return <tr key={r.id}><th scope="row"><strong>{r.name}</strong><span>{r.industry||'업종 미등록'}</span><small>대표 상품: {r.productName||'—'}</small></th><td data-label="담당">{r.platform?r.platform.managers.map(m=>m.name).join(', ')||'미배정':'—'}</td><td data-label="Workspace">{r.status}</td><td data-label="데이터 연결">{r.platform?`${Object.values(r.platform.document.connections).filter(c=>c?.state==='healthy').length} / ${connectorCatalog.length}`:'—'}</td><td className="am-detail" data-label="최근 동기화">{last?<time dateTime={last}>{new Date(last).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}</time>:'기록 없음'}</td><td className="am-detail am-roas" data-label="최근 ROAS">{r.roas===null?'—':r.roas.toFixed(1)+'%'}</td><td data-label="상태"><span className={['데이터 오류','확인 필요','확인 불가'].includes(health(r))?'am-attention':''}>{health(r)}</span></td><td className="am-row-actions">{r.status==='ACTIVE'?<Link className="am-open" href={`/dashboard?advertiser=${encodeURIComponent(r.id)}&period=${period}`}>Workspace 열기 →</Link>:<span>비활성 Workspace</span>}<div><button aria-label={`${r.name} 수정`} onClick={()=>edit(r)}>수정</button><Link href={r.status==='ACTIVE'?`/advertisers/${encodeURIComponent(r.id)}`:'/settings'}>사용자 보기</Link></div></td></tr>})}</tbody></table></div>
   {!visible.length&&<div className="am-empty"><h3>{rows.length?'조건에 맞는 광고주가 없습니다.':'등록된 광고주가 없습니다.'}</h3><p>{rows.length?'검색어나 필터를 바꿔보세요.':'새 광고주를 등록해 Workspace 설정을 시작하세요.'}</p>{rows.length?<button onClick={()=>{setSearch('');setManager('');setFilter('');setConnection('')}}>필터 초기화</button>:<button onClick={()=>edit(null)}>새 광고주</button>}</div>}
  </>}
  <dialog className="am-dialog" ref={dialog} aria-labelledby="advertiser-dialog-title" onCancel={e=>{if(busy)e.preventDefault();else setEditing(undefined)}}>
   {editing!==undefined&&<form onSubmit={async e=>{e.preventDefault();if(busy)return;setBusy(true);setNotice('');try{await flushServerStorage();const saved=await api('/api/admin/advertisers',editing?'PATCH':'POST',{id:editing?.id,name,industry,productName,status});if(!editing){window.location.assign(saved.status==='ACTIVE'?`/connections?advertiser=${saved.id}`:'/advertisers')}else{window.location.reload()}}catch(e){setNotice((e as Error).message)}finally{setBusy(false)}}}>
    <header><div><p className="am-eyebrow">WORKSPACE</p><h2 id="advertiser-dialog-title">{editing?'광고주 수정':'새 광고주'}</h2></div><button type="button" disabled={busy} onClick={()=>setEditing(undefined)} aria-label="닫기">×</button></header><p>{editing?'기본 정보를 수정합니다. 담당자 배정은 사용자 보기에서 관리합니다.':'기본 정보를 저장합니다. 활성 Workspace는 데이터 연결 설정으로 이동합니다.'}</p>
    <label>광고주 이름<input required maxLength={120} value={name} onChange={e=>setName(e.target.value)}/></label><label>업종<input maxLength={120} value={industry} onChange={e=>setIndustry(e.target.value)}/></label><label>대표 상품<input maxLength={120} value={productName} onChange={e=>setProductName(e.target.value)}/></label><label>Workspace 상태<select value={status} onChange={e=>setStatus(e.target.value)}><option>ACTIVE</option><option>DISABLED</option></select></label>
    <p role="status">{notice}</p><footer><button type="button" disabled={busy} onClick={()=>setEditing(undefined)}>취소</button><button className="am-primary" disabled={busy}>{busy?'저장 중…':editing?'광고주 변경 저장':'광고주 생성'}</button></footer>
   </form>}
  </dialog>{editing===undefined&&notice&&<p role="status">{notice}</p>}
 </section>;
}
