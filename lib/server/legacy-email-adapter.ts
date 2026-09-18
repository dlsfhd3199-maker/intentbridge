// Retained for migration reference only. Not registered with the credentials provider.
import type {Adapter,AdapterUser} from "next-auth/adapters";
import {createHash} from "node:crypto";
import {db} from "./database";
import {authOperation} from "./auth-trace";
const hash=(token:string)=>createHash("sha256").update(token).digest("hex");
const asUser=(u:{id:string;email:string;name:string|null;emailVerified:Date|null;image:string|null}):AdapterUser=>({id:u.id,email:u.email,name:u.name,emailVerified:u.emailVerified,image:u.image});
export const legacyEmailAdapter:Adapter={
 async createUser(){throw new Error("Invitation required");},
 async getUser(id){const u=await db.user.findUnique({where:{id}});return u?asUser(u):null;},
 async getUserByEmail(email){const u=await authOperation("user.lookup",()=>db.user.findUnique({where:{email:email.toLowerCase()}}));return u?asUser(u):null;},
 async getUserByAccount(){return null;},
 async updateUser(user){return asUser(await db.user.update({where:{id:user.id},data:{...(user.emailVerified?{emailVerified:user.emailVerified}:{})}}));},
 async createSession(s){await authOperation("session.create",()=>db.session.create({data:{...s,sessionToken:hash(s.sessionToken)}}));return s;},
 async getSessionAndUser(token){const row=await db.session.findUnique({where:{sessionToken:hash(token)},include:{user:true}});if(!row||row.user.status!=="ACTIVE")return null;return {session:{sessionToken:token,userId:row.userId,expires:row.expires},user:asUser(row.user)};},
 async updateSession(s){const row=await db.session.update({where:{sessionToken:hash(s.sessionToken)},data:{expires:s.expires}});return {...row,sessionToken:s.sessionToken};},
 async deleteSession(token){await db.session.deleteMany({where:{sessionToken:hash(token)}});},
 // Auth.js already hashes email verification tokens before calling the adapter.
 async createVerificationToken(token){return authOperation("token.create",()=>db.verificationToken.create({data:token}));},
 async useVerificationToken({identifier,token}){return authOperation("token.consume",()=>db.$transaction(async tx=>{const row=await tx.verificationToken.findUnique({where:{identifier_token:{identifier,token}}});if(!row)return null;const deleted=await tx.verificationToken.deleteMany({where:{identifier,token}});return deleted.count?row:null;}));},
};
