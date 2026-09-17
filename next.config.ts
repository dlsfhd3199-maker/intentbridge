import type {NextConfig} from "next";
import {securityHeaders,contentSecurityPolicy} from "./lib/security-headers";
const config:NextConfig={poweredByHeader:false,experimental:{authInterrupts:true},async headers(){return [{source:"/:path*",headers:[...securityHeaders,{key:"Content-Security-Policy",value:contentSecurityPolicy(undefined,process.env.NODE_ENV==="development")},...(process.env.APP_ENV==="staging"||process.env.APP_ENV==="production"?[{key:"Strict-Transport-Security",value:"max-age=31536000"}]:[])]}]}};
export default config;
