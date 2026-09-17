import {createHmac,randomBytes} from "node:crypto";
export interface RateLimitStore {consume(key:string,limit:number,windowMs:number):Promise<{allowed:boolean;retryAfter:number}>}
export class MemoryRateLimitStore implements RateLimitStore {
 private entries=new Map<string,{count:number;until:number}>();
 constructor(private now=()=>Date.now()){}
 async consume(key:string,limit:number,windowMs:number){const now=this.now();let row=this.entries.get(key);if(!row||row.until<=now){if(this.entries.size>=10000){for(const [k,v]of this.entries)if(v.until<=now)this.entries.delete(k);if(this.entries.size>=10000)return {allowed:false,retryAfter:60};}row={count:0,until:now+windowMs};this.entries.set(key,row)}row.count++;return {allowed:row.count<=limit,retryAfter:Math.max(1,Math.ceil((row.until-now)/1000))};}
}
const defaults={loginEmail:5,loginIp:30,invite:20,ga4:10,import:10,campaign:120,operation:120};
export type RateAction=keyof typeof defaults;
export function ratePolicy(action:RateAction){const raw=Number(process.env[`RATE_LIMIT_${action.replace(/[A-Z]/g,s=>"_"+s).toUpperCase()}`]??defaults[action]);return {limit:Number.isSafeInteger(raw)&&raw>0?raw:defaults[action],windowMs:60000};}
const salt=process.env.AUTH_SECRET||randomBytes(32).toString("hex");
export const rateKey=(action:RateAction,identity:string)=>`${action}:${createHmac("sha256",salt).update(identity).digest("hex")}`;
