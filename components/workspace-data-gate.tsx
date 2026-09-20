"use client";
import {useUserRole} from "@/context/user-role-context";
import {can} from "@/lib/permissions";

import {useEffect,useState} from "react";
import {usePathname} from "next/navigation";
import {flushServerStorage,mergeServerStorage} from "@/lib/server-storage";
const loaded=new Set<string>();let allLoaded=false;
export function WorkspaceDataGate({advertiserId,children,forceWorkspace=false}:{advertiserId:string;children:React.ReactNode;forceWorkspace?:boolean}){const {user}=useUserRole(),path=usePathname(),full=!forceWorkspace&&can(user.role,"MANAGE_SETTINGS")&&["/settings","/connections"].includes(path),needed=forceWorkspace||!['/dashboard','/advertisers'].includes(path)&&!path.startsWith('/advertisers/'),key=full?"all":advertiserId;const [ready,setReady]=useState(""),[error,setError]=useState("");useEffect(()=>{let active=true;if(!needed||allLoaded||loaded.has(key)){setReady(key);return;}setReady("");setError("");(async()=>{await flushServerStorage();const response=await fetch(`/api/workspace-documents${full?"":`?advertiser=${encodeURIComponent(advertiserId)}`}`,{cache:"no-store"});if(!response.ok)throw new Error();const documents=await response.json();if(active){mergeServerStorage(documents);if(full)allLoaded=true;else loaded.add(key);setReady(key)}})().catch(()=>{if(active)setError("데이터를 불러오지 못했습니다. 다시 시도해 주세요.")});return()=>{active=false}},[key,needed,full,advertiserId]);return !needed||(ready===key&&(allLoaded||loaded.has(key)))?<>{children}</>:error?<section role="alert"><p>{error}</p><button onClick={()=>window.location.reload()}>다시 시도</button></section>:<p role="status">워크스페이스 데이터를 불러오고 있습니다…</p>}
