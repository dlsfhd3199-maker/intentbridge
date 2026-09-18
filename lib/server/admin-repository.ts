import {transaction} from "./transaction";
import {boundedString,pagination} from "./input";
import {enforceRate} from "./request-protection";
import {requestContext} from "./request-context";
import "server-only";
import {createHash,randomBytes} from "node:crypto";
import {db} from "./database";
import {AccessError,requirePermission,requireAdvertiserAccess} from "./authorization";
import type {Prisma} from "@prisma/client";
const safeUser={id:true,email:true,name:true,role:true,status:true,createdAt:true,lastLoginAt:true,members:{select:{advertiserId:true}}} as const;
const text=(v:unknown,max=120)=>v===undefined?"":boundedString(v,max);
export async function listUsers(url?:string){await requirePermission("MANAGE_SETTINGS");const status=new URL(url??"http://local").searchParams.get("status");if(status&&!["PENDING","ACTIVE","DISABLED","INVITED"].includes(status))throw new AccessError(400);return db.user.findMany({...pagination(url),where:status?{status}:{},select:safeUser,orderBy:{id:"asc"}});}
export async function changeUser(input:Record<string,unknown>,invite=false){
 const actor=await requirePermission("MANAGE_SETTINGS");if(invite)await enforceRate("invite",actor.id);if(!input||typeof input!=="object")throw new AccessError(400);const role=input.role,status=invite?"INVITED":input.status;
 if(!["ADMIN","ADVERTISER"].includes(String(role))||!["ACTIVE","INVITED","DISABLED"].includes(String(status))||!Array.isArray(input.advertiserIds)||!input.advertiserIds.every(id=>typeof id==="string"))throw new AccessError(400,"사용자 정보를 확인하세요.");
 const ids=[...new Set(input.advertiserIds as string[])];if(ids.length>100)throw new AccessError(400);
 return transaction(async tx=>{
  if(await tx.advertiser.count({where:{id:{in:ids},status:"ACTIVE"}})!==ids.length)throw new AccessError(400,"활성 광고주를 선택하세요.");
  const email=text(input.email,254).toLowerCase();if(invite&&!/^[-a-z0-9._+]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email))throw new AccessError(400,"이메일을 확인하세요.");
  const prior=invite?null:await tx.user.findUnique({where:{id:text(input.id)},select:safeUser});if(!invite&&!prior)throw new AccessError(404);
  if(prior?.status==="PENDING")throw new AccessError(400,"승인 및 광고주 연결 절차를 사용하세요.");
  if(prior?.status==="INVITED"&&status==="ACTIVE")throw new AccessError(400,"초대 사용자는 이메일 확인 후 활성화됩니다.");
  if(!invite&&status==="INVITED"&&prior?.status!=="INVITED")throw new AccessError(400);
  if(prior?.role==="ADMIN"&&prior.status==="ACTIVE"&&(role!=="ADMIN"||status!=="ACTIVE")&&await tx.user.count({where:{role:"ADMIN",status:"ACTIVE"}})<=1)throw new AccessError(409,"최소 1명의 활성 관리자가 필요합니다.");
  if(invite&&await tx.user.findUnique({where:{email}}))throw new AccessError(409,"이미 등록된 이메일입니다. 기존 사용자의 광고주 연결을 수정하세요.");
  const data={name:text(input.name),role:String(role),status:String(status)};
  const user=invite?await tx.user.create({data:{...data,email}}):await tx.user.update({where:{id:prior!.id},data});
  await tx.advertiserMember.deleteMany({where:{userId:user.id}});if(ids.length)await tx.advertiserMember.createMany({data:ids.map(advertiserId=>({userId:user.id,advertiserId}))});
  if(invite)await tx.invitation.create({data:{userId:user.id,tokenHash:createHash("sha256").update(randomBytes(32)).digest("hex"),expiresAt:new Date(Date.now()+7*86400000)}});
  else await tx.session.deleteMany({where:{userId:user.id}});
  const after=await tx.user.findUnique({where:{id:user.id},select:safeUser});
  await tx.auditLog.create({data:{requestId:requestContext()?.requestId,actorUserId:actor.id,action:invite?"USER_INVITED":status==="DISABLED"?"user.disabled":"USER_UPDATED",resource:user.id,...(prior?{before:JSON.parse(JSON.stringify(prior))}:{}),after:JSON.parse(JSON.stringify(after))}});return after;
 },{actor:actor.id,scope:invite?"invite":"user-update",input});
}
export async function listAdvertisers(url?:string){await requirePermission("MANAGE_ADVERTISER");return db.advertiser.findMany({...pagination(url),select:{id:true,name:true,industry:true,productName:true,status:true},orderBy:{id:"asc"}});}
export async function changeAdvertiser(input:Record<string,unknown>,create=false){
 const actor=await requirePermission("MANAGE_ADVERTISER");const name=text(input.name),status=input.status??"ACTIVE";if(!name||!["ACTIVE","DISABLED"].includes(String(status)))throw new AccessError(400,"광고주 정보를 확인하세요.");
 return transaction(async tx=>{const prior=create?null:await tx.advertiser.findUnique({where:{id:text(input.id)}});if(!create&&!prior)throw new AccessError(404);
 const data={name,status:String(status),industry:text(input.industry),productName:text(input.productName)};
 const mockData={...data,source:{uniqueUsers:0,sessions:0,organicUsers:0,paidUsers:0},funnel:{viewContent:0,addToCart:0,beginCheckout:0,directPurchases:0,retargetableAudience:0,recoveredPurchases:0},finance:{gptSpend:0,metaSpend:0,directRevenue:0,recoveredRevenue:0},segments:[{id:"checkout-7d",name:"결제 이탈 7D",volume:0,priority:"high"},{id:"cart-14d",name:"장바구니 이탈 14D",volume:0,priority:"medium"},{id:"view-30d",name:"상품조회 이탈 30D",volume:0,priority:"broad"}]};
 const row=create?await tx.advertiser.create({data:{...data,mockData}}):await tx.advertiser.update({where:{id:prior!.id},data});
 if(create){await tx.advertiserConnection.create({data:{advertiserId:row.id,provider:"ga4"}});await tx.advertiserMember.create({data:{userId:actor.id,advertiserId:row.id,role:"ADMIN"}});}
 await tx.auditLog.create({data:{requestId:requestContext()?.requestId,actorUserId:actor.id,advertiserId:row.id,action:create?"ADVERTISER_CREATED":"ADVERTISER_UPDATED",resource:row.id,...(prior?{before:{name:prior.name,status:prior.status}}:{}),after:data}});return {id:row.id,...data};},{actor:actor.id,scope:create?"advertiser-create":"advertiser-update",input});
}
export async function connection(id:string,input?:Record<string,unknown>){const {user}=await requireAdvertiserAccess(id,"MANAGE_CONNECTIONS");if(!input)return db.advertiserConnection.findMany({where:{advertiserId:id}});
 if(Object.keys(input).some(k=>!["propertyId","dataMode"].includes(k))||input.propertyId!==undefined&&input.propertyId!==null&&!/^\d{1,20}$/.test(String(input.propertyId))||input.dataMode!==undefined&&!["mock","real"].includes(String(input.dataMode)))throw new AccessError(400);
 return transaction(async tx=>{const before=await tx.advertiserConnection.findUnique({where:{advertiserId_provider:{advertiserId:id,provider:"ga4"}}});const data={...(input.propertyId!==undefined?{propertyId:input.propertyId===null?null:String(input.propertyId)}:{}),...(input.dataMode?{dataMode:String(input.dataMode)}:{})};const after=await tx.advertiserConnection.upsert({where:{advertiserId_provider:{advertiserId:id,provider:"ga4"}},create:{advertiserId:id,provider:"ga4",...data},update:data});await tx.auditLog.create({data:{requestId:requestContext()?.requestId,actorUserId:user.id,advertiserId:id,action:"CONNECTION_UPDATED",resource:after.id,...(before?{before:JSON.parse(JSON.stringify(before)) as Prisma.InputJsonValue}:{}),after:JSON.parse(JSON.stringify(after))}});return after;});
}

export async function reviewUser(input:Record<string,unknown>){
 const actor=await requirePermission("MANAGE_SETTINGS"),action=input.action;
 if(!["approve","reject","disable"].includes(String(action)))throw new AccessError(400);
 const id=boundedString(input.id,120,true),advertiserId=action==="approve"?boundedString(input.advertiserId,120,true):undefined;
 return transaction(async tx=>{
  const prior=await tx.user.findUnique({where:{id},select:safeUser});if(!prior)throw new AccessError(404);
  if(action!=="disable"&&!["PENDING","INVITED"].includes(prior.status))throw new AccessError(409,"승인 대기 상태를 다시 확인해주세요.");
  if(prior.role==="ADMIN"&&prior.status==="ACTIVE"&&await tx.user.count({where:{role:"ADMIN",status:"ACTIVE"}})<=1)throw new AccessError(409,"최소 1명의 활성 관리자가 필요합니다.");
  if(action==="approve"){
   if(prior.role!=="ADVERTISER"||!await tx.advertiser.findFirst({where:{id:advertiserId,status:"ACTIVE"}}))throw new AccessError(400,"활성 광고주를 선택하세요.");
   await tx.user.update({where:{id},data:{status:"ACTIVE",role:"ADVERTISER"}});
   await tx.advertiserMember.deleteMany({where:{userId:id}});
   await tx.advertiserMember.create({data:{userId:id,advertiserId:advertiserId!,role:"ADVERTISER"}});
  }else{await tx.user.update({where:{id},data:{status:"DISABLED"}});}
  await tx.session.deleteMany({where:{userId:id}});
  const after=await tx.user.findUnique({where:{id},select:safeUser});
  await tx.auditLog.create({data:{actorUserId:actor.id,requestId:requestContext()?.requestId,action:action==="approve"?"user.approved":action==="reject"?"user.rejected":"user.disabled",resource:id,before:JSON.parse(JSON.stringify(prior)),after:JSON.parse(JSON.stringify(after))}});return after;
 },{actor:actor.id,scope:"user-review",input:{id,action,advertiserId}});
}
