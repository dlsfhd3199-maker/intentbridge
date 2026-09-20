"use client";
import {useEffect,useRef,useState} from "react";
import {getSession,signIn} from "next-auth/react";
import {AuthFrame} from "@/components/auth/auth-frame";
export function LoginForm({initialMode="login"}:{initialMode?:"login"|"signup"}){
 const [mode,setMode]=useState<"login"|"signup"|"complete">(initialMode),[checking,setChecking]=useState(true),[checkError,setCheckError]=useState(false),[check,setCheck]=useState(0);
 const [email,setEmail]=useState(""),[name,setName]=useState(""),[password,setPassword]=useState(""),[confirm,setConfirm]=useState(""),[show,setShow]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState("");const lock=useRef(false),heading=useRef<HTMLHeadingElement>(null);
 useEffect(()=>{let active=true;setChecking(true);setCheckError(false);getSession().then(session=>{if(!active)return;if(session?.user){window.location.replace("/dashboard");return;}if(new URLSearchParams(window.location.search).has("error"))setMessage("로그인하지 못했습니다. 다시 로그인해주세요.");setChecking(false)}).catch(()=>{if(active){setChecking(false);setCheckError(true)}});return()=>{active=false}},[check]);
 function switchMode(next:typeof mode){setMode(next);setPassword("");setConfirm("");setShow(false);setMessage("");requestAnimationFrame(()=>heading.current?.focus());}
 return <AuthFrame>{checking?<div role="status" className="auth-loading-inline">로그인 상태 확인 중...</div>:checkError?<><h2>로그인 상태를 확인하지 못했습니다.</h2><button className="auth-primary" onClick={()=>setCheck(v=>v+1)}>다시 시도</button></>:mode==="complete"?<><h2 ref={heading} tabIndex={-1}>가입이 완료되었습니다.</h2><p role="status">관리자 승인 후 IntentBridge를 이용할 수 있습니다.</p><button className="auth-primary" onClick={()=>switchMode("login")}>로그인 화면으로</button></>:<><h2 ref={heading} tabIndex={-1}>{mode==="login"?"로그인":"회원가입"}</h2><form className="auth-form auth-credentials" aria-busy={busy} onSubmit={async event=>{
 event.preventDefault();if(lock.current)return;setMessage("");if(mode==="signup"&&password!==confirm){setMessage("비밀번호 확인이 일치하지 않습니다.");return;}
 lock.current=true;setBusy(true);try{
  if(mode==="signup"){
   const response=await fetch("/api/auth/signup",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,email,password,passwordConfirm:confirm})});const result=await response.json();if(!response.ok){setMessage(result.error??"입력 내용을 확인해주세요.");return;}switchMode("complete");
  }else{
   const result=await signIn("credentials",{email,password,redirect:false,redirectTo:"/dashboard"});if(result?.error){setMessage(result.code==="pending"?"관리자 승인 대기 중입니다.":result.code==="disabled"?"사용이 중지된 계정입니다.":"이메일 또는 비밀번호를 확인해주세요.");return;}window.location.replace("/dashboard");
  }
 }catch{setMessage("처리하지 못했습니다. 잠시 후 다시 시도해주세요.");}finally{lock.current=false;setBusy(false)}
 }}>
 {mode==="signup"&&<label>이름<input name="name" autoComplete="name" required maxLength={120} value={name} onChange={e=>setName(e.target.value)} readOnly={busy}/></label>}
 <label>이메일<input name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} readOnly={busy}/></label>
 <label htmlFor="password">비밀번호</label><div className="auth-password"><input id="password" name="password" type={show?"text":"password"} autoComplete={mode==="signup"?"new-password":"current-password"} required minLength={8} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)} readOnly={busy} aria-describedby="password-help"/><button type="button" aria-label={show?"비밀번호 숨기기":"비밀번호 보기"} aria-pressed={show} onClick={()=>setShow(!show)}>{show?"숨기기":"보기"}</button></div>
 {mode==="signup"&&<><p id="password-help" className="auth-help">8자 이상 입력해주세요. 12자 이상을 권장합니다.</p><label>비밀번호 확인<input name="passwordConfirm" type={show?"text":"password"} autoComplete="new-password" required minLength={8} maxLength={128} value={confirm} onChange={e=>setConfirm(e.target.value)} readOnly={busy}/></label></>}
 <p className="auth-error" role="status" aria-live="polite">{message}</p><button className="auth-primary" disabled={busy}>{busy?"처리 중...":mode==="login"?"로그인":"가입하기"}</button>
 </form><p className="auth-switch">{mode==="login"?"계정이 없으신가요?":"이미 계정이 있으신가요?"} <button className="auth-secondary" disabled={busy} onClick={()=>switchMode(mode==="login"?"signup":"login")}>{mode==="login"?"회원가입":"로그인"}</button></p></>}</AuthFrame>;
}
