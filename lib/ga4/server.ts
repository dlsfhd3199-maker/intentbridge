import "server-only";
import {BetaAnalyticsDataClient} from "@google-analytics/data";
import {readFile} from "node:fs/promises";
import {isAbsolute} from "node:path";
import {ga4Config} from "./config";
import {GA4Connector,type GA4ReadClient} from "./connector";
import {GA4Error} from "./errors";
const connectors=new Map<string,GA4Connector>();
export function serverGA4(advertiserId:string,propertyId?:string|null){const config=ga4Config(advertiserId,propertyId?{...process.env,GA4_PROPERTY_MAP:JSON.stringify({[advertiserId]:propertyId})}:process.env);const key=JSON.stringify(config);let connector=connectors.get(key);if(!connector){let client:BetaAnalyticsDataClient|undefined;let opening:Promise<BetaAnalyticsDataClient>|undefined;
 const open=async()=>{if(client)return client;if(opening)return opening;opening=(async()=>{if(!isAbsolute(config.keyFilename))throw new GA4Error("AUTHENTICATION_ERROR");let credential:unknown;try{credential=JSON.parse(await readFile(config.keyFilename,"utf8"));}catch{throw new GA4Error("AUTHENTICATION_ERROR");}if(!credential||typeof credential!=="object"||!("type"in credential)||credential.type!=="service_account"||!("client_email"in credential)||typeof credential.client_email!=="string"||!("private_key"in credential)||typeof credential.private_key!=="string")throw new GA4Error("AUTHENTICATION_ERROR");client=new BetaAnalyticsDataClient({credentials:{client_email:credential.client_email,private_key:credential.private_key},scopes:["https://www.googleapis.com/auth/analytics.readonly"]});return client;})();try{return await opening;}finally{opening=undefined;}};
 const adapter:GA4ReadClient={async runReport(request,timeoutMs){const sdk=await open();const [response]=await sdk.runReport(request,{timeout:timeoutMs,retry:null});return response;}};connector=new GA4Connector(config,adapter);if(connectors.size>20)connectors.clear();connectors.set(key,connector);}return {config,connector};}
