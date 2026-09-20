"use client";
import {createContext,useContext,useEffect,useState} from 'react';
const SessionContext=createContext(false);
// Only the entry links need client state. No workspace/bootstrap or advertising requests.
export function PublicSession({children}:{children:React.ReactNode}){
 const [signedIn,setSignedIn]=useState(false);
 useEffect(()=>{const controller=new AbortController();fetch('/api/auth/session',{cache:'no-store',signal:controller.signal}).then(r=>r.ok?r.json():null).then(s=>setSignedIn(!!s?.user?.id)).catch(()=>{});return()=>controller.abort();},[]);
 return <SessionContext.Provider value={signedIn}>{children}</SessionContext.Provider>;
}
export function EntryLink({short=false,secondary=false}:{short?:boolean;secondary?:boolean}){
 const signedIn=useContext(SessionContext);
 if(signedIn&&secondary)return null;
 return <a className={secondary?'pw-login':'pw-button'} href={signedIn?'/dashboard':secondary?'/login':'/signup'}>{signedIn?'대시보드로 이동':secondary?'로그인':short?'시작하기':'IntentBridge 시작하기'}{!secondary&&<span aria-hidden="true"> ↗</span>}</a>;
}
