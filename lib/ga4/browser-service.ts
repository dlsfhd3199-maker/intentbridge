import {assertAccess,currentUser,can} from "../permissions";
import type {Query} from "../../types/domain";
import type {DataMode,GA4Envelope} from "../../types/ga4";
export async function readGA4(query:Query,mode?:DataMode,action:"status"|"snapshot"|"test"="snapshot"):Promise<GA4Envelope>{
 assertAccess(query.advertiserId,action==="test"?"MANAGE_CONNECTIONS":undefined);
 const params=new URLSearchParams({advertiser:query.advertiserId,period:String(query.period),action});if(mode&&can(currentUser().role,"MANAGE_CONNECTIONS"))params.set("mode",mode);
 const response=await fetch(`/api/ga4?${params}`,{method:action==="test"?"POST":"GET",cache:"no-store",signal:AbortSignal.timeout(40000)});
 const body:unknown=await response.json();if(!body||typeof body!=="object"||!("connection"in body)||!("mode"in body))throw new Error("GA4 서버 상태를 확인하지 못했습니다.");return body as GA4Envelope;
}
