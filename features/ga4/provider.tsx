"use client";
import {createContext,useContext,useEffect,useRef,useState} from "react";
import {usePathname} from "next/navigation";
import type {Query} from "@/types/domain";
import type {DataMode,GA4Envelope} from "@/types/ga4";
import {readGA4} from "@/lib/ga4/browser-service";
import {can} from "@/lib/permissions";
import {useUserRole} from "@/context/user-role-context";
import {DataState} from "@/components/data-state";
const Context=createContext<{data:GA4Envelope|null;loading:boolean;warning:string;mode:DataMode;changeMode:(mode:DataMode)=>void;refresh:()=>void;query:Query}|null>(null);
export const useGA4=()=>{const value=useContext(Context);if(!value)throw new Error("Analytics context missing");return value;};
export function GA4Provider({query,children}:{query:Query;children:React.ReactNode}){const {user}=useUserRole();const path=usePathname(),[data,setData]=useState<GA4Envelope|null>(null),[loading,setLoading]=useState(true),[revision,setRevision]=useState(0),[warning,setWarning]=useState("");const overrides=useRef<Record<string,DataMode>>({});
 useEffect(()=>{let active=true;setLoading(true);setData(null);const mode=overrides.current[query.advertiserId];readGA4(query,mode,"status").then(async status=>status.mode==="real"?readGA4(query,"real"):status).then(next=>{if(active)setData(next);}).catch(()=>{if(active)setData({mode:mode??"mock",connection:{status:"API ERROR",propertyId:null,lastTested:null,readOnly:true,quotaRemaining:null},error:{code:"API_ERROR",message:"GA4 서버 상태를 확인하지 못했습니다."}});}).finally(()=>{if(active)setLoading(false);});return()=>{active=false};},[query.advertiserId,query.period,revision]);
 const changeMode=async(mode:DataMode)=>{if(!can(user.role,"MANAGE_CONNECTIONS")){setWarning("데이터 모드 변경은 관리자에게 요청해 주세요.");return;}try{const response=await fetch(`/api/workspaces/${query.advertiserId}/connection`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({dataMode:mode})});if(!response.ok)throw new Error();}catch{setWarning("데이터 모드를 저장하지 못했습니다.");return;}const fallback=mode==="mock"&&(data?.mode==="real"||!!data?.error);overrides.current[query.advertiserId]=mode;setData(current=>current?{...current,mode,snapshot:undefined,error:undefined}:null);setRevision(v=>v+1);setWarning(fallback?"GA4 데이터를 불러오지 못했거나 조회를 중단하여, 사용자가 선택한 Mock 데이터를 표시하고 있습니다.":"");};
 const real=data?.mode==="real",protectedRoute=["/","/funnel","/performance","/reports"].includes(path);
 return <Context.Provider value={{data,loading,warning,mode:data?.mode??"mock",changeMode,refresh:()=>setRevision(v=>v+1),query}}><div className="ga4-provenance" role="status"><b>{real?(data.snapshot?(protectedRoute?"REAL GA4 DATA":"MIXED DATA · MOCK AD DATA"):"GA4 REAL · 데이터 확인 필요"):"MOCK DATA"}</b><span>{real?"GA4 · REAL / Meta · MOCK / Forecast · DEMO · Spend·CPA·ROAS 실측 미지원":"GA4 / 광고 성과: Mock Mode"}</span></div>{warning&&<p role="status">{warning}</p>}{protectedRoute&&loading?<DataState kind="loading"/>:protectedRoute&&data?.error?<DataState kind="error" message={data.error.message} onRetry={()=>setRevision(v=>v+1)}/>:children}{data?.error&&<div className="ga4-actions">{can(user.role,"MANAGE_CONNECTIONS")&&<button onClick={()=>changeMode("mock")}>Mock Mode로 돌아가기</button>}{can(user.role,"MANAGE_CONNECTIONS")?<a href="/connections">데이터 연결 설정 확인 →</a>:<span>관리자에게 데이터 확인을 요청해 주세요.</span>}</div>}</Context.Provider>;
}
