"use client";
import {PlatformToolbar} from "@/features/platform/platform-toolbar";
import {WorkspaceDataGate} from "./workspace-data-gate";
import {signOut} from "next-auth/react";
import {flushServerStorage} from "@/lib/server-storage";
import Link from "next/link";
import {UserRoleProvider,useUserRole} from "@/context/user-role-context";
import {can,canAccessAdvertiser} from "@/lib/permissions";
import {navigation,canAccessRoute} from "@/lib/route-permissions";
import {AccessDenied} from "./access-gate";
import "@/features/dashboard/workspace.css";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, createContext, useContext, useEffect, useState } from "react";
import { ChevronRight, LayoutDashboard, Building2, Route, SlidersHorizontal, Megaphone, ListChecks, FileChartColumn, Cable, Settings2, LockKeyhole } from "lucide-react";
import { readAppSettings } from "@/lib/app-settings";
import type { AppSettings } from "@/types/mvp";
import "@/features/connections/mvp.css";
import {GA4Provider} from "@/features/ga4/provider";
import "@/features/ga4/ga4.css";
import { getDashboard } from "@/lib/dashboard";
import type { Advertiser, DashboardData, Period } from "@/types/domain";

const pageDescriptions:Record<string,string>={"/dashboard":"유입부터 구매까지, 놓친 고객과 다음 운영 액션을 연결합니다.","/advertisers":"광고주별 성과와 워크스페이스를 관리합니다.","/funnel":"고객을 놓치는 구간과 다시 만날 기회를 확인합니다.","/performance":"현재 데이터를 기준으로 개선안과 예상 변화를 비교합니다.","/campaigns":"고객 그룹과 메시지를 설계하고 캠페인 상태를 확인합니다.","/operations":"검토가 필요한 운영 제안을 확인하고 다음 액션을 결정합니다.","/reports":"이번 기간 성과와 개선 기회를 한 장의 보고서로 읽습니다.","/connections":"데이터 출처와 채널별 연결 상태를 확인합니다.","/settings":"사용자, 담당 광고주와 시스템 설정을 관리합니다."};
const navIcons:Record<string,typeof LayoutDashboard>={"/dashboard":LayoutDashboard,"/advertisers":Building2,"/funnel":Route,"/performance":SlidersHorizontal,"/campaigns":Megaphone,"/operations":ListChecks,"/reports":FileChartColumn,"/connections":Cable,"/settings":Settings2};
const SelectionContext = createContext<(id: string, period: Period) => void>(() => {});
export const useWorkspaceSelection = () => useContext(SelectionContext);
const DashboardContext = createContext<DashboardData | null>(null);
export function useDashboard() {
  const data = useContext(DashboardContext);
  if (!data) throw new Error("Dashboard provider가 필요합니다.");
  return data;
}
function Shell({ children, advertisers, initialData }: { children: React.ReactNode; advertisers: Advertiser[]; initialData: DashboardData }) {
  const pathname = usePathname(),search=useSearchParams();
  const {user,ready,qaSwitch,changeRole}=useUserRole();
  const admin=can(user.role,"MANAGE_CAMPAIGN");
  const selectable=admin||advertisers.length>1;
  const requestedId=search.get("advertiser");
  const deniedWorkspace=!!requestedId&&!canAccessAdvertiser(user,requestedId);
  const items=navigation.filter(n=>canAccessRoute(user,n.href)).map(n=>({...n,name:n.href==="/campaigns"&&!can(user.role,"MANAGE_CAMPAIGN")?"광고 현황":n.name}));
  const [advertiserId, setAdvertiserId] = useState(()=>requestedId&&advertisers.some(a=>a.id===requestedId)?requestedId:initialData.advertiser.id);
  const scopeId=advertiserId;
  const [period, setPeriod] = useState<Period>(()=>[7,14,30].includes(Number(search.get("period")))?Number(search.get("period")) as Period:30);
  const [density, setDensity] = useState<AppSettings["density"]>("comfortable");
  useEffect(() => {
    const settings = readAppSettings();
    setDensity(settings.density);
    const queryPeriod = Number(new URLSearchParams(window.location.search).get("period"));
    setPeriod([7,14,30].includes(queryPeriod) ? queryPeriod as Period : settings.defaultPeriod);
    let previousDefaultPeriod = settings.defaultPeriod;
    const sync = () => { const next = readAppSettings(); setDensity(next.density); if (next.defaultPeriod !== previousDefaultPeriod) setPeriod(next.defaultPeriod); previousDefaultPeriod = next.defaultPeriod; };
    window.addEventListener("intentbridge-settings", sync);
    return () => window.removeEventListener("intentbridge-settings", sync);
  }, []);
  const [data, setData] = useState(initialData);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    getDashboard({ advertiserId:scopeId, period }).then(next => { if (active) setData(next); })
      .catch(() => { if (active) setError("데모 데이터를 불러오지 못했습니다. 광고주 또는 기간을 다시 선택해 주세요."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [scopeId, period, user.role]);
  useEffect(()=>{if(requestedId&&advertisers.some(a=>a.id===requestedId))setAdvertiserId(requestedId);},[admin,requestedId,advertisers]);
  const selectWorkspace=(id:string,days:Period)=>{const url=new URL(window.location.href);url.searchParams.set("advertiser",id);url.searchParams.set("period",String(days));window.history.replaceState(null,"",url.pathname+url.search);setAdvertiserId(id);setPeriod(days);};
  const current = items.find(item => item.href === pathname);
  return <SelectionContext.Provider value={(id, days) => { if (canAccessAdvertiser(user,id)&&advertisers.some(a => a.id === id)) { selectWorkspace(id,days); } }}><DashboardContext.Provider value={data}>
    <a className="skip-link" href="#main">본문으로 이동</a>
    <div className="app-shell" data-density={density}>
      <aside className="sidebar">
        <Link href="/dashboard" className="brand" aria-label="IntentBridge 홈"><span className="brand-symbol"/><span>IntentBridge<small>ADVERTISING WORKSPACE</small></span></Link>
        <div className="workspace-label">WORKSPACE <span>{user.role==="manager"?"담당 운영":user.role==="advertiser"?"성과 조회":"전체 운영"}</span></div>
        <nav aria-label="주 메뉴">{items.map(({ href, name, caption }) => {const Icon=navIcons[href]??LayoutDashboard;return <Link key={href} aria-label={`${name} ${caption}`} href={["/campaigns","/operations"].includes(href) ? `${href}?advertiser=${scopeId}&period=${period}` : href} className={`nav-item ${pathname === href ? "active" : ""}`} aria-current={pathname === href ? "page" : undefined}><Icon size={18} strokeWidth={1.6}/><span>{name}<small>{caption}</small></span>{pathname === href && <ChevronRight size={14}/>}</Link>})}{user.role==="manager"&&<Link href="/dashboard#assigned-workspaces" className="nav-item"><Building2 size={18} strokeWidth={1.6}/><span>내 광고주</span></Link>}</nav>
        <div className="sidebar-bottom"><div className="ui-user"><span className="ui-avatar">{(user.name||user.email||"U").slice(0,1)}</span><div><b>{user.name||"사용자"}</b><p className="role-note">{user.email}</p></div></div>{qaSwitch?<label className="role-switch">현재 보기<select aria-label="현재 보기" value={user.role} onChange={e=>changeRole(e.target.value as "super_admin"|"manager"|"advertiser")}><option value="super_admin">최고 관리자 보기</option><option value="manager">내부 마케터 보기</option><option value="advertiser">광고주 보기</option></select></label>:<p>로그인됨 · 권한에 따라 표시</p>}<button className="logout-button" onClick={async()=>{try{await flushServerStorage();await signOut({redirectTo:"/login"});}catch{/* Save status provides recovery without discarding drafts. */}}}>로그아웃</button></div>
      </aside>
      <div className="main-shell">
        <main id="main" className="main-content">
          <header className="context-header"><div><span className="eyebrow">INTENTBRIDGE</span><h1>{current?.name??"접근 안내"}</h1><p className="ui-page-description">{pageDescriptions[pathname]}</p></div><div className="advertiser-control"><label htmlFor="advertiser">광고주 워크스페이스</label>{selectable?<select id="advertiser" value={scopeId} onChange={event=>selectWorkspace(event.target.value,period)}>{advertisers.map(item=><option key={item.id} value={item.id}>{item.name} · {item.productName}</option>)}</select>:<strong className="workspace-lock">{advertisers.find(a=>a.id===scopeId)?.name} · 내 워크스페이스 <LockKeyhole size={14}/></strong>}</div><div className="period-control"><span>조회 기간</span><div className="period-buttons" role="group" aria-label="조회 기간">{([7,14,30] as const).map(days=><button key={days} aria-pressed={period===days} onClick={()=>selectWorkspace(scopeId,days)} className={period===days?"selected":""}>{days}일</button>)}</div></div></header>
          <PlatformToolbar advertisers={advertisers} id={scopeId} period={period} select={selectWorkspace}/><div className="brand-context"><b>{advertisers.find(a=>a.id===scopeId)?.name}</b><span>{advertisers.find(a=>a.id===scopeId)?.productName}</span></div>
          <div aria-live="polite" className="sr-only">{loading ? "데이터 불러오는 중" : `${data.advertiser.name}, ${data.period}일 데이터 표시`}</div>
          {!ready?<p>화면 준비 중…</p>:!canAccessRoute(user,pathname)||deniedWorkspace?<AccessDenied workspace={deniedWorkspace}/>:error?<div role="alert" className="error-panel">{error}</div>:!admin&&(data.advertiser.id!==scopeId||data.period!==period)?<p>데이터 불러오는 중…</p>:<div aria-busy={loading}><GA4Provider key={user.role} query={{advertiserId:data.advertiser.id,period:data.period}}><WorkspaceDataGate advertiserId={data.advertiser.id}>{children}</WorkspaceDataGate></GA4Provider></div>}
          <footer className="page-footer"><span>IntentBridge <span className="muted">/</span> 관심에서 구매까지, 하나의 흐름으로.</span><span>{data.period}일 조회 · IntentBridge</span></footer>
        </main>
      </div>
    </div>
  </DashboardContext.Provider></SelectionContext.Provider>;
}

export function AppShell(props:{children:React.ReactNode;advertisers:Advertiser[];initialData:DashboardData}){return <UserRoleProvider><Suspense fallback={<p>화면 준비 중…</p>}><Shell {...props}/></Suspense></UserRoleProvider>;}
