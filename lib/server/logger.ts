type Level="info"|"warn"|"error";
// Deliberately allowlisted: never accept arbitrary Error, payload, URL, email or headers.
export function log(level:Level,event:string,fields:{requestId?:string;errorType?:string;status?:number}={}){
 const levels={info:0,warn:1,error:2};const threshold=process.env.LOG_LEVEL as Level|undefined;
 if(levels[level]<(levels[threshold??"info"]??0))return;
 const code=(v:string|undefined)=>v?.replace(/[^a-zA-Z0-9_.:-]/g,"").slice(0,100);
 process.stdout.write(JSON.stringify({time:new Date().toISOString(),level,event:code(event),requestId:code(fields.requestId),errorType:code(fields.errorType),status:fields.status})+"\n");
}
