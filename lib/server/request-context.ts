import {AsyncLocalStorage} from "node:async_hooks";
import {randomUUID} from "node:crypto";
const context=new AsyncLocalStorage<{requestId:string;idempotencyKey?:string;fingerprint?:string;authFailureStage?:string}>();
export const requestContext=()=>context.getStore();
export async function withRequest(request:Request,fn:()=>Promise<Response>){const requestId=randomUUID();return context.run({requestId,idempotencyKey:request.headers.get("Idempotency-Key")??undefined},async()=>{const result=await fn();result.headers.set("X-Request-ID",requestId);result.headers.set("Cache-Control","no-store");return result});}
