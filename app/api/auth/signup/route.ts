import {db} from "@/lib/server/database";
import {sameOrigin,apiError,AccessError} from "@/lib/server/authorization";
import {withRequest,requestContext} from "@/lib/server/request-context";
import {enforceRate,clientAddress} from "@/lib/server/request-protection";
import {jsonInput,boundedString} from "@/lib/server/input";
import {hashPassword,passwordProblem,normalizeEmail,validEmail} from "@/lib/password";
export const runtime="nodejs";
export async function POST(request:Request){return withRequest(request,async()=>{try{
 sameOrigin(request);await enforceRate("signupIp",clientAddress(request));const input=await jsonInput(request,4096);
 if(Object.keys(input).some(key=>!["name","email","password","passwordConfirm"].includes(key)))throw new AccessError(400,"입력 내용을 확인해주세요.");
 const name=boundedString(input.name,120,true),email=normalizeEmail(input.email);
 if(!validEmail(email))throw new AccessError(400,"입력 내용을 확인해주세요.");
 await enforceRate("signupEmail",email);const problem=passwordProblem(input.password);if(problem)throw new AccessError(400,problem);
 if(input.password!==input.passwordConfirm)throw new AccessError(400,"비밀번호 확인이 일치하지 않습니다.");
 const passwordHash=await hashPassword(input.password as string);
 try{await db.$transaction(async tx=>{const user=await tx.user.create({data:{name,email,passwordHash,role:"ADVERTISER",status:"PENDING"}});await tx.auditLog.create({data:{actorUserId:user.id,requestId:requestContext()?.requestId,action:"signup",resource:user.id,after:{status:"PENDING",role:"ADVERTISER"}}});});}
 catch(error){if((error as {code?:string}).code==="P2002")throw new AccessError(409,"이미 가입된 이메일입니다.");throw error;}
 return Response.json({status:"PENDING"},{status:201});
 }catch(error){return apiError(error);}});}
