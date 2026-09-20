"use client";
import {useCallback,useEffect,useState} from 'react';
import type {PlatformView} from '@/types/platform';
export function usePlatform(id:string){
 const [view,setView]=useState<PlatformView|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const reload=useCallback(async()=>{const response=await fetch(`/api/workspaces/${encodeURIComponent(id)}/platform`,{cache:'no-store'});const body=await response.json();if(!response.ok)throw new Error(body.error||'플랫폼 설정을 불러오지 못했습니다.');setView(body);return body as PlatformView;},[id]);
 useEffect(()=>{let active=true;setView(null);setError('');const load=()=>{fetch(`/api/workspaces/${encodeURIComponent(id)}/platform`,{cache:'no-store'}).then(async r=>{const body=await r.json();if(!r.ok)throw new Error(body.error||'설정을 불러오지 못했습니다.');if(active)setView(body);}).catch(e=>{if(active)setError(e.message);});};load();window.addEventListener('intentbridge-platform',load);return()=>{active=false;window.removeEventListener('intentbridge-platform',load);};},[id]);
 const save=async(input:Record<string,unknown>)=>{if(!view||busy)return false;setBusy(true);setError('');try{const response=await fetch(`/api/workspaces/${encodeURIComponent(id)}/platform`,{method:'PATCH',headers:{'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID()},body:JSON.stringify({...input,revision:view.revision})});const body=await response.json();if(!response.ok)throw new Error(body.error||'저장하지 못했습니다.');await reload();window.dispatchEvent(new Event('intentbridge-platform'));return true;}catch(e){setError((e as Error).message);return false;}finally{setBusy(false);}};
 return {view,error,busy,save,reload};
}
