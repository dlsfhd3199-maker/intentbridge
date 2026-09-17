import {defaultFunnelEvents,defaultSourceRules,type SourceRules} from "./definitions";
import type {AdvertiserConnection,FunnelEventMapping} from "../../types/ga4";
export interface GA4ServerConfig extends AdvertiserConnection { keyFilename:string; events:FunnelEventMapping; sourceRules:SourceRules; invalid:boolean }
// Pure config parser for injected tests. Only server.ts supplies process.env.
export function ga4Config(advertiserId:string,env:Record<string,string|undefined>):GA4ServerConfig {
 let propertyId:string|null=null,invalid=false;
 try{if(env.GA4_PROPERTY_MAP){const map:unknown=JSON.parse(env.GA4_PROPERTY_MAP);if(!map||typeof map!=="object"||Array.isArray(map))throw new Error();const id=(map as Record<string,unknown>)[advertiserId];if(id!==undefined&&typeof id!=="string")throw new Error();propertyId=typeof id==="string"?id:null;}else if(advertiserId==="brand-a")propertyId=env.GA4_PROPERTY_ID||null;}catch{invalid=true;}
 if(propertyId&&!/^\d+$/.test(propertyId)){invalid=true;propertyId=null;}
 const list=(name:string,fallback:string[])=>env[name]?.trim()?env[name]!.split(",").map(s=>s.trim().toLowerCase()).filter(Boolean):fallback;
 return {advertiserId,analyticsProvider:"ga4",propertyId,dataMode:env.GA4_DATA_MODE==="real"?"real":"mock",keyFilename:env.GOOGLE_APPLICATION_CREDENTIALS??"",events:{...defaultFunnelEvents},sourceRules:{aliases:list("CHATGPT_SOURCE_ALIASES",defaultSourceRules.aliases),paidMediums:list("CHATGPT_PAID_MEDIUMS",defaultSourceRules.paidMediums),organicMediums:list("CHATGPT_ORGANIC_MEDIUMS",defaultSourceRules.organicMediums)},invalid};
}
