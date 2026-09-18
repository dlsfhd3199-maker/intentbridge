import {log} from "./logger";
import {requestContext} from "./request-context";
import "server-only";
import {auth} from "@/auth";
import {db} from "./database";
import {can,roleFromDatabase} from "../permissions";
import type {Permission,SessionUser,UserRole} from "@/types/auth";
export class AccessError extends Error {constructor(public status:number,message="이 페이지에 접근할 권한이 없습니다.",public retryAfter?:number){super(message);}}
export async function requireUser(){const session=await auth();if(!session?.user?.id)throw new AccessError(401,"로그인이 필요합니다.");const user=await db.user.findUnique({where:{id:session.user.id},include:{members:{where:{advertiser:{status:"ACTIVE"}},select:{advertiserId:true}}}});if(!user||user.status!=="ACTIVE"||!roleFromDatabase(user.role))throw new AccessError(401,"로그인이 필요합니다.");return user;}
export function sessionUser(user:Awaited<ReturnType<typeof requireUser>>):SessionUser {const ids=user.members.map(m=>m.advertiserId);return {id:user.id,email:user.email,name:user.name??"",role:roleFromDatabase(user.role)!,advertiserId:ids[0]??"",advertiserIds:ids,source:"session"};}
export async function requirePermission(permission:Permission){const user=await requireUser();if(!can(sessionUser(user).role,permission))throw new AccessError(403);return user;}
export async function requireRole(role:UserRole){const user=await requireUser();if(sessionUser(user).role!==role)throw new AccessError(403);return user;}
export async function requireAdvertiserAccess(advertiserId:string,permission?:Permission){const user=await requireUser();if(permission&&!can(sessionUser(user).role,permission))throw new AccessError(403);const advertiser=await db.advertiser.findFirst({where:{id:advertiserId,status:"ACTIVE",...(user.role==="SUPER_ADMIN"?{}:{members:{some:{userId:user.id}}})}});if(!advertiser)throw new AccessError(403);return {user,advertiser};}
export function sameOrigin(request:Request){const origin=request.headers.get("origin"),expected=new URL(process.env.AUTH_URL||request.url).origin;if(request.headers.get("sec-fetch-site")==="cross-site"||origin&&origin!==expected)throw new AccessError(403);if(!["GET","HEAD"].includes(request.method)&&!origin)throw new AccessError(403);}
export function apiError(error:unknown){const requestId=requestContext()?.requestId;log(error instanceof AccessError?"warn":"error","api.failed",{requestId,errorType:error instanceof AccessError?`Access${error.status}`:"InternalError"});return Response.json({requestId,error:error instanceof AccessError?error.message:"처리하지 못했습니다. 잠시 후 다시 시도해 주세요."},{status:error instanceof AccessError?error.status:500,headers:{"Cache-Control":"no-store",...(error instanceof AccessError&&error.retryAfter?{"Retry-After":String(error.retryAfter)}:{})}});}
