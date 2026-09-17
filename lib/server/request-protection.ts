import "server-only";
import {db} from "./database";
import {AccessError} from "./authorization";
import {MemoryRateLimitStore,rateKey,ratePolicy,type RateAction,type RateLimitStore} from "./rate-limit";
import {readEnvironment} from "./env";
const memory=new MemoryRateLimitStore();
const database:RateLimitStore={async consume(key,limit,windowMs){const slot=Math.floor(Date.now()/windowMs),id=`${key}:${slot}`;const row=await db.rateLimitBucket.upsert({where:{id},create:{id,count:1,expiresAt:new Date((slot+1)*windowMs)},update:{count:{increment:1}}});return {allowed:row.count<=limit,retryAfter:Math.max(1,Math.ceil(((slot+1)*windowMs-Date.now())/1000))};}};
export async function enforceRate(action:RateAction,identity:string){const config=readEnvironment(),policy=ratePolicy(action);const result=await(config.rateStore==="database"?database:memory).consume(rateKey(action,identity),policy.limit,policy.windowMs);if(!result.allowed)throw new AccessError(429,`요청이 많습니다. ${result.retryAfter}초 후 다시 시도해 주세요.`,result.retryAfter);}
export function clientAddress(request:Request){return readEnvironment().trustProxy?request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()||"unavailable":"untrusted-proxy";}
