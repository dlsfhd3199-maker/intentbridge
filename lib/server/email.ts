import {randomUUID} from "node:crypto";
import {log} from "./logger";
import {requestContext} from "./request-context";
export async function sendLoginEmail({identifier,url,provider}:{identifier:string;url:string;provider:{apiKey?:string;from?:string}}){
 const requestId=requestContext()?.requestId??randomUUID();
 try{const safeUrl=url.replaceAll("&","&amp;").replaceAll('"',"&quot;").replaceAll("<","&lt;");
 const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${provider.apiKey}`,"Content-Type":"application/json"},body:JSON.stringify({from:provider.from,to:identifier,subject:"IntentBridge 로그인 요청",text:`IntentBridge 로그인 요청\n\n로그인: ${url}\n\n이 링크는 15분 동안 한 번만 사용할 수 있습니다. 요청하지 않았다면 이 메일을 무시해 주세요.`,html:`<main style="font-family:Arial,sans-serif;color:#172238;padding:32px"><h1>IntentBridge</h1><h2>로그인 요청</h2><p><a href="${safeUrl}" style="display:inline-block;padding:14px 24px;background:#172238;color:white;border-radius:8px">로그인</a></p><p>이 링크는 15분 동안 한 번만 사용할 수 있습니다.</p><p>요청하지 않았다면 이 메일을 무시해 주세요.</p></main>`}),signal:AbortSignal.timeout(10000)});if(!response.ok)throw new Error();
 }catch{log("error","email.delivery_failed",{requestId,errorType:"EmailDeliveryError"});throw new Error("EmailDeliveryError");}
}
