import {readEnvironment} from "./lib/server/env";
import {sendLoginEmail} from "./lib/server/email";
import {log} from "./lib/server/logger";
import {requestContext} from "./lib/server/request-context";
import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";
import type {Adapter,AdapterUser} from "next-auth/adapters";
import {createHash,randomBytes} from "node:crypto";
import {db} from "./lib/server/database";
const hash=(token:string)=>createHash("sha256").update(token).digest("hex");
const asUser=(u:{id:string;email:string;name:string|null;emailVerified:Date|null;image:string|null}):AdapterUser=>({id:u.id,email:u.email,name:u.name,emailVerified:u.emailVerified,image:u.image});
const adapter:Adapter={
 async createUser(){throw new Error("Invitation required");},
 async getUser(id){const u=await db.user.findUnique({where:{id}});return u?asUser(u):null;},
 async getUserByEmail(email){const u=await db.user.findUnique({where:{email:email.toLowerCase()}});return u?asUser(u):null;},
 async getUserByAccount(){return null;},
 async updateUser(user){return asUser(await db.user.update({where:{id:user.id},data:{...(user.emailVerified?{emailVerified:user.emailVerified}:{})}}));},
 async createSession(s){await db.session.create({data:{...s,sessionToken:hash(s.sessionToken)}});return s;},
 async getSessionAndUser(token){const row=await db.session.findUnique({where:{sessionToken:hash(token)},include:{user:true}});if(!row||row.user.status!=="ACTIVE")return null;return {session:{sessionToken:token,userId:row.userId,expires:row.expires},user:asUser(row.user)};},
 async updateSession(s){const row=await db.session.update({where:{sessionToken:hash(s.sessionToken)},data:{expires:s.expires}});return {...row,sessionToken:s.sessionToken};},
 async deleteSession(token){await db.session.deleteMany({where:{sessionToken:hash(token)}});},
 // Auth.js already hashes email verification tokens before calling the adapter.
 async createVerificationToken(token){return db.verificationToken.create({data:token});},
 async useVerificationToken({identifier,token}){return db.$transaction(async tx=>{const row=await tx.verificationToken.findUnique({where:{identifier_token:{identifier,token}}});if(!row)return null;const deleted=await tx.verificationToken.deleteMany({where:{identifier,token}});return deleted.count?row:null;});},
};
const devSecret=readEnvironment().appEnv==="development"?(process.env.AUTH_SECRET ||= randomBytes(48).toString("hex")):undefined;
export const {handlers,auth,signIn,signOut}=NextAuth({
 useSecureCookies:readEnvironment().deployed||process.env.AUTH_URL?.startsWith("https://"),adapter,secret:process.env.AUTH_SECRET||devSecret,trustHost:true,session:{strategy:"database",maxAge:8*60*60,updateAge:60*30},
 pages:{signIn:"/login",verifyRequest:"/login?sent=1",error:"/login?error=1"},
 providers:[Resend({sendVerificationRequest:sendLoginEmail,apiKey:process.env.RESEND_API_KEY||process.env.AUTH_RESEND_KEY,from:process.env.AUTH_EMAIL_FROM||"IntentBridge <login@example.invalid>",maxAge:15*60,normalizeIdentifier(email){const value=email.trim().toLowerCase();if(value.length>254||!/^[-a-z0-9._+]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(value))throw new Error("Invalid email");return value;}})],
 callbacks:{
  async signIn({user}){if(!user.email)return false;const u=await db.user.findUnique({where:{email:user.email.toLowerCase()},include:{invitations:true}});return !!u&&(u.status==="ACTIVE"||u.status==="INVITED"&&u.invitations.some(i=>!i.acceptedAt&&i.expiresAt>new Date()));},
  async session({session,user}){session.user={...session.user,id:user.id};return session;},
 },
 events:{async signIn({user}){await db.$transaction([db.user.updateMany({where:{id:user.id,status:{in:["ACTIVE","INVITED"]}},data:{status:"ACTIVE",lastLoginAt:new Date()}}),db.invitation.updateMany({where:{userId:user.id,acceptedAt:null},data:{acceptedAt:new Date()}})]);}},
 logger:{error(){log("error","auth.failed",{requestId:requestContext()?.requestId,errorType:"AuthenticationError"});},warn(){},debug(){}},
});
