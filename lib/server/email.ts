import {authTrace,authFailure} from "./auth-trace";
export async function sendLoginEmail({identifier,url,provider}:{identifier:string;url:string;provider:{apiKey?:string;from?:string}}){
 let status:number|undefined;
 authTrace("auth.email.send.started","email.send");
 try{const safeUrl=url.replaceAll("&","&amp;").replaceAll('"',"&quot;").replaceAll("<","&lt;");
 const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${provider.apiKey}`,"Content-Type":"application/json"},body:JSON.stringify({from:provider.from,to:identifier,subject:"IntentBridge 로그인 요청",text:`IntentBridge 로그인 요청\n\n로그인: ${url}\n\n이 링크는 15분 동안 한 번만 사용할 수 있습니다. 요청하지 않았다면 이 메일을 무시해 주세요.`,html:`<main style="font-family:Arial,sans-serif;color:#172238;padding:32px"><h1>IntentBridge</h1><h2>로그인 요청</h2><p><a href="${safeUrl}" style="display:inline-block;padding:14px 24px;background:#172238;color:white;border-radius:8px">로그인</a></p><p>이 링크는 15분 동안 한 번만 사용할 수 있습니다.</p><p>요청하지 않았다면 이 메일을 무시해 주세요.</p></main>`}),signal:AbortSignal.timeout(10000)});status=response.status;if(!response.ok){const error=new Error("Email delivery failed");error.name="EmailDeliveryError";throw error;}
 authTrace("auth.email.send.completed","email.send");
 }catch(error){authFailure("auth.email.send.failed","email.send",error,status);const failure=new Error("EmailDeliveryError",{cause:error});failure.name="EmailDeliveryError";throw failure;}
}
