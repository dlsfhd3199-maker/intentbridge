import "server-only";
import {createHash} from "node:crypto";
import type {Prisma} from "@prisma/client";
import {db} from "./database";
import {AccessError} from "./authorization";
import {requestContext} from "./request-context";
export async function transaction<T>(fn:(tx:Prisma.TransactionClient)=>Promise<T>,identity?:{actor:string;scope:string;input:unknown}){
 const key=requestContext()?.idempotencyKey;
 if(key&&(!/^[a-zA-Z0-9:_-]{8,120}$/.test(key)))throw new AccessError(400,"Idempotency Key를 확인하세요.");
 const receipt=key&&identity?createHash("sha256").update(`${identity.actor}:${identity.scope}:${key}`).digest("hex"):null;
 const hash=identity?createHash("sha256").update(JSON.stringify(identity.input)).digest("hex"):"";
 for(let attempt=0;;attempt++){try{return await db.$transaction(async tx=>{
  if(receipt){const old=await tx.mutationReceipt.findUnique({where:{id:receipt}});if(old){if(old.payloadHash!==hash)throw new AccessError(409,"동일 요청 키의 내용이 다릅니다.");return old.result as T;}}
  const result=await fn(tx);
  if(receipt)await tx.mutationReceipt.create({data:{id:receipt,payloadHash:hash,result:JSON.parse(JSON.stringify(result)),expiresAt:new Date(Date.now()+7*86400000)}});
  return result;
 },{isolationLevel:"Serializable",timeout:20000,maxWait:10000});}catch(e){const code=(e as {code?:string})?.code;if(attempt<3&&["P2034","P2002","P1008"].includes(code??"")){await new Promise(r=>setTimeout(r,30*(attempt+1)));continue;}throw e;}}
}
