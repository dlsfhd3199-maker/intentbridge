import {withRequest} from "@/lib/server/request-context";
import {enforceRate} from "@/lib/server/request-protection";
import {requireAdvertiserAccess,requirePermission,apiError,sameOrigin} from "@/lib/server/authorization";
import {db} from "@/lib/server/database";
import {NextRequest,NextResponse} from "next/server";
import {serverGA4} from "@/lib/ga4/server";
import {GA4Error,safeGA4Error} from "@/lib/ga4/errors";

import type {Period} from "@/types/domain";
export const runtime="nodejs";
export const dynamic="force-dynamic";
async function handle(request:NextRequest,test=false){
 try{sameOrigin(request);const send=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
 const p=request.nextUrl.searchParams,id=p.get("advertiser")??"brand-a",period=Number(p.get("period")??30);if(![7,14,30].includes(period))return send({error:{code:"INVALID_PROPERTY",message:"광고주와 기간을 확인하세요."}},400);
 const {user}=await requireAdvertiserAccess(id);if(test||p.has('mode'))await requirePermission('MANAGE_CONNECTIONS');if(test)await enforceRate('ga4',user.id);
 const mapping=await db.advertiserConnection.findUnique({where:{advertiserId_provider:{advertiserId:id,provider:'ga4'}}});
 const {config,connector}=serverGA4(id,mapping?.propertyId);const override=p.get("mode");if(override!==null&&!["mock","real"].includes(override))return send({error:{code:"API_ERROR",message:"Data Mode를 확인하세요."}},400);const mode=override??mapping?.dataMode??config.dataMode;
 if(!test&&p.get("action")==="status")return send({mode,connection:user.role==="SUPER_ADMIN"?connector.getConnectionStatus():{status:connector.getConnectionStatus().status,propertyId:null,lastTested:null,readOnly:true,quotaRemaining:null}});
 if(mode==="mock"&&!test)return send({mode,connection:user.role==="SUPER_ADMIN"?connector.getConnectionStatus():{status:connector.getConnectionStatus().status,propertyId:null,lastTested:null,readOnly:true,quotaRemaining:null}});
 if(config.invalid||!config.propertyId||!config.keyFilename)return send({mode,connection:user.role==="SUPER_ADMIN"?connector.getConnectionStatus():{status:connector.getConnectionStatus().status,propertyId:null,lastTested:null,readOnly:true,quotaRemaining:null},error:safeGA4Error(new GA4Error(config.invalid?"INVALID_PROPERTY":"MISSING_CONFIGURATION"))});
 // Keep the existing local-only real GA4 boundary in this phase.
 if(process.env.NODE_ENV==="production"||!["localhost","127.0.0.1","[::1]"].includes(request.nextUrl.hostname))return send({mode,connection:user.role==="SUPER_ADMIN"?connector.getConnectionStatus():{status:connector.getConnectionStatus().status,propertyId:null,lastTested:null,readOnly:true,quotaRemaining:null},error:{code:"API_ERROR",message:"실제 GA4 조회는 로컬 개발 서버에서만 허용됩니다. 현재 단계에서는 운영 환경의 실제 조회를 확대하지 않습니다."}},403);
 try{if(test)return send({mode,connection:await connector.testConnection()});const snapshot=await connector.snapshot({advertiserId:id,period:period as Period});const publicSnapshot=Object.fromEntries(Object.entries(snapshot).filter(([key])=>!["propertyId","quotaRemaining"].includes(key)));return send({mode,connection:user.role==="SUPER_ADMIN"?connector.getConnectionStatus():{status:connector.getConnectionStatus().status,propertyId:null,lastTested:null,readOnly:true,quotaRemaining:null},snapshot:user.role==="SUPER_ADMIN"?snapshot:publicSnapshot});}catch(e){return send({mode,connection:user.role==="SUPER_ADMIN"?connector.getConnectionStatus():{status:connector.getConnectionStatus().status,propertyId:null,lastTested:null,readOnly:true,quotaRemaining:null},error:safeGA4Error(e)});}
 }catch(e){return apiError(e)}
}
export async function GET(request:NextRequest){return withRequest(request,()=>handle(request));}
export async function POST(request:NextRequest){return withRequest(request,()=>handle(request,true));}
