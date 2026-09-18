import NextAuth,{CredentialsSignin} from "next-auth";
import Credentials from "next-auth/providers/credentials";
import {createHash,randomBytes} from "node:crypto";
import {db} from "./lib/server/database";
import {readEnvironment} from "./lib/server/env";
import {authFailure,authTrace} from "./lib/server/auth-trace";
import {requestContext} from "./lib/server/request-context";
import {normalizeEmail,validEmail,verifyPassword} from "./lib/password";
import {transaction} from "./lib/server/transaction";
class PendingUser extends CredentialsSignin {code="pending";}
class DisabledUser extends CredentialsSignin {code="disabled";}
const digest=(value:string)=>createHash("sha256").update(value).digest("hex");
const maxAge=8*60*60;
const devSecret=readEnvironment().appEnv==="development"?(process.env.AUTH_SECRET ||= randomBytes(48).toString("hex")):undefined;
async function failed(reason:string,userId?:string){
 await db.auditLog.create({data:{actorUserId:userId??"anonymous",requestId:requestContext()?.requestId,action:"login.failed",resource:"authentication",after:{reason}}});
 authTrace("auth.login.denied","credentials",reason);
}
export const {handlers,auth,signIn,signOut}=NextAuth({
 useSecureCookies:readEnvironment().deployed||process.env.AUTH_URL?.startsWith("https://"),secret:process.env.AUTH_SECRET||devSecret,trustHost:true,
 // Auth.js Credentials supports JWT. Native encrypted cookies plus the existing
 // Session table provide immediate server-side revocation without custom JWT encoding.
 session:{strategy:"jwt",maxAge},pages:{signIn:"/login",error:"/login?error=1"},
 providers:[Credentials({credentials:{email:{type:"email"},password:{type:"password"}},async authorize(credentials){
  const email=normalizeEmail(credentials.email),password=credentials.password;
  if(!validEmail(email)||typeof password!=="string"||password.length<8||password.length>128){await failed("invalid_credentials");return null;}
  const user=await db.user.findUnique({where:{email}});
  if(!await verifyPassword(user?.passwordHash??null,password)){await failed("invalid_credentials");return null;}
  if(user!.status!=="ACTIVE"){
   await failed(user!.status==="DISABLED"?"disabled":"pending",user!.id);
   if(user!.status==="DISABLED")throw new DisabledUser();throw new PendingUser();
  }
  return {id:user!.id,email:user!.email,name:user!.name};
 }})],
 callbacks:{
  async jwt({token,user}){
   if(user){
    const sessionId=randomBytes(32).toString("hex");
    const valid=await transaction(async tx=>{
     const current=await tx.user.findUnique({where:{id:user.id}});if(!current||current.status!=="ACTIVE")return false;
     await tx.session.create({data:{sessionToken:digest(sessionId),userId:current.id,expires:new Date(Date.now()+maxAge*1000)}});
     await tx.user.update({where:{id:current.id},data:{lastLoginAt:new Date()}});
     await tx.auditLog.create({data:{actorUserId:current.id,requestId:requestContext()?.requestId,action:"login.success",resource:"authentication"}});return true;
    });
    if(!valid)return null;token.sub=user.id;token.sessionId=sessionId;
   }
   if(typeof token.sessionId!=="string"||!token.sub)return null;
   const record=await db.session.findUnique({where:{sessionToken:digest(token.sessionId)},include:{user:{select:{status:true}}}});
   if(!record||record.userId!==token.sub||record.expires<=new Date()||record.user.status!=="ACTIVE")return null;
   return token;
  },
  async session({session,token}){session.user={...session.user,id:token.sub!};return session;},
 },
 events:{async signOut(message){if("token" in message&&typeof message.token?.sessionId==="string")await db.session.deleteMany({where:{sessionToken:digest(message.token.sessionId)}});}},
 logger:{error(error){authFailure("auth.failed",requestContext()?.authFailureStage??"auth.handler",error);},warn(){},debug(){}},
});
