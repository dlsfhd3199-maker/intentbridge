"use client";
import {createContext,useContext,useEffect,useState} from 'react';
const SessionContext=createContext(false);
// Only the entry links need client state. No workspace/bootstrap or advertising requests.
export function PublicSession({children}:{children:React.ReactNode}){
 const [signedIn,setSignedIn]=useState(false);
 useEffect(()=>{const controller=new AbortController();fetch('/api/auth/session',{cache:'no-store',signal:controller.signal}).then(r=>r.ok?r.json():null).then(s=>setSignedIn(!!s?.user?.id)).catch(()=>{});return()=>controller.abort();},[]);
 return <SessionContext.Provider value={signedIn}>{children}</SessionContext.Provider>;
}
// A future demo workspace can replace this target without changing session handling.
export const publicEntryTargets={experience:'#product',workspace:'/dashboard',login:'/login'};
export function EntryLink({secondary=false}:{secondary?:boolean}){
 const signedIn=useContext(SessionContext);
 const href=secondary?(signedIn?publicEntryTargets.experience:publicEntryTargets.login):(signedIn?publicEntryTargets.workspace:publicEntryTargets.experience);
 const label=secondary?(signedIn?'제품 살펴보기':'로그인'):(signedIn?'내 Workspace 열기':'제품 체험하기');
 return <a className={secondary?'pw-login':'pw-button'} href={href}>{label}{!secondary&&<span aria-hidden="true"> ↗</span>}</a>;
}
