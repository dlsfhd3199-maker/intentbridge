export type AppEnvironment="development"|"staging"|"production";
export function readEnvironment(source:Record<string,string|undefined>=process.env){
 const appEnv=source.APP_ENV??(source.NODE_ENV==="production"?"production":"development");
 if(!["development","staging","production"].includes(appEnv))throw new Error("Configuration Error: APP_ENV");
 const deployed=appEnv!=="development";
 return {appEnv:appEnv as AppEnvironment,deployed,databaseUrl:source.DATABASE_URL,authUrl:source.AUTH_URL,authSecret:source.AUTH_SECRET,emailKey:source.RESEND_API_KEY||source.AUTH_RESEND_KEY,emailFrom:source.AUTH_EMAIL_FROM,logLevel:source.LOG_LEVEL??"info",rateStore:source.RATE_LIMIT_STORE??"memory",trustProxy:source.TRUST_PROXY_IP==="true",auditDays:Number(source.AUDIT_RETENTION_DAYS??365),alertDays:Number(source.ALERT_RETENTION_DAYS??90)};
}
export function validateEnvironment(source:Record<string,string|undefined>=process.env){
 const config=readEnvironment(source),missing:string[]=[];
 if(config.deployed){if(!config.databaseUrl||!/^postgres(ql)?:\/\//.test(config.databaseUrl))missing.push("DATABASE_URL (PostgreSQL)");if(!config.authSecret||config.authSecret.length<32)missing.push("AUTH_SECRET (32+ characters)");try{if(new URL(config.authUrl??"").protocol!=="https:")missing.push("AUTH_URL (HTTPS)")}catch{missing.push("AUTH_URL (HTTPS)")}if(!config.emailKey)missing.push("RESEND_API_KEY");if(!config.emailFrom||!/@/.test(config.emailFrom))missing.push("AUTH_EMAIL_FROM");}
 if(!["info","warn","error"].includes(config.logLevel))missing.push("LOG_LEVEL");
 if(!["memory","database"].includes(config.rateStore))missing.push("RATE_LIMIT_STORE");
 if(config.appEnv==="production"&&config.rateStore!=="database")missing.push("RATE_LIMIT_STORE (shared database required)");
 if(![config.auditDays,config.alertDays].every(n=>Number.isInteger(n)&&n>0))missing.push("RETENTION_DAYS");
 if(missing.length)throw new Error(`Configuration Error: ${missing.join(", ")}`);
 return config;
}
