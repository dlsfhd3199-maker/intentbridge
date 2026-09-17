import {deniedHtml} from "./lib/auth-presentation";
import {randomBytes} from "node:crypto";
import {contentSecurityPolicy} from "./lib/security-headers";
import {auth} from "./auth";
import {db} from "./lib/server/database";
import {canAccessRoute} from "./lib/route-permissions";
import {NextResponse} from "next/server";
// Reject before streaming starts, so denial is a real HTTP 403, including RSC requests.
export const proxy=auth(async request=>{
 const nonce=randomBytes(18).toString("base64"),csp=contentSecurityPolicy(nonce,process.env.NODE_ENV==="development"),headers=new Headers(request.headers);headers.set("x-nonce",nonce);headers.set("Content-Security-Policy",csp);const next=()=>{const response=NextResponse.next({request:{headers}});response.headers.set("Content-Security-Policy",csp);return response};if(request.nextUrl.pathname==="/login")return next();
 const id=request.auth?.user?.id;
 const user=id?await db.user.findUnique({where:{id},include:{members:{include:{advertiser:true}}}}):null;
 if(!user||user.status!=="ACTIVE")return NextResponse.redirect(new URL("/login",request.url));
 const advertiserIds=user.members.filter(m=>m.advertiser.status==="ACTIVE").map(m=>m.advertiserId);
 const session={id:user.id,role:user.role==="ADMIN"?"admin" as const:"advertiser" as const,advertiserIds,advertiserId:advertiserIds[0]??"",source:"session" as const};
 const path=request.nextUrl.pathname,detail=path.match(/^\/advertisers\/([^/]+)$/)?.[1],query=request.nextUrl.searchParams.getAll("advertiser");
 let denied=(!detail&&!canAccessRoute(session,path))||query.length>1;
 for(const advertiserId of [...query,...(detail?[detail]:[])]){
  const row=await db.advertiser.findFirst({where:{id:advertiserId,status:"ACTIVE",...(user.role==="ADMIN"?{}:{members:{some:{userId:user.id}}})},select:{id:true}});if(!row)denied=true;
 }
 if(denied)return new NextResponse(deniedHtml,{status:403,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
 return next();
});
export const config={matcher:["/login","/","/funnel/:path*","/performance/:path*","/campaigns/:path*","/operations/:path*","/reports/:path*","/connections/:path*","/advertisers/:path*","/settings/:path*"]};
